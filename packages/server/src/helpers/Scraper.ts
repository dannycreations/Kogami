import { Data, Effect } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/http';
import { DOMParser } from 'linkedom';

import { makeStoreManager } from '@kogami/server/structures/StoreManager';
import { getDayDiff, parseDateRange } from '@kogami/server/utilities/date';

import type { Store } from '@kogami/server/structures/StoreManager';
import type { BaseRateData, BaseRateEntry } from '@kogami/server/types/rates';

type RateType = 'exchange' | 'interest';

export class ScraperError extends Data.TaggedError('ScraperError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const SOURCES: Readonly<Record<RateType, { readonly url: string; readonly file: string }>> = {
  exchange: { url: 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak', file: 'exchange-rates.json' },
  interest: { url: 'https://fiskal.kemenkeu.go.id/informasi-publik/tarif-bunga', file: 'interest-rates.json' },
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const WEEKLY_RANGE_DAYS = 7;

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
        Effect.mapError((err) => new ScraperError({ message: `Scrape failed: ${err}`, cause: err })),
        Effect.scoped,
      );

      const dom = new DOMParser().parseFromString(response, 'text/html');
      const rangeText = dom.querySelector('.text-muted em')?.textContent || '';
      const range = parseDateRange(rangeText);

      if (!range) {
        return yield* new ScraperError({ message: `Could not parse date range from: "${rangeText}"` });
      }

      const entries = parseRows(dom);
      if (entries.length === 0) {
        // A page that parses into zero rows is a broken layout, not an empty rate table.
        // Failing here lets getOrScrape fall back instead of storing a range that serves
        // clients an empty result for every date it covers.
        return yield* new ScraperError({ message: `No rate rows parsed from: ${url}` });
      }

      return {
        startDate: range.start,
        endDate: range.end,
        entries,
      };
    });

  const getOrScrape = (date: string) =>
    Effect.gen(function* () {
      const store = yield* manager.getStore;
      const today = new Date().toISOString().split('T')[0]!;

      let existing: BaseRateData<T> | undefined;
      let fallback: BaseRateData<T> | undefined;
      let fallbackDays = Infinity;

      for (const key in store) {
        const data = store[key]!;
        if (date < data.startDate || date > data.endDate) continue;

        const days = getDayDiff(data.startDate, data.endDate);
        // Interest ranges are stored one per month, so any covering range is authoritative.
        // Exchange ranges are weekly, so short ranges win over the longer holiday-stretched ones.
        const isAuthoritative = type === 'interest' || days <= WEEKLY_RANGE_DAYS;

        if (days < fallbackDays) {
          fallback = data;
          fallbackDays = days;
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
      const duration = getDayDiff(data.startDate, data.endDate);

      if (type === 'exchange' && duration <= WEEKLY_RANGE_DAYS) {
        for (const key in updatedStore) {
          const existingData = updatedStore[key]!;
          if (data.startDate >= existingData.startDate && data.endDate <= existingData.endDate) {
            const existingDuration = getDayDiff(existingData.startDate, existingData.endDate);
            if (existingDuration > duration) {
              yield* Effect.logInfo(`Removing redundant range: ${key}`);
              delete updatedStore[key];
            }
          }
        }
      }

      updatedStore[rangeKey] = data;
      yield* manager.saveStore(updatedStore);

      return data;
    });

  return { getOrScrape, getStore: manager.getStore };
};

export type Scraper<T extends BaseRateEntry = BaseRateEntry> = ReturnType<typeof makeScraper<T>>;
