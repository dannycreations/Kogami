import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type CurrencyCode } from '../app/constants';
import { insertSorted, updateSorted } from '../utilities/Store';

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

const compareTransactions = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

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
        set((state) => ({
          transactions: insertSorted(state.transactions, normalized, compareTransactions),
        }));
      },
      updateTransaction: (id, updates) =>
        set((state) => {
          const transactions = updateSorted(state.transactions, id, updates, normalizeTransaction, compareTransactions);
          return transactions ? { transactions } : state;
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
