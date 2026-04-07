import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type CurrencyCode } from '../app/constants';

export interface InvestmentTransaction {
  readonly id: string;
  readonly date: string;
  readonly action: 'BUY' | 'SELL';
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  readonly currency: CurrencyCode;
}

interface InvestmentState {
  readonly transactions: InvestmentTransaction[];
  readonly addTransaction: (transaction: InvestmentTransaction) => void;
  readonly updateTransaction: (
    id: string,
    updates: Partial<Omit<InvestmentTransaction, 'action'>> & { action?: InvestmentTransaction['action'] },
  ) => void;
  readonly deleteTransaction: (id: string) => void;
  readonly setTransactions: (transactions: InvestmentTransaction[]) => void;
}

const compareTransactions = (a: InvestmentTransaction, b: InvestmentTransaction) =>
  b.date > a.date ? 1 : b.date < a.date ? -1 : b.id > a.id ? 1 : b.id < a.id ? -1 : 0;

const normalizeTransaction = (tx: InvestmentTransaction): InvestmentTransaction => ({
  ...tx,
  symbol: tx.symbol.trim().toUpperCase(),
  action: tx.action.toUpperCase() as InvestmentTransaction['action'],
  currency: tx.currency.toUpperCase() as CurrencyCode,
});

export const useInvestmentStore = create<InvestmentState>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (transaction) => {
        const normalized = normalizeTransaction(transaction);
        set((state) => {
          const next = state.transactions;
          let low = 0;
          let high = next.length - 1;
          let index = next.length;

          while (low <= high) {
            const mid = (low + high) >>> 1;
            const item = next[mid]!;
            if (normalized.date > item.date || (normalized.date === item.date && normalized.id >= item.id)) {
              index = mid;
              high = mid - 1;
            } else {
              low = mid + 1;
            }
          }

          const updated = [...next];
          updated.splice(index, 0, normalized);
          return { transactions: updated };
        });
      },
      updateTransaction: (id, updates) =>
        set((state) => {
          const index = state.transactions.findIndex((tx) => tx.id === id);
          if (index === -1) return state;

          const oldTx = state.transactions[index]!;
          const updated = normalizeTransaction({ ...oldTx, ...updates });

          if (
            updated.date === oldTx.date &&
            updated.symbol === oldTx.symbol &&
            updated.action === oldTx.action &&
            updated.quantity === oldTx.quantity &&
            updated.price === oldTx.price &&
            updated.currency === oldTx.currency
          ) {
            return state;
          }

          const next = [...state.transactions];
          if (updated.date === oldTx.date) {
            next[index] = updated;
            return { transactions: next };
          }

          next.splice(index, 1);
          let low = 0;
          let high = next.length - 1;
          let insertIdx = next.length;

          while (low <= high) {
            const mid = (low + high) >>> 1;
            const item = next[mid]!;
            if (updated.date > item.date || (updated.date === item.date && updated.id >= item.id)) {
              insertIdx = mid;
              high = mid - 1;
            } else {
              low = mid + 1;
            }
          }
          next.splice(insertIdx, 0, updated);
          return { transactions: next };
        }),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      setTransactions: (transactions) =>
        set({
          transactions: transactions.map(normalizeTransaction).sort(compareTransactions),
        }),
    }),
    {
      name: 'kogami_investment',
    },
  ),
);
