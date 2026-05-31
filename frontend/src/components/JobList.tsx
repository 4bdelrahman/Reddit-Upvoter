import React, { useState } from 'react';
import type { Job } from '../api/client';
import { deleteJob } from '../api/client';

interface JobListProps {
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  onJobDeleted: (id: string) => void;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const statusConfig: Record<
  string,
  { label: string; dotClass: string; bgClass: string; textClass: string }
> = {
  pending: {
    label: 'Pending',
    dotClass: 'bg-amber-400',
    bgClass: 'bg-amber-400/10',
    textClass: 'text-amber-400',
  },
  active: {
    label: 'Active',
    dotClass: 'bg-blue-400',
    bgClass: 'bg-blue-400/10',
    textClass: 'text-blue-400',
  },
  done: {
    label: 'Done',
    dotClass: 'bg-emerald-400',
    bgClass: 'bg-emerald-400/10',
    textClass: 'text-emerald-400',
  },
  failed: {
    label: 'Failed',
    dotClass: 'bg-red-400',
    bgClass: 'bg-red-400/10',
    textClass: 'text-red-400',
  },
};

function truncateUrl(url: string, max = 55): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + '…';
}

function getCompletedCount(job: Job): number {
  if (job.done_tasks) return parseInt(job.done_tasks, 10);
  if (job.tasks) return job.tasks.filter((t) => t.status === 'done').length;
  return 0;
}

function getTotalCount(job: Job): number {
  if (job.total_tasks) return parseInt(job.total_tasks, 10);
  if (job.tasks) return job.tasks.length;
  return 5;
}

function getNextUpvoteIn(job: Job): string | null {
  if (job.scheduled_tasks && parseInt(job.scheduled_tasks, 10) > 0) {
    return 'Pending...';
  }
  return null;
}

/* ── Component ────────────────────────────────────────────────────────────── */

const JobList: React.FC<JobListProps> = ({ jobs, isLoading, error, onJobDeleted }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteJob(id);
      onJobDeleted(id);
    } catch {
      // silently fail; user can retry
    } finally {
      setDeletingId(null);
    }
  };

  // Loading skeleton
  if (isLoading && jobs.length === 0) {
    return (
      <div id="job-list-loading" className="animate-fade-in space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-dark-800/60 border border-dark-600/30 rounded-xl p-5 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-16 h-5 bg-dark-600 rounded-md" />
              <div className="flex-1 h-4 bg-dark-600 rounded-md" />
            </div>
            <div className="h-2 bg-dark-600 rounded-full w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        id="job-list-error"
        className="animate-fade-in bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <p className="text-gray-600 text-xs mt-1">Jobs will retry on next poll cycle.</p>
      </div>
    );
  }

  // Empty state
  if (jobs.length === 0) {
    return (
      <div
        id="job-list-empty"
        className="animate-fade-in bg-dark-800/40 border border-dark-600/30 rounded-xl p-12 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-dark-700/60 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0v3m0-3h3m-3 0v3m3-3v3m-6-6h.008v.008H6.75V10.5z" />
          </svg>
        </div>
        <h3 className="text-gray-400 font-medium text-sm mb-1">No jobs yet</h3>
        <p className="text-gray-600 text-xs">
          Submit a Reddit post URL to create your first upvote job.
        </p>
      </div>
    );
  }

  // Job cards
  return (
    <div id="job-list" className="space-y-3 animate-fade-in">
      {jobs.map((job, index) => {
        const cfg = statusConfig[job.status] || statusConfig.pending;
        const completed = getCompletedCount(job);
        const total = getTotalCount(job) || 5;
        const progress = (completed / total) * 100;
        const nextIn = getNextUpvoteIn(job);

        return (
          <div
            key={job.id}
            id={`job-card-${job.id}`}
            className="bg-dark-800/60 backdrop-blur-sm border border-dark-600/40 rounded-xl p-5
                       hover:border-dark-500/60 transition-all duration-300
                       animate-slide-up group"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            {/* Top row: status + url + delete */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Status badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide flex-shrink-0 ${cfg.bgClass} ${cfg.textClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                  {cfg.label}
                </span>

                {/* URL */}
                <a
                  href={job.post_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-300 hover:text-reddit-orange truncate transition-colors"
                  title={job.post_url}
                >
                  {truncateUrl(job.post_url || '')}
                </a>
              </div>

              {/* Delete button */}
              <button
                id={`job-delete-${job.id}`}
                onClick={() => handleDelete(job.id)}
                disabled={deletingId === job.id}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10
                           opacity-0 group-hover:opacity-100 transition-all duration-200
                           disabled:opacity-50 flex-shrink-0"
                title="Delete job"
              >
                {deletingId === job.id ? (
                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>

            {/* Target user */}
            {job.target_user && (
              <div className="flex items-center gap-1.5 mb-3 ml-0.5">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs text-gray-500">
                  Target: <span className="text-gray-400 font-medium">u/{job.target_user}</span>
                </span>
              </div>
            )}

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium">
                  Upvotes: {completed}/{total}
                </span>
                {nextIn && job.status !== 'done' && (
                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Next in {nextIn}
                  </span>
                )}
              </div>
              <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-reddit-orange to-orange-400 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default JobList;
