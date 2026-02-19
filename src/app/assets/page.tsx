'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { AssetForm } from '@/components/forms';
import { useAssets } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { addAsset, updateAsset, deleteAsset } from '@/lib/firestore';
import { formatCurrency } from '@/lib/currency';
import type { Asset, AssetFormData } from '@/types';

function AssetItem({
  asset,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  onEdit: (a: Asset) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
      <div>
        <div className="text-zinc-100 font-medium">{asset.name}</div>
        <div className="text-green-400 font-semibold text-sm">
          {formatCurrency(asset.balance, asset.currency)}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(asset)}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(asset.id)}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const { user } = useAuth();
  const { assets, loading, refresh } = useAssets();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const handleAdd = async (data: AssetFormData) => {
    if (!user) return;
    await addAsset(user.uid, data);
    await refresh();
    setIsModalOpen(false);
  };

  const handleEdit = async (data: AssetFormData) => {
    if (!editingAsset) return;
    await updateAsset(editingAsset.id, data);
    await refresh();
    setEditingAsset(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this asset?')) return;
    await deleteAsset(id);
    await refresh();
  };

  const cashAssets = assets.filter((a) => a.type === 'cash');
  const cryptoAssets = assets.filter((a) => a.type === 'crypto');

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Assets</h1>
          <Button onClick={() => setIsModalOpen(true)}>Add Asset</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <Card key={i}>
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-14 bg-zinc-800/60 rounded animate-pulse" />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <Card>
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-zinc-300 font-medium">No assets yet</p>
                <p className="text-zinc-500 text-sm mt-1">Add your bank accounts, cash, or crypto holdings.</p>
              </div>
              <Button onClick={() => setIsModalOpen(true)}>Add Asset</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash / Bank */}
            <Card title="Cash / Bank">
              <div className="space-y-3">
                {cashAssets.length === 0 ? (
                  <div className="text-zinc-500 text-sm py-2">No cash or bank assets.</div>
                ) : (
                  cashAssets.map((asset) => (
                    <AssetItem
                      key={asset.id}
                      asset={asset}
                      onEdit={setEditingAsset}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </Card>

            {/* Crypto */}
            <Card title="Crypto">
              <div className="space-y-3">
                {cryptoAssets.length === 0 ? (
                  <div className="text-zinc-500 text-sm py-2">No crypto assets.</div>
                ) : (
                  cryptoAssets.map((asset) => (
                    <AssetItem
                      key={asset.id}
                      asset={asset}
                      onEdit={setEditingAsset}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Add Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Asset">
          <AssetForm onSubmit={handleAdd} onCancel={() => setIsModalOpen(false)} />
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={!!editingAsset} onClose={() => setEditingAsset(null)} title="Edit Asset">
          {editingAsset && (
            <AssetForm
              initialData={editingAsset}
              onSubmit={handleEdit}
              onCancel={() => setEditingAsset(null)}
            />
          )}
        </Modal>
      </div>
    </AuthGuard>
  );
}
