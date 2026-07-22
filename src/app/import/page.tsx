'use client';

import { useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AuthGuard } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { useTransactions } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { bulkAddTransactions, updateTransaction } from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { parseStatement, type ParsedStatement } from '@/lib/statements';
import { reconcile, type ExistingTx, type ReconciledRow } from '@/lib/reconcile';
import type { Currency, TransactionFormData } from '@/types';

/** ISO YYYY-MM-DD in local time. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Stable key for a parsed row so edit state survives realtime re-renders. */
function rowKey(r: ReconciledRow): string {
  return `${r.row.date}|${r.row.amount}|${r.row.currency}|${r.row.description}`;
}

interface Edit {
  selected: boolean;
  category: string;
}

export default function ImportPage() {
  const { user } = useAuth();
  const { transactions } = useTransactions(); // all transactions, realtime
  const [statements, setStatements] = useState<{ name: string; parsed: ParsedStatement }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showLogged, setShowLogged] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setParsing(true);
    try {
      const parsed: { name: string; parsed: ParsedStatement }[] = [];
      for (const file of Array.from(files)) {
        const buf = await file.arrayBuffer();
        parsed.push({ name: file.name, parsed: await parseStatement(buf) });
      }
      setStatements((prev) => [...prev, ...parsed]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that PDF.');
    } finally {
      setParsing(false);
    }
  };

  // Existing logged expenses, adapted to the reconciler's shape.
  const existing: ExistingTx[] = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense')
        .map((t) => ({
          id: t.id,
          date: toISO(t.date.toDate()),
          amount: t.amount,
          currency: t.currency,
          category: t.category,
          note: t.note,
        })),
    [transactions]
  );

  const allRows = useMemo(() => statements.flatMap((s) => s.parsed.rows), [statements]);
  const result = useMemo(() => reconcile(allRows, existing), [allRows, existing]);

  const getEdit = (r: ReconciledRow): Edit =>
    edits[rowKey(r)] ?? { selected: true, category: r.row.category };

  const setEdit = (r: ReconciledRow, patch: Partial<Edit>) =>
    setEdits((prev) => ({ ...prev, [rowKey(r)]: { ...getEdit(r), ...patch } }));

  const selectedMissing = result.missing.filter((r) => getEdit(r).selected);

  const handleAddMissing = async () => {
    if (!user || selectedMissing.length === 0) return;
    setSaving(true);
    try {
      const items: TransactionFormData[] = selectedMissing.map((r) => ({
        date: Timestamp.fromDate(new Date(r.row.date + 'T12:00:00')),
        amount: r.row.amount,
        type: 'expense',
        category: getEdit(r).category,
        currency: r.row.currency as Currency,
        note: r.row.description,
      }));
      await bulkAddTransactions(user.uid, items);
      setSavedCount((c) => c + items.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add transactions.');
    } finally {
      setSaving(false);
    }
  };

  const handleFixRounding = async (r: ReconciledRow) => {
    if (!r.match) return;
    await updateTransaction(r.match.id, { amount: r.row.amount });
  };

  const reset = () => {
    setStatements([]);
    setEdits({});
    setSavedCount(0);
    setError('');
  };

  const hasStatements = statements.length > 0;

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Check Statement</h1>
            <p className="text-sm text-text-secondary mt-1">
              Upload a card statement — I&apos;ll flag only the expenses you haven&apos;t logged
              yet.
            </p>
          </div>
          {hasStatements && (
            <Button variant="secondary" onClick={reset}>
              Start over
            </Button>
          )}
        </div>

        {/* Upload */}
        <Card>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-border rounded-lg py-10 flex flex-col items-center gap-3 text-center"
          >
            <svg
              className="w-10 h-10 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-text-secondary text-sm">Drop your statement PDF(s) here, or</p>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={parsing}>
              {parsing ? 'Reading…' : 'Choose file(s)'}
            </Button>
            <p className="text-xs text-text-tertiary mt-1">
              Banco Promerica and BAC Credomatic supported. Files are read on your device only.
            </p>
          </div>

          {statements.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {statements.map((s, i) => (
                <span
                  key={i}
                  className="text-xs bg-surface-hover text-text-secondary px-2.5 py-1 rounded-full border border-border"
                >
                  {s.parsed.cardLabel ?? s.parsed.bank} · {s.parsed.rows.length} rows
                </span>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 text-error text-sm bg-error/10 border border-error/20 p-3 rounded-lg">
              {error}
            </div>
          )}
        </Card>

        {hasStatements && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryStat label="Missing" value={result.summary.missing} tone="amber" />
              <SummaryStat label="Rounded" value={result.summary.rounded} tone="blue" />
              <SummaryStat label="Already logged" value={result.summary.logged} tone="green" />
              <SummaryStat label="Payments skipped" value={result.payments.length} tone="zinc" />
            </div>

            {savedCount > 0 && (
              <div className="text-sm text-success bg-success/10 border border-success/20 p-3 rounded-lg">
                Added {savedCount} transaction{savedCount === 1 ? '' : 's'}. Nicely caught up.
              </div>
            )}

            {/* MISSING — the point of the feature */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-text-primary">
                  Missing expenses{' '}
                  <span className="text-text-tertiary font-normal">({result.missing.length})</span>
                </h2>
                {result.missing.length > 0 && (
                  <Button
                    onClick={handleAddMissing}
                    disabled={saving || selectedMissing.length === 0}
                  >
                    {saving ? 'Adding…' : `Add ${selectedMissing.length} selected`}
                  </Button>
                )}
              </div>

              {result.missing.length === 0 ? (
                <p className="text-sm text-text-tertiary py-6 text-center">
                  Nothing missing — every statement charge is already logged. 🎉
                </p>
              ) : (
                <div className="space-y-2">
                  {result.missing.map((r) => {
                    const edit = getEdit(r);
                    return (
                      <div
                        key={rowKey(r)}
                        className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={edit.selected}
                          onChange={(e) => setEdit(r, { selected: e.target.checked })}
                          className="w-4 h-4 accent-indigo-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{r.row.description}</p>
                          <p className="text-xs text-text-tertiary">{r.row.date}</p>
                        </div>
                        <select
                          value={edit.category}
                          onChange={(e) => setEdit(r, { category: e.target.value })}
                          className="bg-surface-hover border border-border rounded-md px-2 py-1 text-xs text-text-primary shrink-0"
                        >
                          {TRANSACTION_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm font-medium text-error w-24 text-right shrink-0">
                          {formatCurrency(r.row.amount, r.row.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* ROUNDED — logged but amount differs */}
            {result.rounded.length > 0 && (
              <Card>
                <h2 className="font-semibold text-text-primary mb-1">
                  Rounded entries{' '}
                  <span className="text-text-tertiary font-normal">({result.rounded.length})</span>
                </h2>
                <p className="text-xs text-text-tertiary mb-4">
                  You logged these, but the amount differs from the statement. Fix to use the exact
                  amount.
                </p>
                <div className="space-y-2">
                  {result.rounded.map((r) => (
                    <div
                      key={rowKey(r)}
                      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{r.row.description}</p>
                        <p className="text-xs text-text-tertiary">
                          logged {formatCurrency(r.match!.amount, r.row.currency)} · statement{' '}
                          {formatCurrency(r.row.amount, r.row.currency)}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => handleFixRounding(r)}>
                        Fix to {formatCurrency(r.row.amount, r.row.currency)}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* LOGGED — collapsible reassurance */}
            {result.logged.length > 0 && (
              <Card>
                <button
                  onClick={() => setShowLogged((s) => !s)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="font-semibold text-text-primary">
                    Already logged{' '}
                    <span className="text-text-tertiary font-normal">({result.logged.length})</span>
                  </h2>
                  <span className="text-text-tertiary text-sm">{showLogged ? 'Hide' : 'Show'}</span>
                </button>
                {showLogged && (
                  <div className="space-y-1 mt-4">
                    {result.logged.map((r) => (
                      <div
                        key={rowKey(r)}
                        className="flex items-center justify-between py-1.5 text-sm text-text-secondary"
                      >
                        <span className="truncate">{r.row.description}</span>
                        <span className="shrink-0">
                          {formatCurrency(r.row.amount, r.row.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'blue' | 'green' | 'zinc';
}) {
  const tones = {
    amber: 'text-warning',
    blue: 'text-secondary',
    green: 'text-success',
    zinc: 'text-text-secondary',
  };
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-xs text-text-tertiary mt-1">{label}</p>
    </div>
  );
}
