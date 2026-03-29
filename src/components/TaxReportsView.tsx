import { useVirtualizer } from '@tanstack/react-virtual';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useInvestmentStore } from '../stores/investmentStore';
import { ViewHeader, VirtualTable } from './shared/DataView';

interface MonthlySummary {
  readonly month: string;
  totalUsd: number;
  totalIdr: number;
  transactions: number;
}

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

const SummaryRow = memo(({ summary, style }: { summary: MonthlySummary; style?: React.CSSProperties }) => {
  return (
    <div className="v-row flex items-stretch w-full hover:bg-surface-50 transition-colors" style={style}>
      <div className="v-cell border-r border-surface-100 p-0 flex items-center justify-center w-32 shrink-0">
        <span className="text-xs font-bold text-surface-600">{summary.month}</span>
      </div>
      <div className="v-cell border-r border-surface-100 flex-1 flex items-center px-4">
        <span className="font-mono text-xs font-semibold text-brand-900">{USD_FORMATTER.format(summary.totalUsd)}</span>
      </div>
      <div className="v-cell border-r border-surface-100 flex-1 flex items-center px-4">
        <span className="font-mono text-xs font-semibold text-emerald-700">{IDR_FORMATTER.format(summary.totalIdr)}</span>
      </div>
      <div className="v-cell text-center w-24 shrink-0 flex items-center justify-center">
        <span className="text-xs font-medium text-surface-500">{summary.transactions} tx</span>
      </div>
    </div>
  );
});

export const TaxReportsView = () => {
  const [exchangeRates, setExchangeRates] = useState<any>(null);
  const transactions = useInvestmentStore((state) => state.transactions);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load local exchange rates for conversion
    import('../../data/exchange-rates.json').then((data) => {
      setExchangeRates(data.default || data);
    });
  }, []);

  const getExchangeRate = (dateStr: string): number => {
    if (!exchangeRates) return 15000;

    const date = new Date(dateStr);
    const keys = Object.keys(exchangeRates);
    const matchingKey = keys.find((key) => {
      const entry = exchangeRates[key];
      if (!entry || !entry.startDate || !entry.endDate) return false;
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      return date >= start && date <= end;
    });

    if (matchingKey) {
      const entry = exchangeRates[matchingKey].entries.find((e: any) => e.currency === 'USD');
      return entry ? entry.rate : 15000;
    }

    return 15000;
  };

  const summaries = useMemo(() => {
    const monthlyMap = new Map<string, MonthlySummary>();

    transactions.forEach((tx) => {
      if (!tx.date || !tx.symbol) return;

      const monthKey = tx.date.substring(0, 7); // YYYY-MM
      const rate = getExchangeRate(tx.date);
      const usdValue = tx.quantity * tx.price;
      const idrValue = usdValue * rate;

      const existing = monthlyMap.get(monthKey) || {
        month: monthKey,
        totalUsd: 0,
        totalIdr: 0,
        transactions: 0,
      };

      existing.totalUsd += tx.action === 'buy' ? usdValue : -usdValue;
      existing.totalIdr += tx.action === 'buy' ? idrValue : -idrValue;
      existing.transactions += 1;

      monthlyMap.set(monthKey, existing);
    });

    return Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions, exchangeRates]);

  const virtualizer = useVirtualizer({
    count: summaries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 10,
  });

  const totalUsd = summaries.reduce((acc, curr) => acc + curr.totalUsd, 0);
  const totalIdr = summaries.reduce((acc, curr) => acc + curr.totalIdr, 0);

  return (
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <ViewHeader title="Tax Reporting Summary" subtitle="Aggregated investment data for tax compliance" onSync={() => {}} loading={!exchangeRates} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Net Invested (USD)</span>
          </div>
          <p className="text-xl font-bold text-brand-900">{USD_FORMATTER.format(totalUsd)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">IDR Value (Historical)</span>
          </div>
          <p className="text-xl font-bold text-emerald-700">{IDR_FORMATTER.format(totalIdr)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <TrendingDown className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Summary Period</span>
          </div>
          <p className="text-xl font-bold text-surface-900">{summaries.length} Months</p>
        </div>
      </div>

      <VirtualTable
        count={virtualizer.getVirtualItems().length}
        parentRef={parentRef}
        totalSize={virtualizer.getTotalSize()}
        loading={!exchangeRates}
        hasData={summaries.length > 0}
        headers={
          <>
            <div className="px-4 py-2.5 w-32 text-center border-r border-surface-200 bg-surface-50 shrink-0 flex items-center justify-center font-bold text-xs uppercase text-surface-500">
              Month
            </div>
            <div className="px-4 py-2.5 border-r border-surface-200 bg-surface-50 flex-1 flex items-center font-bold text-xs uppercase text-surface-500">
              USD Amount
            </div>
            <div className="px-4 py-2.5 border-r border-surface-200 bg-surface-50 flex-1 flex items-center font-bold text-xs uppercase text-surface-500">
              IDR Equivalent
            </div>
            <div className="px-4 py-2.5 text-center text-surface-400 font-bold text-xs uppercase bg-surface-50 w-24 shrink-0 flex items-center justify-center">
              Activity
            </div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <SummaryRow
              key={virtualRow.key}
              summary={summaries[virtualRow.index]!}
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
            <span>Total Monthly Summaries: {summaries.length}</span>
            <span>Tax Compliance Data</span>
          </>
        }
      />
    </div>
  );
};
