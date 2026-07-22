'use client';

import { useState, useMemo } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal, Select, SkeletonList, useToast } from '@/components/ui';
import { TransactionForm } from '@/components/forms';
import { useTransactions } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import type { Currency, Transaction, TransactionFormData } from '@/types';

/** Returns "YYYY-MM" for the current local month. */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Builds a list of the last N months in "YYYY-MM" format, newest first. */
function buildMonthOptions(count = 6): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

export default function TransactionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const { transactions, loading } = useTransactions(selectedMonth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleAdd = async (data: TransactionFormData) => {
    if (!user) return;
    await addTransaction(user.uid, data);
    setIsModalOpen(false);
    toast.success('Transaction added');
  };

  const handleEdit = async (data: TransactionFormData) => {
    if (!editingTransaction) return;
    await updateTransaction(editingTransaction.id, data);
    setEditingTransaction(null);
    toast.success('Transaction updated');
  };

  const handleDelete = async (t: Transaction) => {
    await deleteTransaction(t.id);
    // Rebuild the form data so "Undo" can restore the record.
    const restore: TransactionFormData = {
      date: t.date,
      amount: t.amount,
      type: t.type,
      category: t.category,
      currency: t.currency,
      ...(t.note !== undefined ? { note: t.note } : {}),
    };
    toast.success('Transaction deleted', {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: async () => {
          if (!user) return;
          await addTransaction(user.uid, restore);
        },
      },
    });
  };

  const handleExportCSV = () => {
    if (!transactions.length) return;

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Note'];
    const rows = transactions.map((t) => [
      t.date.toDate().toLocaleDateString(),
      t.type,
      t.category,
      t.amount.toString(),
      t.currency,
      t.note || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Friendly label for the currently selected month
  const selectedLabel = useMemo(
    () => MONTH_OPTIONS.find((o) => o.value === selectedMonth)?.label ?? selectedMonth,
    [selectedMonth]
  );

  const expensesSummary = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type === 'expense') {
        totals[t.currency] = (totals[t.currency] || 0) + t.amount;
      }
    });
    return Object.entries(totals)
      .map(([curr, amt]) => formatCurrency(amt, curr as Currency))
      .join(' | ');
  }, [transactions]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Transactions</h1>
            {!loading && (
              <p className="text-sm text-text-secondary mt-1">
                Total Expenses:{' '}
                <span className="font-medium text-error">
                  {expensesSummary || formatCurrency(0)}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Select
              label=""
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={MONTH_OPTIONS}
            />
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              disabled={transactions.length === 0}
            >
              Export CSV
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>Add Transaction</Button>
          </div>
        </div>

        <Card>
          {loading ? (
            <SkeletonList rows={5} rowClassName="h-10" />
          ) : transactions.length === 0 ? (
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <div>
                <p className="text-text-primary font-medium">No transactions</p>
                <p className="text-text-secondary text-sm mt-1">
                  No transactions found for {selectedLabel}.
                </p>
              </div>
              <Button onClick={() => setIsModalOpen(true)}>Add Transaction</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-text-secondary text-sm border-b border-border">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium hidden sm:table-cell">Note</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/60 transition-colors hover:bg-surface-hover/40"
                    >
                      <td className="py-3 text-text-secondary text-sm">
                        {t.date.toDate().toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            t.type === 'income'
                              ? 'bg-success/15 text-success'
                              : 'bg-error/15 text-error'
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="py-3 text-text-primary text-sm">{t.category}</td>
                      <td
                        className={`py-3 font-fira-code font-medium text-sm tabular-nums ${
                          t.type === 'income' ? 'text-success' : 'text-error'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="py-3 text-text-secondary text-sm hidden sm:table-cell">
                        {t.note || '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingTransaction(t)}
                            className="rounded-sm px-2.5 py-1.5 text-sm text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="rounded-sm px-2.5 py-1.5 text-sm text-error hover:bg-error/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Transaction">
          <TransactionForm onSubmit={handleAdd} onCancel={() => setIsModalOpen(false)} />
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          title="Edit Transaction"
        >
          {editingTransaction && (
            <TransactionForm
              initialData={editingTransaction}
              onSubmit={handleEdit}
              onCancel={() => setEditingTransaction(null)}
            />
          )}
        </Modal>
      </div>
    </AuthGuard>
  );
}
