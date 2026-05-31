import { Queue, Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { query, log } from '../db/client';
import { QueueJobData, Account, RedditComment } from '../types';
import { launchBrowser, createContextWithCookies, closeBrowser } from '../automation/browser';
import { upvoteComment } from '../automation/upvote';
import { randomDelay } from '../automation/humanBehavior';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse the Redis URL into a connection config that BullMQ accepts natively.
// This avoids ioredis version mismatches between the standalone package and BullMQ's bundled copy.
function parseRedisConnection(): { host: string; port: number; password?: string; username?: string; tls?: {} } {
  try {
    const url = new URL(redisUrl);
    const config: any = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      maxRetriesPerRequest: null,
    };
    if (url.password) config.password = decodeURIComponent(url.password);
    if (url.username && url.username !== 'default') config.username = decodeURIComponent(url.username);
    if (url.protocol === 'rediss:') config.tls = {};
    return config;
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisConnection();

// ─── Queue ──────────────────────────────────────────────────────────────────
export const upvoteQueue = new Queue<QueueJobData>('upvote-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 minute initial backoff
    },
    removeOnComplete: { age: 86400, count: 1000 }, // keep 24h or 1000 completed
    removeOnFail: { age: 604800, count: 5000 },    // keep 7 days or 5000 failed
  },
});

// ─── Worker ─────────────────────────────────────────────────────────────────
export const upvoteWorker = new Worker<QueueJobData>(
  'upvote-queue',
  async (job: Job<QueueJobData>) => {
    const { taskId, jobId, postUrl, commentId, accountSlot } = job.data;

    await log(`Processing upvote: comment ${commentId} with account slot ${accountSlot}`, 'info', jobId);

    // Load account cookies from DB
    const accounts = await query<Account>(
      `SELECT * FROM accounts WHERE slot = $1 AND status = 'active'`,
      [accountSlot]
    );

    if (accounts.length === 0) {
      const errMsg = `Account slot ${accountSlot} not found or not active`;
      await query(
        `UPDATE upvote_tasks SET status = 'failed', error = $1, fired_at = NOW() WHERE id = $2`,
        [errMsg, taskId]
      );
      await log(errMsg, 'error', jobId, `slot-${accountSlot}`);
      throw new Error(errMsg);
    }

    const account = accounts[0];
    let browser = null;

    try {
      browser = await launchBrowser();
      const { page } = await createContextWithCookies(browser, account.cookies);

      // Perform the upvote
      const result = await upvoteComment(page, postUrl, commentId);

      if (result.success) {
        // Update task as done
        await query(
          `UPDATE upvote_tasks SET status = 'done', fired_at = NOW() WHERE id = $1`,
          [taskId]
        );

        // Update account last_used
        await query(`UPDATE accounts SET last_used = NOW() WHERE slot = $1`, [accountSlot]);

        const msg = result.alreadyUpvoted
          ? `Comment ${commentId} was already upvoted by ${account.username}`
          : `Successfully upvoted comment ${commentId} with ${account.username}`;

        await log(msg, 'success', jobId, account.username);
      } else {
        const errMsg = result.error || 'Unknown upvote failure';
        await query(
          `UPDATE upvote_tasks SET status = 'failed', error = $1, fired_at = NOW() WHERE id = $2`,
          [errMsg, taskId]
        );
        await log(`Failed to upvote comment ${commentId}: ${errMsg}`, 'error', jobId, account.username);
        throw new Error(errMsg);
      }

      // Check if all tasks for this job are done
      await checkJobCompletion(jobId);
    } catch (err: any) {
      if (browser) {
        await closeBrowser(browser);
      }
      const errMsg = err.message || 'Unknown execution error';
      await query(
        `UPDATE upvote_tasks SET status = 'failed', error = $1, fired_at = NOW() WHERE id = $2 AND status = 'scheduled'`,
        [errMsg, taskId]
      );
      await log(`System error processing comment ${commentId}: ${errMsg}`, 'error', jobId);
      await checkJobCompletion(jobId);
      throw err;
    }
  },
  {
    connection,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000, // max 5 jobs per minute
    },
  }
);

upvoteWorker.on('failed', async (job, err) => {
  if (job) {
    console.error(`Job ${job.id} failed:`, err.message);
  }
});

upvoteWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

/**
 * Check if all tasks for a job are completed and update the job status accordingly.
 */
async function checkJobCompletion(jobId: string): Promise<void> {
  const result = await query<{ total: string; done: string; failed: string }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'done')::text AS done,
       COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
     FROM upvote_tasks WHERE job_id = $1`,
    [jobId]
  );

  if (result.length > 0) {
    const { total, done, failed } = result[0];
    const totalNum = parseInt(total, 10);
    const doneNum = parseInt(done, 10);
    const failedNum = parseInt(failed, 10);

    if (doneNum + failedNum >= totalNum) {
      const jobStatus = failedNum === totalNum ? 'failed' : 'done';
      await query(
        `UPDATE jobs SET status = $1, completed_at = NOW() WHERE id = $2`,
        [jobStatus, jobId]
      );
      await log(`Job completed: ${doneNum}/${totalNum} succeeded`, jobStatus === 'done' ? 'success' : 'error', jobId);
    }
  }
}

/**
 * Schedule upvote tasks for each comment × each account, with random delays.
 * Inserts upvote_task rows and enqueues BullMQ delayed jobs.
 */
export async function scheduleUpvoteTasks(
  jobId: string,
  postUrl: string,
  comments: RedditComment[],
  accounts: Account[]
): Promise<void> {
  const activeAccounts = accounts.filter((a) => a.status === 'active');

  if (activeAccounts.length === 0) {
    await log('No active accounts available for upvoting', 'error', jobId);
    await query(`UPDATE jobs SET status = 'failed' WHERE id = $1`, [jobId]);
    return;
  }

  if (comments.length === 0) {
    await log('No target comments found to upvote', 'error', jobId);
    await query(`UPDATE jobs SET status = 'failed' WHERE id = $1`, [jobId]);
    return;
  }

  const tasks: { taskId: string; delay: number; data: QueueJobData }[] = [];

  for (const comment of comments) {
    for (const account of activeAccounts) {
      const taskId = uuidv4();
      // Random delay between 20 minutes (1,200,000ms) and 2 hours (7,200,000ms)
      const delayMs = Math.floor(Math.random() * 6000000) + 1200000;
      const scheduledAt = new Date(Date.now() + delayMs);

      // Insert the upvote_task row
      await query(
        `INSERT INTO upvote_tasks (id, job_id, account_slot, comment_id, scheduled_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [taskId, jobId, account.slot, comment.id, scheduledAt]
      );

      tasks.push({
        taskId,
        delay: delayMs,
        data: {
          taskId,
          jobId,
          postUrl,
          commentId: comment.id,
          accountSlot: account.slot,
        },
      });
    }
  }

  // Enqueue all BullMQ jobs with delays
  for (const task of tasks) {
    await upvoteQueue.add('upvote', task.data, {
      delay: task.delay,
      jobId: task.taskId as any, // use task UUID as BullMQ job ID for easy cancellation
    });
  }

  await query(`UPDATE jobs SET status = 'active' WHERE id = $1`, [jobId]);

  await log(
    `Scheduled ${tasks.length} upvote tasks (${comments.length} comments × ${activeAccounts.length} accounts)`,
    'info',
    jobId
  );
}

/**
 * Remove all pending/delayed BullMQ jobs for a given job ID.
 */
export async function cancelJobTasks(jobId: string): Promise<number> {
  // Get all scheduled tasks for this job
  const tasks = await query<{ id: string }>(
    `SELECT id FROM upvote_tasks WHERE job_id = $1 AND status = 'scheduled'`,
    [jobId]
  );

  let removed = 0;

  for (const task of tasks) {
    try {
      const bullJob = await upvoteQueue.getJob(task.id);
      if (bullJob) {
        await bullJob.remove();
        removed++;
      }
    } catch {
      // Job may already be processing or removed
    }
  }

  // Update all scheduled tasks to failed
  await query(
    `UPDATE upvote_tasks SET status = 'failed', error = 'Cancelled' WHERE job_id = $1 AND status = 'scheduled'`,
    [jobId]
  );

  return removed;
}

export async function closeQueue(): Promise<void> {
  await upvoteWorker.close();
  await upvoteQueue.close();
}
