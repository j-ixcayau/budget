'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import type { Liability, LiabilityFormData, Currency } from '@/types';

interface LiabilityFormProps {
  initialData?: Liability;
  onSubmit: (data: LiabilityFormData) => Promise<void>;
  onCancel: () => void;
}

export function LiabilityForm({ initialData, onSubmit, onCancel }: LiabilityFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    remainingAmount: initialData?.remainingAmount.toString() || '',
    monthlyPayment: initialData?.monthlyPayment.toString() || '',
    currency: initialData?.currency || 'Q' as Currency,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        remainingAmount: parseFloat(formData.remainingAmount),
        monthlyPayment: parseFloat(formData.monthlyPayment),
        currency: formData.currency,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save liability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        placeholder="e.g., Car Loan, Mortgage, Credit Card"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Input
        label="Remaining Amount"
        type="number"
        step="0.01"
        value={formData.remainingAmount}
        onChange={(e) => setFormData({ ...formData, remainingAmount: e.target.value })}
        required
      />
      <Input
        label="Monthly Payment"
        type="number"
        step="0.01"
        value={formData.monthlyPayment}
        onChange={(e) => setFormData({ ...formData, monthlyPayment: e.target.value })}
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
