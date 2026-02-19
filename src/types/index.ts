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
    EUR: number; // Rate to convert EUR to base currency
    USD: number; // Rate to convert USD to base currency
    Q: number;   // Rate to convert Q to base currency (1 if Q is base)
  };
}

// Form types (without id and userId)
export type TransactionFormData = Omit<Transaction, 'id' | 'userId'>;
export type AssetFormData = Omit<Asset, 'id' | 'userId'>;
export type LiabilityFormData = Omit<Liability, 'id' | 'userId'>;
