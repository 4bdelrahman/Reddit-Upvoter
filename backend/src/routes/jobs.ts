import { Router, Request, Response } from 'express';
import { query, queryOne, log } from '../db/client';
import { Job, Account } from '../types';
import { findTargetComments } from '../workers/commentFinder';
import { scheduleUpvoteTasks, cancelJobTasks } from '../queue/bullmq';

const router = Router();

/**
 * POST /jobs
 * Create a new upvote job for a Reddit post URL.
 * Body: { postUrl: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { postUrl } = req.body;

    if (!postUrl || typeof postUrl !== 'string') {
      res.status(400).json({ error: 'postUrl is required and must be a string' });
      return;
    }

    // Validate it looks like a Reddit URL
    if (!postUrl.includes('reddit.com')) {
      res.status(400).json({ error: 'postUrl must be a valid Reddit URL' });
      return;
    }

    // Fetch known usernames from accounts table
    const accounts = await query<Account>(
      `SELECT * FROM accounts WHERE status = 'active' ORDER BY slot`
    );

    if (accounts.length === 0) {
      res.status(400).json({ error: 'No active accounts configured. Add accounts first.' });
      return;
    }

    const knownUsernames = accounts.map((a) => a.username);

    // Build cookie string from the first active account to bypass 403 blocks
    let cookieString = '';
    if (accounts[0] && Array.isArray(accounts[0].cookies)) {
      cookieString = accounts[0].cookies
        .map((c: any) => `${c.name}=${c.value}`)
        .join('; ');
    }

    // Find target comments (comments by our accounts)
    let comments;
    try {
      comments = await findTargetComments(postUrl, knownUsernames, cookieString);
    } catch (err: any) {
      await log(`Failed to fetch comments from ${postUrl}: ${err.message}`, 'error');
      res.status(502).json({ error: `Failed to fetch Reddit comments: ${err.message}` });
      return;
    }

    // Detect target user (the post author) from the URL or first non-account comment
    let targetUser: string | null = null;
    try {
      const urlMatch = postUrl.match(/\/user\/([^/]+)/);
      if (urlMatch) {
        targetUser = urlMatch[1];
      }
    } catch {
      // Not critical
    }

    // Create the job row
    const jobRows = await query<Job>(
      `INSERT INTO jobs (post_url, target_user, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [postUrl, targetUser]
    );

    const job = jobRows[0];

    await log(`Job created for ${postUrl} — found ${comments.length} target comments`, 'info', job.id);

    if (comments.length === 0) {
      await query(`UPDATE jobs SET status = 'done', completed_at = NOW() WHERE id = $1`, [job.id]);
      await log('No comments by our accounts found on this post', 'info', job.id);

      res.status(201).json({
        ...job,
        status: 'done',
        comments_found: 0,
        message: 'No comments by configured accounts found on this post',
      });
      return;
    }

    // Schedule upvote tasks
    await scheduleUpvoteTasks(job.id, postUrl, comments, accounts);

    // Reload job to get updated status
    const updatedJob = await queryOne<Job>(`SELECT * FROM jobs WHERE id = $1`, [job.id]);

    res.status(201).json({
      ...updatedJob,
      comments_found: comments.length,
      accounts_used: accounts.length,
    });
  } catch (err: any) {
    console.error('POST /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /jobs
 * List all jobs with upvote progress counts.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const jobs = await query<
      Job & { total_tasks: string; done_tasks: string; failed_tasks: string; scheduled_tasks: string }
    >(`
      SELECT
        j.*,
        COALESCE(t.total, 0)::text AS total_tasks,
        COALESCE(t.done, 0)::text AS done_tasks,
        COALESCE(t.failed, 0)::text AS failed_tasks,
        COALESCE(t.scheduled, 0)::text AS scheduled_tasks
      FROM jobs j
      LEFT JOIN (
        SELECT
          job_id,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'done') AS done,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled
        FROM upvote_tasks
        GROUP BY job_id
      ) t ON t.job_id = j.id
      ORDER BY j.created_at DESC
    `);

    res.json(jobs);
  } catch (err: any) {
    console.error('GET /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /jobs/:id
 * Get a single job with its upvote_tasks timeline.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await queryOne<Job>(`SELECT * FROM jobs WHERE id = $1`, [id]);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const tasks = await query(
      `SELECT * FROM upvote_tasks WHERE job_id = $1 ORDER BY scheduled_at ASC`,
      [id]
    );

    res.json({ ...job, tasks });
  } catch (err: any) {
    console.error('GET /jobs/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /jobs/:id
 * Cancel a job: remove pending BullMQ jobs and update status.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await queryOne<Job>(`SELECT * FROM jobs WHERE id = $1`, [id]);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Try to cancel pending BullMQ jobs (non-fatal if Redis is down)
    let removed = 0;
    try {
      removed = await cancelJobTasks(id);
    } catch (queueErr: any) {
      console.warn('Could not cancel BullMQ tasks (Redis may be down):', queueErr.message);
      // Still proceed — we'll clean up the DB rows regardless
    }

    // Delete associated upvote_tasks first (cascade should handle this, but be explicit)
    await query(`DELETE FROM upvote_tasks WHERE job_id = $1`, [id]);

    // Delete the job row entirely
    await query(`DELETE FROM jobs WHERE id = $1`, [id]);

    await log(`Job deleted — removed ${removed} pending tasks from queue`, 'info');

    res.json({
      message: 'Job deleted',
      removed_tasks: removed,
    });
  } catch (err: any) {
    console.error('DELETE /jobs/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
