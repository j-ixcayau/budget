'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Asset } from '@/types';
import { fetchCryptoPrices, type CryptoPrices } from '@/lib/crypto';

export function useCryptoPrices(assets: Asset[]) {
  const [prices, setPrices] = useState<CryptoPrices>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coinIds = assets
    .filter((a) => a.type === 'crypto' && a.coinId)
    .map((a) => a.coinId!);

  const coinIdsKey = [...new Set(coinIds)].sort().join(',');

  const refresh = useCallback(async () => {
    if (!coinIdsKey) {
      setPrices({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchCryptoPrices(coinIdsKey.split(','));
      setPrices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  }, [coinIdsKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (!coinIdsKey) return;
    const interval = setInterval(refresh, 120_000);
    return () => clearInterval(interval);
  }, [coinIdsKey, refresh]);

  return { prices, loading, error, refresh };
}
