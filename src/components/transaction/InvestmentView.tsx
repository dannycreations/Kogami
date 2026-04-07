import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

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
        <div className="v-cell border-r border-surface-100 p-1 flex items-center justify-center w-40 shrink-0">
          <input
            type="date"
            value={transaction.date}
            onChange={(e) => onUpdate(transaction.id, { date: e.target.value })}
            className="w-full h-7 px-2 bg-white border border-surface-200 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-xs font-mono transition-all"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 w-24 shrink-0 flex items-center justify-center bg-white">
          <select
            value={transaction.action}
            onChange={(e) => onUpdate(transaction.id, { action: e.target.value as InvestmentTransaction['action'] })}
            className="w-full h-7 px-1 text-surface-900 text-[9px] font-bold uppercase cursor-pointer outline-none border border-surface-200 rounded bg-white appearance-auto focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[120px]">
          <input
            type="text"
            value={transaction.symbol}
            placeholder="Symbol (e.g. AAPL)"
            onChange={(e) => onUpdate(transaction.id, { symbol: e.target.value })}
            className="w-full h-7 px-2 bg-white border border-surface-200 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-xs font-bold text-brand-900 transition-all"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 flex-1 flex items-center min-w-[120px]">
          <input
            type="number"
            step="any"
            value={transaction.quantity}
            onChange={(e) => onUpdate(transaction.id, { quantity: parseFloat(e.target.value) || 0 })}
            className="w-full h-7 px-2 bg-white border border-surface-200 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-xs font-mono text-right transition-all"
          />
        </div>
        <div className="v-cell border-r border-surface-100 p-1 w-24 shrink-0 flex items-center justify-center bg-white">
          <select
            value={transaction.currency}
            onChange={(e) => onUpdate(transaction.id, { currency: e.target.value as CurrencyCode })}
            className="w-full h-7 px-1 text-surface-900 text-[9px] font-mono font-bold cursor-pointer outline-none border border-surface-200 rounded bg-white appearance-auto focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
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
            value={transaction.price}
            onChange={(e) => onUpdate(transaction.id, { price: parseFloat(e.target.value) || 0 })}
            className="w-full h-7 px-2 bg-white border border-surface-200 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-xs font-mono text-right transition-all"
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

const ImportCSVModal = memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [csvData, setCsvData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
          id: crypto.randomUUID(),
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text/plain')) {
      setError('Please drop a CSV or text file.');
      return;
    }

    try {
      const text = await file.text();
      setCsvData(text);
      setError(null);
    } catch (err) {
      setError('Failed to read the file.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-surface-100">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-brand-600" />
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Import CSV Transactions</h2>
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            placeholder="2024-01-01,buy,AAPL,10,USD,150.00"
            className={`w-full h-64 p-4 text-xs font-mono border rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none transition-all ${
              isDragging ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500 ring-inset' : 'bg-surface-50 border-surface-200'
            }`}
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
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-2 gap-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
            <input
              type="text"
              placeholder="Filter transactions (symbol, date, etc.)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 bg-white border border-surface-200 rounded text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
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
          <button
            onClick={addRow}
            className="flex items-center space-x-2 bg-brand-800 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-900 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-2 bg-white border border-surface-200 text-surface-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-surface-50 transition-colors shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-white border border-surface-200 text-surface-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-surface-50 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <ImportCSVModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      <VirtualTable
        count={virtualizer.getVirtualItems().length}
        parentRef={parentRef}
        totalSize={virtualizer.getTotalSize()}
        loading={false}
        hasData={filteredTransactions.length > 0}
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
