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

export const useInvestmentStore = create<InvestmentState>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [
            {
              ...transaction,
              symbol: transaction.symbol.trim().toUpperCase(),
              action: transaction.action.toUpperCase() as InvestmentTransaction['action'],
              currency: transaction.currency.toUpperCase() as CurrencyCode,
            },
            ...state.transactions,
          ],
        })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id
              ? {
                  ...tx,
                  ...updates,
                  symbol: (updates.symbol ?? tx.symbol).trim().toUpperCase(),
                  action: (updates.action ?? tx.action).toUpperCase() as InvestmentTransaction['action'],
                  currency: (updates.currency ?? tx.currency).toUpperCase() as CurrencyCode,
                }
              : tx,
          ),
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      setTransactions: (transactions) =>
        set({
          transactions: transactions.map((tx) => ({
            ...tx,
            symbol: tx.symbol.trim().toUpperCase(),
            action: tx.action.toUpperCase() as InvestmentTransaction['action'],
            currency: tx.currency.toUpperCase() as CurrencyCode,
          })),
        }),
    }),
    {
      name: 'kogami_investment',
    },
  ),
);
