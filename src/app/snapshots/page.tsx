'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import {
  useAssets,
  useLiabilities,
  useMonthlySnapshots,
  useUserSettings,
} from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { addMonthlySnapshot, deleteMonthlySnapshot, getCurrentMonth } from '@/lib/firestore';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  formatCurrency,
} from '@/lib/currency';

export default function SnapshotsPage() {
  const { user } = useAuth();
  const { assets } = useAssets();
  const { liabilities } = useLiabilities();
  const { snapshots, loading, refresh } = useMonthlySnapshots();
  const { settings } = useUserSettings();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!user || !settings) return;

    const currentMonth = getCurrentMonth();
    
    // Check if snapshot already exists for this month
    const exists = snapshots.some((s) => s.month === currentMonth);
    if (exists) {
      if (!confirm(`A snapshot for ${currentMonth} already exists. Generate a new one?`)) {
        return;
      }
    }

    setGenerating(true);
    try {
      const totalAssets = calculateTotalAssets(assets, settings);
      const totalLiabilities = calculateTotalLiabilities(liabilities, settings);
      const netWorth = calculateNetWorth(assets, liabilities, settings);

      await addMonthlySnapshot(user.uid, {
        month: currentMonth,
        totalAssets,
        totalLiabilities,
        netWorth,
      });

      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    await deleteMonthlySnapshot(id);
    await refresh();
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Monthly Snapshots</h1>
          <Button onClick={handleGenerate} disabled={generating || !settings}>
            {generating ? 'Generating...' : 'Generate Snapshot'}
          </Button>
        </div>

        <Card>
          {loading ? (
            <div className="text-zinc-400">Loading...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-zinc-400">
              No snapshots yet. Click &quot;Generate Snapshot&quot; to create your first monthly snapshot.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-zinc-400 text-sm border-b border-zinc-800">
                    <th className="pb-3 font-medium">Month</th>
                    <th className="pb-3 font-medium">Total Assets</th>
                    <th className="pb-3 font-medium">Total Liabilities</th>
                    <th className="pb-3 font-medium">Net Worth</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-b border-zinc-800/50">
                      <td className="py-3 text-zinc-100 font-medium">{snapshot.month}</td>
                      <td className="py-3 text-green-400">
                        {formatCurrency(snapshot.totalAssets)}
                      </td>
                      <td className="py-3 text-red-400">
                        {formatCurrency(snapshot.totalLiabilities)}
                      </td>
                      <td className={`py-3 font-semibold ${
                        snapshot.netWorth >= 0 ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(snapshot.netWorth)}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDelete(snapshot.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AuthGuard>
  );
}
