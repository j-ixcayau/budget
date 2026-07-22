'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/layout';
import { Card, Modal } from '@/components/ui';
import { NetWorthChart, ExpensesPieChart } from '@/components/charts';
import { NetWorthHero } from '@/components/dashboard/NetWorthHero';
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

    // Month-over-month net worth delta from the most recent prior snapshot.
    const priorSnapshot = [...snapshots]
      .filter((s) => s.month < currentMonth)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    const deltaPct =
      priorSnapshot && priorSnapshot.netWorth !== 0
        ? ((netWorth - priorSnapshot.netWorth) / Math.abs(priorSnapshot.netWorth)) * 100
        : null;

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
      deltaPct,
    };
  }, [
    assets,
    liabilities,
    transactions,
    settings,
    currentMonth,
    recurringExpenses,
    owedDebts,
    snapshots,
  ]);

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
          <div className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/20 rounded-md">
            <svg
              className="w-5 h-5 text-warning shrink-0"
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
              <p className="text-sm font-medium text-warning">Monthly balance update needed</p>
              <p className="text-xs text-warning/70 mt-0.5">
                Update your asset balances and generate a snapshot for {currentMonth} to keep your
                net worth history accurate.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/assets"
                className="bg-warning/20 text-warning hover:bg-warning/30 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Update Balances
              </Link>
              <Link
                href="/snapshots"
                className="bg-surface-hover text-text-secondary hover:bg-surface-raised hover:text-text-primary px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Snapshots
              </Link>
            </div>
          </div>
        )}

        {/* Summary — Net Worth hero + compact secondary metrics */}
        <NetWorthHero
          netWorth={stats?.netWorth ?? 0}
          deltaPct={stats?.deltaPct ?? null}
          monthBalance={stats ? stats.monthIncome - stats.monthExpenses : 0}
          debtsOwedToMe={stats?.totalDebtsOwed ?? 0}
          currency={settings?.baseCurrency}
          loading={!stats}
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-xs font-medium text-text-secondary">Total Assets</div>
            <div className="mt-1 font-fira-code text-xl font-bold text-success tabular-nums">
              {stats ? formatCurrency(stats.totalAssets, settings?.baseCurrency) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-xs font-medium text-text-secondary">Total Liabilities</div>
            <div className="mt-1 font-fira-code text-xl font-bold text-error tabular-nums">
              {stats ? formatCurrency(stats.totalLiabilities, settings?.baseCurrency) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-xs font-medium text-text-secondary">This Month Income</div>
            <div className="mt-1 font-fira-code text-xl font-bold text-success tabular-nums">
              {stats ? formatCurrency(stats.monthIncome, settings?.baseCurrency) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-text-secondary">This Month Expenses</div>
              <Link
                href="/debts"
                className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                Debts →
              </Link>
            </div>
            <div className="mt-1 font-fira-code text-xl font-bold text-error tabular-nums">
              {stats ? formatCurrency(stats.monthExpenses, settings?.baseCurrency) : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bills This Month Widget */}
          <div className="lg:col-span-1">
            <Card
              title={`Bills This Month${stats && stats.pendingCount > 0 ? ` · ${stats.pendingCount} pending` : ''}`}
            >
              <div className="space-y-3">
                {!stats || stats.billStatuses.length === 0 ? (
                  <div className="text-sm text-text-tertiary py-4 flex flex-col items-center gap-2">
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
                      ? { text: 'Paid', cls: 'bg-success/10 text-success' }
                      : overdue
                        ? { text: 'Overdue', cls: 'bg-error/10 text-error' }
                        : { text: 'Pending', cls: 'bg-warning/10 text-warning' };
                    return (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between p-3 bg-surface-hover rounded-md group transition-colors hover:bg-surface-raised"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {bill.name}
                            </span>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}
                            >
                              {badge.text}
                            </span>
                          </div>
                          <div className="text-xs text-text-secondary">
                            Due day: {bill.dayOfMonth} •{' '}
                            {formatCurrency(bill.defaultAmount, bill.currency)}
                          </div>
                        </div>
                        {!paid && (
                          <button
                            onClick={() => setLogExpense(bill)}
                            className="shrink-0 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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
                <div className="h-64 flex items-center justify-center text-text-tertiary">
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
