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
          const next = [...state.transactions];
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
          next.splice(index, 0, normalized);
          return { transactions: next };
        });
      },
      updateTransaction: (id, updates) =>
        set((state) => {
          let changed = false;
          let dateChanged = false;
          const next = state.transactions.map((tx) => {
            if (tx.id !== id) return tx;
            const updated = normalizeTransaction({ ...tx, ...updates });
            if (
              updated.date !== tx.date ||
              updated.description !== tx.description ||
              updated.category !== tx.category ||
              updated.amount !== tx.amount ||
              updated.currency !== tx.currency
            ) {
              changed = true;
              if (updated.date !== tx.date) dateChanged = true;
              return updated;
            }
            return tx;
          });
          if (!changed) return state;
          if (dateChanged) {
            next.sort(compareTransactions);
          }
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
