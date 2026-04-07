import { useVirtualizer } from '@tanstack/react-virtual';
import { Calculator, ChevronDown, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_CURRENCY } from '../app/constants';
import { useInvestmentStore } from '../stores/investmentStore';
import { useSettingStore } from '../stores/settingsStore';
import { VirtualTable } from './shared/DataView';

interface YearlyReport {
  readonly year: number;
  realizedProfit: number;
  holdingsValue: number;
  transactionsCount: number;
  holdings: {
    symbol: string;
    quantity: number;
    costBasisOriginal: number;
    valuePreferredAtDec31: number;
  }[];
  profitBreakdown: {
    symbol: string;
    profit: number;
  }[];
}

interface InventoryItem {
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  readonly currency: string;
  readonly date: string;
  readonly rateAtBuy: number;
}

const SummaryRow = memo(
  ({
    report,
    style,
    formatter,
    index,
    measureElement,
  }: {
    report: YearlyReport;
    style?: React.CSSProperties;
    formatter: Intl.NumberFormat;
    index: number;
    measureElement: (el: HTMLElement | null) => void;
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (rowRef.current) {
        measureElement(rowRef.current);
      }
    }, [isExpanded, measureElement]);

    return (
      <div ref={rowRef} data-index={index} className="flex flex-col w-full border-b border-surface-100 bg-white" style={style}>
        <div
          className={`flex items-stretch w-full hover:bg-surface-50 transition-colors cursor-pointer min-h-[72px] ${isExpanded ? 'bg-surface-50' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-center w-24 shrink-0 border-r border-surface-100 bg-surface-50/30">
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-surface-900 tracking-tight">{report.year}</span>
              <span className="text-[9px] font-bold text-surface-400 uppercase">{report.transactionsCount} txs</span>
            </div>
          </div>

          <div className="flex-1 flex items-center px-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">Realized Gain/Loss</span>
              <div className="flex items-center space-x-2">
                {report.realizedProfit >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                <span className={`font-mono text-sm font-bold ${report.realizedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatter.format(report.realizedProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center px-6 border-l border-surface-100/50">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">Holdings (Dec 31)</span>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-3 w-3 text-brand-400" />
                <span className="font-mono text-sm font-bold text-surface-900">{formatter.format(report.holdingsValue)}</span>
              </div>
            </div>
          </div>

          <div className="w-12 shrink-0 flex items-center justify-center border-l border-surface-100">
            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} text-surface-400 group-hover:text-surface-600`}>
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="bg-white border-t border-surface-100 grid grid-cols-1 md:grid-cols-2 gap-px bg-surface-100">
            <div className="bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="label-caps-sm">Profit Breakdown</h3>
                <div className="h-px flex-1 mx-4 bg-surface-100" />
              </div>
              <div className="space-y-2.5">
                {report.profitBreakdown.map((p) => (
                  <div key={p.symbol} className="flex items-center justify-between group">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-surface-50 flex items-center justify-center text-[10px] font-bold text-surface-600 border border-surface-100 group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                        {p.symbol.substring(0, 2)}
                      </div>
                      <span className="text-xs font-bold text-surface-800">{p.symbol}</span>
                    </div>
                    <span className={`font-mono text-xs font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {p.profit > 0 ? '+' : ''}
                      {formatter.format(p.profit)}
                    </span>
                  </div>
                ))}
                {report.profitBreakdown.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-surface-300">
                    <Calculator className="h-6 w-6 mb-2 opacity-20" />
                    <p className="text-[10px] font-medium uppercase tracking-widest">No realized profit</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="label-caps-sm">Year-End Inventory</h3>
                <div className="h-px flex-1 mx-4 bg-surface-100" />
              </div>
              <div className="space-y-2.5">
                {report.holdings.map((h) => (
                  <div key={h.symbol} className="flex items-center justify-between group">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-surface-50 flex items-center justify-center text-[10px] font-bold text-surface-600 border border-surface-100 group-hover:border-brand-200 group-hover:bg-brand-50 transition-colors">
                        {h.symbol.substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-surface-800">{h.symbol}</span>
                        <span className="text-[10px] font-mono text-surface-400 leading-none">{h.quantity.toLocaleString()} units</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-xs font-bold text-brand-900">{formatter.format(h.valuePreferredAtDec31)}</span>
                      <span className="text-[9px] font-bold text-surface-400 uppercase leading-none mt-0.5">Market Value</span>
                    </div>
                  </div>
                ))}
                {report.holdings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-surface-300">
                    <TrendingDown className="h-6 w-6 mb-2 opacity-20" />
                    <p className="text-[10px] font-medium uppercase tracking-widest">Zero inventory</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export const TaxReportView = () => {
  const [exchangeRates, setExchangeRates] = useState<Record<
    string,
    { startDate: string; endDate: string; entries: { currency: string; rate: number }[] }
  > | null>(null);
  const transactions = useInvestmentStore((state) => state.transactions);
  const preferredCurrency = useSettingStore((state) => state.preferredCurrency);
  const parentRef = useRef<HTMLDivElement>(null);

  const formatter = useMemo(() => {
    return new Intl.NumberFormat(preferredCurrency === DEFAULT_CURRENCY ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: preferredCurrency,
      minimumFractionDigits: preferredCurrency === DEFAULT_CURRENCY ? 0 : 2,
    });
  }, [preferredCurrency]);

  useEffect(() => {
    // Load local exchange rates for conversion
    import('../../data/exchange-rates.json').then((data) => {
      setExchangeRates(data.default || data);
    });
  }, []);

  const sortedExchangeKeys = useMemo(() => {
    if (!exchangeRates) return [];
    return Object.keys(exchangeRates).sort((a, b) => b.localeCompare(a));
  }, [exchangeRates]);

  const exchangeMap = useMemo(() => {
    if (!exchangeRates) return null;
    const map = new Map<string, Map<string, number>>();
    for (const key in exchangeRates) {
      const entry = exchangeRates[key]!;
      const rates = new Map<string, number>();
      rates.set(DEFAULT_CURRENCY, 1);
      for (const e of entry.entries) {
        rates.set(e.currency, e.rate);
      }
      map.set(key, rates);
    }
    return map;
  }, [exchangeRates]);

  const lastLookup = useRef<{ date: string; rates: Map<string, number> | undefined } | null>(null);

  const getExchangeRate = useCallback(
    (dateStr: string, from: string, to: string): number => {
      if (from === to) return 1;
      if (!exchangeRates || !exchangeMap) return to === DEFAULT_CURRENCY ? 15000 : 1;

      let rates: Map<string, number> | undefined;

      if (lastLookup.current?.date === dateStr) {
        rates = lastLookup.current.rates;
      } else {
        // Exact year match (most common)
        const yearStr = dateStr.substring(0, 4);
        const yearEntry = exchangeRates[yearStr];
        if (yearEntry && dateStr >= yearEntry.startDate && dateStr <= yearEntry.endDate) {
          rates = exchangeMap.get(yearStr);
        }

        if (!rates) {
          // Binary search over overlapping ranges
          let low = 0;
          let high = sortedExchangeKeys.length - 1;
          while (low <= high) {
            const mid = (low + high) >>> 1;
            const key = sortedExchangeKeys[mid]!;
            const e = exchangeRates[key]!;

            if (dateStr >= e.startDate && dateStr <= e.endDate) {
              rates = exchangeMap.get(key);
              break;
            }

            // Sorted by startDate DESC (newest first)
            if (dateStr < e.startDate) {
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
        }
        lastLookup.current = { date: dateStr, rates };
      }

      if (rates) {
        const fromRate = rates.get(from);
        const toRate = rates.get(to);
        if (fromRate !== undefined && toRate !== undefined) {
          return fromRate / toRate;
        }
      }

      return to === DEFAULT_CURRENCY ? 15000 : 1;
    },
    [exchangeRates, exchangeMap, sortedExchangeKeys],
  );

  const yearlyReports = useMemo(() => {
    if (!transactions.length) return [];

    // Store is already sorted by date DESC
    const startYear = parseInt(transactions[transactions.length - 1]!.date.substring(0, 4), 10);
    const endYear = Math.max(parseInt(transactions[0]!.date.substring(0, 4), 10), new Date().getFullYear());

    if (isNaN(startYear)) return [];

    const reportsArr: YearlyReport[] = [];
    const inventory = new Map<string, { items: InventoryItem[]; nextIdx: number }>();

    let txIdx = transactions.length - 1;
    for (let year = startYear; year <= endYear; year++) {
      let txsInYearCount = 0;
      let realizedProfit = 0;
      const profitBreakdownMap = new Map<string, number>();

      while (txIdx >= 0) {
        const tx = transactions[txIdx]!;
        const txYear = parseInt(tx.date.substring(0, 4), 10);
        if (txYear > year) break;

        txIdx--;
        if (!tx.symbol || !tx.date) continue;

        txsInYearCount++;
        const rateToPreferred = getExchangeRate(tx.date, tx.currency, preferredCurrency);
        const { symbol, action } = tx;

        if (action === 'BUY') {
          let inv = inventory.get(symbol);
          if (!inv) {
            inv = { items: [], nextIdx: 0 };
            inventory.set(symbol, inv);
          }
          inv.items.push({
            symbol,
            quantity: Math.abs(tx.quantity || 0),
            price: tx.price || 0,
            currency: tx.currency,
            date: tx.date,
            rateAtBuy: rateToPreferred,
          });
        } else if (action === 'SELL') {
          let remainingToSell = Math.abs(tx.quantity || 0);
          const inv = inventory.get(symbol);

          if (inv) {
            let symbolProfit = 0;
            while (remainingToSell > 0 && inv.nextIdx < inv.items.length) {
              const item = inv.items[inv.nextIdx]!;
              const sellFromThisItem = Math.min(item.quantity, remainingToSell);
              const buyValuePreferred = sellFromThisItem * item.price * item.rateAtBuy;
              const sellValuePreferred = sellFromThisItem * (tx.price || 0) * rateToPreferred;
              const profit = sellValuePreferred - buyValuePreferred;

              realizedProfit += profit;
              symbolProfit += profit;

              remainingToSell -= sellFromThisItem;

              if (Math.abs(item.quantity - sellFromThisItem) < 1e-10) {
                inv.nextIdx++;
              } else {
                inv.items[inv.nextIdx] = { ...item, quantity: item.quantity - sellFromThisItem };
              }
            }
            if (symbolProfit !== 0) {
              profitBreakdownMap.set(symbol, (profitBreakdownMap.get(symbol) || 0) + symbolProfit);
            }
          }
        }
      }

      const currentHoldings: YearlyReport['holdings'] = [];
      let yearEndHoldingsValue = 0;
      const yearEndRates = new Map<string, number>();

      for (const [symbol, inv] of inventory) {
        if (inv.nextIdx >= inv.items.length) continue;

        let totalQuantity = 0;
        let totalCostBasis = 0;
        let totalValuePreferred = 0;

        for (let i = inv.nextIdx; i < inv.items.length; i++) {
          const item = inv.items[i]!;
          let dec31Rate = yearEndRates.get(item.currency);
          if (dec31Rate === undefined) {
            dec31Rate = getExchangeRate(`${year}-12-31`, item.currency, preferredCurrency);
            yearEndRates.set(item.currency, dec31Rate);
          }

          totalQuantity += item.quantity;
          totalCostBasis += item.quantity * item.price * item.rateAtBuy;
          totalValuePreferred += item.quantity * item.price * dec31Rate;
        }

        if (totalQuantity > 1e-7) {
          currentHoldings.push({
            symbol,
            quantity: totalQuantity,
            costBasisOriginal: totalCostBasis,
            valuePreferredAtDec31: totalValuePreferred,
          });
          yearEndHoldingsValue += totalValuePreferred;
        }
      }

      reportsArr.push({
        year,
        realizedProfit,
        holdingsValue: yearEndHoldingsValue,
        transactionsCount: txsInYearCount,
        holdings: currentHoldings,
        profitBreakdown: Array.from(profitBreakdownMap.entries())
          .map(([symbol, profit]) => ({ symbol, profit }))
          .sort((a, b) => b.profit - a.profit),
      });
    }

    return reportsArr.reverse();
  }, [transactions, exchangeRates, exchangeMap, sortedExchangeKeys, preferredCurrency, getExchangeRate]);

  const virtualizer = useVirtualizer({
    count: yearlyReports.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
    measureElement: (el) => (el as HTMLElement).getBoundingClientRect().height,
  });

  const totalRealizedProfit = yearlyReports.reduce((acc, curr) => acc + curr.realizedProfit, 0);
  const currentHoldingsValue = yearlyReports.length > 0 ? yearlyReports[0]!.holdingsValue : 0;

  return (
    <div className="view-container">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card relative p-6 group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="h-16 w-16 text-emerald-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="label-caps-sm">Total Realized Profit</span>
            </div>
            <div className="flex items-baseline space-x-1">
              {!exchangeRates ? (
                <div className="h-8 w-32 bg-surface-100 animate-pulse rounded" />
              ) : (
                <span className={`text-2xl font-black tracking-tight ${totalRealizedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatter.format(totalRealizedProfit)}
                </span>
              )}
            </div>
            <div className="mt-2 text-[10px] font-bold text-surface-400 uppercase tracking-wider flex items-center">
              <div className="w-1 h-1 rounded-full bg-surface-200 mr-2" />
              Cumulative across all years
            </div>
          </div>
        </div>

        <div className="card relative p-6 group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="h-16 w-16 text-brand-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-1.5 bg-brand-50 rounded-lg">
                <DollarSign className="h-4 w-4 text-brand-600" />
              </div>
              <span className="label-caps-sm">Portfolio Value</span>
            </div>
            <div className="flex items-baseline space-x-1 text-surface-900">
              {!exchangeRates ? (
                <div className="h-8 w-32 bg-surface-100 animate-pulse rounded" />
              ) : (
                <span className="text-2xl font-black tracking-tight">{formatter.format(currentHoldingsValue)}</span>
              )}
            </div>
            <div className="mt-2 text-[10px] font-bold text-surface-400 uppercase tracking-wider flex items-center">
              <div className="w-1 h-1 rounded-full bg-brand-200 mr-2" />
              Current year-end inventory
            </div>
          </div>
        </div>

        <div className="card relative p-6 group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calculator className="h-16 w-16 text-surface-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <div className="p-1.5 bg-surface-100 rounded-lg">
                <Calculator className="h-4 w-4 text-surface-600" />
              </div>
              <span className="label-caps-sm">Reporting Range</span>
            </div>
            <div className="flex items-baseline space-x-2 text-surface-900">
              {!exchangeRates ? (
                <div className="h-8 w-12 bg-surface-100 animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-2xl font-black tracking-tight">{yearlyReports.length}</span>
                  <span className="text-sm font-bold text-surface-400 uppercase">Fiscal Years</span>
                </>
              )}
            </div>
            <div className="mt-2 text-[10px] font-bold text-surface-400 uppercase tracking-wider flex items-center">
              <div className="w-1 h-1 rounded-full bg-surface-300 mr-2" />
              {!exchangeRates ? (
                <div className="h-3 w-24 bg-surface-100 animate-pulse rounded" />
              ) : (
                <>
                  From {yearlyReports[yearlyReports.length - 1]?.year} to {yearlyReports[0]?.year}
                </>
              )}
            </div>
          </div>
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
            <div className="table-header-cell w-24 justify-center">Year</div>
            <div className="table-header-cell flex-1 px-6">Net Gain/Loss</div>
            <div className="table-header-cell flex-1 px-6">Year-End Assets</div>
            <div className="table-header-cell w-12 justify-center">-</div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <SummaryRow
              key={virtualRow.key}
              index={virtualRow.index}
              measureElement={virtualizer.measureElement}
              report={yearlyReports[virtualRow.index]!}
              formatter={formatter}
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
      />
    </div>
  );
};
