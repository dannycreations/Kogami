import { Effect } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/http';
import { DOMParser } from 'linkedom';

import { makeStoreManager } from '@kogami/server/structures/StoreManager';
import { getDayDiff, parseDateRange } from '@kogami/server/utilities/date';

import type { Store } from '@kogami/server/structures/StoreManager';
import type { BaseRateData, BaseRateEntry } from '@kogami/server/types/rates';

type RateType = 'exchange' | 'interest';

const SOURCES: Readonly<Record<RateType, { readonly url: string; readonly file: string }>> = {
  exchange: { url: 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak', file: 'exchange-rates.json' },
  interest: { url: 'https://fiskal.kemenkeu.go.id/informasi-publik/tarif-bunga', file: 'interest-rates.json' },
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const makeScraper = <T extends BaseRateEntry>(type: RateType, parseRows: (dom: ReturnType<DOMParser['parseFromString']>) => T[]) => {
  const sourceUrl = SOURCES[type].url;
  const filePath = `data/${SOURCES[type].file}`;
  const manager = makeStoreManager<BaseRateData<T>>(filePath);

  const scrape = (date: string) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const url = `${sourceUrl}?date=${date}`;

      yield* Effect.logInfo(`Fetching URL: ${url}`);
      const response = yield* HttpClientRequest.get(url).pipe(
        HttpClientRequest.setHeader('User-Agent', USER_AGENT),
        client.execute,
        Effect.timeout('60 seconds'),
        Effect.flatMap((res) => res.text),
        // @effect-diagnostics-next-line globalErrorInEffectFailure:off
        Effect.mapError((err) => new Error(`Scrape failed: ${err}`)),
        Effect.scoped,
      );

      const dom = new DOMParser().parseFromString(response, 'text/html');
      const rangeText = dom.querySelector('.text-muted em')?.textContent || '';
      const range = parseDateRange(rangeText);

      if (!range) {
        // @effect-diagnostics-next-line globalErrorInEffectFailure:off
        return yield* Effect.fail(new Error(`Could not parse date range from: "${rangeText}"`));
      }

      return {
        startDate: range.start,
        endDate: range.end,
        entries: parseRows(dom),
      };
    });

  const getOrScrape = (date: string) =>
    Effect.gen(function* () {
      const store = yield* manager.getStore;
      const today = new Date().toISOString().split('T')[0]!;

      let existing: BaseRateData<T> | undefined;
      let fallback: BaseRateData<T> | undefined;

      for (const key in store) {
        const data = store[key]!;
        if (date < data.startDate || date > data.endDate) continue;

        const days = getDayDiff(data.startDate, data.endDate);
        // Interest ranges are stored one per month, so any covering range is authoritative.
        // Exchange ranges are weekly, so short ranges win over the longer holiday-stretched ones.
        const isAuthoritative = type === 'interest' || days <= 7;

        if (!fallback || days < getDayDiff(fallback.startDate, fallback.endDate)) {
          fallback = data;
        }

        if (isAuthoritative || date > today) {
          existing = data;
          if (isAuthoritative) break;
        }
      }

      if (existing) {
        yield* Effect.logInfo(`Cache hit: ${existing.startDate} to ${existing.endDate}`);
        return existing;
      }

      const data = yield* scrape(date).pipe(
        Effect.catch((error) => {
          if (fallback) {
            return Effect.logWarning(
              `Scrape failed for ${date}, falling back to existing range ${fallback.startDate}_${fallback.endDate}: ${error.message}`,
            ).pipe(Effect.as(fallback));
          }
          return Effect.fail(error);
        }),
      );

      const rangeKey = `${data.startDate}_${data.endDate}`;

      if (fallback && rangeKey === `${fallback.startDate}_${fallback.endDate}`) {
        return data;
      }

      const updatedStore: Store<BaseRateData<T>> = { ...store };

      if (type === 'exchange') {
        const duration = getDayDiff(data.startDate, data.endDate);
        if (duration <= 7) {
          const start = data.startDate;
          const end = data.endDate;
          for (const key in updatedStore) {
            const existingData = updatedStore[key]!;
            if (start >= existingData.startDate && end <= existingData.endDate) {
              const existingDuration = getDayDiff(existingData.startDate, existingData.endDate);
              if (existingDuration > duration) {
                yield* Effect.logInfo(`Removing redundant range: ${key}`);
                delete updatedStore[key];
              }
            }
          }
        }
      }

      updatedStore[rangeKey] = data;
      yield* manager.saveStore(updatedStore);

      return data;
    });

  return { getOrScrape, filePath };
};
