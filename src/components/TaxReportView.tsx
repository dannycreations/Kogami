import { useVirtualizer } from '@tanstack/react-virtual';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
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
}

interface InventoryItem {
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  readonly currency: string;
  readonly date: string;
  readonly rateAtBuy: number;
}

const SummaryRow = memo(({ report, style, formatter }: { report: YearlyReport; style?: React.CSSProperties; formatter: Intl.NumberFormat }) => {
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
          <span className={`font-mono text-xs font-bold ${report.realizedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatter.format(report.realizedProfit)}
          </span>
        </div>
        <div className="v-cell border-r border-surface-100 flex-1 flex flex-col justify-center px-4">
          <span className="text-[9px] font-bold text-surface-400 uppercase">Holdings (Dec 31 Rates)</span>
          <span className="font-mono text-xs font-bold text-brand-900">{formatter.format(report.holdingsValue)}</span>
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
                  <span className="font-mono font-bold text-brand-800">{formatter.format(h.valuePreferredAtDec31)}</span>
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

  const getExchangeRate = useCallback(
    (dateStr: string, from: string, to: string): number => {
      if (from === to) return 1;
      if (!exchangeRates || !exchangeMap) return to === DEFAULT_CURRENCY ? 15000 : 1;

      const yearStr = dateStr.substring(0, 4);
      let rates = exchangeMap.get(yearStr);

      if (!rates) {
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
          if (dateStr < e.startDate) low = mid + 1;
          else high = mid - 1;
        }
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

    const sortedTxs = transactions.filter((tx) => tx.date && tx.symbol);
    if (sortedTxs.length === 0) return [];

    const startYear = parseInt(sortedTxs[sortedTxs.length - 1]!.date.substring(0, 4), 10);
    const endYear = Math.max(parseInt(sortedTxs[0]!.date.substring(0, 4), 10), new Date().getFullYear());

    const reportsArr: YearlyReport[] = [];
    const inventory = new Map<string, InventoryItem[]>();

    let txIdx = sortedTxs.length - 1;
    for (let year = startYear; year <= endYear; year++) {
      let txsInYearCount = 0;
      let realizedProfit = 0;

      while (txIdx >= 0 && parseInt(sortedTxs[txIdx]!.date.substring(0, 4), 10) === year) {
        const tx = sortedTxs[txIdx]!;
        txIdx--;
        txsInYearCount++;
        const rateToPreferred = getExchangeRate(tx.date, tx.currency, preferredCurrency);
        const { symbol, action } = tx;

        if (action === 'BUY') {
          let symbolInv = inventory.get(symbol);
          if (!symbolInv) {
            symbolInv = [];
            inventory.set(symbol, symbolInv);
          }
          symbolInv.push({
            symbol,
            quantity: tx.quantity || 0,
            price: tx.price || 0,
            currency: tx.currency,
            date: tx.date,
            rateAtBuy: rateToPreferred,
          });
        } else if (action === 'SELL') {
          let remainingToSell = tx.quantity || 0;
          const symbolInv = inventory.get(symbol);

          if (symbolInv) {
            while (remainingToSell > 0 && symbolInv.length > 0) {
              const item = symbolInv[0]!;
              const sellFromThisItem = Math.min(item.quantity, remainingToSell);
              const buyValuePreferred = sellFromThisItem * item.price * item.rateAtBuy;
              const sellValuePreferred = sellFromThisItem * (tx.price || 0) * rateToPreferred;
              realizedProfit += sellValuePreferred - buyValuePreferred;

              remainingToSell -= sellFromThisItem;

              if (Math.abs(item.quantity - sellFromThisItem) < 1e-10) {
                symbolInv.shift();
              } else {
                symbolInv[0] = { ...item, quantity: item.quantity - sellFromThisItem };
              }
            }
          }
        }
      }

      const currentHoldings: YearlyReport['holdings'] = [];
      let yearEndHoldingsValue = 0;

      for (const [symbol, symbolInv] of inventory) {
        if (symbolInv.length === 0) continue;

        let totalQuantity = 0;
        let totalCostBasis = 0;
        let totalValuePreferred = 0;
        const currencyRates = new Map<string, number>();

        for (const item of symbolInv) {
          let dec31Rate = currencyRates.get(item.currency);
          if (dec31Rate === undefined) {
            dec31Rate = getExchangeRate(`${year}-12-31`, item.currency, preferredCurrency);
            currencyRates.set(item.currency, dec31Rate);
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
      });
    }

    return reportsArr.sort((a, b) => b.year - a.year);
  }, [transactions, exchangeRates, exchangeMap, sortedExchangeKeys, preferredCurrency, getExchangeRate]);

  const virtualizer = useVirtualizer({
    count: yearlyReports.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  const totalRealizedProfit = yearlyReports.reduce((acc, curr) => acc + curr.realizedProfit, 0);
  const currentHoldingsValue = yearlyReports.length > 0 ? yearlyReports[0]!.holdingsValue : 0;

  return (
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Realized Profit ({preferredCurrency})</span>
          </div>
          <p className={`text-xl font-bold ${totalRealizedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatter.format(totalRealizedProfit)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
          <div className="flex items-center space-x-2 text-surface-500 mb-1">
            <DollarSign className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Latest Holdings Value ({preferredCurrency})</span>
          </div>
          <p className="text-xl font-bold text-brand-900">{formatter.format(currentHoldingsValue)}</p>
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
