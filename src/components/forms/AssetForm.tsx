'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { POPULAR_COINS } from '@/lib/crypto';
import type { Asset, AssetFormData, Currency, AssetType } from '@/types';

interface AssetFormProps {
  initialData?: Asset;
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
}

const CUSTOM_COIN_VALUE = '__custom__';

export function AssetForm({ initialData, onSubmit, onCancel }: AssetFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isExistingCrypto = initialData?.type === 'crypto' && initialData?.coinId;
  const matchesPredefined = isExistingCrypto
    ? POPULAR_COINS.some((c) => c.id === initialData.coinId)
    : false;

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    balance: initialData?.balance?.toString() || '0',
    currency: initialData?.currency || ('USD' as Currency),
    type: initialData?.type || ('cash' as AssetType),
    selectedCoin: isExistingCrypto
      ? matchesPredefined
        ? initialData.coinId!
        : CUSTOM_COIN_VALUE
      : POPULAR_COINS[0].id,
    customCoinId: isExistingCrypto && !matchesPredefined ? initialData.coinId! : '',
    customCoinSymbol: isExistingCrypto && !matchesPredefined ? (initialData.coinSymbol || '') : '',
    quantity: initialData?.quantity?.toString() || '',
    investedAmount: initialData?.investedAmount?.toString() || '',
    investedCurrency: initialData?.investedCurrency || ('USD' as Currency),
  });

  const isCrypto = formData.type === 'crypto';
  const isCustomCoin = formData.selectedCoin === CUSTOM_COIN_VALUE;

  const handleCoinChange = (coinIdOrCustom: string) => {
    if (coinIdOrCustom === CUSTOM_COIN_VALUE) {
      setFormData({
        ...formData,
        selectedCoin: CUSTOM_COIN_VALUE,
        name: '',
        customCoinId: '',
        customCoinSymbol: '',
      });
      return;
    }

    const coin = POPULAR_COINS.find((c) => c.id === coinIdOrCustom);
    if (coin) {
      setFormData({
        ...formData,
        selectedCoin: coin.id,
        name: `${coin.name} (${coin.symbol})`,
      });
    }
  };

  const handleTypeChange = (newType: AssetType) => {
    if (newType === 'crypto') {
      const defaultCoin = POPULAR_COINS[0];
      setFormData({
        ...formData,
        type: newType,
        name: `${defaultCoin.name} (${defaultCoin.symbol})`,
        selectedCoin: defaultCoin.id,
        currency: 'USD',
      });
    } else {
      setFormData({
        ...formData,
        type: newType,
        name: initialData?.type === 'cash' ? (initialData?.name || '') : '',
        balance: initialData?.type === 'cash' ? (initialData?.balance?.toString() || '') : '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isCrypto) {
        const coinId = isCustomCoin ? formData.customCoinId.trim() : formData.selectedCoin;
        const coin = POPULAR_COINS.find((c) => c.id === coinId);
        const coinSymbol = isCustomCoin
          ? formData.customCoinSymbol.trim().toUpperCase()
          : (coin?.symbol || '');
        const name = isCustomCoin
          ? formData.name.trim() || `${formData.customCoinSymbol.trim().toUpperCase()}`
          : formData.name;

        if (!coinId) {
          setError('Please provide a CoinGecko coin ID.');
          setLoading(false);
          return;
        }

        await onSubmit({
          name,
          balance: 0,
          currency: 'USD',
          type: 'crypto',
          coinId,
          coinSymbol,
          quantity: parseFloat(formData.quantity) || 0,
          investedAmount: parseFloat(formData.investedAmount) || 0,
          investedCurrency: formData.investedCurrency,
        });
      } else {
        await onSubmit({
          name: formData.name,
          balance: parseFloat(formData.balance),
          currency: formData.currency,
          type: 'cash',
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save asset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const coinOptions = [
    ...POPULAR_COINS.map((c) => ({
      value: c.id,
      label: `${c.name} (${c.symbol})`,
    })),
    { value: CUSTOM_COIN_VALUE, label: 'Custom coin...' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Type"
        value={formData.type}
        onChange={(e) => handleTypeChange(e.target.value as AssetType)}
        options={[
          { value: 'cash', label: 'Cash / Bank' },
          { value: 'crypto', label: 'Crypto' },
        ]}
      />

      {isCrypto ? (
        <>
          <Select
            label="Coin"
            value={formData.selectedCoin}
            onChange={(e) => handleCoinChange(e.target.value)}
            options={coinOptions}
          />

          {isCustomCoin && (
            <>
              <Input
                label="CoinGecko ID"
                placeholder="e.g., bitcoin, ethereum"
                value={formData.customCoinId}
                onChange={(e) => setFormData({ ...formData, customCoinId: e.target.value })}
                required
              />
              <Input
                label="Symbol"
                placeholder="e.g., BTC, ETH"
                value={formData.customCoinSymbol}
                onChange={(e) => setFormData({ ...formData, customCoinSymbol: e.target.value })}
                required
              />
              <Input
                label="Name"
                placeholder="e.g., My Custom Coin"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </>
          )}

          <Input
            label="Quantity"
            type="number"
            step="any"
            placeholder="e.g., 0.5"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
          />

          <Input
            label="Invested Amount"
            type="number"
            step="0.01"
            placeholder="Total fiat money invested"
            value={formData.investedAmount}
            onChange={(e) => setFormData({ ...formData, investedAmount: e.target.value })}
            required
          />

          <Select
            label="Invested Currency"
            value={formData.investedCurrency}
            onChange={(e) => setFormData({ ...formData, investedCurrency: e.target.value as Currency })}
            options={[
              { value: 'Q', label: 'Q (Quetzal)' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
            ]}
          />
        </>
      ) : (
        <>
          <Input
            label="Name"
            placeholder="e.g., Bank Account, Wise EUR"
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
        </>
      )}

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
