import { FetchHttpClient, FileSystem } from '@effect/platform';
import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { getOrScrape } from '@server/api/exchange-rates/Handler';
import { LoggerClientLayer, makeLoggerClient } from '@server/structures/LoggerClient';
import { Effect, Layer, Logger } from 'effect';

const DATA_FILE = 'data/exchange-rates.json';

const validateAndCollectMissing = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(DATA_FILE);

  if (!exists) {
    return [new Date().toISOString().split('T')[0]];
  }

  const content = yield* fs.readFileString(DATA_FILE);
  let store: Record<string, any> = {};
  try {
    store = JSON.parse(content);
  } catch (e) {
    return [new Date().toISOString().split('T')[0]];
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const missingDates = new Set<string>();
  const forceScrapeDates = new Set<string>();

  // Calculate cutoff: first day of previous month
  const cutoffDate = new Date();
  cutoffDate.setDate(1); // First day of current month
  cutoffDate.setMonth(cutoffDate.getMonth() - 1); // First day of previous month
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const sortedRanges = Object.values(store).sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (sortedRanges.length === 0) {
    missingDates.add(todayStr);
  } else {
    // Check for gaps between ranges
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      const current = sortedRanges[i];
      const next = sortedRanges[i + 1];

      // Only check if the current range starts after or on the cutoff
      if (current.startDate < cutoffStr) {
        break;
      }

      const endDate = new Date(current.startDate);
      endDate.setDate(endDate.getDate() - 1);
      const expectedEndDate = endDate.toISOString().split('T')[0];

      if (expectedEndDate > next.endDate) {
        yield* Effect.logWarning(`Gap detected between ${current.startDate} and ${next.endDate}`);
        missingDates.add(expectedEndDate);
      }
    }

    // Check for broken ranges (usually 7 days)
    for (const range of sortedRanges) {
      // Only check ranges that end after or on the cutoff
      if (range.endDate < cutoffStr) {
        continue;
      }

      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;

      const isBroken = durationDays > 7 && (todayStr >= range.startDate || range.endDate <= todayStr);
      const isCorrupt = !range.entries || range.entries.length === 0;

      if (isBroken || isCorrupt) {
        yield* Effect.logWarning(
          `Broken/Corrupt range detected: ${range.startDate} to ${range.endDate} (${durationDays} days). Forcing scrape for ${range.startDate}`,
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

  const targets = yield* validateAndCollectMissing;

  if (targets.length === 0) {
    yield* Effect.logInfo('No missing or broken ranges detected.');
    return;
  }

  yield* Effect.logInfo(`Identified ${targets.length} target dates for scraping: ${targets.join(', ')}`);

  for (const date of targets) {
    yield* Effect.logInfo(`Processing target date: ${date}`);
    const result = yield* Effect.either(getOrScrape(date));

    if (result._tag === 'Left') {
      const errorMsg = result.left instanceof Error ? result.left.message : String(result.left);
      yield* Effect.logError(`Prefetch failed for ${date} -> ${errorMsg}`);
    } else {
      const data = result.right;
      const usd = data.entries.find((e) => e.currency === 'USD');
      yield* Effect.logInfo(`Successfully fetched/verified [${data.startDate} to ${data.endDate}] USD: ${usd?.rate ?? 'N/A'}`);
    }

    yield* Effect.sleep('500 millis');
  }

  yield* Effect.logInfo('Prefetch cycle complete.');
});

const logger = makeLoggerClient();

const AppLive = Layer.mergeAll(BunPath.layer, BunFileSystem.layer, FetchHttpClient.layer, LoggerClientLayer(Logger.defaultLogger, logger));

const program = prefetch.pipe(Effect.provide(AppLive), Effect.sandbox, Effect.catchAll(Effect.logError));

Effect.runPromise(program);
