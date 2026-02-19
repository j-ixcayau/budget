'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  getTransactions,
  getAssets,
  getLiabilities,
  getMonthlySnapshots,
  getUserSettings,
} from '@/lib/firestore';
import type {
  Transaction,
  Asset,
  Liability,
  MonthlySnapshot,
  UserSettings,
} from '@/types';

export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getTransactions(user.uid);
    setTransactions(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
}

export function useAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getAssets(user.uid);
    setAssets(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { assets, loading, refresh };
}

export function useLiabilities() {
  const { user } = useAuth();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLiabilities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getLiabilities(user.uid);
    setLiabilities(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { liabilities, loading, refresh };
}

export function useMonthlySnapshots() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getMonthlySnapshots(user.uid);
    setSnapshots(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { snapshots, loading, refresh };
}

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getUserSettings(user.uid);
    setSettings(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, loading, refresh };
}
