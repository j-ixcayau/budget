import { RecurringExpense, Transaction } from '@/types';

/**
 * ============================================================================
 *  UNIFIED RECURRING-EXPENSE / MISSING-PAYMENT LOGIC
 * ============================================================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for deciding whether a recurring
 * bill has been paid for a given billing cycle.
 *
 * IMPORTANT: An identical copy lives in `functions/src/recurring.ts` (used by
 * the Telegram Cloud Function). The Cloud Functions build is a separate
 * package and cannot import from the Next.js `src/` tree, so the two files are
 * kept byte-for-byte identical below the type imports. If you change the core
 * functions here, mirror the change there.
 *
 * Tunable behaviour (shared by web + Telegram):
 *   OVERDUE_GRACE_DAYS  – how long after a due date we keep flagging LAST
 *                         month's cycle as overdue.
 *   DUE_SOON_DAYS       – lookahead window used for "due soon" notifications.
 */

const DAY_MS = 1000 * 60 * 60 * 24;
export const OVERDUE_GRACE_DAYS = 10;
export const DUE_SOON_DAYS = 3;
// How many days BEFORE the due date a payment may be made and still count for
// that cycle (people often pay a few days early). Defines the billing period.
export const EARLY_PAYMENT_DAYS = 7;

/** Does this transaction correspond to this bill at all? */
function txMatchesBill(tx: Transaction, expense: RecurringExpense): boolean {
  const nameLower = expense.name.toLowerCase();
  if (tx.note?.toLowerCase().includes(nameLower)) return true;
  if (tx.category === expense.category && expense.isFixed) {
    return Math.abs(tx.amount - expense.defaultAmount) < 0.01;
  }
  return false;
}

/**
 * Check if a recurring expense has been logged for a specific target cycle.
 *
 * A payment counts for the cycle whose due date is `targetDate` when it falls
 * inside that cycle's BILLING PERIOD:
 *     [ targetDue - EARLY_PAYMENT_DAYS,  nextDue - EARLY_PAYMENT_DAYS )
 * These periods are contiguous and non-overlapping, so every payment is
 * attributed to exactly one cycle no matter how early or late it was paid.
 * (This replaces an older "nearest due date" heuristic that misattributed
 * payments made far from the due day.)
 */
export function isBillPaidForDate(
  expense: RecurringExpense,
  targetDate: Date,
  transactions: Transaction[]
): boolean {
  const periodStart = new Date(targetDate);
  periodStart.setDate(periodStart.getDate() - EARLY_PAYMENT_DAYS);

  const nextDue = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, expense.dayOfMonth);
  const periodEnd = new Date(nextDue);
  periodEnd.setDate(periodEnd.getDate() - EARLY_PAYMENT_DAYS);

  return transactions.some((tx) => {
    const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date as unknown as string);
    if (isNaN(txDate.getTime())) return false;
    if (!txMatchesBill(tx, expense)) return false;
    return txDate >= periodStart && txDate < periodEnd;
  });
}

export interface BillStatus {
  expense: RecurringExpense;
  dueDate: Date;
  /** days until this month's due date; negative = past due */
  daysUntilDue: number;
  /** paid for the current calendar month's cycle */
  currentCyclePaid: boolean;
  /** paid for last month's cycle (true if outside the grace window) */
  prevCyclePaid: boolean;
  /** current cycle unpaid AND already past its due date */
  isOverdue: boolean;
  /** last month's cycle unpaid AND still inside the grace window */
  isPrevOverdue: boolean;
  /** unpaid AND due within DUE_SOON_DAYS (this month or next month) */
  isDueSoon: boolean;
}

/**
 * Compute the full payment status of a bill relative to `now`. This is the
 * shared primitive both the web dashboard and the Telegram notifier build on,
 * so both surfaces agree on what "missing" means.
 */
export function getBillStatus(
  expense: RecurringExpense,
  transactions: Transaction[],
  now: Date = new Date()
): BillStatus {
  const dueDate = new Date(now.getFullYear(), now.getMonth(), expense.dayOfMonth);
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / DAY_MS;
  const currentCyclePaid = isBillPaidForDate(expense, dueDate, transactions);

  // Previous month's cycle: only relevant while inside the overdue grace window.
  const prevDueDate = new Date(now.getFullYear(), now.getMonth() - 1, expense.dayOfMonth);
  const daysSincePrevDue = (now.getTime() - prevDueDate.getTime()) / DAY_MS;
  const prevInGrace = daysSincePrevDue >= 0 && daysSincePrevDue <= OVERDUE_GRACE_DAYS;
  const prevCyclePaid = prevInGrace ? isBillPaidForDate(expense, prevDueDate, transactions) : true;

  // Next month's cycle: only matters if it's about to be due.
  const nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, expense.dayOfMonth);
  const daysToNextDue = (nextDueDate.getTime() - now.getTime()) / DAY_MS;
  const nextDueSoon =
    daysToNextDue >= 0 &&
    daysToNextDue <= DUE_SOON_DAYS &&
    !isBillPaidForDate(expense, nextDueDate, transactions);

  const isOverdue = !currentCyclePaid && daysUntilDue < 0;
  const isPrevOverdue = !prevCyclePaid;
  const isDueSoon =
    (!currentCyclePaid && daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_DAYS) || nextDueSoon;

  return {
    expense,
    dueDate,
    daysUntilDue,
    currentCyclePaid,
    prevCyclePaid,
    isOverdue,
    isPrevOverdue,
    isDueSoon,
  };
}

/**
 * WEB DASHBOARD view: every active bill not yet paid for the current month,
 * plus anything still overdue from last month. This is a planning view, so it
 * keeps showing a bill for the whole month until it is actually paid.
 */
export function getPendingBills(
  recurringExpenses: RecurringExpense[],
  transactions: Transaction[],
  now: Date = new Date()
): RecurringExpense[] {
  return recurringExpenses
    .filter((e) => e.isActive)
    .map((e) => getBillStatus(e, transactions, now))
    .filter((s) => !s.currentCyclePaid || s.isPrevOverdue)
    .sort((a, b) => a.expense.dayOfMonth - b.expense.dayOfMonth)
    .map((s) => s.expense);
}

/**
 * TELEGRAM notification view: only the actionable subset — overdue (this month
 * or last month within grace) or due within the next few days. This keeps the
 * push notifications from nagging weeks in advance while using the exact same
 * payment detection as the web.
 */
/** Display priority: overdue first, then pending, then paid. */
function statusRank(s: BillStatus): number {
  const paid = s.currentCyclePaid && !s.isPrevOverdue;
  const overdue = s.isOverdue || s.isPrevOverdue;
  if (overdue) return 0;
  if (!paid) return 1;
  return 2;
}

/**
 * Full status of every active bill for the current month. Sorted by state
 * (overdue → pending → paid), then by due day within each group. Used by the
 * dashboard so it shows a complete monthly checklist with Paid / Pending /
 * Overdue state instead of silently hiding paid bills.
 */
export function getMonthlyBillStatuses(
  recurringExpenses: RecurringExpense[],
  transactions: Transaction[],
  now: Date = new Date()
): BillStatus[] {
  return recurringExpenses
    .filter((e) => e.isActive)
    .map((e) => getBillStatus(e, transactions, now))
    .sort((a, b) => statusRank(a) - statusRank(b) || a.expense.dayOfMonth - b.expense.dayOfMonth);
}

export function getBillsToNotify(
  recurringExpenses: RecurringExpense[],
  transactions: Transaction[],
  now: Date = new Date()
): RecurringExpense[] {
  return recurringExpenses
    .filter((e) => e.isActive)
    .map((e) => getBillStatus(e, transactions, now))
    .filter((s) => s.isOverdue || s.isPrevOverdue || s.isDueSoon)
    .sort((a, b) => a.expense.dayOfMonth - b.expense.dayOfMonth)
    .map((s) => s.expense);
}
