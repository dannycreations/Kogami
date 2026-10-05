import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useMemo, useRef, useState } from 'react';

import { useRateData } from '@kogami/client/components/rate/useRateData';
import { FilterBar, SyncErrorBanner, virtualRowStyle, VirtualTable } from '@kogami/client/components/shared/DataView';

import type { InterestRateData, InterestRateEntry } from '@kogami/server/types/rates';

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
  const [search, setSearch] = useState<string>('');
  const { date, onDateChange, data, loading, error } = useRateData<InterestRateData>('/interest-rates');

  const parentRef = useRef<HTMLDivElement>(null);

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
        onDateChange={onDateChange}
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search Tags"
        searchPlaceholder="Ex. Pasal 19, Pasal 8"
        isValid={!!data && !loading}
        period={data ? { startDate: data.startDate, endDate: data.endDate } : undefined}
      />

      {error && <SyncErrorBanner message={error} />}

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
          return <RateRow key={virtualRow.key} entry={filteredEntries[virtualRow.index]!} style={virtualRowStyle(virtualRow)} />;
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
