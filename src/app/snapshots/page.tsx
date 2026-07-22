'use client';

import { useMemo, useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { useAssets, useMonthlySnapshots, useUserSettings, useDebts } from '@/hooks/useFirestore';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useAuth } from '@/hooks/useAuth';
import { addMonthlySnapshot, deleteMonthlySnapshot, getCurrentMonth } from '@/lib/firestore';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  formatCurrency,
} from '@/lib/currency';
import type { MonthlySnapshot } from '@/types';

/** Returns a formatted date+time string, or null if no createdAt is available. */
function formatSnapshotDateTime(snapshot: MonthlySnapshot): { date: string; time: string | null } {
  if (snapshot.createdAt) {
    const d = snapshot.createdAt.toDate();
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  }
  // Legacy snapshot — parse YYYY-MM into a readable month name
  const [year, month] = snapshot.month.split('-');
  const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  return { date: label, time: null };
}

function NetWorthDelta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const delta = current - previous;
  const pct = previous !== 0 ? ((delta / Math.abs(previous)) * 100).toFixed(1) : null;
  const isPositive = delta >= 0;
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isPositive ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
      }`}
    >
      {isPositive ? '+' : ''}
      {formatCurrency(delta)}
      {pct !== null && ` (${isPositive ? '+' : ''}${pct}%)`}
    </span>
  );
}

export default function SnapshotsPage() {
  const { user } = useAuth();
  const { assets } = useAssets();
  const { debts: liabilities } = useDebts('i_owe');
  const { snapshots, loading } = useMonthlySnapshots();
  const { settings } = useUserSettings();
  const { prices } = useCryptoPrices(assets);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!user || !settings) return;
    setGenerating(true);
    try {
      const totalAssets = calculateTotalAssets(assets, settings, prices);
      const totalLiabilities = calculateTotalLiabilities(liabilities, settings);
      const netWorth = calculateNetWorth(assets, liabilities, settings, prices);

      await addMonthlySnapshot(user.uid, {
        month: getCurrentMonth(),
        totalAssets,
        totalLiabilities,
        netWorth,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    setDeletingId(id);
    try {
      await deleteMonthlySnapshot(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Group snapshots by month, keeping order (already sorted month desc from hook).
  // Within each month, sort by createdAt desc client-side (new snapshots have createdAt;
  // legacy snapshots without createdAt are placed last).
  const grouped = useMemo(() => {
    const groups = new Map<string, MonthlySnapshot[]>();
    for (const s of snapshots) {
      const existing = groups.get(s.month) ?? [];
      groups.set(s.month, [...existing, s]);
    }
    // Sort month keys descending, and within each group sort by createdAt desc
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(
        ([month, group]) =>
          [
            month,
            [...group].sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return b.createdAt.toMillis() - a.createdAt.toMillis();
              }
              if (a.createdAt) return -1; // a is newer (has timestamp)
              if (b.createdAt) return 1; // b is newer (has timestamp)
              return 0;
            }),
          ] as [string, MonthlySnapshot[]]
      );
  }, [snapshots]);

  const currentMonth = getCurrentMonth();

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Monthly Snapshots</h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              Track your net worth over time. Multiple snapshots per month are supported.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating || !settings}>
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </span>
            ) : (
              'Generate Snapshot'
            )}
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-hover/60 rounded-lg animate-pulse" />
              ))}
            </div>
          </Card>
        ) : snapshots.length === 0 ? (
          <Card>
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <svg
                className="w-12 h-12 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <div>
                <p className="text-text-secondary font-medium">No snapshots yet</p>
                <p className="text-text-tertiary text-sm mt-1">
                  Click &quot;Generate Snapshot&quot; to capture your current net worth.
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={generating || !settings}>
                Generate Snapshot
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([month, monthSnapshots]) => {
              const isCurrentMonth = month === currentMonth;
              // For the delta badge: compare latest of this month vs latest of previous group
              const latestInGroup = monthSnapshots[0];

              return (
                <div key={month}>
                  {/* Month header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-sm font-semibold text-text-secondary tracking-wide uppercase">
                      {month}
                    </h2>
                    {isCurrentMonth && (
                      <span className="text-xs bg-primary/20 text-secondary border border-primary/30 px-2 py-0.5 rounded-full">
                        Current Month
                      </span>
                    )}
                    <span className="text-xs text-text-tertiary">
                      {monthSnapshots.length === 1
                        ? '1 snapshot'
                        : `${monthSnapshots.length} snapshots`}
                    </span>
                  </div>

                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-text-tertiary text-xs border-b border-border uppercase tracking-wide">
                            <th className="pb-3 font-medium">Generated</th>
                            <th className="pb-3 font-medium">Assets</th>
                            <th className="pb-3 font-medium">Liabilities</th>
                            <th className="pb-3 font-medium">Net Worth</th>
                            <th className="pb-3 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthSnapshots.map((snapshot, i) => {
                            const isLatest = i === 0;
                            const { date, time } = formatSnapshotDateTime(snapshot);
                            const prev = monthSnapshots[i + 1];
                            return (
                              <tr
                                key={snapshot.id}
                                className={`border-b border-border last:border-0 ${
                                  isLatest ? 'bg-surface/40' : 'opacity-60'
                                }`}
                              >
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-2">
                                    {isLatest && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0 mt-0.5 self-start" />
                                    )}
                                    <div>
                                      <div
                                        className={`text-sm ${
                                          isLatest
                                            ? 'text-text-primary font-medium'
                                            : 'text-text-secondary'
                                        }`}
                                      >
                                        {date}
                                      </div>
                                      {time !== null ? (
                                        <div className="text-xs text-text-tertiary mt-0.5">
                                          {time}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-text-tertiary mt-0.5 italic">
                                          time not recorded
                                        </div>
                                      )}
                                    </div>
                                    {isLatest && monthSnapshots.length > 1 && (
                                      <span className="text-xs text-text-tertiary bg-surface-hover px-1.5 py-0.5 rounded self-start">
                                        latest
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 pr-4 text-success text-sm font-medium">
                                  {formatCurrency(snapshot.totalAssets, settings?.baseCurrency)}
                                </td>
                                <td className="py-3 pr-4 text-error text-sm font-medium">
                                  {formatCurrency(
                                    snapshot.totalLiabilities,
                                    settings?.baseCurrency
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-sm font-bold ${
                                        snapshot.netWorth >= 0 ? 'text-secondary' : 'text-error'
                                      }`}
                                    >
                                      {formatCurrency(snapshot.netWorth, settings?.baseCurrency)}
                                    </span>
                                    {prev && (
                                      <NetWorthDelta
                                        current={snapshot.netWorth}
                                        previous={prev.netWorth}
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 text-right">
                                  <button
                                    onClick={() => handleDelete(snapshot.id)}
                                    disabled={deletingId === snapshot.id}
                                    className="text-xs text-text-tertiary hover:text-error transition-colors disabled:opacity-40"
                                  >
                                    {deletingId === snapshot.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
