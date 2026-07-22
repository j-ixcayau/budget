'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal, SkeletonList, useToast } from '@/components/ui';
import { DebtForm } from '@/components/forms';
import { useDebts, useUserSettings } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { CURRENCY_OPTIONS } from '@/lib/constants';
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

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors group"
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
        <div className="mt-2 ml-1 pl-3 border-l border-border/60 space-y-2">
          {loading ? (
            <p className="text-xs text-text-tertiary py-1">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="text-xs text-text-tertiary py-1">No transactions recorded yet.</p>
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
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      isPayment ? 'bg-success' : 'bg-warning'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-medium ${
                          isPayment ? 'text-success' : 'text-warning'
                        }`}
                      >
                        {isPayment ? '− ' : '+ '}
                        {formatCurrency(p.amount, debt.currency)}
                      </span>
                      <span className="text-xs text-text-tertiary">{dateLabel}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          isPayment
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-warning/10 text-warning border-warning/20'
                        }`}
                      >
                        {isPayment ? 'payment' : 'additional'}
                      </span>
                    </div>
                    {p.note && (
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">{p.note}</p>
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

interface TransactionFormProps {
  debt: Debt;
  onSubmit: (
    type: DebtTransactionType,
    amount: number,
    date: string,
    note: string
  ) => Promise<void>;
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
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
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
    'w-full bg-surface-hover border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-1 bg-surface-hover/80 rounded-lg p-1">
        {(['payment', 'additional'] as DebtTransactionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTxType(t);
              setAmount('');
              setError('');
            }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              txType === t
                ? t === 'payment'
                  ? 'bg-success text-white'
                  : 'bg-warning text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'payment' ? '✓ Payment Received' : '+ Additional Loan'}
          </button>
        ))}
      </div>

      <div className="text-sm text-text-secondary bg-surface-hover/40 rounded-lg px-3 py-2 space-x-1">
        {isPayment ? (
          <>
            <span className="text-text-tertiary">Outstanding:</span>
            <span className="text-success font-semibold">
              {formatCurrency(debt.remainingAmount, debt.currency)}
            </span>
          </>
        ) : (
          <>
            <span className="text-text-tertiary">Total lent:</span>
            <span className="text-warning font-semibold">
              {formatCurrency(debt.amount, debt.currency)}
            </span>
            <span className="text-text-tertiary">·</span>
            <span className="text-text-tertiary">Remaining:</span>
            <span className="text-success font-semibold">
              {formatCurrency(debt.remainingAmount, debt.currency)}
            </span>
          </>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-secondary">
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

      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-secondary">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-secondary">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isPayment ? 'e.g., Venmo, cash' : 'e.g., For new laptop, rent'}
          className={`${fieldClass} placeholder-zinc-500`}
        />
      </div>

      {error && (
        <div className="text-error text-sm bg-error/10 border border-error/20 p-3 rounded-lg">
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

function DueDateBadge({ dueDate }: { dueDate?: Timestamp }) {
  if (!dueDate) return null;
  const due = dueDate.toDate();
  const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (diffDays < 0)
    return (
      <span className="text-xs bg-error/20 text-error border border-error/30 px-2 py-0.5 rounded-full">
        Overdue · {label}
      </span>
    );
  if (diffDays <= 7)
    return (
      <span className="text-xs bg-warning/20 text-warning border border-warning/30 px-2 py-0.5 rounded-full">
        Due soon · {label}
      </span>
    );
  return (
    <span className="text-xs bg-surface-hover text-text-secondary border border-border px-2 py-0.5 rounded-full">
      Due {label}
    </span>
  );
}

type Tab = 'active' | 'settled';

interface DebtManagerProps {
  type: 'i_owe' | 'owed_to_me';
}

export function DebtManager({ type }: DebtManagerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const { debts, loading, refresh } = useDebts(type);
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

  const t = {
    title: type === 'i_owe' ? 'What I Owe' : 'People Who Owe Me',
    totalLabel: type === 'i_owe' ? 'Total owed:' : 'Total outstanding:',
    addBtn: type === 'i_owe' ? 'Add Liability' : 'Add Debt',
    emptyActive: type === 'i_owe' ? 'No active liabilities. Nice!' : 'No active debts. Nice!',
    emptySettled: type === 'i_owe' ? 'No settled liabilities yet.' : 'No settled debts yet.',
    totalBorrowOrLent: type === 'i_owe' ? 'Total borrowed: ' : 'Total lent: ',
    deletePrompt:
      type === 'i_owe'
        ? 'Delete this liability and all its transactions?'
        : 'Delete this debt and all its transactions?',
  };

  const handleAdd = async (data: DebtFormData) => {
    if (!user) return;
    await addDebt(user.uid, { ...data, debtType: type } as DebtFormData);
    await refresh();
    setIsAddOpen(false);
    toast.success(type === 'i_owe' ? 'Liability added' : 'Debt added');
  };

  const handleEdit = async (data: DebtFormData) => {
    if (!editingDebt) return;
    await updateDebt(editingDebt.id, data);
    await refresh();
    setEditingDebt(null);
    toast.success('Changes saved');
  };

  const handleDelete = async (id: string) => {
    // Deleting a debt also removes all its transactions, so keep an explicit
    // confirmation here — the cascade can't be safely undone with a toast.
    if (!confirm(t.deletePrompt)) return;
    if (!user) return;
    await deleteDebt(id, user.uid);
    await refresh();
    toast.success('Deleted');
  };

  const handleSettle = async (debt: Debt) => {
    if (!confirm(`Mark "${debt.name}" as fully settled?`)) return;
    await markDebtSettled(debt.id);
    await refresh();
    toast.success(`"${debt.name}" settled`);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t.title}</h1>
            {totalOutstanding !== null && (
              <p className="text-sm text-text-secondary mt-0.5">
                {t.totalLabel}{' '}
                <span className="text-success font-semibold">
                  {formatCurrency(totalOutstanding, settings?.baseCurrency as Currency)}
                </span>
              </p>
            )}
          </div>
          <Button onClick={() => setIsAddOpen(true)}>{t.addBtn}</Button>
        </div>

        <div className="flex gap-1 bg-surface rounded-md p-1 w-fit">
          {(['active', 'settled'] as Tab[]).map((tabName) => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                tab === tabName
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tabName === 'active'
                ? `Active (${activeDebts.length})`
                : `Settled (${settledDebts.length})`}
            </button>
          ))}
        </div>

        <Card>
          {loading ? (
            <SkeletonList rows={4} rowClassName="h-16" />
          ) : displayedDebts.length === 0 ? (
            <div className="text-text-secondary py-4 text-center">
              {tab === 'active' ? t.emptyActive : t.emptySettled}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedDebts.map((debt) => {
                const paidPct =
                  debt.amount > 0
                    ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100
                    : 100;
                return (
                  <div key={debt.id} className="p-4 bg-surface-hover rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-primary font-semibold">{debt.name}</span>
                          {debt.status === 'settled' && (
                            <span className="text-xs bg-success/20 text-success border border-success/30 px-2 py-0.5 rounded-full">
                              Settled
                            </span>
                          )}
                          <DueDateBadge dueDate={debt.dueDate} />
                        </div>

                        <div className="flex gap-4 mt-1.5 flex-wrap">
                          <div>
                            <span className="text-text-tertiary text-xs">Remaining: </span>
                            <span className="text-success font-semibold text-sm">
                              {formatCurrency(debt.remainingAmount, debt.currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-tertiary text-xs">
                              {t.totalBorrowOrLent}
                            </span>
                            <span className="text-text-secondary text-sm">
                              {formatCurrency(debt.amount, debt.currency)}
                            </span>
                          </div>
                        </div>

                        {debt.amount > 0 && (
                          <div className="mt-2 h-1.5 bg-surface-hover rounded-full overflow-hidden w-48 max-w-full">
                            <div
                              className="h-full bg-success rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, paidPct))}%` }}
                            />
                          </div>
                        )}

                        {debt.note && (
                          <div className="text-xs text-text-tertiary mt-1">{debt.note}</div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap shrink-0">
                        <button
                          onClick={() => setTransactionDebt(debt)}
                          className={`text-xs border px-3 py-1.5 rounded-md transition-all ${
                            debt.status === 'active'
                              ? 'bg-success/10 text-success hover:bg-success hover:text-white border-success/30'
                              : 'text-warning hover:text-warning border-warning/30 hover:border-warning/50'
                          }`}
                        >
                          {debt.status === 'active' ? 'Record Transaction' : `+ ${t.addBtn}`}
                        </button>
                        {debt.status === 'active' && (
                          <button
                            onClick={() => handleSettle(debt)}
                            className="text-xs text-text-secondary hover:text-text-primary border border-border hover:border-border px-3 py-1.5 rounded-md transition-all"
                          >
                            Settle
                          </button>
                        )}
                        <button
                          onClick={() => setEditingDebt(debt)}
                          className="text-xs text-secondary hover:text-secondary border border-primary/30 hover:border-primary/50 px-3 py-1.5 rounded-md transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(debt.id)}
                          className="text-xs text-error hover:text-error border border-error/30 hover:border-error/50 px-3 py-1.5 rounded-md transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <DebtHistory debt={debt} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t.addBtn}>
        <DebtForm debtType={type} onSubmit={handleAdd} onCancel={() => setIsAddOpen(false)} />
      </Modal>

      <Modal
        isOpen={!!editingDebt}
        onClose={() => setEditingDebt(null)}
        title={`Edit ${type === 'i_owe' ? 'Liability' : 'Debt'}`}
      >
        {editingDebt && (
          <DebtForm
            debtType={type}
            initialData={editingDebt}
            onSubmit={handleEdit}
            onCancel={() => setEditingDebt(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!transactionDebt}
        onClose={() => setTransactionDebt(null)}
        title={`Transaction — ${transactionDebt?.name}`}
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
