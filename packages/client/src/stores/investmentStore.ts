import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { insertSorted, newestFirst, updateSorted } from '@kogami/client/utilities/store';

import type { CurrencyCode } from '@kogami/client/app/constants';

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
  readonly updateTransaction: (id: string, updates: Partial<InvestmentTransaction>) => void;
  readonly deleteTransaction: (id: string) => void;
  readonly setTransactions: (transactions: InvestmentTransaction[]) => void;
}

const normalizeTransaction = (tx: InvestmentTransaction): InvestmentTransaction => ({
  ...tx,
  symbol: tx.symbol.trim().toUpperCase(),
  action: tx.action.toUpperCase() as InvestmentTransaction['action'],
  quantity: Math.abs(tx.quantity || 0),
  price: Math.abs(tx.price || 0),
  currency: tx.currency.toUpperCase() as CurrencyCode,
});

export const useInvestmentStore = create<InvestmentState>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: insertSorted(state.transactions, normalizeTransaction(transaction), newestFirst),
        })),
      updateTransaction: (id, updates) =>
        set((state) => {
          const transactions = updateSorted(state.transactions, id, updates, normalizeTransaction, newestFirst);
          return transactions ? { transactions } : state;
        }),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      setTransactions: (transactions) =>
        set({
          transactions: transactions.map(normalizeTransaction).sort(newestFirst),
        }),
    }),
    {
      name: 'kogami_investment',
      merge: (persisted, current) => ({
        ...current,
        transactions: [...(persisted as InvestmentState).transactions].sort(newestFirst),
      }),
    },
  ),
);
