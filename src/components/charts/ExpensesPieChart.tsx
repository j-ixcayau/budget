'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { Transaction, UserSettings } from '@/types';
import { convertToBaseCurrency, formatCurrency } from '@/lib/currency';

interface ExpensesPieChartProps {
  transactions: Transaction[];
  settings: UserSettings;
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
];

export function ExpensesPieChart({ transactions, settings }: ExpensesPieChartProps) {
  const baseCurrency = settings.baseCurrency;

  // Filter expenses and group by category
  const expenses = transactions.filter((t) => t.type === 'expense');

  const categoryTotals = expenses.reduce(
    (acc, t) => {
      const amount = convertToBaseCurrency(t.amount, t.currency, settings);
      acc[t.category] = (acc[t.category] || 0) + amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const data = useMemo(() => {
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [categoryTotals]);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const renderTooltip = ({ active, payload }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const name = String(entry.name ?? '');
    const value = Number(entry.value ?? 0);
    const color = (entry.payload as { fill?: string } | undefined)?.fill;
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="glass-card rounded-md px-3 py-2 text-sm shadow-lg">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-text-primary">{name}</span>
        </div>
        <div className="mt-1 font-fira-code tabular-nums text-text-secondary">
          {formatCurrency(value, baseCurrency)}
          <span className="ml-1.5 text-text-tertiary">({pct.toFixed(1)}%)</span>
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-text-tertiary">
        No expenses this month.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={renderTooltip} />
        <Legend
          formatter={(value) => <span className="text-text-secondary text-sm">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
