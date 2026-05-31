export interface Account {
  id: number;
  slot: number;
  username: string;
  cookies: CookieObject[];
  status: 'active' | 'limited' | 'banned';
  last_used: Date | null;
  created_at: Date;
}

export interface CookieObject {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface Job {
  id: string;
  post_url: string;
  target_user: string | null;
  status: 'pending' | 'active' | 'done' | 'failed' | 'cancelled';
  created_at: Date;
  completed_at: Date | null;
}

export interface UpvoteTask {
  id: string;
  job_id: string;
  account_slot: number;
  comment_id: string;
  scheduled_at: Date;
  fired_at: Date | null;
  status: 'scheduled' | 'done' | 'failed';
  error: string | null;
}

export interface LogEntry {
  id: number;
  job_id: string | null;
  account: string | null;
  message: string;
  type: 'info' | 'success' | 'error';
  created_at: Date;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  permalink: string;
}

export interface QueueJobData {
  taskId: string;
  jobId: string;
  postUrl: string;
  commentId: string;
  accountSlot: number;
}
