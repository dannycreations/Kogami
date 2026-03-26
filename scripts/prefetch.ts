import { FetchHttpClient, FileSystem } from '@effect/platform';
import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { EXCHANGE_RATES_FILE, getOrScrape as getOrScrapeExchange } from '@server/api/exchange-rates/Handler';
import { getOrScrape as getOrScrapeInterest, INTEREST_RATES_FILE } from '@server/api/interest-rates/Handler';
import { LoggerClientLayer, makeLoggerClient } from '@server/structures/LoggerClient';
import { Effect, Layer, Logger } from 'effect';

const validateAndCollectMissing = (dataFile: string, isMonthly: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(dataFile);

    if (!exists) {
      return [new Date().toISOString().split('T')[0]!];
    }

    const content = yield* fs.readFileString(dataFile);
    let store: Record<string, any> = {};
    try {
      store = JSON.parse(content);
    } catch (e) {
      return [new Date().toISOString().split('T')[0]!];
    }

    const todayStr = new Date().toISOString().split('T')[0]!;
    const missingDates = new Set<string>();
    const forceScrapeDates = new Set<string>();

    const cutoffDate = new Date();
    cutoffDate.setDate(1); // First day of current month
    cutoffDate.setMonth(cutoffDate.getMonth() - 1); // First day of previous month
    const cutoffStr = cutoffDate.toISOString().split('T')[0]!;

    const sortedRanges = Object.values(store).sort((a, b) => b.startDate.localeCompare(a.startDate));

    if (sortedRanges.length === 0) {
      missingDates.add(todayStr);
    } else {
      // Check for gaps between ranges
      for (let i = 0; i < sortedRanges.length - 1; i++) {
        const current = sortedRanges[i];
        const next = sortedRanges[i + 1];

        if (current.startDate < cutoffStr) {
          break;
        }

        const endDate = new Date(current.startDate);
        endDate.setDate(endDate.getDate() - 1);
        const expectedEndDate = endDate.toISOString().split('T')[0]!;

        if (expectedEndDate > next.endDate) {
          yield* Effect.logWarning(`Gap detected in ${dataFile} between ${current.startDate} and ${next.endDate}`);
          missingDates.add(expectedEndDate);
        }
      }

      // Check for broken ranges
      for (const range of sortedRanges) {
        if (range.endDate < cutoffStr) {
          continue;
        }

        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;

        // Detect if range is too long (broken)
        // For monthly cycle (interest rates), we check if it spans multiple months or exceeds 31 days.
        // This naturally handles February (28/29 days) as it is <= 31 and within one month.
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

      // Ensure we have current date covered
      const latestRange = sortedRanges[0];
      if (todayStr > latestRange.endDate) {
        missingDates.add(todayStr);
      }
    }

    return [...missingDates, ...forceScrapeDates].sort((a, b) => b.localeCompare(a));
  });

const prefetch = Effect.gen(function* () {
  yield* Effect.logInfo('Starting prefetch validation and repair...');

  // Exchange Rates (weekly cycle)
  yield* Effect.logInfo('Prefetching exchange rates...');
  const exchangeTargets = yield* validateAndCollectMissing(EXCHANGE_RATES_FILE, false);
  if (exchangeTargets.length > 0) {
    yield* Effect.logInfo(`Identified ${exchangeTargets.length} target dates for exchange rate scraping: ${exchangeTargets.join(', ')}`);
    for (const date of exchangeTargets) {
      if (!date) continue;
      yield* Effect.logInfo(`Processing exchange rate target date: ${date}`);
      const result = yield* Effect.either(getOrScrapeExchange(date));
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

  // Interest Rates (monthly cycle)
  yield* Effect.logInfo('Prefetching interest rates...');
  const interestTargets = yield* validateAndCollectMissing(INTEREST_RATES_FILE, true);
  if (interestTargets.length > 0) {
    yield* Effect.logInfo(`Identified ${interestTargets.length} target dates for interest rate scraping: ${interestTargets.join(', ')}`);
    for (const date of interestTargets) {
      if (!date) continue;
      yield* Effect.logInfo(`Processing interest rate target date: ${date}`);
      const result = yield* Effect.either(getOrScrapeInterest(date));
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
