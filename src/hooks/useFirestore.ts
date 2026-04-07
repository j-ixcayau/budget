'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  getTransactions,
  getAssets,
  getMonthlySnapshots,
  getUserSettings,
  getRecurringExpenses,
  getDebts,
} from '@/lib/firestore';
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
 * Generic hook to fetch a Firestore collection for the current user.
 */
function useFirestoreCollection<T>(fetchFn: (userId: string) => Promise<T[]>) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(user.uid);
      setData(result);
    } catch (err: any) {
      setError(err);
      console.error('Firestore hook error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, fetchFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useTransactions() {
  const { data: transactions, ...rest } = useFirestoreCollection(getTransactions);
  return { transactions, ...rest };
}

export function useAssets() {
  const { data: assets, ...rest } = useFirestoreCollection(getAssets);
  return { assets, ...rest };
}

export function useMonthlySnapshots() {
  const { data: snapshots, ...rest } = useFirestoreCollection(getMonthlySnapshots);
  return { snapshots, ...rest };
}

export function useRecurringExpenses() {
  const { data: recurringExpenses, ...rest } = useFirestoreCollection(getRecurringExpenses);
  return { recurringExpenses, ...rest };
}

export function useDebts(type?: DebtType) {
  const { data: allDebts, ...rest } = useFirestoreCollection<Debt>(getDebts);
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

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getUserSettings(user.uid);
      setSettings(data);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, loading, error, refresh };
}
