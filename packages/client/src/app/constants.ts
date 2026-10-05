export const API_BASE_URL = 'http://localhost:1730';

export const DEFAULT_CURRENCY: CurrencyCode = 'IDR';

export const CURRENCIES = [
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'SGD', name: 'Singapore Dollar' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];
