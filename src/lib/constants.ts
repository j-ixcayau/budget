// Shared currency options used across all forms
export const CURRENCY_OPTIONS = [
  { value: 'Q', label: 'Q (Quetzal)' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
] as const;

// Shared transaction categories used in TransactionForm and RecurringExpenseForm
export const TRANSACTION_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Health',
  'Shopping',
  'Salary',
  'Freelance',
  'Investment',
  'Other',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];
