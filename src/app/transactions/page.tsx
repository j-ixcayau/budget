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

export default function TransactionsPage() {
  const { user } = useAuth();
  const { transactions, loading, refresh } = useTransactions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('all');

  const handleAdd = async (data: TransactionFormData) => {
    if (!user) return;
    await addTransaction(user.uid, data);
    await refresh();
    setIsModalOpen(false);
  };

  const handleEdit = async (data: TransactionFormData) => {
    if (!editingTransaction) return;
    await updateTransaction(editingTransaction.id, data);
    await refresh();
    setEditingTransaction(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(id);
    await refresh();
  };

  // Build list of unique months from transactions
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t) => {
      const d = t.date.toDate();
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(m);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const filtered = useMemo(() => {
    if (selectedMonth === 'all') return transactions;
    return transactions.filter((t) => {
      const d = t.date.toDate();
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return m === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-zinc-100">Transactions</h1>
          <div className="flex items-center gap-3">
            {monthOptions.length > 0 && (
              <Select
                label=""
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                options={[
                  { value: 'all', label: 'All months' },
                  ...monthOptions.map((m) => ({ value: m, label: m })),
                ]}
              />
            )}
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
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-zinc-300 font-medium">No transactions yet</p>
                <p className="text-zinc-500 text-sm mt-1">
                  {selectedMonth !== 'all' ? 'No transactions for this month.' : 'Add your first transaction to get started.'}
                </p>
              </div>
              {selectedMonth === 'all' && (
                <Button onClick={() => setIsModalOpen(true)}>Add Transaction</Button>
              )}
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
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-800/50">
                      <td className="py-3 text-zinc-300 text-sm">
                        {t.date.toDate().toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          t.type === 'income' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-300 text-sm">{t.category}</td>
                      <td className={`py-3 font-medium text-sm ${
                        t.type === 'income' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="py-3 text-zinc-400 text-sm hidden sm:table-cell">{t.note || '—'}</td>
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
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add Transaction"
        >
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
