import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { CURRENCIES } from '../../app/constants';
import { useInvestmentStore } from '../../stores/investmentStore';
import { useSettingStore } from '../../stores/settingsStore';
import { VirtualTable } from '../shared/DataView';
import { ImportCSVModal } from '../shared/ImportModal';

import type { CurrencyCode } from '../../app/constants';
import type { InvestmentTransaction } from '../../stores/investmentStore';

const EditableRow = memo(
  ({
    transaction,
    style,
    onUpdate,
    onDelete,
  }: {
    transaction: InvestmentTransaction;
    style?: React.CSSProperties;
    onUpdate: (id: string, updates: Partial<InvestmentTransaction>) => void;
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
        <div className="v-cell border-r border-surface-100 p-1 w-24 shrink-0 flex items-center justify-center">
          <button
            onClick={() => onUpdate(transaction.id, { action: transaction.action === 'BUY' ? 'SELL' : 'BUY' })}
            className={`w-full h-7 text-[10px] font-black rounded border transition-all ${
              transaction.action === 'BUY' ? 'badge-emerald hover:bg-emerald-100' : 'badge-red hover:bg-red-100'
            }`}
          >
            {transaction.action}
          </button>
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[120px]">
          <input
            type="text"
            value={transaction.symbol}
            placeholder="Symbol (e.g. AAPL)"
            onChange={(e) => onUpdate(transaction.id, { symbol: e.target.value })}
            className="compact-input w-full h-7 !px-2 font-bold text-brand-900"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[120px]">
          <input
            type="number"
            step="any"
            min="0"
            value={transaction.quantity}
            onChange={(e) => onUpdate(transaction.id, { quantity: Math.abs(parseFloat(e.target.value) || 0) })}
            className={`compact-input w-full h-7 !px-2 font-mono text-right ${transaction.action === 'BUY' ? 'text-emerald-700' : 'text-red-600'}`}
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
            value={transaction.price}
            onChange={(e) => onUpdate(transaction.id, { price: Math.abs(parseFloat(e.target.value) || 0) })}
            className={`compact-input w-full h-7 !px-2 font-mono text-right ${transaction.action === 'BUY' ? 'text-emerald-700' : 'text-red-600'}`}
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

export const InvestmentView = () => {
  const transactions = useInvestmentStore((state) => state.transactions);
  const addTransaction = useInvestmentStore((state) => state.addTransaction);
  const updateTransaction = useInvestmentStore((state) => state.updateTransaction);
  const deleteTransaction = useInvestmentStore((state) => state.deleteTransaction);
  const setTransactions = useInvestmentStore((state) => state.setTransactions);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const preferredCurrency = useSettingStore((state) => state.preferredCurrency);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return transactions;
    return transactions.filter(
      (tx) =>
        tx.symbol.toLowerCase().includes(query) ||
        tx.date.includes(query) ||
        tx.action.toLowerCase().includes(query) ||
        tx.currency.toLowerCase().includes(query),
    );
  }, [transactions, searchQuery]);

  const addRow = useCallback(() => {
    addTransaction({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0]!,
      action: 'BUY',
      symbol: '',
      quantity: 0,
      price: 0,
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
    const headers = ['Date', 'Action', 'Symbol', 'Quantity', 'Currency', 'Price'];
    const rows = transactions.map((tx) => [tx.date, tx.action, tx.symbol, tx.quantity, tx.currency, tx.price]);
    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'investments.csv');
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
              placeholder="symbol, date, etc..."
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

      <ImportCSVModal<InvestmentTransaction>
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(newTxs) => setTransactions([...newTxs, ...transactions])}
        title="Import Investment Transactions"
        template="Date,Action,Symbol,Quantity,Currency,Price"
        example="2024-01-01,buy,AAPL,10,USD,150.00"
        minColumns={6}
        parseLine={(parts, lineIdx) => {
          const [date, action, symbol, quantity, currency, price] = parts;

          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Line ${lineIdx}: Invalid date format. Expected YYYY-MM-DD.`);
          }

          const actionUpper = action?.toUpperCase();
          if (actionUpper !== 'BUY' && actionUpper !== 'SELL') {
            throw new Error(`Line ${lineIdx}: Action must be 'buy' or 'sell'.`);
          }

          const parsedQuantity = Math.abs(parseFloat(quantity || '0'));
          const parsedPrice = Math.abs(parseFloat(price || '0'));

          if (isNaN(parsedQuantity) || isNaN(parsedPrice)) {
            throw new Error(`Line ${lineIdx}: Quantity and Price must be numbers.`);
          }

          return {
            id: crypto.randomUUID(),
            date,
            action: actionUpper as InvestmentTransaction['action'],
            symbol: symbol?.toUpperCase() || '',
            quantity: parsedQuantity,
            currency: (currency?.toUpperCase() as CurrencyCode) || 'USD',
            price: parsedPrice,
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
            <div className="table-header-cell w-24 justify-center">Action</div>
            <div className="table-header-cell flex-1">Symbol</div>
            <div className="table-header-cell flex-1">Quantity</div>
            <div className="table-header-cell w-24">Currency</div>
            <div className="table-header-cell flex-1">Price</div>
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
