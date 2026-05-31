import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Insert a log entry and trim the logs table to the most recent 500 rows.
 */
export async function log(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  jobId?: string,
  account?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO logs (job_id, account, message, type) VALUES ($1, $2, $3, $4)`,
      [jobId ?? null, account ?? null, message, type]
    );

    // Trim logs to the most recent 500 rows
    await query(`
      DELETE FROM logs
      WHERE id NOT IN (
        SELECT id FROM logs ORDER BY created_at DESC LIMIT 500
      )
    `);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
