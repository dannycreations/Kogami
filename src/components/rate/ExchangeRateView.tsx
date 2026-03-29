import { FetchHttpClient, HttpClient, HttpClientRequest } from '@effect/platform';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Effect } from 'effect';
import { AlertCircle } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FilterBar, VirtualTable } from '../shared/DataView';

import type { ExchangeRateData, ExchangeRateEntry } from '@server/helpers/Scraper';

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CurrencyRow = memo(({ entry, style }: { entry: ExchangeRateEntry; style?: React.CSSProperties }) => {
  return (
    <div className="v-row flex items-stretch w-full" style={style}>
      <div className="v-cell border-r border-surface-100 p-0 flex items-center justify-center w-16 shrink-0">
        <div className="inline-flex w-7 h-5 rounded-sm bg-surface-100 items-center justify-center text-[10px] font-bold text-surface-500 border border-surface-200 shadow-sm overflow-hidden">
          {entry.currency.substring(0, 2)}
        </div>
      </div>
      <div className="v-cell border-r border-surface-100 flex-1 min-w-0 flex items-center">
        <div className="flex items-center">
          <span className="font-mono font-bold text-brand-900 bg-brand-50 px-1.5 py-0.5 rounded text-xs border border-brand-100 mr-2">
            {entry.currency}
          </span>
        </div>
      </div>
      <div className="v-cell border-r border-surface-100 text-right w-1/3 shrink-0 flex items-center justify-end">
        <span className="font-mono text-[13px] font-medium text-surface-800">{IDR_FORMATTER.format(entry.rate)}</span>
      </div>
      <div className="v-cell text-center w-24 shrink-0 flex items-center justify-center">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          Active
        </span>
      </div>
    </div>
  );
});

export const ExchangeRateView = () => {
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]!);
  const [currency, setCurrency] = useState<string>('');
  const [data, setData] = useState<ExchangeRateData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const fetchExchangeRates = useCallback((targetDate: string) => {
    setLoading(true);
    setError(null);

    const program = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* HttpClientRequest.get(`http://localhost:1730/exchange-rates?date=${targetDate}`).pipe(
        client.execute,
        Effect.flatMap((res) => res.json),
      );
      return response as ExchangeRateData;
    }).pipe(Effect.provide(FetchHttpClient.layer));

    Effect.runPromise(program)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const d = date.trim();
    if (!d) return;

    const timer = setTimeout(() => fetchExchangeRates(d), 500);
    return () => clearTimeout(timer);
  }, [date, fetchExchangeRates]);

  const filteredEntries = useMemo(() => {
    const entries = data?.entries;
    if (!entries) return [];
    const search = currency.trim().toLowerCase();
    if (!search) return entries;
    return entries.filter((entry) => entry.currency.toLowerCase().includes(search));
  }, [data?.entries, currency]);

  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <FilterBar
        date={date}
        onDateChange={setDate}
        search={currency}
        onSearchChange={setCurrency}
        searchLabel="Currency Find"
        searchPlaceholder="Ex. USD, EUR"
        isValid={!!data && !loading}
        period={data ? { startDate: data.startDate, endDate: data.endDate } : undefined}
      />

      {error && (
        <div className="bg-red-50 border-l-2 border-red-500 text-red-800 p-3 rounded-r text-sm flex items-start shadow-sm mt-4">
          <AlertCircle className="h-4 w-4 mr-2 mt-0.5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold">Sync Error</p>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <VirtualTable
        count={virtualizer.getVirtualItems().length}
        parentRef={parentRef}
        totalSize={virtualizer.getTotalSize()}
        loading={loading}
        hasData={!!data}
        headers={
          <>
            <div className="px-4 py-2.5 w-16 text-center border-r border-surface-200 bg-surface-50 shrink-0 flex items-center justify-center">
              Flag
            </div>
            <div className="px-4 py-2.5 border-r border-surface-200 bg-surface-50 flex-1 flex items-center">Currency Code</div>
            <div className="px-4 py-2.5 border-r border-surface-200 text-right bg-surface-50 w-1/3 shrink-0 flex items-center justify-end">
              Base Rate (IDR)
            </div>
            <div className="px-4 py-2.5 text-center text-surface-400 font-medium bg-surface-50 w-24 shrink-0 flex items-center justify-center">
              Status
            </div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <CurrencyRow
              key={virtualRow.key}
              entry={filteredEntries[virtualRow.index]!}
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
            <span>Total Entries: {filteredEntries.length}</span>
            <span>Data Source: Ministry of Finance RI</span>
          </>
        }
      />
    </div>
  );
};
