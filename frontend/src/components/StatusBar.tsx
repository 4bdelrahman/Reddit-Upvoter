import React from 'react';
import type { QueueStats } from '../api/client';

interface StatusBarProps {
  stats: QueueStats | null;
  isPolling: boolean;
  lastUpdated: Date | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ stats, isPolling, lastUpdated }) => {
  return (
    <header
      id="status-bar"
      className="relative w-full bg-dark-800/80 backdrop-blur-xl border-b border-dark-600/50"
    >
      {/* Gradient accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-reddit-orange/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-reddit-orange animate-pulse-slow" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-reddit-orange/40 animate-ping" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-white">Reddit</span>
                <span className="text-reddit-orange ml-1">Boost</span>
              </h1>
            </div>
            <div className="hidden sm:block w-px h-5 bg-dark-500" />
            <span className="hidden sm:block text-xs text-gray-500 font-medium tracking-wide uppercase">
              Dashboard
            </span>
          </div>

          {/* Center: Queue Stats */}
          <div className="flex items-center gap-2 sm:gap-4">
            {stats ? (
              <>
                <StatBadge
                  id="stat-pending"
                  label="Pending"
                  count={stats.pending}
                  dotColor="bg-amber-400"
                  textColor="text-amber-400"
                />
                <StatBadge
                  id="stat-active"
                  label="Active"
                  count={stats.active}
                  dotColor="bg-blue-400"
                  textColor="text-blue-400"
                />
                <StatBadge
                  id="stat-delayed"
                  label="Delayed"
                  count={stats.delayed}
                  dotColor="bg-purple-400"
                  textColor="text-purple-400"
                />
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <div className="w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                Loading stats…
              </div>
            )}
          </div>

          {/* Right: Polling indicator & timestamp */}
          <div className="flex items-center gap-3">
            {isPolling && (
              <div id="polling-indicator" className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400/80 font-medium uppercase tracking-wider">
                  Live
                </span>
              </div>
            )}
            {lastUpdated && (
              <span className="hidden md:block text-[10px] text-gray-600 font-mono">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

/* ── Stat Badge Sub-component ────────────────────────────────────────────── */

interface StatBadgeProps {
  id: string;
  label: string;
  count: number;
  dotColor: string;
  textColor: string;
}

const StatBadge: React.FC<StatBadgeProps> = ({ id, label, count, dotColor, textColor }) => (
  <div
    id={id}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-700/60 border border-dark-600/40"
  >
    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
    <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">{label}</span>
    <span className={`text-xs font-semibold ${textColor} tabular-nums`}>{count}</span>
  </div>
);

export default StatusBar;
