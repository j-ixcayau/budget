'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { getUserSettings } from '@/lib/firestore';
import type {
  Transaction,
  Asset,
  MonthlySnapshot,
  UserSettings,
  RecurringExpense,
  Debt,
  DebtType,
} from '@/types';

/**
 * Generic hook to fetch a Firestore collection for the current user in real-time.
 */
function useRealtimeCollection<T>(
  collectionName: string,
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc'
) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [where('userId', '==', user.uid)];
    if (sortField) {
      constraints.push(orderBy(sortField, sortDirection));
    }
    const q = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T));
        setLoading(false);
      },
      (err) => {
        console.error('Firestore hook error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, collectionName, sortField, sortDirection]);

  // Provide a dummy refresh to satisfy existing components that might call it
  const refresh = useCallback(() => Promise.resolve(), []);

  return { data, loading, error, refresh };
}

/**
 * Fetches transactions for the current user.
 * When `monthFilter` is provided ("YYYY-MM"), only that month's documents
 * are requested from Firestore — avoiding a full-collection scan.
 */
export function useTransactions(monthFilter?: string) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [where('userId', '==', user.uid)];

    if (monthFilter && /^\d{4}-\d{2}$/.test(monthFilter)) {
      const [year, month] = monthFilter.split('-').map(Number);
      // Start of the selected month (local midnight → UTC Timestamp)
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      // Start of the next month — used as exclusive upper bound
      const end = new Date(year, month, 1, 0, 0, 0, 0);
      constraints.push(where('date', '>=', Timestamp.fromDate(start)));
      constraints.push(where('date', '<', Timestamp.fromDate(end)));
    }

    constraints.push(orderBy('date', 'desc'));

    const q = query(collection(db, 'transactions'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction));
        setLoading(false);
      },
      (err) => {
        console.error('Firestore hook error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, monthFilter]);

  const refresh = useCallback(() => Promise.resolve(), []);

  return { transactions, loading, error, refresh };
}

export function useAssets() {
  const { data: assets, ...rest } = useRealtimeCollection<Asset>('assets');
  return { assets, ...rest };
}

export function useMonthlySnapshots() {
  const { data: snapshots, ...rest } = useRealtimeCollection<MonthlySnapshot>(
    'monthlySnapshots',
    'month',
    'desc'
  );
  return { snapshots, ...rest };
}

export function useRecurringExpenses() {
  const { data: recurringExpenses, ...rest } = useRealtimeCollection<RecurringExpense>(
    'recurringExpenses',
    'dayOfMonth',
    'asc'
  );
  return { recurringExpenses, ...rest };
}

export function useDebts(type?: DebtType) {
  const { data: allDebts, ...rest } = useRealtimeCollection<Debt>('debts', 'date', 'desc');
  return {
    debts: type ? allDebts.filter((d) => (d.debtType || 'owed_to_me') === type) : allDebts,
    ...rest,
  };
}

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as UserSettings);
          setLoading(false);
          setError(null);
        } else {
          // If it doesn't exist, we rely on getUserSettings to seed the default settings
          try {
            const data = await getUserSettings(user.uid);
            setSettings(data);
          } catch (err: any) {
            setError(err);
          } finally {
            setLoading(false);
          }
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const refresh = useCallback(() => Promise.resolve(), []);

  return { settings, loading, error, refresh };
}
