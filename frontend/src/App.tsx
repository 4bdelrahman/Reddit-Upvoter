import React, { useState, useEffect, useCallback } from 'react';
import StatusBar from './components/StatusBar';
import JobSubmit from './components/JobSubmit';
import JobList from './components/JobList';
import AccountManager from './components/AccountManager';
import LogPanel from './components/LogPanel';
import {
  fetchJobs,
  fetchLogs,
  fetchQueueStats,
} from './api/client';
import type { Job, LogEntry, QueueStats } from './api/client';

/* ── Tab Definitions ──────────────────────────────────────────────────────── */

type TabKey = 'submit' | 'jobs' | 'accounts' | 'logs';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabDef[] = [
  {
    key: 'submit',
    label: 'Submit',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    key: 'jobs',
    label: 'Jobs',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: 'accounts',
    label: 'Accounts',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    key: 'logs',
    label: 'Logs',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

/* ── App ──────────────────────────────────────────────────────────────────── */

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('submit');

  // Data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);

  // Loading / error state
  const [jobsLoading, setJobsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Polling
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* ── Data Fetching ──────────────────────────────────────────────────────── */

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) setJobsLoading(true);
    try {
      const data = await fetchJobs();
      setJobs(data);
      setJobsError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch jobs';
      setJobsError(msg);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setLogsLoading(true);
    try {
      const data = await fetchLogs(100);
      setLogs(data);
      setLogsError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch logs';
      setLogsError(msg);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchQueueStats();
      setStats(data);
    } catch {
      // stats silently fail
    }
  }, []);

  /* ── Initial Load ───────────────────────────────────────────────────────── */

  useEffect(() => {
    loadJobs();
    loadLogs();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Polling intervals ──────────────────────────────────────────────────── */

  // Jobs & logs: every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsPolling(true);
      Promise.all([loadJobs(true), loadLogs(true)]).finally(() => {
        setIsPolling(false);
        setLastUpdated(new Date());
      });
    }, 15_000);

    return () => clearInterval(interval);
  }, [loadJobs, loadLogs]);

  // Queue stats: every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
    }, 30_000);

    return () => clearInterval(interval);
  }, [loadStats]);

  /* ── Event Handlers ─────────────────────────────────────────────────────── */

  const handleJobCreated = (job: Job) => {
    setJobs((prev) => [job, ...prev]);
    loadStats(); // refresh queue stats
  };

  const handleJobDeleted = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    loadStats();
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Status Bar */}
      <StatusBar stats={stats} isPolling={isPolling} lastUpdated={lastUpdated} />

      {/* Main content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <nav id="tab-nav" className="flex items-center gap-1.5 mb-8 p-1 bg-dark-800/50 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                         transition-all duration-200
                         ${
                           activeTab === tab.key
                             ? 'bg-dark-600 text-white shadow-lg shadow-black/20'
                             : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/40'
                         }`}
            >
              <span
                className={
                  activeTab === tab.key ? 'text-reddit-orange' : 'text-gray-600'
                }
              >
                {tab.icon}
              </span>
              {tab.label}
              {/* Job count badge */}
              {tab.key === 'jobs' && jobs.length > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                    activeTab === 'jobs'
                      ? 'bg-reddit-orange/20 text-reddit-orange'
                      : 'bg-dark-600 text-gray-500'
                  }`}
                >
                  {jobs.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === 'submit' && (
            <JobSubmit onJobCreated={handleJobCreated} />
          )}

          {activeTab === 'jobs' && (
            <JobList
              jobs={jobs}
              isLoading={jobsLoading}
              error={jobsError}
              onJobDeleted={handleJobDeleted}
            />
          )}

          {activeTab === 'accounts' && <AccountManager />}

          {activeTab === 'logs' && (
            <LogPanel logs={logs} isLoading={logsLoading} error={logsError} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-dark-800/50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span className="text-[11px] text-gray-700">
            Reddit Boost v1.0 — Internal Dashboard
          </span>
          <div className="flex items-center gap-3 text-[11px] text-gray-700">
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500/60" />
              System Online
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
