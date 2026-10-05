import { Effect } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http';
import { useEffect, useState } from 'react';

import { API_BASE_URL } from '@kogami/client/app/constants';

const DEBOUNCE_MS = 500;

export const useRateData = <T>(endpoint: string) => {
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]!);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = date.trim();
    if (!target) return;

    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      const program = Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const response = yield* HttpClientRequest.get(`${API_BASE_URL}${endpoint}?date=${target}`).pipe(
          client.execute,
          Effect.flatMap((res) => res.json),
        );
        return response as unknown as T;
      }).pipe(Effect.provide(FetchHttpClient.layer));

      Effect.runPromise(program).then(
        (result) => {
          setData(result);
          setLoading(false);
        },
        (err) => {
          setError(String(err));
          setLoading(false);
        },
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [date, endpoint]);

  return { date, onDateChange: setDate, data, loading, error };
};
