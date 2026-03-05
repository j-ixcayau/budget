'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { formatCurrency } from '@/lib/currency';
import { bulkUpdateAssetBalances } from '@/lib/firestore';
import type { Asset } from '@/types';

interface BulkBalanceUpdateFormProps {
  assets: Asset[];
  onComplete: () => void;
  onCancel: () => void;
}

export function BulkBalanceUpdateForm({ assets, onComplete, onCancel }: BulkBalanceUpdateFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState<Record<string, string>>(
    Object.fromEntries(assets.map((a) => [a.id, a.balance.toString()]))
  );

  const changedCount = assets.filter(
    (a) => parseFloat(balances[a.id] || '0') !== a.balance
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const updates = assets
      .filter((a) => {
        const newBalance = parseFloat(balances[a.id] || '0');
        return !isNaN(newBalance) && newBalance !== a.balance;
      })
      .map((a) => ({ id: a.id, balance: parseFloat(balances[a.id]) }));

    if (updates.length === 0) {
      onComplete();
      return;
    }

    setLoading(true);
    try {
      await bulkUpdateAssetBalances(updates);
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update balances.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-zinc-400">
        Update your cash/bank balances to their current real values.
      </p>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {assets.map((asset) => {
          const changed = parseFloat(balances[asset.id] || '0') !== asset.balance;
          return (
            <div
              key={asset.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                changed ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-zinc-800/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100 truncate">{asset.name}</div>
                <div className="text-xs text-zinc-500">
                  Was: {formatCurrency(asset.balance, asset.currency)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-zinc-500 font-medium">{asset.currency}</span>
                <Input
                  type="number"
                  step="0.01"
                  value={balances[asset.id] || ''}
                  onChange={(e) => setBalances({ ...balances, [asset.id]: e.target.value })}
                  className="w-32 text-right !py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-zinc-500">
          {changedCount > 0 ? `${changedCount} balance${changedCount > 1 ? 's' : ''} changed` : 'No changes'}
        </span>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save All'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
