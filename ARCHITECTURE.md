# ARCHITECTURE.md - Reddit Boost System (Live / Cloud)

**Version**: 2.0 | **Date**: May 30, 2026  
**Hosting**: Railway (backend) + Vercel (frontend)  
**Mode**: 24/7 cloud service, no local machine required

---

## 1. System Overview

A fully cloud-hosted Reddit comment upvoting service for affiliate marketing.  
The user submits Reddit post URLs via a web dashboard. The backend detects the  
user's comments on those posts, then schedules each of the 5 accounts to upvote  
them at random intervals (20 min – 2 hours apart). Multiple posts are handled  
simultaneously in parallel queues.

```
User (browser dashboard)
        │
        ▼
   Vercel Frontend (React)
        │  REST API calls
        ▼
   Railway Backend (Node.js + Express)
        │
        ├── Job Queue (BullMQ + Redis)
        │       └── Workers: upvote jobs fire at random delays
        │
        ├── Playwright (Chromium, headless)
        │       └── 5 Reddit accounts via session cookies
        │
        └── PostgreSQL (Neon.tech, free tier)
                └── accounts, jobs, upvote_tasks, logs
```

---

## 2. Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Backend | Node.js + Express | Simple REST API |
| Frontend | React + Vite + Tailwind | Web dashboard |
| Browser Automation | Playwright (Chromium) | Headless Reddit sessions |
| Job Queue | BullMQ + Redis (Railway) | Random delay scheduling, parallel jobs |
| Database | PostgreSQL via Neon.tech | Persistent state, free tier |
| Auth (dashboard) | Simple secret token | Protects the dashboard |
| Hosting (backend) | Railway | Always-on Node process |
| Hosting (frontend) | Vercel | Free static hosting |

---

## 3. Folder Structure

```
reddit-boost/
├── backend/
│   ├── src/
│   │   ├── index.ts               # Express app entry
│   │   ├── routes/
│   │   │   ├── jobs.ts            # POST /jobs, GET /jobs, DELETE /jobs/:id
│   │   │   ├── accounts.ts        # GET/POST /accounts (cookie management)
│   │   │   └── logs.ts            # GET /logs
│   │   ├── workers/
│   │   │   ├── jobProcessor.ts    # BullMQ worker: processes upvote tasks
│   │   │   └── commentFinder.ts   # Fetches post, finds target comments
│   │   ├── automation/
│   │   │   ├── browser.ts         # Playwright launch + cookie injection
│   │   │   ├── upvote.ts          # Find comment → upvote logic
│   │   │   ├── selectors.ts       # Reddit DOM selectors with fallbacks
│   │   │   └── humanBehavior.ts   # Random delays, scroll, cover upvotes
│   │   ├── db/
│   │   │   ├── client.ts          # PostgreSQL connection (pg)
│   │   │   └── schema.sql         # Table definitions
│   │   ├── queue/
│   │   │   └── bullmq.ts          # Queue setup, job scheduling
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile                 # For Railway deployment
│
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── api/
    │   │   └── client.ts          # Typed API calls to backend
    │   └── components/
    │       ├── JobSubmit.tsx       # Submit new post URL
    │       ├── JobList.tsx         # Active jobs + progress
    │       ├── AccountManager.tsx  # Cookie management per account
    │       ├── LogPanel.tsx        # Live log feed (polling)
    │       └── StatusBar.tsx       # Queue health, accounts online
    ├── package.json
    └── vite.config.ts
```

---

## 4. Database Schema (`backend/src/db/schema.sql`)

```sql
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
```

---

## 5. Core Flow

### Step 1 — Job Submission
```
POST /jobs { postUrl }
  └── Fetch Reddit post via Reddit JSON API (no auth needed):
      GET {postUrl}.json
  └── Scan comments for the target_user (detected from post author or
      matched against known accounts)
  └── For each comment found:
        For each of the 5 accounts:
          → Generate random delay: 20min–2hr (randomBetween(1200, 7200) seconds)
          → Insert upvote_task row with scheduled_at = NOW() + delay
          → Enqueue BullMQ job with { delay }
  └── Insert job row, return job ID to frontend
```

### Step 2 — Queue Worker fires
```
BullMQ job fires at scheduled_at time
  └── Load account cookies from DB (slot = account_slot)
  └── Launch Playwright headless Chromium
  └── Inject cookies → navigate to post URL
  └── Slow scroll → find comment by comment_id
  └── Check not already upvoted → click upvote
  └── Upvote 2–3 random comments (cover behavior)
  └── Wait 30–90s on page → close browser
  └── Update upvote_task status = 'done'
  └── Write log entry
```

### Step 3 — Parallel jobs
```
Multiple posts submitted → each gets its own set of upvote_tasks
All tasks live in the same BullMQ queue
Worker concurrency = 2 (run 2 browser sessions at once, safe for Railway)
Tasks from different jobs fire independently based on their delay
```

---

## 6. Random Delay Logic

```ts
// Per upvote_task, generate a unique random delay
function randomDelayMs(): number {
  const minMs = 20 * 60 * 1000;   // 20 minutes
  const maxMs = 2 * 60 * 60 * 1000; // 2 hours
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// When a job is created, schedule all 5 upvotes with different delays
for (const account of accounts) {
  const delay = randomDelayMs();
  await queue.add('upvote', { taskId, accountSlot: account.slot }, { delay });
}

// Result: 5 upvotes land at completely different times within a 2hr window
// e.g. +23min, +47min, +1h12min, +1h38min, +1h55min
```

---

## 7. Comment Detection (No Login Required)

Reddit exposes public post JSON without auth:

```ts
async function findTargetComments(postUrl: string): Promise<Comment[]> {
  const jsonUrl = postUrl.replace(/\/?$/, '.json') + '?limit=500';
  const res = await fetch(jsonUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  const comments = flattenComments(data[1].data.children);

  // Match comments by the submitting user OR any known account username
  return comments.filter(c =>
    knownUsernames.includes(c.author.toLowerCase())
  );
}
```

---

## 8. API Endpoints

```
POST   /jobs                  Submit new post URL → creates job + tasks
GET    /jobs                  List all jobs with progress counts
GET    /jobs/:id              Single job detail + task timeline
DELETE /jobs/:id              Cancel job, remove pending queue tasks

GET    /accounts              List 5 account slots + status
POST   /accounts/:slot        Save/update cookies for a slot
DELETE /accounts/:slot/cookies  Clear cookies

GET    /logs?limit=100        Recent log entries
GET    /queue/stats           BullMQ queue depth, active, delayed counts
```

All routes protected by `Authorization: Bearer <SECRET_TOKEN>` header.

---

## 9. Frontend Dashboard (React)

```
┌──────────────────────────────────────────────────────┐
│  Reddit Boost  ●  Queue: 12 pending  2 active        │
├────────────┬───────────┬──────────────┬──────────────┤
│  Submit    │  Jobs     │  Accounts    │  Logs        │
├────────────┴───────────┴──────────────┴──────────────┤
│                                                      │
│  [Submit Tab]                                        │
│  Post URL: ________________________________          │
│  [ Detect Comments & Queue Upvotes ]                 │
│                                                      │
│  [Jobs Tab]                                          │
│  ┌─────────────────────────────────────────────┐     │
│  │ r/entrepreneur/...abc123   ● active          │     │
│  │ Comment: "Check out this tool..."            │     │
│  │ ████████░░░░░░░░  3/5 upvotes done           │     │
│  │ Next upvote in: 23 min                       │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [Accounts Tab]                                      │
│  Slot 1  u/shadow_hawk_99  ● active  [Edit cookies]  │
│  Slot 2  u/pixel_ranger_07 ● active  [Edit cookies]  │
│  ...                                                 │
│                                                      │
│  [Logs Tab]                                          │
│  12:04:11  ✅ slot_2 upvoted comment abc on job xyz  │
│  12:41:33  ✅ slot_4 upvoted comment abc on job xyz  │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

Frontend polls `/jobs` and `/logs` every 15 seconds for live updates.

---

## 10. Railway Deployment

```dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

**Railway services needed:**
- `backend` — Node.js app (this Dockerfile)
- `redis` — Railway Redis plugin (for BullMQ)
- `postgres` — Use Neon.tech free tier (external)

**Environment variables on Railway:**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_TOKEN=your_dashboard_password
PORT=3000
```

---

## 11. Account Cookie Setup (One-Time)

1. Open Chrome with the Reddit account logged in
2. Install "EditThisCookie" or "Cookie-Editor" extension
3. Export cookies as JSON array
4. Paste into the dashboard → Accounts tab → slot 1–5
5. Backend stores in PostgreSQL, injects per Playwright session

Cookies persist until Reddit session expires (~30–90 days).  
Dashboard will flag accounts as `limited` if upvote fails (expired session).

---

## 12. Resilience & Safety

- BullMQ retries failed jobs up to 3 times with exponential backoff
- If cookies expired → mark account `limited`, skip slot, log warning
- If comment not found → retry after 10 min (post may not have loaded)
- Worker concurrency capped at 2 to stay within Railway memory limits
- All browser sessions closed after each task (no lingering processes)
- Playwright uses `--no-sandbox` flag required for Railway/Docker

---

## 13. Build Order

1. `backend/src/db/schema.sql` — run on Neon.tech
2. `backend/src/db/client.ts` — pg connection
3. `backend/src/types/index.ts` — shared types
4. `backend/src/automation/` — browser, upvote, selectors, humanBehavior
5. `backend/src/workers/commentFinder.ts` — Reddit JSON fetch
6. `backend/src/queue/bullmq.ts` — queue + worker setup
7. `backend/src/routes/` — jobs, accounts, logs
8. `backend/src/index.ts` — Express app + middleware
9. `frontend/src/api/client.ts` — typed API client
10. `frontend/src/components/` — all UI components
11. `Dockerfile` + Railway deploy

---

## 14. Commands

```bash
# Backend
cd backend && npm run dev        # Local dev
cd backend && npm run build      # Compile TS

# Frontend  
cd frontend && npm run dev       # Local UI
cd frontend && npm run build     # Deploy to Vercel

# DB
psql $DATABASE_URL -f src/db/schema.sql   # Run migrations
```
