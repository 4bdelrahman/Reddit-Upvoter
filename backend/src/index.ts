import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { closePool } from './db/client';
import { closeQueue } from './queue/bullmq';
import jobsRouter from './routes/jobs';
import accountsRouter from './routes/accounts';
import logsRouter from './routes/logs';
import queueRouter from './routes/queue';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || '*'
      : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parser ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ─── Auth Middleware ────────────────────────────────────────────────────────
const SECRET_TOKEN = process.env.SECRET_TOKEN;

app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip auth for health check
  if (req.path === '/health') {
    next();
    return;
  }

  if (!SECRET_TOKEN) {
    // If no token configured, allow all (dev mode)
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  if (token !== SECRET_TOKEN) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/jobs', jobsRouter);
app.use('/accounts', accountsRouter);
app.use('/logs', logsRouter);
app.use('/queue', queueRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 Reddit Boost backend running on port ${PORT}`);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    await closeQueue();
    console.log('BullMQ queue and worker closed');
  } catch (err) {
    console.error('Error closing queue:', err);
  }

  try {
    await closePool();
    console.log('PostgreSQL pool closed');
  } catch (err) {
    console.error('Error closing pool:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
