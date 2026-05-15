import { RecurringExpense, Transaction, Currency, UserSettings } from '@/types';
import { convertToBaseCurrency } from './currency';

function getClosestDueDate(txDate: Date, expense: RecurringExpense): Date {
  const year = txDate.getFullYear();
  const month = txDate.getMonth();

  const d1 = new Date(year, month - 1, expense.dayOfMonth);
  const d2 = new Date(year, month, expense.dayOfMonth);
  const d3 = new Date(year, month + 1, expense.dayOfMonth);

  const diff1 = Math.abs(txDate.getTime() - d1.getTime());
  const diff2 = Math.abs(txDate.getTime() - d2.getTime());
  const diff3 = Math.abs(txDate.getTime() - d3.getTime());

  if (diff1 < diff2 && diff1 < diff3) return d1;
  if (diff3 < diff2 && diff3 < diff1) return d3;
  return d2;
}

/**
 * Check if a recurring expense has been logged for a specific target date.
 * Finds the closest due date for each matching transaction to avoid double counting.
 */
export function isBillPaidForDate(
  expense: RecurringExpense,
  targetDate: Date,
  transactions: Transaction[]
): boolean {
  const nameLower = expense.name.toLowerCase();

  return transactions.some((tx) => {
    const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date as any);
    if (isNaN(txDate.getTime())) return false;

    // Check if this transaction matches the bill at all
    let matches = false;
    if (tx.note?.toLowerCase().includes(nameLower)) {
      matches = true;
    } else if (tx.category === expense.category && expense.isFixed) {
      if (Math.abs(tx.amount - expense.defaultAmount) < 0.01) {
        matches = true;
      }
    }

    if (!matches) return false;

    // It matches the bill. Is it FOR this targetDate?
    const closestDueDate = getClosestDueDate(txDate, expense);

    return (
      closestDueDate.getFullYear() === targetDate.getFullYear() &&
      closestDueDate.getMonth() === targetDate.getMonth()
    );
  });
}

/**
 * Filter pending recurring expenses.
 * Shows bills unpaid for the current month, and recently overdue bills from last month.
 */
export function getPendingBills(
  recurringExpenses: RecurringExpense[],
  transactions: Transaction[]
): RecurringExpense[] {
  const now = new Date();
  const pendingBills: RecurringExpense[] = [];

  for (const expense of recurringExpenses) {
    if (!expense.isActive) continue;

    const currentDueDate = new Date(now.getFullYear(), now.getMonth(), expense.dayOfMonth);
    const isCurrentPaid = isBillPaidForDate(expense, currentDueDate, transactions);

    const prevDueDate = new Date(now.getFullYear(), now.getMonth() - 1, expense.dayOfMonth);
    const daysSincePrevDue = (now.getTime() - prevDueDate.getTime()) / (1000 * 3600 * 24);

    let isPrevPaid = true;
    // If the previous cycle was within the last 15 days, check if it's paid
    if (daysSincePrevDue <= 15 && daysSincePrevDue >= 0) {
      isPrevPaid = isBillPaidForDate(expense, prevDueDate, transactions);
    }

    const nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, expense.dayOfMonth);
    const daysToNextDue = (nextDueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);

    let isNextPaid = true;
    // For the next month, only show as pending if it's within 15 days
    if (daysToNextDue <= 15 && daysToNextDue >= 0) {
      isNextPaid = isBillPaidForDate(expense, nextDueDate, transactions);
    }

    if (!isCurrentPaid || !isPrevPaid || !isNextPaid) {
      pendingBills.push(expense);
    }
  }

  return pendingBills.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
}

/**
 * Get bills due within the next N days.
 */
export function getUpcomingBills(
  pendingBills: RecurringExpense[],
  daysAhead: number = 3
): RecurringExpense[] {
  const today = new Date().getDate();
  const limit = today + daysAhead;

  return pendingBills.filter((bill) => {
    // If today is late in the month, dayOfMonth might be smaller than today (next month's bill)
    // but here we focus on bills due in the CURRENT month.
    return bill.dayOfMonth >= today && bill.dayOfMonth <= limit;
  });
}
