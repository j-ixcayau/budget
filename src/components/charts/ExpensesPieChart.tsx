'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { Transaction, UserSettings } from '@/types';
import { convertToBaseCurrency, formatCurrency } from '@/lib/currency';

interface ExpensesPieChartProps {
  transactions: Transaction[];
  settings: UserSettings;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export function ExpensesPieChart({ transactions, settings }: ExpensesPieChartProps) {
  const baseCurrency = settings.baseCurrency;

  // Filter expenses and group by category
  const expenses = transactions.filter((t) => t.type === 'expense');
  
  const categoryTotals = expenses.reduce((acc, t) => {
    const amount = convertToBaseCurrency(t.amount, t.currency, settings);
    acc[t.category] = (acc[t.category] || 0) + amount;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500">
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
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
          }}
          formatter={(value) => [formatCurrency(Number(value), baseCurrency), 'Amount']}
        />
        <Legend
          formatter={(value) => <span className="text-zinc-300 text-sm">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
