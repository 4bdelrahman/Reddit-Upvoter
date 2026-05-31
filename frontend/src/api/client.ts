// ── Types ────────────────────────────────────────────────────────────────────

export interface Account {
  slot: number;
  username: string;
  status: 'active' | 'limited' | 'banned' | 'empty';
  hasCookies: boolean;
  lastUsed: string | null;
}

export interface UpvoteTask {
  accountSlot: number;
  accountUsername: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  scheduledFor: string;
  completedAt: string | null;
  error: string | null;
}

export interface Job {
  id: string;
  post_url: string;
  target_user: string | null;
  status: 'pending' | 'active' | 'done' | 'failed' | 'cancelled';
  created_at: string;
  completed_at: string | null;

  total_tasks?: string;
  done_tasks?: string;
  failed_tasks?: string;
  scheduled_tasks?: string;
  tasks?: UpvoteTask[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
  accountName: string | null;
  jobId: string | null;
}

export interface QueueStats {
  pending: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

// ── API Client ───────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SECRET_TOKEN = import.meta.env.VITE_SECRET_TOKEN || '';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(SECRET_TOKEN ? { Authorization: `Bearer ${SECRET_TOKEN}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMessage = body.error || body.message || errorMessage;
    } catch {
      // use default message
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ── Exported API Functions ───────────────────────────────────────────────────

export async function fetchJobs(): Promise<Job[]> {
  return apiFetch<Job[]>('/jobs');
}

export async function fetchJob(id: string): Promise<Job> {
  return apiFetch<Job>(`/jobs/${encodeURIComponent(id)}`);
}

export async function createJob(postUrl: string): Promise<Job> {
  return apiFetch<Job>('/jobs', {
    method: 'POST',
    body: JSON.stringify({ postUrl }),
  });
}

export async function deleteJob(id: string): Promise<void> {
  return apiFetch<void>(`/jobs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchAccounts(): Promise<Account[]> {
  return apiFetch<Account[]>('/accounts');
}

export async function saveAccount(
  slot: number,
  username: string,
  cookies: string
): Promise<Account> {
  let parsedCookies;
  try {
    parsedCookies = JSON.parse(cookies);
  } catch (err) {
    throw new Error("Invalid cookie JSON. Please make sure you copied the entire array from EditThisCookie.");
  }

  return apiFetch<Account>(`/accounts/${slot}`, {
    method: 'POST',
    body: JSON.stringify({ username, cookies: parsedCookies }),
  });
}

export async function deleteAccountCookies(slot: number): Promise<void> {
  return apiFetch<void>(`/accounts/${slot}/cookies`, {
    method: 'DELETE',
  });
}

export async function fetchLogs(limit?: number): Promise<LogEntry[]> {
  const query = limit ? `?limit=${limit}` : '';
  return apiFetch<LogEntry[]>(`/logs${query}`);
}

export async function fetchQueueStats(): Promise<QueueStats> {
  return apiFetch<QueueStats>('/queue/stats');
}
