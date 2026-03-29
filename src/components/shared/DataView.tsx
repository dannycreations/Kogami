import { Calendar, RefreshCw } from 'lucide-react';
import { memo } from 'react';

export const FilterBar = memo(
  ({
    date,
    onDateChange,
    search,
    onSearchChange,
    searchPlaceholder,
    searchLabel,
    isValid,
    period,
  }: {
    date: string;
    onDateChange: (date: string) => void;
    search: string;
    onSearchChange: (search: string) => void;
    searchPlaceholder: string;
    searchLabel: string;
    isValid: boolean;
    period?: { startDate: string; endDate: string } | undefined;
  }) => (
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
            onChange={(e) => onDateChange(e.target.value)}
            className="compact-input w-full pl-3 pr-8 !py-2 !h-11 !relative z-10"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center z-30">
            <div className="relative cursor-pointer text-surface-400 hover:text-brand-600 transition-colors">
              <Calendar className="h-4 w-4" />
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => onDateChange(e.target.value)}
                tabIndex={-1}
              />
            </div>
          </div>
        </div>

        <div className="w-1/2 relative">
          <label className="absolute left-8 top-0 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-surface-400 select-none pointer-events-none bg-white px-1.5 z-30">
            {searchLabel}
          </label>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="compact-input w-full pl-8 pr-3 !py-2 !h-11 !relative z-10"
          />
        </div>
      </div>

      {isValid && (
        <div className="ml-auto flex items-center px-3 py-1.5 bg-brand-50 border border-brand-100 rounded text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
          {period && (
            <span className="text-surface-500 font-mono">
              Period: {period.startDate} &mdash; {period.endDate}
            </span>
          )}
        </div>
      )}
    </div>
  ),
);

export const VirtualTable = memo(
  ({
    count,
    parentRef,
    totalSize,
    loading,
    hasData,
    headers,
    renderRow,
    footer,
  }: {
    count: number;
    parentRef: React.RefObject<HTMLDivElement | null>;
    totalSize: number;
    loading: boolean;
    hasData: boolean;
    headers: React.ReactNode;
    renderRow: (index: number) => React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div className="table-container flex-1 flex flex-col min-h-0 mt-3.5">
      <div className="flex flex-col w-full text-left border-collapse relative h-full overflow-hidden">
        <div ref={parentRef} className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <div className="min-w-full w-max">
            <div className="sticky top-0 z-30 shadow-sm bg-surface-50 table-header flex w-full">{headers}</div>
            <div
              className="bg-white relative w-full"
              style={{
                height: `${totalSize}px`,
              }}
            >
              {loading ? (
                <div className="px-4 py-16 text-center w-full">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-brand-50 mb-3">
                    <RefreshCw className="h-5 w-5 text-brand-500 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-surface-600">Querying central database...</p>
                </div>
              ) : count > 0 ? (
                Array.from({ length: count }).map((_, index) => renderRow(index))
              ) : hasData ? (
                <div className="px-4 py-12 text-center text-surface-400 text-sm w-full">No results match the search criteria.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {footer && (
        <div className="bg-surface-50 border-t border-surface-200 px-4 py-2 text-[10px] text-surface-500 flex justify-between items-center font-mono">
          {footer}
        </div>
      )}
    </div>
  ),
);
