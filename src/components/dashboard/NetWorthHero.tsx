'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/currency';
import type { Currency } from '@/types';

/** Animates a number from its previous value up to `value` with an ease-out curve. */
function useCountUp(value: number, ms = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const frame = (t: number) => {
      const p = Math.min((t - start) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return display;
}

interface NetWorthHeroProps {
  netWorth: number;
  /** Percent change vs last month; null when there's no prior snapshot. */
  deltaPct: number | null;
  monthBalance: number;
  debtsOwedToMe: number;
  currency?: Currency;
  loading?: boolean;
}

export function NetWorthHero({
  netWorth,
  deltaPct,
  monthBalance,
  debtsOwedToMe,
  currency,
  loading = false,
}: NetWorthHeroProps) {
  const animated = useCountUp(netWorth);
  const positive = (deltaPct ?? 0) >= 0;
  const balancePositive = monthBalance >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Net Worth hero — primary column */}
      <div className="lg:col-span-2 rounded-lg border border-primary/25 bg-gradient-to-br from-surface-raised to-surface p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Net Worth
        </p>
        <p className="mt-2 font-fira-code text-4xl font-bold tabular-nums text-text-primary sm:text-5xl">
          {loading ? '—' : formatCurrency(animated, currency)}
        </p>
        {deltaPct !== null && !loading ? (
          <p className={`mt-2 text-sm font-medium ${positive ? 'text-success' : 'text-error'}`}>
            {positive ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}% vs last month
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-tertiary">
            {loading ? ' ' : 'No prior snapshot to compare'}
          </p>
        )}
      </div>

      {/* Secondary metrics — compact column */}
      <div className="flex flex-col gap-4">
        <div className="flex-1 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-secondary">This month</p>
          <p
            className={`mt-1 font-fira-code text-2xl font-bold tabular-nums ${
              balancePositive ? 'text-success' : 'text-error'
            }`}
          >
            {loading
              ? '—'
              : `${balancePositive ? '+' : ''}${formatCurrency(monthBalance, currency)}`}
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-secondary">Debts owed to me</p>
          <p className="mt-1 font-fira-code text-2xl font-bold tabular-nums text-text-primary">
            {loading ? '—' : formatCurrency(debtsOwedToMe, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
