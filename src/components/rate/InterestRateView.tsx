import { FetchHttpClient, HttpClient, HttpClientRequest } from '@effect/platform';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Effect } from 'effect';
import { AlertCircle } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FilterBar, VirtualTable } from '../shared/DataView';

import type { InterestRateData, InterestRateEntry } from '@server/helpers/Scraper';

const RateRow = memo(({ entry, style }: { entry: InterestRateEntry; style?: React.CSSProperties }) => {
  return (
    <div className="v-row flex items-stretch w-full" style={style}>
      <div className="v-cell border-r border-surface-100 flex-1 min-w-0 flex items-center">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-surface-900 leading-snug">{entry.tags}</span>
        </div>
      </div>
      <div className="v-cell border-r border-surface-100 text-right w-32 shrink-0 flex items-center justify-end">
        <span className="badge badge-brand font-mono">{entry.rate.toFixed(2)}%</span>
      </div>
      <div className="v-cell text-center w-24 shrink-0 flex items-center justify-center">
        <span className="badge badge-emerald">Active</span>
      </div>
    </div>
  );
});

export const InterestRateView = () => {
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]!);
  const [search, setSearch] = useState<string>('');
  const [data, setData] = useState<InterestRateData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const fetchInterestRates = useCallback((targetDate: string) => {
    setLoading(true);
    setError(null);

    const program = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* HttpClientRequest.get(`http://localhost:1730/interest-rates?date=${targetDate}`).pipe(
        client.execute,
        Effect.flatMap((res) => res.json),
      );
      return response as InterestRateData;
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

    const timer = setTimeout(() => fetchInterestRates(d), 500);
    return () => clearTimeout(timer);
  }, [date, fetchInterestRates]);

  const filteredEntries = useMemo(() => {
    const entries = data?.entries;
    if (!entries) return [];
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry: InterestRateEntry) => entry.tags.toLowerCase().includes(query));
  }, [data?.entries, search]);

  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  return (
    <div className="view-container">
      <FilterBar
        date={date}
        onDateChange={setDate}
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search Tags"
        searchPlaceholder="Ex. Pasal 19, Pasal 8"
        isValid={!!data && !loading}
        period={data ? { startDate: data.startDate, endDate: data.endDate } : undefined}
      />

      {error && (
        <div className="bg-red-50 border-l-2 border-red-200 text-red-800 p-3 rounded-r text-[13px] flex items-start shadow-sm mt-4">
          <AlertCircle className="h-4 w-4 mr-2 mt-0.5 text-red-500 shrink-0" />
          <div>
            <p className="font-black uppercase tracking-tight text-[11px]">Sync Error</p>
            <p className="mt-0.5 leading-tight">{error}</p>
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
            <div className="table-header-cell flex-1">Legal Reference (Tags)</div>
            <div className="table-header-cell w-32 justify-end text-right">Rate / Month</div>
            <div className="table-header-cell w-24 justify-center text-surface-400 font-medium">Status</div>
          </>
        }
        renderRow={(index) => {
          const virtualRow = virtualizer.getVirtualItems()[index]!;
          return (
            <RateRow
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
            <span>Total Rules: {filteredEntries.length}</span>
            <span>Data Source: Ministry of Finance RI</span>
          </>
        }
      />
    </div>
  );
};
