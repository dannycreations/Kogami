import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { Cause, Data, Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';

import { scraper as exchangeScrape } from '@kogami/server/api/exchange-rates/Handler';
import { scraper as interestScrape } from '@kogami/server/api/interest-rates/Handler';
import { fillGaps } from '@kogami/server/helpers/Scraper';
import { LoggerClientLayer, makeLoggerClient } from '@kogami/server/structures/LoggerClient';

class PrefetchIncompleteError extends Data.TaggedError('PrefetchIncompleteError')<{
  readonly message: string;
}> {}

const prefetch = Effect.gen(function* () {
  yield* Effect.logInfo('Starting prefetch validation and repair...');

  const today = new Date().toISOString().split('T')[0]!;
  const unfilled = (yield* fillGaps('exchange', exchangeScrape, today)) + (yield* fillGaps('interest', interestScrape, today));

  if (unfilled > 0) {
    // Exiting non-zero is what makes a run that fetched nothing visible in CI.
    return yield* new PrefetchIncompleteError({ message: `${unfilled} date(s) could not be filled` });
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
