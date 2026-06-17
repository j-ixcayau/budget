'use client';

import { useState, useMemo } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal, Select } from '@/components/ui';
import { TransactionForm } from '@/components/forms';
import { useTransactions } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import type { Transaction, TransactionFormData } from '@/types';

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
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const { transactions, loading } = useTransactions(selectedMonth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleAdd = async (data: TransactionFormData) => {
    if (!user) return;
    await addTransaction(user.uid, data);
    setIsModalOpen(false);
  };

  const handleEdit = async (data: TransactionFormData) => {
    if (!editingTransaction) return;
    await updateTransaction(editingTransaction.id, data);
    setEditingTransaction(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(id);
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
      .map(([curr, amt]) => formatCurrency(amt, curr as any))
      .join(' | ');
  }, [transactions]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Transactions</h1>
            {!loading && (
              <p className="text-sm text-zinc-400 mt-1">
                Total Expenses:{' '}
                <span className="font-medium text-red-400">
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
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-zinc-800/60 rounded animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <svg
                className="w-12 h-12 text-zinc-700"
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
                <p className="text-zinc-300 font-medium">No transactions</p>
                <p className="text-zinc-500 text-sm mt-1">
                  No transactions found for {selectedLabel}.
                </p>
              </div>
              <Button onClick={() => setIsModalOpen(true)}>Add Transaction</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-zinc-400 text-sm border-b border-zinc-800">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium hidden sm:table-cell">Note</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-800/50">
                      <td className="py-3 text-zinc-300 text-sm">
                        {t.date.toDate().toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            t.type === 'income'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-300 text-sm">{t.category}</td>
                      <td
                        className={`py-3 font-medium text-sm ${
                          t.type === 'income' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="py-3 text-zinc-400 text-sm hidden sm:table-cell">
                        {t.note || '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingTransaction(t)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
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
