-- The 5 Reddit accounts
CREATE TABLE accounts (
  id          SERIAL PRIMARY KEY,
  slot        INT UNIQUE NOT NULL,        -- 1 through 5
  username    TEXT NOT NULL,
  cookies     JSONB NOT NULL,             -- raw cookie array from browser
  status      TEXT DEFAULT 'active',      -- active | limited | banned
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- A "job" = one Reddit post URL to boost
CREATE TABLE jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_url     TEXT NOT NULL,
  target_user  TEXT,                      -- auto-detected from post
  status       TEXT DEFAULT 'pending',    -- pending | active | done | failed
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- One upvote_task = one account upvoting one comment at a scheduled time
CREATE TABLE upvote_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID REFERENCES jobs(id) ON DELETE CASCADE,
  account_slot  INT NOT NULL,             -- which of the 5 accounts
  comment_id    TEXT NOT NULL,            -- Reddit comment ID
  scheduled_at  TIMESTAMPTZ NOT NULL,     -- when to fire (random delay)
  fired_at      TIMESTAMPTZ,
  status        TEXT DEFAULT 'scheduled', -- scheduled | done | failed
  error         TEXT
);

-- Rolling log (keep last 500)
CREATE TABLE logs (
  id         SERIAL PRIMARY KEY,
  job_id     UUID REFERENCES jobs(id) ON DELETE SET NULL,
  account    TEXT,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'info',         -- info | success | error
  created_at TIMESTAMPTZ DEFAULT NOW()
);
