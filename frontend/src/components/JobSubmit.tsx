import React, { useState } from 'react';
import { createJob } from '../api/client';
import type { Job } from '../api/client';

interface JobSubmitProps {
  onJobCreated: (job: Job) => void;
}

const JobSubmit: React.FC<JobSubmitProps> = ({ onJobCreated }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      const job = await createJob(trimmed);
      setFeedback({
        type: 'success',
        message: 'Job created for the specified comment!',
      });
      setUrl('');
      onJobCreated(job);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create job';
      setFeedback({ type: 'error', message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="job-submit-panel"
      className="animate-fade-in"
    >
      <div className="bg-dark-800/60 backdrop-blur-sm border border-dark-600/50 rounded-xl p-6 shadow-2xl shadow-black/20">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-reddit-orange/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-reddit-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </span>
            New Upvote Job
          </h2>
          <p className="text-sm text-gray-400 mt-1.5 ml-10">
            Paste a direct Reddit comment URL to schedule upvotes.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              id="job-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.reddit.com/r/subreddit/comments/.../comment/..."
              disabled={isLoading}
              className="w-full bg-dark-900/80 border border-dark-500 rounded-lg px-4 py-3 pr-12
                         text-sm text-gray-200 placeholder-gray-600
                         focus:outline-none focus:ring-2 focus:ring-reddit-orange/50 focus:border-reddit-orange/60
                         transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {url && !isLoading && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                aria-label="Clear input"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            id="job-submit-btn"
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-sm
                       bg-gradient-to-r from-reddit-orange to-orange-600
                       text-white shadow-lg shadow-reddit-orange/20
                       hover:shadow-xl hover:shadow-reddit-orange/30
                       hover:scale-[1.02] active:scale-[0.98]
                       transition-all duration-200
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
                       disabled:hover:shadow-lg disabled:hover:shadow-reddit-orange/20
                       flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Queue Upvotes
              </>
            )}
          </button>
        </form>

        {/* Feedback */}
        {feedback && (
          <div
            id="job-submit-feedback"
            className={`mt-4 px-4 py-3 rounded-lg text-sm animate-slide-up flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {feedback.type === 'success' ? '✓' : '✕'}
            </span>
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Tips section */}
      <div className="mt-4 px-2">
        <div className="flex items-center gap-4 text-[11px] text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upvotes are spread across 5 accounts over ~25 minutes
          </span>
        </div>
      </div>
    </div>
  );
};

export default JobSubmit;
