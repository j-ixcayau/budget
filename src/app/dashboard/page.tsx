'use client';

import { useMemo } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card } from '@/components/ui';
import { NetWorthChart, ExpensesPieChart } from '@/components/charts';
import {
  useTransactions,
  useAssets,
  useLiabilities,
  useMonthlySnapshots,
  useUserSettings,
} from '@/hooks/useFirestore';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  formatCurrency,
  convertToBaseCurrency,
} from '@/lib/currency';
import { getCurrentMonth, getMonthTransactions } from '@/lib/firestore';

export default function DashboardPage() {
  const { transactions } = useTransactions();
  const { assets } = useAssets();
  const { liabilities } = useLiabilities();
  const { snapshots } = useMonthlySnapshots();
  const { settings } = useUserSettings();

  const currentMonth = getCurrentMonth();

  const stats = useMemo(() => {
    if (!settings) return null;

    const totalAssets = calculateTotalAssets(assets, settings);
    const totalLiabilities = calculateTotalLiabilities(liabilities, settings);
    const netWorth = calculateNetWorth(assets, liabilities, settings);

    const monthTransactions = getMonthTransactions(transactions, currentMonth);
    const monthIncome = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + convertToBaseCurrency(t.amount, t.currency, settings), 0);
    const monthExpenses = monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + convertToBaseCurrency(t.amount, t.currency, settings), 0);

    return { totalAssets, totalLiabilities, netWorth, monthIncome, monthExpenses, monthTransactions };
  }, [assets, liabilities, transactions, settings, currentMonth]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <div className="text-sm text-zinc-400">Total Assets</div>
            <div className="text-2xl font-bold text-green-400">
              {stats ? formatCurrency(stats.totalAssets) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">Total Liabilities</div>
            <div className="text-2xl font-bold text-red-400">
              {stats ? formatCurrency(stats.totalLiabilities) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">Net Worth</div>
            <div className={`text-2xl font-bold ${stats && stats.netWorth >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {stats ? formatCurrency(stats.netWorth) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">This Month Income</div>
            <div className="text-2xl font-bold text-green-400">
              {stats ? formatCurrency(stats.monthIncome) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">This Month Expenses</div>
            <div className="text-2xl font-bold text-red-400">
              {stats ? formatCurrency(stats.monthExpenses) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">This Month Balance</div>
            <div className={`text-2xl font-bold ${stats && (stats.monthIncome - stats.monthExpenses) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats ? formatCurrency(stats.monthIncome - stats.monthExpenses) : '—'}
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Net Worth Trend">
            <NetWorthChart snapshots={snapshots} settings={settings} />
          </Card>
          <Card title="Expenses by Category">
            {settings && stats ? (
              <ExpensesPieChart transactions={stats.monthTransactions} settings={settings} />
            ) : (
              <div className="h-64 flex items-center justify-center text-zinc-500">Loading...</div>
            )}
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
