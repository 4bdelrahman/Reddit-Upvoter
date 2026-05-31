import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../api/client';

interface LogPanelProps {
  logs: LogEntry[];
  isLoading: boolean;
  error: string | null;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const typeConfig: Record<
  string,
  { icon: string; borderClass: string; textClass: string; bgClass: string }
> = {
  success: {
    icon: '✅',
    borderClass: 'border-l-emerald-500/50',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/5',
  },
  info: {
    icon: 'ℹ️',
    borderClass: 'border-l-blue-500/50',
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-500/5',
  },
  error: {
    icon: '❌',
    borderClass: 'border-l-red-500/50',
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/5',
  },
  warn: {
    icon: '⚠️',
    borderClass: 'border-l-amber-500/50',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/5',
  },
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/* ── Component ────────────────────────────────────────────────────────────── */

const LogPanel: React.FC<LogPanelProps> = ({ logs, isLoading, error }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  /* ── Loading ────────────────────────────────────────────────────────────── */
  if (isLoading && logs.length === 0) {
    return (
      <div id="log-panel-loading" className="animate-fade-in">
        <div className="bg-dark-800/60 border border-dark-600/30 rounded-xl p-5">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-16 h-4 bg-dark-600 rounded" />
                <div className="w-5 h-5 bg-dark-600 rounded" />
                <div className="flex-1 h-4 bg-dark-600 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div
        id="log-panel-error"
        className="animate-fade-in bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-red-400 text-sm font-medium">{error}</p>
      </div>
    );
  }

  /* ── Empty ───────────────────────────────────────────────────────────────── */
  if (logs.length === 0) {
    return (
      <div
        id="log-panel-empty"
        className="animate-fade-in bg-dark-800/40 border border-dark-600/30 rounded-xl p-12 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-dark-700/60 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-gray-400 font-medium text-sm mb-1">No log entries</h3>
        <p className="text-gray-600 text-xs">
          Logs will appear here as the system processes upvote jobs.
        </p>
      </div>
    );
  }

  /* ── Log feed ────────────────────────────────────────────────────────────── */
  return (
    <div id="log-panel" className="animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Activity Feed
          </span>
        </div>
        <span className="text-[11px] text-gray-600 tabular-nums">
          {logs.length} entries
        </span>
      </div>

      {/* Scrollable log container */}
      <div
        ref={scrollRef}
        className="bg-dark-800/60 backdrop-blur-sm border border-dark-600/40 rounded-xl overflow-hidden"
      >
        <div className="max-h-[520px] overflow-y-auto">
          {logs.map((entry, index) => {
            const cfg = typeConfig[entry.type] || typeConfig.info;
            const showDate =
              index === 0 ||
              formatDate(logs[index - 1].timestamp) !== formatDate(entry.timestamp);

            return (
              <React.Fragment key={entry.id}>
                {/* Date separator */}
                {showDate && (
                  <div className="px-4 py-2 bg-dark-700/40 border-b border-dark-600/30">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                )}

                {/* Log row */}
                <div
                  id={`log-entry-${entry.id}`}
                  className={`flex items-start gap-3 px-4 py-3 border-l-2 border-b border-b-dark-700/30
                             hover:bg-dark-700/30 transition-colors duration-150
                             ${cfg.borderClass} ${cfg.bgClass}`}
                >
                  {/* Timestamp */}
                  <span className="text-[11px] text-gray-600 font-mono tabular-nums flex-shrink-0 pt-0.5 w-16">
                    {formatTimestamp(entry.timestamp)}
                  </span>

                  {/* Type icon */}
                  <span className="flex-shrink-0 text-sm leading-5 w-5 text-center">
                    {cfg.icon}
                  </span>

                  {/* Message body */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-5 ${cfg.textClass}`}>
                      {entry.message}
                    </p>
                    {entry.accountName && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {entry.accountName}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LogPanel;
