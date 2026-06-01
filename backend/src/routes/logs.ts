import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { LogEntry } from '../types';

const router = Router();

/**
 * GET /logs
 * Return recent logs ordered by created_at DESC.
 * Query param: limit (default 100, max 500)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 1), 500);

    const logs = await query<LogEntry>(
      `SELECT 
         id, 
         message, 
         type, 
         created_at AS timestamp, 
         account AS "accountName", 
         job_id AS "jobId" 
       FROM logs 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    res.json(logs);
  } catch (err: any) {
    console.error('GET /logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
