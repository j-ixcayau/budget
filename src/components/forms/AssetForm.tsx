'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import type { Asset, AssetFormData, Currency, AssetType } from '@/types';

interface AssetFormProps {
  initialData?: Asset;
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
}

export function AssetForm({ initialData, onSubmit, onCancel }: AssetFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    balance: initialData?.balance.toString() || '',
    currency: initialData?.currency || 'Q' as Currency,
    type: initialData?.type || 'cash' as AssetType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        balance: parseFloat(formData.balance),
        currency: formData.currency,
        type: formData.type,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save asset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        placeholder="e.g., Bank Account, Wise EUR, Binance USDT"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Input
        label="Balance"
        type="number"
        step="0.01"
        value={formData.balance}
        onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
        required
      />
      <Select
        label="Currency"
        value={formData.currency}
        onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
        options={[
          { value: 'Q', label: 'Q (Quetzal)' },
          { value: 'USD', label: 'USD' },
          { value: 'EUR', label: 'EUR' },
        ]}
      />
      <Select
        label="Type"
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
        options={[
          { value: 'cash', label: 'Cash / Bank' },
          { value: 'crypto', label: 'Crypto' },
        ]}
      />
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update' : 'Add'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
