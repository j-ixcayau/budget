import type { ParsedRow } from './statements/types';

/**
 * ============================================================================
 *  STATEMENT RECONCILIATION
 * ============================================================================
 *
 * The importer's job is NOT to bulk-load a statement. It's to answer one
 * question: "did I forget to log anything this month?" So we take the expenses
 * the bank recorded and check each one against what the user already logged,
 * then surface only the gaps.
 *
 * Two real-world wrinkles are handled here:
 *   1. Rounding — the user logs Q65 when they actually spent Q63.50. We match
 *      within a tolerance instead of requiring an exact amount, and offer to
 *      correct the logged value to the real one.
 *   2. Date drift — the purchase date on the statement can differ from the day
 *      the user logged it by a few days (posting delays, logging late). We
 *      match within a date window.
 *
 * Pure module (no Firestore imports) so it is unit-testable.
 */

/** Minimal shape of an already-logged transaction, adapted from Firestore. */
export interface ExistingTx {
  id: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  amount: number;
  currency: 'Q' | 'USD' | 'EUR';
  category?: string;
  note?: string;
}

export type MatchStatus = 'logged' | 'rounded' | 'missing';

export interface ReconciledRow {
  row: ParsedRow;
  status: MatchStatus;
  /** The logged transaction we matched to, for `logged` / `rounded`. */
  match?: ExistingTx;
  /** logged − actual (positive = the user rounded up). Only for `rounded`. */
  roundingDiff?: number;
}

export interface ReconcileResult {
  /** In the statement but NOT logged — the things to add. */
  missing: ReconciledRow[];
  /** Logged, but the amount differs from the statement (rounding). */
  rounded: ReconciledRow[];
  /** Logged and amounts agree — no action needed. */
  logged: ReconciledRow[];
  /** Card payments / credits, always ignored. */
  payments: ParsedRow[];
  summary: { statementExpenses: number; missing: number; rounded: number; logged: number };
}

const DATE_WINDOW_DAYS = 6;

/** Amount tolerance for treating two transactions as the same purchase. */
function tolerance(actual: number): number {
  return Math.max(3, actual * 0.1);
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime());
  return ms / (1000 * 60 * 60 * 24);
}

export function reconcile(rows: ParsedRow[], existing: ExistingTx[]): ReconcileResult {
  const payments = rows.filter((r) => r.kind === 'payment');
  const expenses = rows.filter((r) => r.kind === 'expense');

  // Track which logged transactions have already been claimed so two statement
  // lines can't both match the same entry.
  const claimed = new Set<string>();

  const missing: ReconciledRow[] = [];
  const rounded: ReconciledRow[] = [];
  const logged: ReconciledRow[] = [];

  for (const row of expenses) {
    const candidates = existing
      .filter(
        (tx) =>
          !claimed.has(tx.id) &&
          tx.currency === row.currency &&
          daysBetween(tx.date, row.date) <= DATE_WINDOW_DAYS &&
          Math.abs(tx.amount - row.amount) <= tolerance(row.amount)
      )
      .sort((a, b) => {
        const da = Math.abs(a.amount - row.amount);
        const db = Math.abs(b.amount - row.amount);
        if (da !== db) return da - db; // closest amount first
        return daysBetween(a.date, row.date) - daysBetween(b.date, row.date);
      });

    const match = candidates[0];
    if (!match) {
      missing.push({ row, status: 'missing' });
      continue;
    }

    claimed.add(match.id);
    const diff = +(match.amount - row.amount).toFixed(2);
    if (Math.abs(diff) <= 0.5) {
      logged.push({ row, status: 'logged', match });
    } else {
      rounded.push({ row, status: 'rounded', match, roundingDiff: diff });
    }
  }

  return {
    missing,
    rounded,
    logged,
    payments,
    summary: {
      statementExpenses: expenses.length,
      missing: missing.length,
      rounded: rounded.length,
      logged: logged.length,
    },
  };
}
