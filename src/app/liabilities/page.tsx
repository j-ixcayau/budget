'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { LiabilityForm } from '@/components/forms';
import { useLiabilities } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { addLiability, updateLiability, deleteLiability } from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import type { Liability, LiabilityFormData } from '@/types';

export default function LiabilitiesPage() {
  const { user } = useAuth();
  const { liabilities, loading, refresh } = useLiabilities();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);

  const handleAdd = async (data: LiabilityFormData) => {
    if (!user) return;
    await addLiability(user.uid, data);
    await refresh();
    setIsModalOpen(false);
  };

  const handleEdit = async (data: LiabilityFormData) => {
    if (!editingLiability) return;
    await updateLiability(editingLiability.id, data);
    await refresh();
    setEditingLiability(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this liability?')) return;
    await deleteLiability(id);
    await refresh();
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Liabilities</h1>
          <Button onClick={() => setIsModalOpen(true)}>Add Liability</Button>
        </div>

        <Card>
          {loading ? (
            <div className="text-zinc-400">Loading...</div>
          ) : liabilities.length === 0 ? (
            <div className="text-zinc-400">No liabilities yet.</div>
          ) : (
            <div className="space-y-3">
              {liabilities.map((liability) => (
                <div key={liability.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-zinc-100 font-medium">{liability.name}</div>
                    <div className="flex gap-6 mt-1">
                      <div>
                        <span className="text-zinc-500 text-sm">Remaining: </span>
                        <span className="text-red-400 font-semibold">
                          {formatCurrency(liability.remainingAmount, liability.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-sm">Monthly: </span>
                        <span className="text-zinc-300">
                          {formatCurrency(liability.monthlyPayment, liability.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingLiability(liability)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(liability.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Add Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Liability">
          <LiabilityForm onSubmit={handleAdd} onCancel={() => setIsModalOpen(false)} />
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={!!editingLiability} onClose={() => setEditingLiability(null)} title="Edit Liability">
          {editingLiability && (
            <LiabilityForm
              initialData={editingLiability}
              onSubmit={handleEdit}
              onCancel={() => setEditingLiability(null)}
            />
          )}
        </Modal>
      </div>
    </AuthGuard>
  );
}
