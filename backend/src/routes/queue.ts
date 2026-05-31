import { Router, Request, Response } from 'express';
import { upvoteQueue } from '../queue/bullmq';

const router = Router();

/**
 * GET /queue/stats
 * Return BullMQ queue counts: waiting, active, delayed, completed, failed.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      upvoteQueue.getWaitingCount(),
      upvoteQueue.getActiveCount(),
      upvoteQueue.getDelayedCount(),
      upvoteQueue.getCompletedCount(),
      upvoteQueue.getFailedCount(),
    ]);

    res.json({
      waiting,
      active,
      delayed,
      completed,
      failed,
      total: waiting + active + delayed + completed + failed,
    });
  } catch (err: any) {
    console.error('GET /queue/stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
