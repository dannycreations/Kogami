import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingState {
  readonly preferredCurrency: string;
  readonly setPreferredCurrency: (currency: string) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      preferredCurrency: 'IDR',
      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),
    }),
    {
      name: 'kogami_settings_store',
    },
  ),
);
