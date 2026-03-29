import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, FileText, Plus, Trash2, X } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';

import { CURRENCIES } from '../../app/constants';
import { useInvestmentStore } from '../../stores/investmentStore';
import { useSettingStore } from '../../stores/settingsStore';
import { VirtualTable } from '../shared/DataView';

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
        <div className="v-cell border-r border-surface-100 p-0 flex items-center justify-center w-40 shrink-0">
          <input
            type="date"
            value={transaction.date}
            onChange={(e) => onUpdate(transaction.id, { date: e.target.value })}
            className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-brand-500 text-xs font-mono"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-0 w-24 shrink-0 flex items-center justify-center bg-white">
          <select
            value={transaction.action}
            onChange={(e) => onUpdate(transaction.id, { action: e.target.value as InvestmentTransaction['action'] })}
            className="w-full mx-1 h-7 px-0.5 text-surface-900 text-[9px] font-bold uppercase cursor-pointer outline-none border border-surface-200 rounded bg-white appearance-auto"
          >
            <option value="buy">BUY</option>
            <option value="sell">SELL</option>
          </select>
        </div>
        <div className="v-cell border-r border-surface-100 p-0 flex-1 flex items-center min-w-[120px]">
          <input
            type="text"
            value={transaction.symbol}
            placeholder="Symbol (e.g. AAPL)"
            onChange={(e) => onUpdate(transaction.id, { symbol: e.target.value })}
            className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-brand-500 text-xs font-bold text-brand-900"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-0 flex-1 flex items-center min-w-[120px]">
          <input
            type="number"
            step="any"
            value={transaction.quantity}
            onChange={(e) => onUpdate(transaction.id, { quantity: parseFloat(e.target.value) || 0 })}
            className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-brand-500 text-xs font-mono text-right"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-0 w-24 shrink-0 flex items-center justify-center bg-white">
          <select
            value={transaction.currency}
            onChange={(e) => onUpdate(transaction.id, { currency: e.target.value as CurrencyCode })}
            className="w-full mx-1 h-7 px-0.5 text-surface-900 text-[9px] font-mono font-bold cursor-pointer outline-none border border-surface-200 rounded bg-white appearance-auto"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code}
              </option>
            ))}
          </select>
        </div>
        <div className="v-cell border-r border-surface-100 p-0 flex-1 flex items-center min-w-[120px]">
          <input
            type="number"
            step="any"
            value={transaction.price}
            onChange={(e) => onUpdate(transaction.id, { price: parseFloat(e.target.value) || 0 })}
            className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-brand-500 text-xs font-mono text-right"
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

const BulkImportModal = memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [csvData, setCsvData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setTransactions = useInvestmentStore((state) => state.setTransactions);
  const existingTransactions = useInvestmentStore((state) => state.transactions);

  const handleImport = () => {
    try {
      setError(null);
      const lines = csvData
        .trim()
        .split('\n')
        .filter((line) => line.trim() !== '');

      if (lines.length === 0) {
        throw new Error('CSV is empty');
      }

      // Check for header and skip if present
      const firstLine = lines[0]!.toLowerCase();
      const hasHeader = firstLine.includes('date') || firstLine.includes('symbol');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const newTransactions: InvestmentTransaction[] = dataLines.map((line, index) => {
        const parts = line.split(',').map((p) => p.trim());

        if (parts.length < 6) {
          throw new Error(`Line ${index + (hasHeader ? 2 : 1)}: Invalid number of columns. Expected at least 6.`);
        }

        const [date, action, symbol, quantity, currency, price] = parts;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error(`Line ${index + (hasHeader ? 2 : 1)}: Invalid date format. Expected YYYY-MM-DD.`);
        }

        if (action?.toLowerCase() !== 'buy' && action?.toLowerCase() !== 'sell') {
          throw new Error(`Line ${index + (hasHeader ? 2 : 1)}: Action must be 'buy' or 'sell'.`);
        }

        const parsedQuantity = parseFloat(quantity || '0');
        const parsedPrice = parseFloat(price || '0');

        if (isNaN(parsedQuantity) || isNaN(parsedPrice)) {
          throw new Error(`Line ${index + (hasHeader ? 2 : 1)}: Quantity and Price must be numbers.`);
        }

        return {
          id: Math.random().toString(36).substring(2, 9),
          date,
          action: action as InvestmentTransaction['action'],
          symbol: symbol || '',
          quantity: parsedQuantity,
          currency: (currency?.toUpperCase() as CurrencyCode) || 'USD',
          price: parsedPrice,
        };
      });

      setTransactions([...newTransactions, ...existingTransactions]);
      setCsvData('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error occurred');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-surface-100">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-brand-600" />
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Bulk Import Transactions</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-50 rounded-full transition-colors">
            <X className="h-5 w-5 text-surface-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <p className="text-xs text-surface-500 mb-4 leading-relaxed">
            Paste your CSV data below. Format:{' '}
            <code className="bg-surface-100 px-1 rounded text-brand-700">Date,Action,Symbol,Quantity,Currency,Price</code>
            <br />
            Example: <code className="bg-surface-100 px-1 rounded text-surface-600">2024-01-01,buy,AAPL,10,USD,150.00</code>
          </p>

          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="2024-01-01,buy,AAPL,10,USD,150.00"
            className="w-full h-64 p-4 text-xs font-mono bg-surface-50 border border-surface-200 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
          />

          {error && <div className="mt-3 p-3 bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium rounded">{error}</div>}
        </div>

        <div className="p-4 border-t border-surface-100 flex justify-end space-x-3 bg-surface-50/50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-surface-600 hover:text-surface-900 transition-colors uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-6 py-2 bg-brand-800 text-white rounded text-xs font-bold hover:bg-brand-900 transition-colors shadow-sm uppercase tracking-wider"
          >
            Import Transactions
          </button>
        </div>
      </div>
    </div>
  );
});

export const InvestmentView = () => {
  const transactions = useInvestmentStore((state) => state.transactions);
  const addTransaction = useInvestmentStore((state) => state.addTransaction);
  const updateTransaction = useInvestmentStore((state) => state.updateTransaction);
  const deleteTransaction = useInvestmentStore((state) => state.deleteTransaction);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const preferredCurrency = useSettingStore((state) => state.preferredCurrency);

  const addRow = useCallback(() => {
    addTransaction({
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString().split('T')[0]!,
      action: 'BUY',
      symbol: '',
      quantity: 0,
      price: 0,
      currency: preferredCurrency,
    });
  }, [addTransaction, preferredCurrency]);

  const virtualizer = useVirtualizer({
    count: transactions.length,
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
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex space-x-2">
          <button
            onClick={addRow}
            className="flex items-center space-x-2 bg-brand-800 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-900 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-white border border-surface-200 text-surface-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-surface-50 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-2 bg-white border border-surface-200 text-surface-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-surface-50 transition-colors shadow-sm"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Bulk Import</span>
          </button>
        </div>
      </div>

      <BulkImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      <VirtualTable
        count={virtualizer.getVirtualItems().length}
        parentRef={parentRef}
        totalSize={virtualizer.getTotalSize()}
        loading={false}
        hasData={transactions.length > 0}
        headers={
          <>
            <div className="px-4 py-2 w-40 text-center border-r border-surface-200 bg-surface-50 shrink-0 font-bold text-[10px] uppercase text-surface-500">
              Date
            </div>
            <div className="px-4 py-2 w-24 text-center border-r border-surface-200 bg-surface-50 shrink-0 font-bold text-[10px] uppercase text-surface-500">
              Action
            </div>
            <div className="px-4 py-2 border-r border-surface-200 bg-surface-50 flex-1 font-bold text-[10px] uppercase text-surface-500">Symbol</div>
            <div className="px-4 py-2 border-r border-surface-200 bg-surface-50 flex-1 font-bold text-[10px] uppercase text-surface-500">
              Quantity
            </div>
            <div className="px-4 py-2 border-r border-surface-200 bg-surface-50 w-24 shrink-0 font-bold text-[10px] uppercase text-surface-500">
              Currency
            </div>
            <div className="px-4 py-2 border-r border-surface-200 bg-surface-50 flex-1 font-bold text-[10px] uppercase text-surface-500">Price</div>
            <div className="px-4 py-2 bg-surface-50 w-16 shrink-0 flex items-center justify-center font-bold text-[10px] uppercase text-surface-500">
              Edit
            </div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <EditableRow
              key={virtualRow.key}
              transaction={transactions[virtualRow.index]!}
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
            <span>Total Transactions: {transactions.length}</span>
          </>
        }
      />
    </div>
  );
};
