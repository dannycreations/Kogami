import { Data, Duration, Effect } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/http';
import { DOMParser } from 'linkedom';

import { makeStoreManager } from '@kogami/server/structures/StoreManager';
import { addDays, findFirstUncoveredDate, getDayDiff, parseDateRange } from '@kogami/server/utilities/date';

import type { Store } from '@kogami/server/structures/StoreManager';
import type { BaseRateData, BaseRateEntry } from '@kogami/server/types/rates';

type RateType = 'exchange' | 'interest';

export class ScraperError extends Data.TaggedError('ScraperError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly unavailable?: boolean;
}> {}

const SOURCES: Readonly<Record<RateType, { readonly url: string; readonly file: string; readonly since: string }>> = {
  exchange: { url: 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak', file: 'exchange-rates.json', since: '2000-09-10' },
  interest: { url: 'https://fiskal.kemenkeu.go.id/informasi-publik/tarif-bunga', file: 'interest-rates.json', since: '2020-12-01' },
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
        // No validity period at all: the source has no data on record for this date.
        return yield* new ScraperError({ message: `Could not parse date range from: "${rangeText}"`, unavailable: true });
      }

      const entries = parseRows(dom);
      if (entries.length === 0) {
        // A page that parses into zero rows is a broken layout, not an empty rate table.
        // Failing here lets getOrScrape fall back instead of storing a range that serves
        // clients an empty result for every date it covers.
        return yield* new ScraperError({ message: `No rate rows parsed from: ${url}`, unavailable: true });
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

  return { getOrScrape, getStore: manager.getStore, since: SOURCES[type].since };
};

export type Scraper<T extends BaseRateEntry = BaseRateEntry> = ReturnType<typeof makeScraper<T>>;

const REPAIR_WINDOW_DAYS = 400;
const SCRAPE_DELAY = '500 millis';

export const fillGaps = <T extends BaseRateEntry>(
  label: string,
  scraper: Scraper<T>,
  today: string,
  windowDays: number = REPAIR_WINDOW_DAYS,
  delay: Duration.Input = SCRAPE_DELAY,
) =>
  Effect.gen(function* () {
    const windowStart = addDays(today, -windowDays);

    // Re-read the store on every call: saveStore swaps in a new object on each write.
    const nextUncovered = (from: string) => Effect.map(scraper.getStore, (store) => findFirstUncoveredDate(Object.values(store), from, today));

    const store = yield* scraper.getStore;
    // An empty store has no history to lean on, so fetch everything the source publishes
    // rather than only the repair window.
    let cursor = Object.keys(store).length === 0 ? scraper.since : windowStart;
    let unfilled = 0;

    for (;;) {
      const missing = yield* nextUncovered(cursor);
      if (missing === null) break;

      yield* Effect.sleep(delay);
      yield* Effect.logInfo(`Scraping ${label} rates for ${missing}`);

      const result = yield* Effect.result(scraper.getOrScrape(missing));

      if (result._tag === 'Failure') {
        // Older than the repair window means the source simply never published that date,
        // which is a permanent archive gap rather than something a later run could fix.
        if (result.failure._tag === 'ScraperError' && result.failure.unavailable === true && missing < windowStart) {
          yield* Effect.logWarning(`No ${label} rates published for ${missing}; skipping`);
        } else {
          unfilled++;
          yield* Effect.logError(`Prefetch failed for ${label} ${missing}: ${String(result.failure)}`);
        }
        // Step over this date so one missing date cannot abandon the rest of the run.
        cursor = addDays(missing, 1);
        continue;
      }

      const { startDate, endDate, entries } = result.success;
      yield* Effect.logInfo(`Stored ${label} rates [${startDate} to ${endDate}] with ${entries.length} entries`);

      // A fetch that succeeded without covering the requested date leaves the hole
      // open. Count it and step over it, otherwise this loop spins on a single date.
      if ((yield* nextUncovered(missing)) === missing) {
        unfilled++;
        yield* Effect.logError(`Prefetch made no progress for ${label} ${missing}; leaving it unfilled`);
        cursor = addDays(missing, 1);
        continue;
      }

      cursor = missing;
    }

    return unfilled;
  });
