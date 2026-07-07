/**
 * ============================================================================
 *  UNIFIED RECURRING-EXPENSE / MISSING-PAYMENT LOGIC (Cloud Functions copy)
 * ============================================================================
 *
 * This is a self-contained mirror of `src/lib/recurring.ts` (the web app).
 * The Cloud Functions build is a separate package and cannot import from the
 * Next.js `src/` tree, so the core functions below are kept byte-for-byte
 * identical. If you change the logic here, mirror it in `src/lib/recurring.ts`.
 *
 * Only the type definitions differ: the web uses the shared `@/types`, while
 * here we declare the minimal shapes the algorithm needs.
 */

export interface RecurringExpenseLike {
  name: string;
  category: string;
  isFixed: boolean;
  defaultAmount: number;
  dayOfMonth: number;
  isActive: boolean;
}

export interface TransactionLike {
  note?: string;
  category: string;
  amount: number;
  // In the Cloud Function transactions are pre-converted to Date; the web
  // passes Firestore Timestamps (which expose .toDate()). Both are handled.
  date: Date | { toDate: () => Date };
}

const DAY_MS = 1000 * 60 * 60 * 24;
export const OVERDUE_GRACE_DAYS = 10;
export const DUE_SOON_DAYS = 3;
// How many days BEFORE the due date a payment may be made and still count for
// that cycle (people often pay a few days early). Defines the billing period.
export const EARLY_PAYMENT_DAYS = 7;

function txMatchesBill(tx: TransactionLike, expense: RecurringExpenseLike): boolean {
  const nameLower = expense.name.toLowerCase();
  if (tx.note?.toLowerCase().includes(nameLower)) return true;
  if (tx.category === expense.category && expense.isFixed) {
    return Math.abs(tx.amount - expense.defaultAmount) < 0.01;
  }
  return false;
}

/**
 * A payment counts for the cycle whose due date is `targetDate` when it falls
 * inside that cycle's BILLING PERIOD:
 *     [ targetDue - EARLY_PAYMENT_DAYS,  nextDue - EARLY_PAYMENT_DAYS )
 * Contiguous, non-overlapping periods → every payment maps to exactly one
 * cycle regardless of how early or late it was paid.
 */
export function isBillPaidForDate(
  expense: RecurringExpenseLike,
  targetDate: Date,
  transactions: TransactionLike[]
): boolean {
  const periodStart = new Date(targetDate);
  periodStart.setDate(periodStart.getDate() - EARLY_PAYMENT_DAYS);

  const nextDue = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, expense.dayOfMonth);
  const periodEnd = new Date(nextDue);
  periodEnd.setDate(periodEnd.getDate() - EARLY_PAYMENT_DAYS);

  return transactions.some((tx) => {
    const raw = tx.date as { toDate?: () => Date };
    const txDate = raw?.toDate ? raw.toDate() : new Date(tx.date as unknown as string);
    if (isNaN(txDate.getTime())) return false;
    if (!txMatchesBill(tx, expense)) return false;
    return txDate >= periodStart && txDate < periodEnd;
  });
}

export interface BillStatus<E extends RecurringExpenseLike = RecurringExpenseLike> {
  expense: E;
  dueDate: Date;
  daysUntilDue: number;
  currentCyclePaid: boolean;
  prevCyclePaid: boolean;
  isOverdue: boolean;
  isPrevOverdue: boolean;
  isDueSoon: boolean;
}

export function getBillStatus<E extends RecurringExpenseLike>(
  expense: E,
  transactions: TransactionLike[],
  now: Date = new Date()
): BillStatus<E> {
  const dueDate = new Date(now.getFullYear(), now.getMonth(), expense.dayOfMonth);
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / DAY_MS;
  const currentCyclePaid = isBillPaidForDate(expense, dueDate, transactions);

  const prevDueDate = new Date(now.getFullYear(), now.getMonth() - 1, expense.dayOfMonth);
  const daysSincePrevDue = (now.getTime() - prevDueDate.getTime()) / DAY_MS;
  const prevInGrace = daysSincePrevDue >= 0 && daysSincePrevDue <= OVERDUE_GRACE_DAYS;
  const prevCyclePaid = prevInGrace ? isBillPaidForDate(expense, prevDueDate, transactions) : true;

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

export function getPendingBills<E extends RecurringExpenseLike>(
  recurringExpenses: E[],
  transactions: TransactionLike[],
  now: Date = new Date()
): E[] {
  return recurringExpenses
    .filter((e) => e.isActive)
    .map((e) => getBillStatus(e, transactions, now))
    .filter((s) => !s.currentCyclePaid || s.isPrevOverdue)
    .sort((a, b) => a.expense.dayOfMonth - b.expense.dayOfMonth)
    .map((s) => s.expense);
}

export function getBillsToNotify<E extends RecurringExpenseLike>(
  recurringExpenses: E[],
  transactions: TransactionLike[],
  now: Date = new Date()
): E[] {
  return recurringExpenses
    .filter((e) => e.isActive)
    .map((e) => getBillStatus(e, transactions, now))
    .filter((s) => s.isOverdue || s.isPrevOverdue || s.isDueSoon)
    .sort((a, b) => a.expense.dayOfMonth - b.expense.dayOfMonth)
    .map((s) => s.expense);
}
