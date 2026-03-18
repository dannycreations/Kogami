import { FetchHttpClient, HttpClient, HttpClientRequest } from '@effect/platform';
import { Effect } from 'effect';
import { Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { ExchangeRateData } from '@server/api/exchange-rates/Handler';

export const ExchangeRatesView = () => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<string>('');
  const [data, setData] = useState<ExchangeRateData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExchangeRates = useCallback((targetDate: string) => {
    setLoading(true);
    setError(null);

    const program = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.get(`http://localhost:1730/exchange-rates?date=${targetDate}`);
      const response = yield* client.execute(request).pipe(Effect.flatMap((res) => res.json));
      return response as ExchangeRateData;
    }).pipe(Effect.provide(FetchHttpClient.layer));

    Effect.runPromise(program as Effect.Effect<ExchangeRateData, any, never>)
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
    fetchExchangeRates(date);
  }, [date, fetchExchangeRates]);

  const filteredEntries = data?.entries.filter((entry) => entry.currency.toLowerCase().includes(currency.toLowerCase())) || [];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Search Exchange Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Effective Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Currency Code</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search currency (e.g. USD, EUR)"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-slate-500 font-medium">Fetching latest exchange rates...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <p className="font-medium">Error fetching data</p>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      )}

      {!loading && data && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">Exchange Rates Period</h3>
              <p className="text-sm text-slate-500">
                {data.startDate} to {data.endDate}
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">Official Data</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Currency</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                    Rate (IDR)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => (
                  <tr key={entry.currency} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                          {entry.currency.substring(0, 2)}
                        </div>
                        <span className="font-semibold text-slate-700">{entry.currency}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-900">
                      {new Intl.NumberFormat('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(entry.rate)}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-slate-400 italic">
                      No currency matches your search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
