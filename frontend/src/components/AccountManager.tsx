import React, { useState, useEffect } from 'react';
import type { Account } from '../api/client';
import {
  fetchAccounts,
  saveAccount,
  deleteAccountCookies,
} from '../api/client';

/* ── Status Config ────────────────────────────────────────────────────────── */

const statusStyles: Record<
  string,
  { dot: string; label: string; bg: string; text: string }
> = {
  active: {
    dot: 'bg-emerald-400',
    label: 'Active',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-400',
  },
  limited: {
    dot: 'bg-amber-400',
    label: 'Limited',
    bg: 'bg-amber-400/10',
    text: 'text-amber-400',
  },
  banned: {
    dot: 'bg-red-400',
    label: 'Banned',
    bg: 'bg-red-400/10',
    text: 'text-red-400',
  },
  empty: {
    dot: 'bg-gray-600',
    label: 'Empty',
    bg: 'bg-gray-600/10',
    text: 'text-gray-500',
  },
};

const slotColors = [
  'from-reddit-orange to-orange-600',
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-yellow-500',
];

/* ── Component ────────────────────────────────────────────────────────────── */

const AccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  // Per-slot editing state
  const [editUsername, setEditUsername] = useState<Record<number, string>>({});
  const [editCookies, setEditCookies] = useState<Record<number, string>>({});
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [clearingSlot, setClearingSlot] = useState<number | null>(null);
  const [slotFeedback, setSlotFeedback] = useState<
    Record<number, { type: 'success' | 'error'; message: string }>
  >({});

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(msg);
      // Create placeholder empty accounts
      setAccounts(
        Array.from({ length: 5 }, (_, i) => ({
          slot: i + 1,
          username: '',
          status: 'empty' as const,
          hasCookies: false,
          lastUsed: null,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpand = (slot: number) => {
    if (expandedSlot === slot) {
      setExpandedSlot(null);
    } else {
      setExpandedSlot(slot);
      // Pre-fill editing fields
      const acct = accounts.find((a) => a.slot === slot);
      setEditUsername((prev) => ({ ...prev, [slot]: acct?.username || '' }));
      setEditCookies((prev) => ({ ...prev, [slot]: '' }));
    }
  };

  const handleSave = async (slot: number) => {
    const username = editUsername[slot]?.trim() || '';
    const cookies = editCookies[slot]?.trim() || '';

    if (!username) {
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'error', message: 'Username is required.' },
      }));
      return;
    }
    if (!cookies) {
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'error', message: 'Cookie JSON is required.' },
      }));
      return;
    }

    setSavingSlot(slot);
    setSlotFeedback((prev) => {
      const copy = { ...prev };
      delete copy[slot];
      return copy;
    });

    try {
      const updated = await saveAccount(slot, username, cookies);
      setAccounts((prev) =>
        prev.map((a) => (a.slot === slot ? updated : a))
      );
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'success', message: 'Account saved successfully!' },
      }));
      setEditCookies((prev) => ({ ...prev, [slot]: '' }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'error', message: msg },
      }));
    } finally {
      setSavingSlot(null);
    }
  };

  const handleClear = async (slot: number) => {
    setClearingSlot(slot);
    setSlotFeedback((prev) => {
      const copy = { ...prev };
      delete copy[slot];
      return copy;
    });

    try {
      await deleteAccountCookies(slot);
      setAccounts((prev) =>
        prev.map((a) =>
          a.slot === slot ? { ...a, hasCookies: false, status: 'empty' as const } : a
        )
      );
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'success', message: 'Cookies cleared.' },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Clear failed';
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'error', message: msg },
      }));
    } finally {
      setClearingSlot(null);
    }
  };

  // Build 5-slot grid (merge with real data or placeholders)
  const slots: Account[] = Array.from({ length: 5 }, (_, i) => {
    const real = accounts.find((a) => a.slot === i + 1);
    return (
      real || {
        slot: i + 1,
        username: '',
        status: 'empty' as const,
        hasCookies: false,
        lastUsed: null,
      }
    );
  });

  /* ── Loading ────────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div id="account-manager-loading" className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-dark-800/60 border border-dark-600/30 rounded-xl p-5 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-dark-600 rounded-lg" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-dark-600 rounded-md w-24" />
                <div className="h-3 bg-dark-600 rounded-md w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── Error fallback ──────────────────────────────────────────────────────── */
  if (error) {
    // Still render cards but show error banner
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div id="account-manager" className="animate-fade-in space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Could not load accounts: {error}. Showing empty slots.</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.map((acct) => {
          const ss = statusStyles[acct.status] || statusStyles.empty;
          const isExpanded = expandedSlot === acct.slot;
          const colorGrad = slotColors[(acct.slot - 1) % slotColors.length];
          const fb = slotFeedback[acct.slot];

          return (
            <div
              key={acct.slot}
              id={`account-slot-${acct.slot}`}
              className={`bg-dark-800/60 backdrop-blur-sm border rounded-xl transition-all duration-300
                         hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5
                         ${isExpanded ? 'border-dark-500/60 col-span-1 sm:col-span-2 lg:col-span-3' : 'border-dark-600/40'}`}
            >
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Slot number */}
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorGrad} flex items-center justify-center shadow-lg`}
                    >
                      <span className="text-white text-sm font-bold">{acct.slot}</span>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {acct.username || (
                          <span className="text-gray-600 italic">Empty slot</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                        <span className={`text-[11px] font-medium ${ss.text}`}>
                          {ss.label}
                        </span>
                        {acct.hasCookies && (
                          <span className="text-[10px] text-gray-600 ml-1">• has cookies</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand/Edit button */}
                  <button
                    id={`account-edit-${acct.slot}`}
                    onClick={() => handleToggleExpand(acct.slot)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                               ${
                                 isExpanded
                                   ? 'bg-dark-600 text-gray-300'
                                   : 'bg-dark-700/60 text-gray-400 hover:bg-dark-600 hover:text-gray-300'
                               }`}
                  >
                    {isExpanded ? 'Close' : 'Edit Cookies'}
                  </button>
                </div>
              </div>

              {/* Expanded edit section */}
              {isExpanded && (
                <div className="border-t border-dark-600/40 p-5 animate-fade-in">
                  <div className="space-y-4 max-w-2xl">
                    {/* Username input */}
                    <div>
                      <label
                        htmlFor={`account-username-${acct.slot}`}
                        className="block text-xs font-medium text-gray-400 mb-1.5"
                      >
                        Username
                      </label>
                      <input
                        id={`account-username-${acct.slot}`}
                        type="text"
                        value={editUsername[acct.slot] || ''}
                        onChange={(e) =>
                          setEditUsername((prev) => ({
                            ...prev,
                            [acct.slot]: e.target.value,
                          }))
                        }
                        placeholder="reddit_username"
                        className="w-full bg-dark-900/80 border border-dark-500 rounded-lg px-3 py-2
                                   text-sm text-gray-200 placeholder-gray-600
                                   focus:outline-none focus:ring-2 focus:ring-reddit-orange/40 focus:border-reddit-orange/50
                                   transition-all duration-200"
                      />
                    </div>

                    {/* Cookies textarea */}
                    <div>
                      <label
                        htmlFor={`account-cookies-${acct.slot}`}
                        className="block text-xs font-medium text-gray-400 mb-1.5"
                      >
                        Cookie JSON
                      </label>
                      <textarea
                        id={`account-cookies-${acct.slot}`}
                        value={editCookies[acct.slot] || ''}
                        onChange={(e) =>
                          setEditCookies((prev) => ({
                            ...prev,
                            [acct.slot]: e.target.value,
                          }))
                        }
                        placeholder='[{"name": "reddit_session", "value": "...", ...}]'
                        rows={6}
                        className="w-full bg-dark-900/80 border border-dark-500 rounded-lg px-3 py-2
                                   text-sm text-gray-300 placeholder-gray-600 font-mono
                                   focus:outline-none focus:ring-2 focus:ring-reddit-orange/40 focus:border-reddit-orange/50
                                   transition-all duration-200 resize-y"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        id={`account-save-${acct.slot}`}
                        onClick={() => handleSave(acct.slot)}
                        disabled={savingSlot === acct.slot}
                        className="px-5 py-2 rounded-lg text-sm font-semibold
                                   bg-gradient-to-r from-reddit-orange to-orange-600
                                   text-white shadow-lg shadow-reddit-orange/20
                                   hover:shadow-xl hover:shadow-reddit-orange/30
                                   hover:scale-[1.02] active:scale-[0.98]
                                   transition-all duration-200
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   flex items-center gap-2"
                      >
                        {savingSlot === acct.slot ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving…
                          </>
                        ) : (
                          'Save Account'
                        )}
                      </button>

                      <button
                        id={`account-clear-${acct.slot}`}
                        onClick={() => handleClear(acct.slot)}
                        disabled={clearingSlot === acct.slot || !acct.hasCookies}
                        className="px-5 py-2 rounded-lg text-sm font-medium
                                   bg-dark-700/60 border border-dark-500
                                   text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5
                                   transition-all duration-200
                                   disabled:opacity-30 disabled:cursor-not-allowed
                                   flex items-center gap-2"
                      >
                        {clearingSlot === acct.slot ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            Clearing…
                          </>
                        ) : (
                          'Clear Cookies'
                        )}
                      </button>
                    </div>

                    {/* Slot-level feedback */}
                    {fb && (
                      <div
                        className={`px-3 py-2 rounded-lg text-xs animate-slide-up flex items-center gap-2 ${
                          fb.type === 'success'
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}
                      >
                        {fb.type === 'success' ? '✓' : '✕'} {fb.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountManager;
