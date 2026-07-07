'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { NetWorthChart, ExpensesPieChart } from '@/components/charts';
import { TransactionForm } from '@/components/forms';
import { useAuth } from '@/hooks/useAuth';
import {
  useTransactions,
  useAssets,
  useMonthlySnapshots,
  useUserSettings,
  useRecurringExpenses,
  useDebts,
} from '@/hooks/useFirestore';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  formatCurrency,
  convertToBaseCurrency,
} from '@/lib/currency';
import { getCurrentMonth, getMonthTransactions, addTransaction } from '@/lib/firestore';
import { getMonthlyBillStatuses } from '@/lib/recurring';
import type { RecurringExpense, TransactionFormData } from '@/types';
import { Timestamp } from 'firebase/firestore';

export default function DashboardPage() {
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { assets } = useAssets();
  const { debts: liabilities } = useDebts('i_owe');
  const { snapshots } = useMonthlySnapshots();
  const { settings } = useUserSettings();
  const { recurringExpenses } = useRecurringExpenses();
  const { debts: owedDebts } = useDebts('owed_to_me');

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

    // Full status for every active bill this month (paid / pending / overdue)
    const billStatuses = getMonthlyBillStatuses(recurringExpenses, transactions);
    const pendingCount = billStatuses.filter((s) => !s.currentCyclePaid || s.isPrevOverdue).length;

    const totalDebtsOwed = owedDebts
      .filter((d) => d.status === 'active')
      .reduce((sum, d) => sum + convertToBaseCurrency(d.remainingAmount, d.currency, settings), 0);

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      monthIncome,
      monthExpenses,
      monthTransactions,
      billStatuses,
      pendingCount,
      totalDebtsOwed,
    };
  }, [assets, liabilities, transactions, settings, currentMonth, recurringExpenses, owedDebts]);

  const handleLogBill = async (data: TransactionFormData) => {
    if (!user) return;
    await addTransaction(user.uid, data);
    setLogExpense(null);
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

        {!hasCurrentMonthSnapshot && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <svg
              className="w-5 h-5 text-amber-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">Monthly balance update needed</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Update your asset balances and generate a snapshot for {currentMonth} to keep your
                net worth history accurate.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/assets"
                className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Update Balances
              </Link>
              <Link
                href="/snapshots"
                className="bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Snapshots
              </Link>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <div className="text-sm text-white/60">Total Assets</div>
            <div className="text-2xl font-bold text-emerald-400 font-fira-code">
              {stats ? formatCurrency(stats.totalAssets, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-white/60">Total Liabilities</div>
            <div className="text-2xl font-bold text-red-500 font-fira-code">
              {stats ? formatCurrency(stats.totalLiabilities, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-white/60">Net Worth</div>
            <div
              className={`text-2xl font-bold font-fira-code ${stats && stats.netWorth >= 0 ? 'text-blue-400' : 'text-red-500'}`}
            >
              {stats ? formatCurrency(stats.netWorth, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-white/60">This Month Income</div>
            <div className="text-2xl font-bold text-emerald-400 font-fira-code">
              {stats ? formatCurrency(stats.monthIncome, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-white/60">This Month Expenses</div>
            <div className="text-2xl font-bold text-red-500 font-fira-code">
              {stats ? formatCurrency(stats.monthExpenses, settings?.baseCurrency) : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-white/60">This Month Balance</div>
            <div
              className={`text-2xl font-bold font-fira-code ${stats && stats.monthIncome - stats.monthExpenses >= 0 ? 'text-emerald-400' : 'text-red-500'}`}
            >
              {stats
                ? formatCurrency(stats.monthIncome - stats.monthExpenses, settings?.baseCurrency)
                : '—'}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-white/60">Outstanding Debts Owed Me</div>
            <div className="text-2xl font-bold text-emerald-400 font-fira-code">
              {stats ? formatCurrency(stats.totalDebtsOwed, settings?.baseCurrency) : '—'}
            </div>
            <Link
              href="/debts"
              className="text-xs text-white/40 hover:text-white/80 mt-1 inline-block transition-colors"
            >
              View debts →
            </Link>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bills This Month Widget */}
          <div className="lg:col-span-1">
            <Card
              title={`Bills This Month${stats && stats.pendingCount > 0 ? ` · ${stats.pendingCount} pending` : ''}`}
            >
              <div className="space-y-3">
                {!stats || stats.billStatuses.length === 0 ? (
                  <div className="text-sm text-zinc-500 py-4 flex flex-col items-center gap-2">
                    <svg
                      className="w-8 h-8 opacity-20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    No recurring bills yet.
                  </div>
                ) : (
                  stats.billStatuses.map((s) => {
                    const bill = s.expense;
                    const paid = s.currentCyclePaid && !s.isPrevOverdue;
                    const overdue = s.isOverdue || s.isPrevOverdue;
                    const badge = paid
                      ? { text: 'Paid', cls: 'bg-emerald-500/10 text-emerald-400' }
                      : overdue
                        ? { text: 'Overdue', cls: 'bg-red-500/10 text-red-400' }
                        : { text: 'Pending', cls: 'bg-amber-500/10 text-amber-400' };
                    return (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-100 truncate">
                              {bill.name}
                            </span>
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.cls}`}
                            >
                              {badge.text}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            Due day: {bill.dayOfMonth} •{' '}
                            {formatCurrency(bill.defaultAmount, bill.currency)}
                          </div>
                        </div>
                        {!paid && (
                          <button
                            onClick={() => setLogExpense(bill)}
                            className="shrink-0 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-md text-xs font-medium transition-all"
                          >
                            Log
                          </button>
                        )}
                      </div>
                    );
                  })
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
                <div className="h-64 flex items-center justify-center text-zinc-500">
                  Loading...
                </div>
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
