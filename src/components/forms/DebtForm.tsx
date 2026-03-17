'use client';

import { useState } from 'react';

import { Timestamp, deleteField } from 'firebase/firestore';
import { Button, Input, Select } from '@/components/ui';
import type { Debt, DebtFormData, Currency } from '@/types';

interface DebtFormProps {
  initialData?: Debt;
  onSubmit: (data: DebtFormData) => Promise<void>;
  onCancel: () => void;
}

function toInputDate(ts?: Timestamp): string {
  if (!ts) return '';
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DebtForm({ initialData, onSubmit, onCancel }: DebtFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    personName: initialData?.personName || '',
    amount: initialData?.amount.toString() || '',
    currency: (initialData?.currency || 'Q') as Currency,
    date: toInputDate(initialData?.date) || new Date().toISOString().slice(0, 10),
    dueDate: toInputDate(initialData?.dueDate) || '',
    note: initialData?.note || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        personName: formData.personName.trim(),
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        date: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')),
        // Use deleteField() so clearing a value actually removes it from Firestore
        dueDate: formData.dueDate
          ? Timestamp.fromDate(new Date(formData.dueDate + 'T00:00:00'))
          : deleteField(),
        note: formData.note.trim() || deleteField(),
      } as unknown as DebtFormData;
      await onSubmit(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Person Name"
        placeholder="e.g., John, Mom, Alice"
        value={formData.personName}
        onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
        required
      />
      <Input
        label="Amount Lent"
        type="number"
        step="0.01"
        min="0.01"
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
      <Input
        label="Date Lent"
        type="date"
        value={formData.date}
        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        required
      />
      <Input
        label="Due Date (optional)"
        type="date"
        value={formData.dueDate}
        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Note (optional)</label>
        <textarea
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          rows={2}
          placeholder="What was it for?"
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update' : 'Add Debt'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
