'use client';

import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Button, Input, Select } from '@/components/ui';
import type { Transaction, TransactionFormData, Currency, TransactionType } from '@/types';

interface TransactionFormProps {
  initialData?: Transaction;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
  'Health', 'Shopping', 'Salary', 'Freelance', 'Investment', 'Other'
];

export function TransactionForm({ initialData, onSubmit, onCancel }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    date: initialData?.date.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    amount: initialData?.amount.toString() || '',
    type: initialData?.type || 'expense' as TransactionType,
    category: initialData?.category || 'Other',
    currency: initialData?.currency || 'Q' as Currency,
    note: initialData?.note || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        date: Timestamp.fromDate(new Date(formData.date)),
        amount: parseFloat(formData.amount),
        type: formData.type,
        category: formData.category,
        currency: formData.currency,
        note: formData.note || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Date"
        type="date"
        value={formData.date}
        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        required
      />
      <Input
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
        required
      />
      <Select
        label="Type"
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <Select
        label="Category"
        value={formData.category}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
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
      <Input
        label="Note (optional)"
        value={formData.note}
        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
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
