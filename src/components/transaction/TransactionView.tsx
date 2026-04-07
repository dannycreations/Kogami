import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { CURRENCIES } from '../../app/constants';
import { useSettingStore } from '../../stores/settingsStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { VirtualTable } from '../shared/DataView';
import { ImportCSVModal } from '../shared/ImportModal';

import type { CurrencyCode } from '../../app/constants';
import type { Transaction } from '../../stores/transactionStore';

const EditableRow = memo(
  ({
    transaction,
    style,
    onUpdate,
    onDelete,
  }: {
    transaction: Transaction;
    style?: React.CSSProperties;
    onUpdate: (id: string, updates: Partial<Transaction>) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <div className="v-row flex items-stretch w-full hover:bg-surface-50 transition-colors border-b border-surface-100" style={style}>
        <div className="v-cell border-r border-surface-100 p-1 flex items-center justify-center w-40 shrink-0">
          <input
            type="date"
            value={transaction.date}
            onChange={(e) => onUpdate(transaction.id, { date: e.target.value })}
            className="compact-input w-full h-7 !px-2 font-mono"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 w-20 shrink-0 flex items-center justify-center">
          <button
            onClick={() => onUpdate(transaction.id, { action: transaction.action === 'IN' ? 'OUT' : 'IN' })}
            className={`w-full h-7 text-[10px] font-black rounded border transition-all ${transaction.action === 'IN' ? 'badge-emerald hover:bg-emerald-100' : 'badge-red hover:bg-red-100'}`}
          >
            {transaction.action}
          </button>
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[200px]">
          <input
            type="text"
            value={transaction.description}
            placeholder="Description"
            onChange={(e) => onUpdate(transaction.id, { description: e.target.value })}
            className="compact-input w-full h-7 !px-2 font-medium text-surface-900"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[150px]">
          <input
            type="text"
            value={transaction.category}
            placeholder="Category"
            onChange={(e) => onUpdate(transaction.id, { category: e.target.value })}
            className="compact-input w-full h-7 !px-2 text-surface-600"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 w-24 shrink-0 flex items-center justify-center bg-white">
          <select
            value={transaction.currency}
            onChange={(e) => onUpdate(transaction.id, { currency: e.target.value as CurrencyCode })}
            className="compact-input w-full h-7 !px-1 text-[9px] font-mono font-bold cursor-pointer appearance-auto"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code}
              </option>
            ))}
          </select>
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[120px]">
          <input
            type="number"
            step="any"
            min="0"
            value={transaction.amount}
            onChange={(e) => onUpdate(transaction.id, { amount: Math.abs(parseFloat(e.target.value) || 0) })}
            className={`compact-input w-full h-7 !px-2 font-mono text-right ${transaction.action === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}
          />
        </div>
        <div className="v-cell p-0 w-16 shrink-0 flex items-center justify-center">
          <button
            onClick={() => onDelete(transaction.id)}
            className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Delete transaction"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  },
);

export const TransactionView = () => {
  const transactions = useTransactionStore((state) => state.transactions);
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const updateTransaction = useTransactionStore((state) => state.updateTransaction);
  const deleteTransaction = useTransactionStore((state) => state.deleteTransaction);
  const setTransactions = useTransactionStore((state) => state.setTransactions);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const preferredCurrency = useSettingStore((state) => state.preferredCurrency);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return transactions;
    return transactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(query) ||
        tx.category.toLowerCase().includes(query) ||
        tx.date.includes(query) ||
        tx.currency.toLowerCase().includes(query),
    );
  }, [transactions, searchQuery]);

  const addRow = useCallback(() => {
    addTransaction({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0]!,
      action: 'IN',
      description: '',
      category: '',
      amount: 0,
      currency: preferredCurrency,
    });
  }, [addTransaction, preferredCurrency]);

  const virtualizer = useVirtualizer({
    count: filteredTransactions.length,
    getScrollElement: useCallback(() => parentRef.current, []),
    estimateSize: useCallback(() => 41, []),
    overscan: 10,
  });

  const exportCSV = () => {
    const headers = ['Date', 'Action', 'Description', 'Category', 'Currency', 'Amount'];
    const rows = transactions.map((tx) => [tx.date, tx.action, tx.description, tx.category, tx.currency, tx.amount]);
    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="view-container">
      <div className="flex items-center justify-between mb-2 gap-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 z-10" />
            <input
              type="text"
              placeholder="desc, cat, date, etc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="compact-input w-full !pl-8 !pr-8 !h-9 !rounded"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-surface-100 rounded-full transition-colors"
              >
                <X className="h-3 w-3 text-surface-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <button onClick={addRow} className="compact-button bg-brand-800 text-white hover:bg-brand-900 space-x-2 shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="compact-button bg-white border border-surface-200 text-surface-700 hover:bg-surface-50 space-x-2 shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={exportCSV}
            className="compact-button bg-white border border-surface-200 text-surface-700 hover:bg-surface-50 space-x-2 shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <ImportCSVModal<Transaction>
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(newTxs) => setTransactions([...newTxs, ...transactions])}
        title="Import General Transactions"
        template="Date,Action,Description,Category,Currency,Amount"
        example="2024-01-01,IN,Lunch,Food,USD,15.50"
        minColumns={5}
        parseLine={(parts, lineIdx) => {
          const [date, description, category, currency, actionOrAmount, amountMaybe] = parts;

          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Line ${lineIdx}: Invalid date format. Expected YYYY-MM-DD.`);
          }

          let action: 'IN' | 'OUT' = 'IN';
          let rawAmount = '0';

          if (parts.length >= 6) {
            action = actionOrAmount?.toUpperCase() === 'OUT' ? 'OUT' : 'IN';
            rawAmount = amountMaybe || '0';
          } else {
            // Backward compatibility or simpler format: check if amount is negative
            const parsed = parseFloat(actionOrAmount || '0');
            action = parsed < 0 ? 'OUT' : 'IN';
            rawAmount = Math.abs(parsed).toString();
          }

          const parsedAmount = Math.abs(parseFloat(rawAmount));

          if (isNaN(parsedAmount)) {
            throw new Error(`Line ${lineIdx}: Amount must be a number.`);
          }

          return {
            id: crypto.randomUUID(),
            date,
            action,
            description: description || '',
            category: category || '',
            currency: (currency?.toUpperCase() as CurrencyCode) || 'USD',
            amount: parsedAmount,
          };
        }}
      />

      <VirtualTable
        count={virtualizer.getVirtualItems().length}
        parentRef={parentRef}
        totalSize={virtualizer.getTotalSize()}
        loading={false}
        hasData={filteredTransactions.length > 0}
        headers={
          <>
            <div className="table-header-cell w-40 justify-center">Date</div>
            <div className="table-header-cell w-20 justify-center">Action</div>
            <div className="table-header-cell flex-1 min-w-[200px]">Description</div>
            <div className="table-header-cell flex-1 min-w-[150px]">Category</div>
            <div className="table-header-cell w-24">Currency</div>
            <div className="table-header-cell flex-1 min-w-[120px]">Amount</div>
            <div className="table-header-cell w-16 justify-center">Edit</div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <EditableRow
              key={virtualRow.key}
              transaction={filteredTransactions[virtualRow.index]!}
              onUpdate={updateTransaction}
              onDelete={deleteTransaction}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          );
        }}
        footer={
          <>
            <div className="flex justify-between w-full">
              <span>Total Transactions: {transactions.length}</span>
              {searchQuery && <span>Filtered: {filteredTransactions.length}</span>}
            </div>
          </>
        }
      />
    </div>
  );
};
