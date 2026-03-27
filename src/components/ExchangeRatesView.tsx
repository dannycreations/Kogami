import { FetchHttpClient, HttpClient, HttpClientRequest } from '@effect/platform';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Effect } from 'effect';
import { AlertCircle, Calendar, Download, RefreshCw, Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ExchangeRateData, ExchangeRateEntry } from '@server/helpers/Scraper';

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CurrencyRow = memo(({ entry, style }: { entry: ExchangeRateEntry; style?: React.CSSProperties }) => {
  return (
    <div className="table-row flex items-center w-full" style={style}>
      <div className="table-cell border-r border-surface-100 p-0 flex items-center justify-center w-16 shrink-0">
        <div className="inline-flex w-7 h-5 rounded-sm bg-surface-100 items-center justify-center text-[10px] font-bold text-surface-500 border border-surface-200 shadow-sm overflow-hidden">
          {entry.currency.substring(0, 2)}
        </div>
      </div>
      <div className="table-cell border-r border-surface-100 flex-1 min-w-0">
        <div className="flex items-center">
          <span className="font-mono font-bold text-brand-900 bg-brand-50 px-1.5 py-0.5 rounded text-xs border border-brand-100 mr-2">
            {entry.currency}
          </span>
        </div>
      </div>
      <div className="table-cell border-r border-surface-100 text-right w-1/3 shrink-0">
        <span className="font-mono text-[13px] font-medium text-surface-800">{IDR_FORMATTER.format(entry.rate)}</span>
      </div>
      <div className="table-cell text-center w-24 shrink-0">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          Active
        </span>
      </div>
    </div>
  );
});

export const ExchangeRatesView = () => {
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
    return entries.filter((entry: any) => entry.currency.toLowerCase().includes(search));
  }, [data?.entries, currency]);

  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full space-y-3.5 max-h-[calc(100vh-7rem)]">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-surface-900">Exchange Rates Matrix</h2>
          <p className="text-xs text-surface-500 mt-0.5">KMK (Keputusan Menteri Keuangan) Tax Reference Rates</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchExchangeRates(date)}
            className="compact-button bg-white text-surface-700 border border-surface-200 hover:bg-surface-50"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin text-brand-500' : 'text-surface-500'}`} />
            <span>Sync</span>
          </button>
          <button className="compact-button bg-brand-800 text-white hover:bg-brand-900 shadow-sm border border-brand-900/50">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3 bg-white p-3 rounded shadow-sm border border-surface-200 mt-3.5">
        <div className="flex-1 flex items-center space-x-3 max-w-xl">
          <div className="w-1/2 relative">
            <label className="absolute left-3 top-0 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-surface-400 select-none pointer-events-none bg-white px-1.5 z-30">
              Effective Date
            </label>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="compact-input w-full pl-3 pr-8 !py-2 !h-11 !relative z-10"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center z-30">
              <div className="relative cursor-pointer text-surface-400 hover:text-brand-600 transition-colors">
                <Calendar className="h-4 w-4" />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => setDate(e.target.value)}
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          <div className="w-1/2 relative">
            <label className="absolute left-8 top-0 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-surface-400 select-none pointer-events-none bg-white px-1.5 z-30">
              Currency Find
            </label>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400 z-20" />
            <input
              type="text"
              placeholder="Ex. USD, EUR"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="compact-input w-full pl-8 pr-3 !py-2 !h-11 !relative z-10"
            />
          </div>
        </div>

        {data && !loading && (
          <div className="ml-auto flex items-center px-3 py-1.5 bg-brand-50 border border-brand-100 rounded text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
            <span className="text-brand-800 font-medium">Valid Data Active</span>
            <span className="mx-2 text-brand-300">|</span>
            <span className="text-surface-500 font-mono">
              Period: {data.startDate} &mdash; {data.endDate}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-l-2 border-red-500 text-red-800 p-3 rounded-r text-sm flex items-start shadow-sm mt-4">
          <AlertCircle className="h-4 w-4 mr-2 mt-0.5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold">Sync Error</p>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="table-container flex-1 flex flex-col min-h-0 mt-3.5">
        <div className="flex flex-col w-full text-left border-collapse relative h-full">
          <div className="sticky top-0 z-20 shadow-sm bg-surface-50 table-header flex w-full">
            <div className="px-4 py-2 w-16 text-center border-r border-surface-200 bg-surface-50 shrink-0">Flag</div>
            <div className="px-4 py-2 border-r border-surface-200 bg-surface-50 flex-1">Currency Code</div>
            <div className="px-4 py-2 border-r border-surface-200 text-right bg-surface-50 w-1/3 shrink-0">Base Rate (IDR)</div>
            <div className="px-4 py-2 text-center text-surface-400 font-medium bg-surface-50 w-24 shrink-0">Status</div>
          </div>
          <div ref={parentRef} className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <div
              className="bg-white relative w-full"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
              }}
            >
              {loading ? (
                <div className="px-4 py-16 text-center w-full">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-50 mb-3">
                    <RefreshCw className="h-5 w-5 text-brand-500 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-surface-600">Querying central database...</p>
                </div>
              ) : filteredEntries.length > 0 ? (
                virtualizer.getVirtualItems().map((virtualRow) => (
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
                ))
              ) : data ? (
                <div className="px-4 py-12 text-center text-surface-400 text-sm w-full">No currency matches the search criteria.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-surface-50 border-t border-surface-200 px-4 py-2 text-[10px] text-surface-500 flex justify-between items-center font-mono">
          <span>Total Entries: {filteredEntries.length}</span>
          <span>Data Source: Ministry of Finance RI</span>
        </div>
      </div>
    </div>
  );
};
