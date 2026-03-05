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

// ============ User Settings ============
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserSettings;
  }
  await setDoc(docRef, defaultSettings);
  return defaultSettings;
}

export async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, settings, { merge: true });
}

// ============ Transactions ============
export async function getTransactions(userId: string): Promise<Transaction[]> {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction));
}

export async function addTransaction(
  userId: string,
  data: TransactionFormData
): Promise<string> {
  const docRef = await addDoc(collection(db, 'transactions'), {
    ...data,
    userId,
  });
  return docRef.id;
}

export async function updateTransaction(
  id: string,
  data: Partial<TransactionFormData>
): Promise<void> {
  await updateDoc(doc(db, 'transactions', id), data);
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(db, 'transactions', id));
}

// ============ Assets ============
export async function getAssets(userId: string): Promise<Asset[]> {
  const q = query(collection(db, 'assets'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Asset));
}

export async function addAsset(userId: string, data: AssetFormData): Promise<string> {
  const docRef = await addDoc(collection(db, 'assets'), { ...data, userId });
  return docRef.id;
}

export async function updateAsset(id: string, data: Partial<AssetFormData>): Promise<void> {
  await updateDoc(doc(db, 'assets', id), data);
}

export async function deleteAsset(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assets', id));
}

export async function bulkUpdateAssetBalances(
  updates: { id: string; balance: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, balance }) => updateDoc(doc(db, 'assets', id), { balance }))
  );
}

// ============ Liabilities ============
export async function getLiabilities(userId: string): Promise<Liability[]> {
  const q = query(collection(db, 'liabilities'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Liability));
}

export async function addLiability(
  userId: string,
  data: LiabilityFormData
): Promise<string> {
  const docRef = await addDoc(collection(db, 'liabilities'), { ...data, userId });
  return docRef.id;
}

export async function updateLiability(
  id: string,
  data: Partial<LiabilityFormData>
): Promise<void> {
  await updateDoc(doc(db, 'liabilities', id), data);
}

export async function deleteLiability(id: string): Promise<void> {
  await deleteDoc(doc(db, 'liabilities', id));
}

// ============ Monthly Snapshots ============
export async function getMonthlySnapshots(userId: string): Promise<MonthlySnapshot[]> {
  const q = query(
    collection(db, 'monthlySnapshots'),
    where('userId', '==', userId),
    orderBy('month', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MonthlySnapshot));
}

export async function addMonthlySnapshot(
  userId: string,
  data: Omit<MonthlySnapshot, 'id' | 'userId'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'monthlySnapshots'), {
    ...data,
    userId,
  });
  return docRef.id;
}

export async function deleteMonthlySnapshot(id: string): Promise<void> {
  await deleteDoc(doc(db, 'monthlySnapshots', id));
}

// ============ Recurring Expenses ============
export async function getRecurringExpenses(userId: string): Promise<RecurringExpense[]> {
  const q = query(
    collection(db, 'recurringExpenses'),
    where('userId', '==', userId),
    orderBy('dayOfMonth', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as RecurringExpense));
}

export async function addRecurringExpense(
  userId: string,
  data: RecurringExpenseFormData
): Promise<string> {
  const docRef = await addDoc(collection(db, 'recurringExpenses'), { ...data, userId });
  return docRef.id;
}

export async function updateRecurringExpense(
  id: string,
  data: Partial<RecurringExpenseFormData>
): Promise<void> {
  await updateDoc(doc(db, 'recurringExpenses', id), data);
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, 'recurringExpenses', id));
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
