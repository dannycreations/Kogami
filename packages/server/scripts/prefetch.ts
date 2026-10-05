import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { Cause, Data, Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';

import { scraper as exchangeScrape } from '@kogami/server/api/exchange-rates/Handler';
import { scraper as interestScrape } from '@kogami/server/api/interest-rates/Handler';
import { LoggerClientLayer, makeLoggerClient } from '@kogami/server/structures/LoggerClient';
import { addDays, findFirstUncoveredDate } from '@kogami/server/utilities/date';

import type { Scraper } from '@kogami/server/helpers/Scraper';
import type { BaseRateEntry } from '@kogami/server/types/rates';

const REPAIR_WINDOW_DAYS = 400;
const SCRAPE_DELAY = '500 millis';

class PrefetchIncompleteError extends Data.TaggedError('PrefetchIncompleteError')<{
  readonly message: string;
}> {}

const fillGaps = <T extends BaseRateEntry>(label: string, scraper: Scraper<T>) =>
  Effect.gen(function* () {
    const today = new Date().toISOString().split('T')[0]!;
    const windowStart = addDays(today, -REPAIR_WINDOW_DAYS);

    const nextMissing = Effect.map(scraper.getStore, (store) => {
      const ranges = Object.values(store);

      let newestEnd = '';
      for (const range of ranges) {
        if (range.endDate > newestEnd) newestEnd = range.endDate;
      }

      const afterNewest = newestEnd ? addDays(newestEnd, 1) : today;
      return findFirstUncoveredDate(ranges, afterNewest > windowStart ? afterNewest : windowStart, today);
    });

    let missing = yield* nextMissing;
    let failures = 0;

    while (missing !== null) {
      yield* Effect.sleep(SCRAPE_DELAY);
      yield* Effect.logInfo(`Scraping ${label} rates for ${missing}`);

      const result = yield* Effect.result(scraper.getOrScrape(missing));
      if (result._tag === 'Failure') {
        failures++;
        yield* Effect.logError(`Prefetch failed for ${label} ${missing}: ${String(result.failure)}`);
        break;
      }

      const { startDate, endDate, entries } = result.success;
      yield* Effect.logInfo(`Stored ${label} rates [${startDate} to ${endDate}] with ${entries.length} entries`);

      const next = yield* nextMissing;
      missing = next !== null && next > missing ? next : null;
    }

    return failures;
  });

const prefetch = Effect.gen(function* () {
  yield* Effect.logInfo('Starting prefetch validation and repair...');

  const failures = (yield* fillGaps('exchange', exchangeScrape)) + (yield* fillGaps('interest', interestScrape));

  if (failures > 0) {
    // Exiting non-zero is what makes a run that fetched nothing visible in CI.
    return yield* new PrefetchIncompleteError({ message: `${failures} prefetch target(s) could not be fetched` });
  }

  yield* Effect.logInfo('Prefetch complete.');
});

const AppLive = Layer.mergeAll(BunPath.layer, BunFileSystem.layer, FetchHttpClient.layer, LoggerClientLayer(makeLoggerClient()));
const program = prefetch.pipe(
  Effect.provide(AppLive),
  Effect.sandbox,
  Effect.catch((cause) =>
    Effect.sync(() => {
      process.exitCode = 1;
      console.error(Cause.pretty(cause));
    }),
  ),
);

Effect.runPromise(program);
