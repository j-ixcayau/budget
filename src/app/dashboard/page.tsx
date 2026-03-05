'use client';

import { useMemo, useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { NetWorthChart, ExpensesPieChart } from '@/components/charts';
import { TransactionForm } from '@/components/forms';
import { useAuth } from '@/hooks/useAuth';
import {
  useTransactions,
  useAssets,
  useLiabilities,
  useMonthlySnapshots,
  useUserSettings,
  useRecurringExpenses,
} from '@/hooks/useFirestore';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  formatCurrency,
  convertToBaseCurrency,
} from '@/lib/currency';
import { getCurrentMonth, getMonthTransactions, addTransaction } from '@/lib/firestore';
import { getPendingBills } from '@/lib/recurring';
import type { RecurringExpense, TransactionFormData } from '@/types';
import { Timestamp } from 'firebase/firestore';

export default function DashboardPage() {
  const { user } = useAuth();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const { assets } = useAssets();
  const { liabilities } = useLiabilities();
  const { snapshots } = useMonthlySnapshots();
  const { settings } = useUserSettings();
  const { recurringExpenses } = useRecurringExpenses();

  const [logExpense, setLogExpense] = useState<RecurringExpense | null>(null);

  const currentMonth = getCurrentMonth();

  const hasCurrentMonthSnapshot = snapshots.some((s) => s.month === currentMonth);

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

    // Calculate pending bills using shared utility
    const pendingBills = getPendingBills(recurringExpenses, monthTransactions);

    return { totalAssets, totalLiabilities, netWorth, monthIncome, monthExpenses, monthTransactions, pendingBills };
  }, [assets, liabilities, transactions, settings, currentMonth, recurringExpenses]);

  const handleLogBill = async (data: TransactionFormData) => {
    if (!user) return;
    await addTransaction(user.uid, data);
    await refreshTransactions();
    setLogExpense(null);
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>

        {!hasCurrentMonthSnapshot && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">Monthly balance update needed</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Update your asset balances and generate a snapshot for {currentMonth} to keep your net worth history accurate.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <a
                href="/assets"
                className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Update Balances
              </a>
              <a
                href="/snapshots"
                className="bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Snapshots
              </a>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <div className="text-sm text-zinc-400">Total Assets</div>
            <div className="text-2xl font-bold text-green-400">
              {stats ? formatCurrency(stats.totalAssets, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">Total Liabilities</div>
            <div className="text-2xl font-bold text-red-400">
              {stats ? formatCurrency(stats.totalLiabilities, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">Net Worth</div>
            <div className={`text-2xl font-bold ${stats && stats.netWorth >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {stats ? formatCurrency(stats.netWorth, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">This Month Income</div>
            <div className="text-2xl font-bold text-green-400">
              {stats ? formatCurrency(stats.monthIncome, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">This Month Expenses</div>
            <div className="text-2xl font-bold text-red-400">
              {stats ? formatCurrency(stats.monthExpenses, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-zinc-400">This Month Balance</div>
            <div className={`text-2xl font-bold ${stats && (stats.monthIncome - stats.monthExpenses) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats ? formatCurrency(stats.monthIncome - stats.monthExpenses, settings?.baseCurrency) : '—'}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Bills Widget */}
          <div className="lg:col-span-1">
            <Card title="Pending Bills This Month">
              <div className="space-y-4">
                {!stats || stats.pendingBills.length === 0 ? (
                  <div className="text-sm text-zinc-500 py-4 flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    All caught up!
                  </div>
                ) : (
                  stats.pendingBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg group">
                      <div>
                        <div className="text-sm font-medium text-zinc-100">{bill.name}</div>
                        <div className="text-xs text-zinc-500">
                          Due day: {bill.dayOfMonth} • {formatCurrency(bill.defaultAmount, bill.currency)}
                        </div>
                      </div>
                      <button
                        onClick={() => setLogExpense(bill)}
                        className="bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-md text-xs font-medium transition-all"
                      >
                        Log
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Log Expense Modal */}
      <Modal
        isOpen={!!logExpense}
        onClose={() => setLogExpense(null)}
        title={`Log Bill: ${logExpense?.name}`}
      >
        {logExpense && (
          <TransactionForm
            initialData={{
              id: 'temp',
              userId: user?.uid || '',
              date: Timestamp.now(),
              amount: logExpense.defaultAmount,
              type: 'expense',
              category: logExpense.category,
              currency: logExpense.currency,
              note: `Monthly ${logExpense.name}`,
            }}
            onSubmit={handleLogBill}
            onCancel={() => setLogExpense(null)}
          />
        )}
      </Modal>
    </AuthGuard>
  );
}
