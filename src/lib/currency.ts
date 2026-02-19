import type { Currency, UserSettings, Asset, Liability } from '@/types';

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

export function calculateTotalAssets(
  assets: Asset[],
  settings: UserSettings
): number {
  return assets.reduce((total, asset) => {
    return total + convertToBaseCurrency(asset.balance, asset.currency, settings);
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
  settings: UserSettings
): number {
  return calculateTotalAssets(assets, settings) - calculateTotalLiabilities(liabilities, settings);
}
