'use client';

import { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { DebtForm } from '@/components/forms';
import { useDebts } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useFirestore';
import {
  addDebt,
  updateDebt,
  deleteDebt,
  addDebtPayment,
  markDebtSettled,
} from '@/lib/firestore';
import { formatCurrency, convertToBaseCurrency } from '@/lib/currency';
import type { Debt, DebtFormData, Currency } from '@/types';

// ─── Tiny payment form ───────────────────────────────────────────────────────
interface PaymentFormProps {
  debt: Debt;
  onSubmit: (amount: number, date: string, note: string) => Promise<void>;
  onCancel: () => void;
}

function PaymentForm({ debt, onSubmit, onCancel }: PaymentFormProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (amt > debt.remainingAmount) { setError(`Max is ${formatCurrency(debt.remainingAmount, debt.currency)}`); return; }
    setError('');
    setLoading(true);
    try {
      await onSubmit(amt, date, note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-sm text-zinc-400">
        Outstanding:{' '}
        <span className="text-green-400 font-semibold">
          {formatCurrency(debt.remainingAmount, debt.currency)}
        </span>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Payment Amount ({debt.currency})</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={debt.remainingAmount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., Venmo, cash"
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
          {error}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Record Payment'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Due date badge helper ────────────────────────────────────────────────────
function DueDateBadge({ dueDate }: { dueDate?: Timestamp }) {
  if (!dueDate) return null;
  const due = dueDate.toDate();
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (diffDays < 0) {
    return (
      <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
        Overdue · {label}
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
        Due soon · {label}
      </span>
    );
  }
  return (
    <span className="text-xs bg-zinc-700/50 text-zinc-400 border border-zinc-600/30 px-2 py-0.5 rounded-full">
      Due {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type Tab = 'active' | 'settled';

export default function DebtsPage() {
  const { user } = useAuth();
  const { debts, loading, refresh } = useDebts();
  const { settings } = useUserSettings();

  const [tab, setTab] = useState<Tab>('active');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  // ─ Filtered lists
  const activeDebts = useMemo(() => debts.filter((d) => d.status === 'active'), [debts]);
  const settledDebts = useMemo(() => debts.filter((d) => d.status === 'settled'), [debts]);
  const displayedDebts = tab === 'active' ? activeDebts : settledDebts;

  // ─ Total outstanding in base currency
  const totalOutstanding = useMemo(() => {
    if (!settings) return null;
    return activeDebts.reduce(
      (sum, d) => sum + convertToBaseCurrency(d.remainingAmount, d.currency, settings),
      0
    );
  }, [activeDebts, settings]);

  // ─ Handlers
  const handleAdd = async (data: DebtFormData) => {
    if (!user) return;
    await addDebt(user.uid, data);
    await refresh();
    setIsAddOpen(false);
  };

  const handleEdit = async (data: DebtFormData) => {
    if (!editingDebt) return;
    await updateDebt(editingDebt.id, data);
    await refresh();
    setEditingDebt(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this debt and all its payments?')) return;
    await deleteDebt(id);
    await refresh();
  };

  const handleSettle = async (debt: Debt) => {
    if (!confirm(`Mark "${debt.personName}" as fully settled?`)) return;
    await markDebtSettled(debt.id);
    await refresh();
  };

  const handlePayment = async (amount: number, date: string, note: string) => {
    if (!user || !payingDebt) return;
    await addDebtPayment(
      user.uid,
      {
        debtId: payingDebt.id,
        amount,
        date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      payingDebt.remainingAmount
    );
    await refresh();
    setPayingDebt(null);
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">People Who Owe Me</h1>
            {totalOutstanding !== null && (
              <p className="text-sm text-zinc-400 mt-0.5">
                Total outstanding:{' '}
                <span className="text-green-400 font-semibold">
                  {formatCurrency(totalOutstanding, settings?.baseCurrency as Currency)}
                </span>
              </p>
            )}
          </div>
          <Button onClick={() => setIsAddOpen(true)}>Add Debt</Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800/60 rounded-lg p-1 w-fit">
          {(['active', 'settled'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t === 'active' ? `Active (${activeDebts.length})` : `Settled (${settledDebts.length})`}
            </button>
          ))}
        </div>

        {/* Debt list */}
        <Card>
          {loading ? (
            <div className="text-zinc-400">Loading...</div>
          ) : displayedDebts.length === 0 ? (
            <div className="text-zinc-400 py-4 text-center">
              {tab === 'active' ? 'No active debts. Nice!' : 'No settled debts yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedDebts.map((debt) => {
                const paidPct = debt.amount > 0 ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100 : 100;
                return (
                  <div
                    key={debt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-800/50 rounded-lg gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Person + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-100 font-semibold">{debt.personName}</span>
                        {debt.status === 'settled' && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Settled
                          </span>
                        )}
                        <DueDateBadge dueDate={debt.dueDate} />
                      </div>

                      {/* Amounts */}
                      <div className="flex gap-4 mt-1.5 flex-wrap">
                        <div>
                          <span className="text-zinc-500 text-xs">Remaining: </span>
                          <span className="text-green-400 font-semibold text-sm">
                            {formatCurrency(debt.remainingAmount, debt.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Original: </span>
                          <span className="text-zinc-300 text-sm">
                            {formatCurrency(debt.amount, debt.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {debt.amount > 0 && (
                        <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden w-48 max-w-full">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, paidPct)}%` }}
                          />
                        </div>
                      )}

                      {/* Note */}
                      {debt.note && (
                        <div className="text-xs text-zinc-500 mt-1">{debt.note}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap shrink-0">
                      {debt.status === 'active' && (
                        <>
                          <button
                            onClick={() => setPayingDebt(debt)}
                            className="text-xs bg-green-600/10 text-green-400 hover:bg-green-600 hover:text-white border border-green-600/30 px-3 py-1.5 rounded-md transition-all"
                          >
                            Record Payment
                          </button>
                          <button
                            onClick={() => handleSettle(debt)}
                            className="text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-md transition-all"
                          >
                            Settle
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setEditingDebt(debt)}
                        className="text-xs text-blue-400 hover:text-blue-300 border border-blue-600/30 hover:border-blue-400/50 px-3 py-1.5 rounded-md transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-600/30 hover:border-red-400/50 px-3 py-1.5 rounded-md transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Debt">
        <DebtForm onSubmit={handleAdd} onCancel={() => setIsAddOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingDebt} onClose={() => setEditingDebt(null)} title="Edit Debt">
        {editingDebt && (
          <DebtForm
            initialData={editingDebt}
            onSubmit={handleEdit}
            onCancel={() => setEditingDebt(null)}
          />
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={!!payingDebt}
        onClose={() => setPayingDebt(null)}
        title={`Record Payment — ${payingDebt?.personName}`}
      >
        {payingDebt && (
          <PaymentForm
            debt={payingDebt}
            onSubmit={handlePayment}
            onCancel={() => setPayingDebt(null)}
          />
        )}
      </Modal>
    </AuthGuard>
  );
}
