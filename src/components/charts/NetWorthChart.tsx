'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { MonthlySnapshot, UserSettings } from '@/types';
import { formatCurrency } from '@/lib/currency';

interface NetWorthChartProps {
  snapshots: MonthlySnapshot[];
  settings?: UserSettings | null;
}

export function NetWorthChart({ snapshots, settings }: NetWorthChartProps) {
  const baseCurrency = settings?.baseCurrency ?? 'Q';

  // Snapshots come in sorted by createdAt desc — deduplicate by month keeping
  // the latest snapshot per month, then sort ascending for the chart X axis.
  const data = useMemo(() => {
    const latestPerMonth = new Map<string, MonthlySnapshot>();
    for (const s of snapshots) {
      if (!latestPerMonth.has(s.month)) {
        latestPerMonth.set(s.month, s);
      }
    }
    return [...latestPerMonth.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((s) => ({ month: s.month, netWorth: s.netWorth }));
  }, [snapshots]);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-text-tertiary">
        No snapshot data yet. Generate a monthly snapshot to see your net worth trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data}>
        <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#71717a"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${formatCurrency(value / 1000, baseCurrency)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#a1a1aa' }}
          formatter={(value) => [formatCurrency(Number(value), baseCurrency), 'Net Worth']}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
