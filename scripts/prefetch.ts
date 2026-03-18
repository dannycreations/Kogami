import { FetchHttpClient } from '@effect/platform';
import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { getOrScrape } from '@server/api/Kurs';
import { LoggerClientLayer, makeLoggerClient } from '@server/structures/LoggerClient';
import { Effect, Layer, Logger } from 'effect';

const prefetch = Effect.gen(function* () {
  let currentDate = new Date().toISOString().split('T')[0];
  const stopDate = '2020-01-01';

  yield* Effect.logInfo(`Starting prefetch backward from ${currentDate} to ${stopDate}...`);

  const processedRanges = new Set<string>();

  while (currentDate >= stopDate) {
    yield* Effect.logInfo(`Current prefetch iteration for: ${currentDate}`);
    const result = yield* Effect.either(getOrScrape(currentDate));

    if (result._tag === 'Left') {
      const errorMsg = result.left instanceof Error ? result.left.message : String(result.left);
      yield* Effect.logError(`CRITICAL: Prefetch failed for ${currentDate} -> ${errorMsg}`);

      // Fallback: move back 7 days if scraping failed to try to find a previous valid range
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      currentDate = d.toISOString().split('T')[0];
      yield* Effect.logWarning(`Retrying from fallback date: ${currentDate}`);
      continue;
    }

    const data = result.right;
    const rangeKey = `${data.startDate}_${data.endDate}`;

    if (processedRanges.has(rangeKey)) {
      yield* Effect.logWarning(`Range ${rangeKey} already processed. Moving back from ${data.startDate}`);
      const d = new Date(data.startDate);
      d.setDate(d.getDate() - 1);
      currentDate = d.toISOString().split('T')[0];
      continue;
    }
    processedRanges.add(rangeKey);

    const usd = data.entries.find((e) => e.mataUang === 'USD');
    yield* Effect.logInfo(`[${data.startDate} to ${data.endDate}] USD: ${usd?.nilai ?? 'N/A'}. Next: ${currentDate}`);

    const start = new Date(data.startDate);
    start.setDate(start.getDate() - 1);
    currentDate = start.toISOString().split('T')[0];

    // Throttle to avoid being blocked
    yield* Effect.sleep('500 millis');
  }

  yield* Effect.logInfo('Prefetch complete.');
});

const logger = makeLoggerClient();
const FSLive = BunFileSystem.layer;
const PathLive = BunPath.layer;
const ClientLive = FetchHttpClient.layer;

const AppLive = Layer.mergeAll(FSLive, PathLive, ClientLive, LoggerClientLayer(Logger.defaultLogger, logger));

const program = prefetch.pipe(Effect.provide(AppLive), Effect.sandbox, Effect.catchAll(Effect.logError));

Effect.runPromise(program as Effect.Effect<void, never, never>);
