import type { Currency, UserSettings, Asset, Liability } from '@/types';
import type { CryptoPrices } from '@/lib/crypto';

export function convertToBaseCurrency(
  amount: number,
  fromCurrency: Currency,
  settings: UserSettings
): number {
  const rate = settings.currencyRates[fromCurrency];
  return amount * rate;
}

export function formatCurrency(amount: number, currency: Currency = 'Q'): string {
  const symbols: Record<Currency, string> = {
    Q: 'Q',
    USD: '$',
    EUR: '€',
  };
  return `${symbols[currency]}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getAssetValueInBase(
  asset: Asset,
  settings: UserSettings,
  cryptoPrices?: CryptoPrices
): number {
  if (asset.type === 'crypto' && asset.coinId && asset.quantity && cryptoPrices?.[asset.coinId]) {
    const valueInUsd = asset.quantity * cryptoPrices[asset.coinId].usd;
    return valueInUsd * settings.currencyRates.USD;
  }
  return convertToBaseCurrency(asset.balance, asset.currency, settings);
}

export function calculateTotalAssets(
  assets: Asset[],
  settings: UserSettings,
  cryptoPrices?: CryptoPrices
): number {
  return assets.reduce((total, asset) => {
    return total + getAssetValueInBase(asset, settings, cryptoPrices);
  }, 0);
}

export function calculateTotalLiabilities(
  liabilities: Liability[],
  settings: UserSettings
): number {
  return liabilities.reduce((total, liability) => {
    return total + convertToBaseCurrency(liability.remainingAmount, liability.currency, settings);
  }, 0);
}

export function calculateNetWorth(
  assets: Asset[],
  liabilities: Liability[],
  settings: UserSettings,
  cryptoPrices?: CryptoPrices
): number {
  return calculateTotalAssets(assets, settings, cryptoPrices) - calculateTotalLiabilities(liabilities, settings);
}
