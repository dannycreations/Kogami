import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_CURRENCY } from '../app/constants';

import type { CurrencyCode } from '../app/constants';

interface SettingState {
  readonly preferredCurrency: CurrencyCode;
  readonly setPreferredCurrency: (currency: CurrencyCode) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      preferredCurrency: DEFAULT_CURRENCY,
      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),
    }),
    {
      name: 'kogami_setting',
    },
  ),
);
