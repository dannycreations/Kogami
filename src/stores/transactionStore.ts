import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type CurrencyCode } from '../app/constants';

export interface Transaction {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly category: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
}

interface TransactionState {
  readonly transactions: Transaction[];
  readonly addTransaction: (transaction: Transaction) => void;
  readonly updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  readonly deleteTransaction: (id: string) => void;
  readonly setTransactions: (transactions: Transaction[]) => void;
}

const compareTransactions = (a: Transaction, b: Transaction) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.id > a.id ? 1 : b.id < a.id ? -1 : 0);

const normalizeTransaction = (tx: Transaction): Transaction => ({
  ...tx,
  description: tx.description.trim(),
  category: tx.category.trim(),
  currency: tx.currency.toUpperCase() as CurrencyCode,
});

export const useTransactionStore = create<TransactionState>()(
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
            updated.description === oldTx.description &&
            updated.category === oldTx.category &&
            updated.amount === oldTx.amount &&
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
      name: 'kogami_general_transactions',
    },
  ),
);
