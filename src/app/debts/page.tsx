'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  getDebtPayments,
} from '@/lib/firestore';
import { formatCurrency, convertToBaseCurrency } from '@/lib/currency';
import type { Debt, DebtFormData, DebtPayment, DebtTransactionType, Currency } from '@/types';

// ─── Transaction history panel ────────────────────────────────────────────────
function DebtHistory({ debt }: { debt: Debt }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const results = await getDebtPayments(debt.id, user.uid);
      setPayments(results);
    } finally {
      setLoading(false);
    }
  }, [debt.id, user]);

  // Reload whenever the panel is opened
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors group"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {open ? 'Hide history' : 'Show history'}
      </button>

      {open && (
        <div className="mt-2 ml-1 pl-3 border-l border-zinc-700/60 space-y-2">
          {loading ? (
            <p className="text-xs text-zinc-500 py-1">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="text-xs text-zinc-600 py-1">No transactions recorded yet.</p>
          ) : (
            payments.map((p) => {
              const isPayment = p.type === 'payment';
              const dateLabel = p.date.toDate().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              return (
                <div key={p.id} className="flex items-start gap-2">
                  {/* Dot */}
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      isPayment ? 'bg-green-500' : 'bg-amber-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type badge */}
                      <span
                        className={`text-xs font-medium ${
                          isPayment ? 'text-green-400' : 'text-amber-400'
                        }`}
                      >
                        {isPayment ? '− ' : '+ '}
                        {formatCurrency(p.amount, debt.currency)}
                      </span>
                      <span className="text-xs text-zinc-600">{dateLabel}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          isPayment
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {isPayment ? 'payment' : 'additional'}
                      </span>
                    </div>
                    {p.note && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{p.note}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Transaction form (payment received OR additional loan) ──────────────────
interface TransactionFormProps {
  debt: Debt;
  onSubmit: (type: DebtTransactionType, amount: number, date: string, note: string) => Promise<void>;
  onCancel: () => void;
}

function TransactionForm({ debt, onSubmit, onCancel }: TransactionFormProps) {
  const [txType, setTxType] = useState<DebtTransactionType>('payment');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPayment = txType === 'payment';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (isPayment && amt > debt.remainingAmount) {
      setError(`Max payment is ${formatCurrency(debt.remainingAmount, debt.currency)}.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSubmit(txType, amt, date, note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div className="flex gap-1 bg-zinc-800/80 rounded-lg p-1">
        {(['payment', 'additional'] as DebtTransactionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTxType(t); setAmount(''); setError(''); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              txType === t
                ? t === 'payment'
                  ? 'bg-green-600 text-white'
                  : 'bg-amber-500 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t === 'payment' ? '✓ Payment Received' : '+ Additional Loan'}
          </button>
        ))}
      </div>

      {/* Context info */}
      <div className="text-sm text-zinc-400 bg-zinc-800/40 rounded-lg px-3 py-2 space-x-1">
        {isPayment ? (
          <>
            <span className="text-zinc-500">Outstanding:</span>
            <span className="text-green-400 font-semibold">
              {formatCurrency(debt.remainingAmount, debt.currency)}
            </span>
          </>
        ) : (
          <>
            <span className="text-zinc-500">Total lent:</span>
            <span className="text-amber-400 font-semibold">
              {formatCurrency(debt.amount, debt.currency)}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">Remaining:</span>
            <span className="text-green-400 font-semibold">
              {formatCurrency(debt.remainingAmount, debt.currency)}
            </span>
          </>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">
          {isPayment ? 'Amount Paid' : 'Additional Amount'} ({debt.currency})
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          {...(isPayment ? { max: debt.remainingAmount } : {})}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className={fieldClass}
        />
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={fieldClass}
        />
      </div>

      {/* Note */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isPayment ? 'e.g., Venmo, cash' : 'e.g., For new laptop, rent'}
          className={`${fieldClass} placeholder-zinc-500`}
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isPayment ? 'Record Payment' : 'Add Loan'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Due date badge ───────────────────────────────────────────────────────────
function DueDateBadge({ dueDate }: { dueDate?: Timestamp }) {
  if (!dueDate) return null;
  const due = dueDate.toDate();
  const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (diffDays < 0)
    return (
      <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
        Overdue · {label}
      </span>
    );
  if (diffDays <= 7)
    return (
      <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
        Due soon · {label}
      </span>
    );
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
  const [transactionDebt, setTransactionDebt] = useState<Debt | null>(null);

  const activeDebts = useMemo(() => debts.filter((d) => d.status === 'active'), [debts]);
  const settledDebts = useMemo(() => debts.filter((d) => d.status === 'settled'), [debts]);
  const displayedDebts = tab === 'active' ? activeDebts : settledDebts;

  const totalOutstanding = useMemo(() => {
    if (!settings) return null;
    return activeDebts.reduce(
      (sum, d) => sum + convertToBaseCurrency(d.remainingAmount, d.currency, settings),
      0
    );
  }, [activeDebts, settings]);

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
    if (!confirm('Delete this debt and all its transactions?')) return;
    await deleteDebt(id);
    await refresh();
  };

  const handleSettle = async (debt: Debt) => {
    if (!confirm(`Mark "${debt.personName}" as fully settled?`)) return;
    await markDebtSettled(debt.id);
    await refresh();
  };

  const handleTransaction = async (
    type: DebtTransactionType,
    amount: number,
    date: string,
    note: string
  ) => {
    if (!user || !transactionDebt) return;
    await addDebtPayment(
      user.uid,
      {
        debtId: transactionDebt.id,
        type,
        amount,
        date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { remainingAmount: transactionDebt.remainingAmount, amount: transactionDebt.amount }
    );
    await refresh();
    setTransactionDebt(null);
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
                tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
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
                const paidPct =
                  debt.amount > 0
                    ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100
                    : 100;
                return (
                  <div
                    key={debt.id}
                    className="p-4 bg-zinc-800/50 rounded-lg"
                  >
                    {/* Top row: info + actions */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Person + status badges */}
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
                            <span className="text-zinc-500 text-xs">Total lent: </span>
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
                              style={{ width: `${Math.min(100, Math.max(0, paidPct))}%` }}
                            />
                          </div>
                        )}

                        {debt.note && (
                          <div className="text-xs text-zinc-500 mt-1">{debt.note}</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap shrink-0">
                        <button
                          onClick={() => setTransactionDebt(debt)}
                          className={`text-xs border px-3 py-1.5 rounded-md transition-all ${
                            debt.status === 'active'
                              ? 'bg-green-600/10 text-green-400 hover:bg-green-600 hover:text-white border-green-600/30'
                              : 'text-amber-400 hover:text-amber-300 border-amber-600/30 hover:border-amber-400/50'
                          }`}
                        >
                          {debt.status === 'active' ? 'Record Transaction' : '+ Add Loan'}
                        </button>
                        {debt.status === 'active' && (
                          <button
                            onClick={() => handleSettle(debt)}
                            className="text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-md transition-all"
                          >
                            Settle
                          </button>
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

                    {/* ─ Expandable transaction history ─ */}
                    <DebtHistory debt={debt} />
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

      {/* Transaction Modal */}
      <Modal
        isOpen={!!transactionDebt}
        onClose={() => setTransactionDebt(null)}
        title={`Transaction — ${transactionDebt?.personName}`}
      >
        {transactionDebt && (
          <TransactionForm
            debt={transactionDebt}
            onSubmit={handleTransaction}
            onCancel={() => setTransactionDebt(null)}
          />
        )}
      </Modal>
    </AuthGuard>
  );
}
