import { RecurringExpense, Transaction, Currency, UserSettings } from '@/types';
import { convertToBaseCurrency } from './currency';

/**
 * Heuristic to check if a recurring expense has already been logged this month.
 */
export function isBillLoggedThisMonth(
  expense: RecurringExpense,
  monthTransactions: Transaction[]
): boolean {
  return monthTransactions.some(tx => 
    tx.note?.toLowerCase().includes(expense.name.toLowerCase()) || 
    tx.category === expense.category
  );
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
