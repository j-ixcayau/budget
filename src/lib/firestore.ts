import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  setDoc,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Transaction,
  Asset,
  Liability,
  MonthlySnapshot,
  UserSettings,
  TransactionFormData,
  AssetFormData,
  LiabilityFormData,
  RecurringExpense,
  RecurringExpenseFormData,
} from '@/types';

// Default user settings
const defaultSettings: UserSettings = {
  baseCurrency: 'Q',
  currencyRates: { Q: 1, USD: 7.75, EUR: 8.5 },
};

// ============ Generic Helpers ============
async function getCollection<T>(
  collectionName: string,
  userId: string,
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc'
): Promise<T[]> {
  try {
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];
    if (sortField) {
      constraints.push(orderBy(sortField, sortDirection));
    }
    const q = query(collection(db, collectionName), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    throw error;
  }
}

async function addToCollection<T extends object>(
  collectionName: string,
  userId: string,
  data: T
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      userId,
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding to ${collectionName}:`, error);
    throw error;
  }
}

async function updateInCollection<T extends object>(
  collectionName: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  try {
    await updateDoc(doc(db, collectionName, id), data as any);
  } catch (error) {
    console.error(`Error updating ${collectionName}:`, error);
    throw error;
  }
}

async function deleteFromCollection(collectionName: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
    throw error;
  }
}

// ============ User Settings ============
export async function getUserSettings(userId: string): Promise<UserSettings> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserSettings;
    }
    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error('Error fetching user settings:', error);
    throw error;
  }
}

export async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
}

// ============ Transactions ============
export async function getTransactions(userId: string): Promise<Transaction[]> {
  return getCollection<Transaction>('transactions', userId, 'date', 'desc');
}

export async function addTransaction(
  userId: string,
  data: TransactionFormData
): Promise<string> {
  return addToCollection('transactions', userId, data);
}

export async function updateTransaction(
  id: string,
  data: Partial<TransactionFormData>
): Promise<void> {
  return updateInCollection('transactions', id, data);
}

export async function deleteTransaction(id: string): Promise<void> {
  return deleteFromCollection('transactions', id);
}

// ============ Assets ============
export async function getAssets(userId: string): Promise<Asset[]> {
  return getCollection<Asset>('assets', userId);
}

export async function addAsset(userId: string, data: AssetFormData): Promise<string> {
  return addToCollection('assets', userId, data);
}

export async function updateAsset(id: string, data: Partial<AssetFormData>): Promise<void> {
  return updateInCollection('assets', id, data);
}

export async function deleteAsset(id: string): Promise<void> {
  return deleteFromCollection('assets', id);
}

export async function bulkUpdateAssetBalances(
  updates: { id: string; balance: number }[]
): Promise<void> {
  try {
    await Promise.all(
      updates.map(({ id, balance }) => updateDoc(doc(db, 'assets', id), { balance }))
    );
  } catch (error) {
    console.error('Error bulk updating assets:', error);
    throw error;
  }
}

// ============ Liabilities ============
export async function getLiabilities(userId: string): Promise<Liability[]> {
  return getCollection<Liability>('liabilities', userId);
}

export async function addLiability(
  userId: string,
  data: LiabilityFormData
): Promise<string> {
  return addToCollection('liabilities', userId, data);
}

export async function updateLiability(
  id: string,
  data: Partial<LiabilityFormData>
): Promise<void> {
  return updateInCollection('liabilities', id, data);
}

export async function deleteLiability(id: string): Promise<void> {
  return deleteFromCollection('liabilities', id);
}

// ============ Monthly Snapshots ============
export async function getMonthlySnapshots(userId: string): Promise<MonthlySnapshot[]> {
  return getCollection<MonthlySnapshot>('monthlySnapshots', userId, 'month', 'desc');
}

export async function addMonthlySnapshot(
  userId: string,
  data: Omit<MonthlySnapshot, 'id' | 'userId'>
): Promise<string> {
  return addToCollection('monthlySnapshots', userId, data);
}

export async function deleteMonthlySnapshot(id: string): Promise<void> {
  return deleteFromCollection('monthlySnapshots', id);
}

// ============ Recurring Expenses ============
export async function getRecurringExpenses(userId: string): Promise<RecurringExpense[]> {
  return getCollection<RecurringExpense>('recurringExpenses', userId, 'dayOfMonth', 'asc');
}

export async function addRecurringExpense(
  userId: string,
  data: RecurringExpenseFormData
): Promise<string> {
  return addToCollection('recurringExpenses', userId, data);
}

export async function updateRecurringExpense(
  id: string,
  data: Partial<RecurringExpenseFormData>
): Promise<void> {
  return updateInCollection('recurringExpenses', id, data);
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  return deleteFromCollection('recurringExpenses', id);
}

// ============ Helpers ============
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthTransactions(
  transactions: Transaction[],
  month: string
): Transaction[] {
  return transactions.filter((t) => {
    const date = t.date.toDate();
    const txMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return txMonth === month;
  });
}
