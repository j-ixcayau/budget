'use client';

import { useMemo, useState } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Modal } from '@/components/ui';
import { AssetForm, BulkBalanceUpdateForm } from '@/components/forms';
import { useAssets, useUserSettings } from '@/hooks/useFirestore';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useAuth } from '@/hooks/useAuth';
import { addAsset, updateAsset, deleteAsset } from '@/lib/firestore';
import { formatCurrency, convertToBaseCurrency } from '@/lib/currency';
import { calculateProfitLoss, getCryptoValueInBaseCurrency } from '@/lib/crypto';
import type { Asset, AssetFormData, Currency } from '@/types';
import type { CryptoPrices } from '@/lib/crypto';

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

function CryptoAssetItem({
  asset,
  prices,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  prices: CryptoPrices;
  onEdit: (a: Asset) => void;
  onDelete: (id: string) => void;
}) {
  const price = asset.coinId ? prices[asset.coinId] : null;
  const currentValueUsd = price && asset.quantity ? asset.quantity * price.usd : null;

  const investedDisplay = asset.investedAmount != null && asset.investedCurrency
    ? formatCurrency(asset.investedAmount, asset.investedCurrency)
    : null;

  const pl = currentValueUsd != null && asset.investedAmount != null && asset.investedCurrency === 'USD'
    ? calculateProfitLoss(currentValueUsd, asset.investedAmount)
    : null;

  // For non-USD invested currencies we still show the raw P/L in USD
  const plApprox = currentValueUsd != null && asset.investedAmount != null && asset.investedCurrency !== 'USD'
    ? { note: true as const }
    : null;

  return (
    <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
            {asset.coinSymbol || '???'}
          </span>
          <span className="text-zinc-100 font-medium">{asset.name}</span>
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

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-zinc-400">Quantity</div>
        <div className="text-zinc-200 text-right">
          {asset.quantity != null ? asset.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '—'}{' '}
          <span className="text-zinc-500">{asset.coinSymbol}</span>
        </div>

        {investedDisplay && (
          <>
            <div className="text-zinc-400">Invested</div>
            <div className="text-zinc-200 text-right">{investedDisplay}</div>
          </>
        )}

        <div className="text-zinc-400">Current Value</div>
        <div className="text-zinc-200 text-right">
          {currentValueUsd != null ? formatCurrency(currentValueUsd, 'USD') : (
            <span className="text-zinc-500">Loading...</span>
          )}
        </div>

        {price?.usd_24h_change != null && (
          <>
            <div className="text-zinc-400">24h Change</div>
            <div className={`text-right font-medium ${price.usd_24h_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {price.usd_24h_change >= 0 ? '+' : ''}{price.usd_24h_change.toFixed(2)}%
            </div>
          </>
        )}

        {pl && (
          <>
            <div className="text-zinc-400">P/L</div>
            <div className={`text-right font-semibold ${pl.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pl.amount >= 0 ? '+' : ''}{formatCurrency(pl.amount, 'USD')}{' '}
              <span className="text-xs">({pl.percentage >= 0 ? '+' : ''}{pl.percentage.toFixed(1)}%)</span>
            </div>
          </>
        )}

        {plApprox && currentValueUsd != null && asset.investedAmount != null && (
          <>
            <div className="text-zinc-400">P/L (approx)</div>
            <div className="text-zinc-300 text-right text-xs">
              Value: {formatCurrency(currentValueUsd, 'USD')} vs Invested: {investedDisplay}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CryptoPortfolioSummary({
  cryptoAssets,
  prices,
  baseCurrency,
  settings,
}: {
  cryptoAssets: Asset[];
  prices: CryptoPrices;
  baseCurrency: Currency;
  settings: { currencyRates: { EUR: number; USD: number; Q: number } };
}) {
  const summary = useMemo(() => {
    let totalCurrentBase = 0;
    let totalInvestedBase = 0;

    for (const asset of cryptoAssets) {
      if (asset.coinId && asset.quantity) {
        totalCurrentBase += getCryptoValueInBaseCurrency(asset.quantity, asset.coinId, prices, { baseCurrency, currencyRates: settings.currencyRates });
      }
      if (asset.investedAmount != null && asset.investedCurrency) {
        totalInvestedBase += convertToBaseCurrency(asset.investedAmount, asset.investedCurrency, { baseCurrency, currencyRates: settings.currencyRates });
      }
    }

    const pl = calculateProfitLoss(totalCurrentBase, totalInvestedBase);
    return { totalCurrentBase, totalInvestedBase, pl };
  }, [cryptoAssets, prices, baseCurrency, settings.currencyRates]);

  if (cryptoAssets.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
        <div className="text-xs text-zinc-500 mb-1">Total Invested</div>
        <div className="text-sm font-semibold text-zinc-200">
          {formatCurrency(summary.totalInvestedBase, baseCurrency)}
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
        <div className="text-xs text-zinc-500 mb-1">Current Value</div>
        <div className="text-sm font-semibold text-zinc-200">
          {summary.totalCurrentBase > 0
            ? formatCurrency(summary.totalCurrentBase, baseCurrency)
            : <span className="text-zinc-500">Loading...</span>}
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
        <div className="text-xs text-zinc-500 mb-1">Total P/L</div>
        <div className={`text-sm font-semibold ${summary.pl.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {summary.totalCurrentBase > 0 ? (
            <>
              {summary.pl.amount >= 0 ? '+' : ''}{formatCurrency(summary.pl.amount, baseCurrency)}
              <span className="text-xs ml-1">({summary.pl.percentage >= 0 ? '+' : ''}{summary.pl.percentage.toFixed(1)}%)</span>
            </>
          ) : '—'}
        </div>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const { user } = useAuth();
  const { assets, loading, refresh } = useAssets();
  const { settings } = useUserSettings();
  const { prices, loading: pricesLoading } = useCryptoPrices(assets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);

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
          <div className="flex gap-2">
            {cashAssets.length > 0 && (
              <Button variant="secondary" onClick={() => setIsBulkUpdateOpen(true)}>
                Update Balances
              </Button>
            )}
            <Button onClick={() => setIsModalOpen(true)}>Add Asset</Button>
          </div>
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
            <Card
              title={
                <span className="flex items-center gap-2">
                  Crypto
                  {pricesLoading && (
                    <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  )}
                </span>
              }
            >
              {settings && (
                <CryptoPortfolioSummary
                  cryptoAssets={cryptoAssets}
                  prices={prices}
                  baseCurrency={settings.baseCurrency}
                  settings={settings}
                />
              )}
              <div className="space-y-3">
                {cryptoAssets.length === 0 ? (
                  <div className="text-zinc-500 text-sm py-2">No crypto assets.</div>
                ) : (
                  cryptoAssets.map((asset) => (
                    <CryptoAssetItem
                      key={asset.id}
                      asset={asset}
                      prices={prices}
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

        {/* Bulk Balance Update Modal */}
        <Modal isOpen={isBulkUpdateOpen} onClose={() => setIsBulkUpdateOpen(false)} title="Update Balances">
          <BulkBalanceUpdateForm
            assets={cashAssets}
            onComplete={async () => {
              await refresh();
              setIsBulkUpdateOpen(false);
            }}
            onCancel={() => setIsBulkUpdateOpen(false)}
          />
        </Modal>
      </div>
    </AuthGuard>
  );
}
