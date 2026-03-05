import type { Currency, UserSettings } from '@/types';

export interface CoinInfo {
  id: string;       // CoinGecko ID
  symbol: string;   // e.g. "BTC"
  name: string;     // e.g. "Bitcoin"
}

export const POPULAR_COINS: CoinInfo[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'tron', symbol: 'TRX', name: 'TRON' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
];

export interface CryptoPrice {
  usd: number;
  eur: number;
  usd_24h_change?: number;
}

export type CryptoPrices = Record<string, CryptoPrice>;

export async function fetchCryptoPrices(coinIds: string[]): Promise<CryptoPrices> {
  if (coinIds.length === 0) return {};

  const unique = [...new Set(coinIds)];
  const res = await fetch(`/api/crypto/prices?ids=${unique.join(',')}`);

  if (!res.ok) {
    throw new Error('Failed to fetch crypto prices');
  }

  return res.json();
}

export function getCryptoCurrentValue(
  quantity: number,
  coinId: string,
  prices: CryptoPrices,
  targetCurrency: Currency,
  settings: UserSettings
): number {
  const price = prices[coinId];
  if (!price) return 0;

  const valueInUsd = quantity * price.usd;

  if (targetCurrency === 'USD') return valueInUsd;
  if (targetCurrency === 'EUR') return quantity * price.eur;

  // For Q (Quetzal): convert from USD using the currency rates
  // settings.currencyRates.USD = how many Q per 1 USD
  const qPerUsd = settings.currencyRates.USD / settings.currencyRates.Q;
  return valueInUsd * qPerUsd;
}

export function getCryptoValueInBaseCurrency(
  quantity: number,
  coinId: string,
  prices: CryptoPrices,
  settings: UserSettings
): number {
  const price = prices[coinId];
  if (!price) return 0;

  const valueInUsd = quantity * price.usd;
  return valueInUsd * settings.currencyRates.USD;
}

export function calculateProfitLoss(
  currentValue: number,
  investedAmount: number
): { amount: number; percentage: number } {
  const amount = currentValue - investedAmount;
  const percentage = investedAmount > 0 ? (amount / investedAmount) * 100 : 0;
  return { amount, percentage };
}

export function findCoinById(coinId: string): CoinInfo | undefined {
  return POPULAR_COINS.find((c) => c.id === coinId);
}

export function findCoinBySymbol(symbol: string): CoinInfo | undefined {
  return POPULAR_COINS.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
}
