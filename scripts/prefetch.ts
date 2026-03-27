import { FetchHttpClient, FileSystem } from '@effect/platform';
import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { scraper as exchangeScrape } from '@server/api/exchange-rates/Handler';
import { scraper as interestScrape } from '@server/api/interest-rates/Handler';
import { LoggerClientLayer, makeLoggerClient } from '@server/structures/LoggerClient';
import { getDayDiff } from '@server/utilities/Date';
import { Effect, Layer, Logger } from 'effect';

const validateAndCollectMissing = (dataFile: string, isMonthly: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(dataFile))) {
      return [new Date().toISOString().split('T')[0]!];
    }

    const content = yield* fs.readFileString(dataFile);
    const store = yield* Effect.try({
      try: () => JSON.parse(content) as Record<string, any>,
      catch: () => ({}) as Record<string, any>,
    });

    const todayStr = new Date().toISOString().split('T')[0]!;
    const missingDates = new Set<string>();
    const forceScrapeDates = new Set<string>();

    const cutoffDate = new Date();
    cutoffDate.setDate(1);
    cutoffDate.setMonth(cutoffDate.getMonth() - 1);
    const cutoffStr = cutoffDate.toISOString().split('T')[0]!;

    const sortedRanges = Object.values(store).sort((a, b) => b.startDate.localeCompare(a.startDate));

    if (sortedRanges.length === 0) {
      missingDates.add(todayStr);
    } else {
      for (let i = 0; i < sortedRanges.length - 1; i++) {
        const current = sortedRanges[i]!;
        const next = sortedRanges[i + 1]!;

        if (current.startDate < cutoffStr) break;

        const date = new Date(current.startDate);
        date.setDate(date.getDate() - 1);
        const expectedEndDate = date.toISOString().split('T')[0]!;

        if (expectedEndDate > next.endDate) {
          yield* Effect.logWarning(`Gap detected in ${dataFile} between ${current.startDate} and ${next.endDate}`);
          missingDates.add(expectedEndDate);
        }
      }

      for (const range of sortedRanges) {
        if (range.endDate < cutoffStr) continue;

        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        const durationDays = getDayDiff(range.startDate, range.endDate);

        let isBroken = false;
        if (isMonthly) {
          isBroken = durationDays > 31 || start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear();
        } else {
          isBroken = durationDays > 7;
        }

        isBroken = isBroken && (todayStr >= range.startDate || range.endDate <= todayStr);
        const isCorrupt = !range.entries || range.entries.length === 0;

        if (isBroken || isCorrupt) {
          yield* Effect.logWarning(
            `Broken/Corrupt range detected in ${dataFile}: ${range.startDate} to ${range.endDate} (${durationDays} days). Forcing scrape for ${range.startDate}`,
          );
          forceScrapeDates.add(range.startDate);
        }
      }

      const latestRange = sortedRanges[0]!;
      if (todayStr > latestRange.endDate) {
        missingDates.add(todayStr);
      }
    }

    return [...missingDates, ...forceScrapeDates].sort((a, b) => b.localeCompare(a));
  });

const prefetch = Effect.gen(function* () {
  yield* Effect.logInfo('Starting prefetch validation and repair...');

  yield* Effect.logInfo('Prefetching exchange rates...');
  const exchangeTargets = yield* validateAndCollectMissing(exchangeScrape.filePath, false);
  if (exchangeTargets.length > 0) {
    yield* Effect.logInfo(`Identified ${exchangeTargets.length} target dates for exchange rate scraping: ${exchangeTargets.join(', ')}`);
    for (const date of exchangeTargets) {
      if (!date) continue;
      yield* Effect.logInfo(`Processing exchange rate target date: ${date}`);
      const result = yield* Effect.either(exchangeScrape.getOrScrape(date));
      if (result._tag === 'Left') {
        const errorMsg = result.left instanceof Error ? result.left.message : String(result.left);
        yield* Effect.logError(`Prefetch failed for exchange rate ${date} -> ${errorMsg}`);
      } else {
        const data = result.right;
        const usd = data.entries.find((e: any) => e.currency === 'USD');
        yield* Effect.logInfo(`Successfully fetched/verified exchange rates [${data.startDate} to ${data.endDate}] USD: ${usd?.rate ?? 'N/A'}`);
      }
      yield* Effect.sleep('500 millis');
    }
  }

  yield* Effect.logInfo('Prefetching interest rates...');
  const interestTargets = yield* validateAndCollectMissing(interestScrape.filePath, true);
  if (interestTargets.length > 0) {
    yield* Effect.logInfo(`Identified ${interestTargets.length} target dates for interest rate scraping: ${interestTargets.join(', ')}`);
    for (const date of interestTargets) {
      if (!date) continue;
      yield* Effect.logInfo(`Processing interest rate target date: ${date}`);
      const result = yield* Effect.either(interestScrape.getOrScrape(date));
      if (result._tag === 'Left') {
        const errorMsg = result.left instanceof Error ? result.left.message : String(result.left);
        yield* Effect.logError(`Prefetch failed for interest rate ${date} -> ${errorMsg}`);
      } else {
        const data = result.right;
        yield* Effect.logInfo(
          `Successfully fetched/verified interest rates [${data.startDate} to ${data.endDate}] with ${data.entries.length} entries`,
        );
      }
      yield* Effect.sleep('500 millis');
    }
  }

  yield* Effect.logInfo('Prefetch cycle complete.');
});

const logger = makeLoggerClient();
const AppLive = Layer.mergeAll(BunPath.layer, BunFileSystem.layer, FetchHttpClient.layer, LoggerClientLayer(Logger.defaultLogger, logger));
const program = prefetch.pipe(Effect.provide(AppLive), Effect.sandbox, Effect.catchAll(Effect.logError));
Effect.runPromise(program);
