import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type CurrencyCode } from '../app/constants';
import { insertSorted, updateSorted } from '../utilities/Store';

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

const compareTransactions = (a: InvestmentTransaction, b: InvestmentTransaction) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

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
      name: 'kogami_investment',
    },
  ),
);
