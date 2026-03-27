import { HttpClient, HttpClientRequest } from '@effect/platform';
import { Effect } from 'effect';
import { DOMParser } from 'linkedom';

import { makeStoreManager } from '../structures/StoreManager';
import { getDayDiff, parseDateRange } from '../utilities/Date';

import type { Store } from '../structures/StoreManager';

export interface BaseRateEntry {
  readonly rate: number;
}

export interface ExchangeRateEntry extends BaseRateEntry {
  readonly currency: string;
}

export interface InterestRateEntry extends BaseRateEntry {
  readonly tags: string;
}

export interface BaseRateData<T extends BaseRateEntry> {
  readonly startDate: string;
  readonly endDate: string;
  readonly entries: T[];
}

export type ExchangeRateData = BaseRateData<ExchangeRateEntry>;
export type InterestRateData = BaseRateData<InterestRateEntry>;

export const makeScraper = <T extends BaseRateEntry>(type: 'exchange' | 'interest', parseRows: (dom: any) => T[]) => {
  const urlBase =
    type === 'exchange' ? 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak' : 'https://fiskal.kemenkeu.go.id/informasi-publik/tarif-bunga';

  const fileName = `${type === 'exchange' ? 'exchange-rates' : 'interest-rates'}.json`;
  const filePath = `data/${fileName}`;
  const manager = makeStoreManager<BaseRateData<T>>(filePath);

  const scrape = (date: string) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const url = `${urlBase}?date=${date}`;

      yield* Effect.logInfo(`Fetching URL: ${url}`);
      const response = yield* HttpClientRequest.get(url).pipe(
        HttpClientRequest.setHeader(
          'User-Agent',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ),
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
      } as BaseRateData<T>;
    });

  const getOrScrape = (date: string) =>
    Effect.gen(function* () {
      const store = yield* manager.getStore;
      const today = new Date().toISOString().split('T')[0]!;

      const existing = Object.values(store).find((data: BaseRateData<T>) => {
        if (date < data.startDate || date > data.endDate) return false;
        if (type === 'exchange') {
          const duration = getDayDiff(data.startDate, data.endDate);
          if (duration <= 7) return true;
          return !(today >= data.startDate || date <= today);
        }
        return true;
      });

      if (existing) {
        yield* Effect.logInfo(`Cache hit: ${existing.startDate} to ${existing.endDate}`);
        return existing as BaseRateData<T>;
      }

      const fallback = Object.values(store).find((data: BaseRateData<T>) => {
        return date >= data.startDate && date <= data.endDate;
      }) as BaseRateData<T> | undefined;

      const data = yield* scrape(date).pipe(
        Effect.catchAll((error) => {
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
          for (const key in updatedStore) {
            const existingData = updatedStore[key]!;
            if (
              data.startDate >= existingData.startDate &&
              data.endDate <= existingData.endDate &&
              getDayDiff(existingData.startDate, existingData.endDate) > duration
            ) {
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

  return { getOrScrape, filePath };
};
