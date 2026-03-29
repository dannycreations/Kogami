import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InvestmentTransaction {
  readonly id: string;
  readonly date: string;
  readonly action: 'buy' | 'sell';
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  readonly currency: string;
}

interface InvestmentState {
  readonly transactions: InvestmentTransaction[];
  readonly addTransaction: (transaction: InvestmentTransaction) => void;
  readonly updateTransaction: (id: string, updates: Partial<InvestmentTransaction>) => void;
  readonly deleteTransaction: (id: string) => void;
  readonly setTransactions: (transactions: InvestmentTransaction[]) => void;
}

export const useInvestmentStore = create<InvestmentState>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [transaction, ...state.transactions],
        })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx)),
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      setTransactions: (transactions) => set({ transactions }),
    }),
    {
      name: 'kogami_investments_store',
    },
  ),
);
