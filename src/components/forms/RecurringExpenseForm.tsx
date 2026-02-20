'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import type { RecurringExpense, RecurringExpenseFormData, Currency } from '@/types';

interface RecurringExpenseFormProps {
  initialData?: RecurringExpense;
  onSubmit: (data: RecurringExpenseFormData) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
  'Health', 'Shopping', 'Salary', 'Freelance', 'Investment', 'Other'
];

export function RecurringExpenseForm({ initialData, onSubmit, onCancel }: RecurringExpenseFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    category: initialData?.category || 'Other',
    currency: initialData?.currency || 'Q' as Currency,
    isFixed: initialData?.isFixed ?? true,
    defaultAmount: initialData?.defaultAmount.toString() || '',
    dayOfMonth: initialData?.dayOfMonth.toString() || '1',
    isActive: initialData?.isActive ?? true,
    note: initialData?.note || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        category: formData.category,
        currency: formData.currency,
        isFixed: formData.isFixed,
        defaultAmount: parseFloat(formData.defaultAmount),
        dayOfMonth: parseInt(formData.dayOfMonth),
        isActive: formData.isActive,
        note: formData.note || '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save recurring expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        placeholder="e.g., Internet, Water, Netflix"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Select
        label="Category"
        value={formData.category}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      <div className="grid grid-cols-2 gap-4">
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
          value={formData.isFixed ? 'fixed' : 'variable'}
          onChange={(e) => setFormData({ ...formData, isFixed: e.target.value === 'fixed' })}
          options={[
            { value: 'fixed', label: 'Fixed Amount' },
            { value: 'variable', label: 'Variable Amount' },
          ]}
        />
      </div>
      <Input
        label={formData.isFixed ? 'Amount' : 'Typical Amount'}
        type="number"
        step="0.01"
        min="0"
        value={formData.defaultAmount}
        onChange={(e) => setFormData({ ...formData, defaultAmount: e.target.value })}
        required
      />
      <Input
        label="Due Day of Month (1-31)"
        type="number"
        min="1"
        max="31"
        value={formData.dayOfMonth}
        onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
        required
      />
      <Input
        label="Note (optional)"
        value={formData.note}
        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
      />
      <div className="flex items-center gap-2 py-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-zinc-300 cursor-pointer">
          Active (Enabled)
        </label>
      </div>

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
