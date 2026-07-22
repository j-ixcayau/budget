'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { RecurringExpenseForm } from '@/components/forms';
import { useRecurringExpenses } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import {
  addRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
} from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import type { RecurringExpense, RecurringExpenseFormData } from '@/types';

export default function RecurringPage() {
  const { user } = useAuth();
  const { recurringExpenses, loading } = useRecurringExpenses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);

  const handleAdd = async (data: RecurringExpenseFormData) => {
    if (!user) return;
    await addRecurringExpense(user.uid, data);
    setIsModalOpen(false);
  };

  const handleEdit = async (data: RecurringExpenseFormData) => {
    if (!editingExpense) return;
    await updateRecurringExpense(editingExpense.id, data);
    setEditingExpense(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring expense?')) return;
    await deleteRecurringExpense(id);
  };

  const handleToggleActive = async (expense: RecurringExpense) => {
    await updateRecurringExpense(expense.id, { isActive: !expense.isActive });
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Recurring Expenses</h1>
            <p className="text-text-tertiary text-sm mt-1">
              Manage your monthly bills and subscriptions.
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>Add Recurring</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 bg-surface border border-border rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : recurringExpenses.length === 0 ? (
          <Card>
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-text-secondary font-medium">No recurring expenses yet</p>
                <p className="text-text-tertiary text-sm mt-1">
                  Add your monthly bills like rent, internet, or Netflix.
                </p>
              </div>
              <Button onClick={() => setIsModalOpen(true)}>Add Recurring Expense</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recurringExpenses.map((expense) => (
              <div
                key={expense.id}
                className={`bg-surface border ${expense.isActive ? 'border-border' : 'border-border opacity-60'} rounded-xl p-5 flex flex-col justify-between transition-all`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-text-primary">{expense.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        expense.isActive
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-hover text-text-tertiary'
                      }`}
                    >
                      {expense.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="text-xs text-text-tertiary flex items-center gap-2 mb-4">
                    <span className="bg-surface-hover px-2 py-0.5 rounded-full">
                      {expense.category}
                    </span>
                    <span>•</span>
                    <span>Due on day {expense.dayOfMonth}</span>
                  </div>
                  <div className="text-xl font-bold text-text-primary flex items-baseline gap-1">
                    {formatCurrency(expense.defaultAmount, expense.currency)}
                    {!expense.isFixed && (
                      <span className="text-[10px] text-text-tertiary font-normal ml-1">
                        approx
                      </span>
                    )}
                  </div>
                  {expense.note && (
                    <p className="text-xs text-text-secondary mt-2 italic line-clamp-1">
                      {expense.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingExpense(expense)}
                      className="text-xs font-medium text-secondary hover:text-secondary transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-xs font-medium text-error hover:text-error transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleActive(expense)}
                    className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
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
