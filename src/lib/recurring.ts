import { RecurringExpense, Transaction, Currency, UserSettings } from '@/types';
import { convertToBaseCurrency } from './currency';

/**
 * Check if a recurring expense has already been logged this month.
 * Matches on the expense name appearing in the transaction note, which is
 * set automatically when logging from the dashboard ("Monthly {name}").
 * Falls back to an exact category + similar amount match to catch manually
 * logged transactions that didn't use the Log button.
 */
export function isBillLoggedThisMonth(
  expense: RecurringExpense,
  monthTransactions: Transaction[]
): boolean {
  const nameLower = expense.name.toLowerCase();
  return monthTransactions.some(tx => {
    if (tx.note?.toLowerCase().includes(nameLower)) return true;

    if (tx.category === expense.category && expense.isFixed) {
      const diff = Math.abs(tx.amount - expense.defaultAmount);
      return diff < 0.01;
    }

    return false;
  });
}

/**
 * Filter pending recurring expenses for a given month.
 */
export function getPendingBills(
  recurringExpenses: RecurringExpense[],
  monthTransactions: Transaction[]
): RecurringExpense[] {
  return recurringExpenses.filter(expense => {
    if (!expense.isActive) return false;
    return !isBillLoggedThisMonth(expense, monthTransactions);
  });
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
  
  return pendingBills.filter(bill => {
    // If today is late in the month, dayOfMonth might be smaller than today (next month's bill)
    // but here we focus on bills due in the CURRENT month.
    return bill.dayOfMonth >= today && bill.dayOfMonth <= limit;
  });
}
