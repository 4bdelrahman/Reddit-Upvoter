import { Router, Request, Response } from 'express';
import { query, queryOne, log } from '../db/client';
import { Account } from '../types';

const router = Router();

/**
 * GET /accounts
 * List all 5 account slots.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Return all accounts, ordered by slot
    const accounts = await query<Account>(
      `SELECT id, slot, username, status, last_used, created_at FROM accounts ORDER BY slot`
    );

    // Build a full 1-5 slot view, showing empty slots too
    const slots = [];
    for (let slot = 1; slot <= 5; slot++) {
      const account = accounts.find((a) => a.slot === slot);
      if (account) {
        slots.push({
          ...account,
          has_cookies: true,
        });
      } else {
        slots.push({
          slot,
          username: null,
          status: 'empty',
          has_cookies: false,
          last_used: null,
          created_at: null,
        });
      }
    }

    res.json(slots);
  } catch (err: any) {
    console.error('GET /accounts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /accounts/:slot
 * Upsert an account for a given slot (1-5).
 * Body: { username: string, cookies: CookieObject[] }
 */
router.post('/:slot', async (req: Request, res: Response) => {
  try {
    const slot = parseInt(req.params.slot, 10);

    if (isNaN(slot) || slot < 1 || slot > 5) {
      res.status(400).json({ error: 'Slot must be a number between 1 and 5' });
      return;
    }

    const { username, cookies } = req.body;

    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'username is required and must be a string' });
      return;
    }

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      res.status(400).json({ error: 'cookies is required and must be a non-empty array' });
      return;
    }

    // Upsert: insert or update on conflict
    const result = await query<Account>(
      `INSERT INTO accounts (slot, username, cookies, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (slot) DO UPDATE SET
         username = EXCLUDED.username,
         cookies = EXCLUDED.cookies,
         status = 'active'
       RETURNING id, slot, username, status, last_used, created_at`,
      [slot, username, JSON.stringify(cookies)]
    );

    await log(`Account slot ${slot} updated: ${username}`, 'info', undefined, username);

    res.status(200).json({
      ...result[0],
      has_cookies: true,
    });
  } catch (err: any) {
    console.error('POST /accounts/:slot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /accounts/:slot/cookies
 * Clear cookies for a slot and set status to 'limited'.
 */
router.delete('/:slot/cookies', async (req: Request, res: Response) => {
  try {
    const slot = parseInt(req.params.slot, 10);

    if (isNaN(slot) || slot < 1 || slot > 5) {
      res.status(400).json({ error: 'Slot must be a number between 1 and 5' });
      return;
    }

    const account = await queryOne<Account>(
      `SELECT * FROM accounts WHERE slot = $1`,
      [slot]
    );

    if (!account) {
      res.status(404).json({ error: `No account in slot ${slot}` });
      return;
    }

    await query(
      `UPDATE accounts SET cookies = '[]'::jsonb, status = 'limited' WHERE slot = $1`,
      [slot]
    );

    await log(`Cookies cleared for slot ${slot} (${account.username})`, 'info', undefined, account.username);

    res.json({
      message: `Cookies cleared for slot ${slot}`,
      slot,
      status: 'limited',
    });
  } catch (err: any) {
    console.error('DELETE /accounts/:slot/cookies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
