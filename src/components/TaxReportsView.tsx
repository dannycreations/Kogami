import { useVirtualizer } from '@tanstack/react-virtual';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useInvestmentStore } from '../stores/investmentStore';
import { VirtualTable } from './shared/DataView';

interface YearlyReport {
  readonly year: number;
  realizedProfitIdr: number;
  holdingsValueIdr: number;
  transactionsCount: number;
  holdings: {
    symbol: string;
    quantity: number;
    costBasisUsd: number;
    valueIdrAtDec31: number;
  }[];
}

interface InventoryItem {
  readonly symbol: string;
  readonly quantity: number;
  readonly priceUsd: number;
  readonly date: string;
  readonly rateAtBuy: number;
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

const SummaryRow = memo(({ report, style }: { report: YearlyReport; style?: React.CSSProperties }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col w-full border-b border-surface-100 bg-white" style={style}>
      <div
        className="v-row flex items-stretch w-full hover:bg-surface-50 transition-colors cursor-pointer min-h-[60px]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="v-cell border-r border-surface-100 p-0 flex items-center justify-center w-32 shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-surface-900">{report.year}</span>
            <span className="text-[9px] text-surface-400 font-mono">{report.transactionsCount} TXs</span>
          </div>
        </div>
        <div className="v-cell border-r border-surface-100 flex-1 flex flex-col justify-center px-4">
          <span className="text-[9px] font-bold text-surface-400 uppercase">Realized Profit (FIFO)</span>
          <span className={`font-mono text-xs font-bold ${report.realizedProfitIdr >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {IDR_FORMATTER.format(report.realizedProfitIdr)}
          </span>
        </div>
        <div className="v-cell border-r border-surface-100 flex-1 flex flex-col justify-center px-4">
          <span className="text-[9px] font-bold text-surface-400 uppercase">Holdings (Dec 31 Rates)</span>
          <span className="font-mono text-xs font-bold text-brand-900">{IDR_FORMATTER.format(report.holdingsValueIdr)}</span>
        </div>
        <div className="v-cell text-center w-12 shrink-0 flex items-center justify-center">
          <span className="text-xs font-medium text-surface-500">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-surface-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-200 pb-2">
            <h3 className="text-[10px] font-bold text-surface-600 uppercase tracking-wider">Holdings at Dec 31, {report.year}</h3>
          </div>
          <div className="space-y-2">
            {report.holdings.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-surface-900 w-16">{h.symbol}</span>
                  <span className="font-mono text-surface-500">{h.quantity.toLocaleString()} units</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono font-bold text-brand-800">{IDR_FORMATTER.format(h.valueIdrAtDec31)}</span>
                  <span className="text-[9px] text-surface-400">Cost: {USD_FORMATTER.format(h.costBasisUsd)}</span>
                </div>
              </div>
            ))}
            {report.holdings.length === 0 && <p className="text-xs text-surface-400 italic">No holdings for this period.</p>}
          </div>
        </div>
      )}
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

  const yearlyReports = useMemo(() => {
    if (!transactions.length) return [];

    const sortedTxs = [...transactions].filter((tx) => tx.date && tx.symbol).sort((a, b) => a.date.localeCompare(b.date));

    if (sortedTxs.length === 0) return [];

    const startYear = new Date(sortedTxs[0]!.date).getFullYear();
    const endYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }

    const reports: YearlyReport[] = [];
    let inventory: InventoryItem[] = [];

    years.forEach((year) => {
      const txsInYear = sortedTxs.filter((tx) => new Date(tx.date).getFullYear() === year);
      let realizedProfitIdr = 0;

      txsInYear.forEach((tx) => {
        const rate = getExchangeRate(tx.date);
        if (tx.action === 'buy') {
          inventory.push({
            symbol: tx.symbol,
            quantity: tx.quantity,
            priceUsd: tx.price,
            date: tx.date,
            rateAtBuy: rate,
          });
        } else {
          let remainingToSell = tx.quantity;
          const sellRate = rate;

          for (let i = 0; i < inventory.length && remainingToSell > 0; i++) {
            const item = inventory[i]!;
            if (item.symbol === tx.symbol) {
              const sellFromThisItem = Math.min(item.quantity, remainingToSell);
              const buyValueIdr = sellFromThisItem * item.priceUsd * item.rateAtBuy;
              const sellValueIdr = sellFromThisItem * tx.price * sellRate;
              realizedProfitIdr += sellValueIdr - buyValueIdr;

              remainingToSell -= sellFromThisItem;

              if (Math.abs(item.quantity - sellFromThisItem) < 0.0000001) {
                inventory.splice(i, 1);
                i--;
              } else {
                inventory[i] = { ...item, quantity: item.quantity - sellFromThisItem };
              }
            }
          }
        }
      });

      const dec31Rate = getExchangeRate(`${year}-12-31`);
      const holdingsMap = new Map<string, { quantity: number; costBasisUsd: number; valueIdrAtDec31: number }>();

      inventory.forEach((item) => {
        const existing = holdingsMap.get(item.symbol) || { quantity: 0, costBasisUsd: 0, valueIdrAtDec31: 0 };
        const itemValueIdr = item.quantity * item.priceUsd * dec31Rate;
        holdingsMap.set(item.symbol, {
          quantity: existing.quantity + item.quantity,
          costBasisUsd: existing.costBasisUsd + item.quantity * item.priceUsd,
          valueIdrAtDec31: existing.valueIdrAtDec31 + itemValueIdr,
        });
      });

      const holdings = Array.from(holdingsMap.entries())
        .map(([symbol, data]) => ({
          symbol,
          ...data,
        }))
        .filter((h) => h.quantity > 0.0000001);

      reports.push({
        year,
        realizedProfitIdr,
        holdingsValueIdr: holdings.reduce((acc, h) => acc + h.valueIdrAtDec31, 0),
        transactionsCount: txsInYear.length,
        holdings,
      });
    });

    return reports.sort((a, b) => b.year - a.year);
  }, [transactions, exchangeRates]);

  const virtualizer = useVirtualizer({
    count: yearlyReports.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  const totalRealizedProfitIdr = yearlyReports.reduce((acc, curr) => acc + curr.realizedProfitIdr, 0);
  const currentHoldingsValueIdr = yearlyReports.length > 0 ? yearlyReports[0]!.holdingsValueIdr : 0;

  return (
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Realized Profit (IDR)</span>
          </div>
          <p className={`text-xl font-bold ${totalRealizedProfitIdr >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {IDR_FORMATTER.format(totalRealizedProfitIdr)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <DollarSign className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Latest Holdings Value (IDR)</span>
          </div>
          <p className="text-xl font-bold text-brand-900">{IDR_FORMATTER.format(currentHoldingsValueIdr)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <TrendingDown className="h-4 w-4 text-surface-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Report Span</span>
          </div>
          <p className="text-xl font-bold text-surface-900">{yearlyReports.length} Years</p>
        </div>
      </div>

      <VirtualTable
        count={virtualizer.getVirtualItems().length}
        parentRef={parentRef}
        totalSize={virtualizer.getTotalSize()}
        loading={!exchangeRates}
        hasData={yearlyReports.length > 0}
        headers={
          <>
            <div className="px-4 py-2.5 w-32 text-center border-r border-surface-200 bg-surface-50 shrink-0 flex items-center justify-center font-bold text-xs uppercase text-surface-500">
              Year
            </div>
            <div className="px-4 py-2.5 border-r border-surface-200 bg-surface-50 flex-1 flex items-center font-bold text-xs uppercase text-surface-500">
              Realized Profit
            </div>
            <div className="px-4 py-2.5 border-r border-surface-200 bg-surface-50 flex-1 flex items-center font-bold text-xs uppercase text-surface-500">
              Year-End Holdings
            </div>
            <div className="px-4 py-2.5 text-center text-surface-400 font-bold text-xs uppercase bg-surface-50 w-12 shrink-0 flex items-center justify-center">
              -
            </div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <SummaryRow
              key={virtualRow.key}
              report={yearlyReports[virtualRow.index]!}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          );
        }}
        footer={
          <>
            <span>Yearly Tax Reports</span>
            <span>FIFO Method | Dec 31 Rates for Holdings</span>
          </>
        }
      />
    </div>
  );
};
