import { Timestamp } from 'firebase/firestore';

export type Currency = 'Q' | 'EUR' | 'USD';
export type TransactionType = 'income' | 'expense';
export type AssetType = 'cash' | 'crypto';

export interface Transaction {
  id: string;
  userId: string;
  date: Timestamp;
  amount: number;
  type: TransactionType;
  category: string;
  currency: Currency;
  note?: string;
}

export interface Asset {
  id: string;
  userId: string;
  name: string;
  balance: number;
  currency: Currency;
  type: AssetType;
  coinId?: string;
  coinSymbol?: string;
  quantity?: number;
  investedAmount?: number;
  investedCurrency?: Currency;
}

export interface Liability {
  id: string;
  userId: string;
  name: string;
  remainingAmount: number;
  monthlyPayment: number;
  currency: Currency;
}

export interface MonthlySnapshot {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface UserSettings {
  baseCurrency: Currency;
  currencyRates: {
    EUR: number;
    USD: number;
    Q: number;
  };
}

export interface RecurringExpense {
  id: string;
  userId: string;
  name: string; // e.g. "Internet", "Water", "Netflix"
  category: string; // reuses existing transaction categories
  currency: Currency;
  isFixed: boolean; // true = fixed amount every month
  defaultAmount: number; // amount if fixed, or a typical hint if variable
  dayOfMonth: number; // expected due day (1–31)
  isActive: boolean; // false = paused/hidden from reminders
  note?: string;
}

export type DebtStatus = 'active' | 'settled';

export interface Debt {
  id: string;
  userId: string;
  personName: string; // who owes you
  amount: number; // original amount lent
  remainingAmount: number; // decreases as payments come in
  currency: Currency;
  date: Timestamp;
  dueDate?: Timestamp; // optional expected repayment date
  note?: string;
  status: DebtStatus;
}

export type DebtTransactionType = 'payment' | 'additional';

export interface DebtPayment {
  id: string;
  debtId: string;
  userId: string;
  type: DebtTransactionType; // 'payment' = they paid you back; 'additional' = they asked for more
  amount: number;
  date: Timestamp;
  note?: string;
}

// Form types (without id and userId)
export type TransactionFormData = Omit<Transaction, 'id' | 'userId'>;
export type AssetFormData = Omit<Asset, 'id' | 'userId'>;
export type LiabilityFormData = Omit<Liability, 'id' | 'userId'>;
export type RecurringExpenseFormData = Omit<RecurringExpense, 'id' | 'userId'>;
export type DebtFormData = Omit<Debt, 'id' | 'userId' | 'remainingAmount' | 'status'>;
export type DebtPaymentFormData = Omit<DebtPayment, 'id' | 'userId'>;
