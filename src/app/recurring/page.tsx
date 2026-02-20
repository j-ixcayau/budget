'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { RecurringExpenseForm } from '@/components/forms';
import { useRecurringExpenses } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { addRecurringExpense, updateRecurringExpense, deleteRecurringExpense } from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import type { RecurringExpense, RecurringExpenseFormData } from '@/types';

export default function RecurringPage() {
  const { user } = useAuth();
  const { recurringExpenses, loading, refresh } = useRecurringExpenses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);

  const handleAdd = async (data: RecurringExpenseFormData) => {
    if (!user) return;
    await addRecurringExpense(user.uid, data);
    await refresh();
    setIsModalOpen(false);
  };

  const handleEdit = async (data: RecurringExpenseFormData) => {
    if (!editingExpense) return;
    await updateRecurringExpense(editingExpense.id, data);
    await refresh();
    setEditingExpense(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring expense?')) return;
    await deleteRecurringExpense(id);
    await refresh();
  };

  const handleToggleActive = async (expense: RecurringExpense) => {
    await updateRecurringExpense(expense.id, { isActive: !expense.isActive });
    await refresh();
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Recurring Expenses</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage your monthly bills and subscriptions.</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>Add Recurring</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recurringExpenses.length === 0 ? (
          <Card>
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-zinc-300 font-medium">No recurring expenses yet</p>
                <p className="text-zinc-500 text-sm mt-1">Add your monthly bills like rent, internet, or Netflix.</p>
              </div>
              <Button onClick={() => setIsModalOpen(true)}>Add Recurring Expense</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recurringExpenses.map((expense) => (
              <div 
                key={expense.id} 
                className={`bg-zinc-900 border ${expense.isActive ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'} rounded-xl p-5 flex flex-col justify-between transition-all`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-zinc-100">{expense.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      expense.isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {expense.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-2 mb-4">
                    <span className="bg-zinc-800 px-2 py-0.5 rounded-full">{expense.category}</span>
                    <span>•</span>
                    <span>Due on day {expense.dayOfMonth}</span>
                  </div>
                  <div className="text-xl font-bold text-zinc-100 flex items-baseline gap-1">
                    {formatCurrency(expense.defaultAmount, expense.currency)}
                    {!expense.isFixed && <span className="text-[10px] text-zinc-500 font-normal ml-1">approx</span>}
                  </div>
                  {expense.note && (
                    <p className="text-xs text-zinc-400 mt-2 italic line-clamp-1">{expense.note}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-zinc-800/50">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingExpense(expense)}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleActive(expense)}
                    className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {expense.isActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add Recurring Expense"
        >
          <RecurringExpenseForm onSubmit={handleAdd} onCancel={() => setIsModalOpen(false)} />
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          title="Edit Recurring Expense"
        >
          {editingExpense && (
            <RecurringExpenseForm
              initialData={editingExpense}
              onSubmit={handleEdit}
              onCancel={() => setEditingExpense(null)}
            />
          )}
        </Modal>
      </div>
    </AuthGuard>
  );
}
