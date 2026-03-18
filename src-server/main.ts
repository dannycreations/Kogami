import { FetchHttpClient, HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from '@effect/platform';
import { BunFileSystem, BunHttpServer, BunPath } from '@effect/platform-bun';
import { Effect, Layer, Logger } from 'effect';

import { getOrScrape } from './api/Kurs';
import { LoggerClientLayer, makeLoggerClient } from './structures/LoggerClient';

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/kurs',
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(request.url, 'http://localhost');
      const date = url.searchParams.get('date');

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return yield* HttpServerResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD)' }, { status: 400 });
      }

      const data = yield* getOrScrape(date);
      return yield* HttpServerResponse.json(data);
    }),
  ),
);

const logger = makeLoggerClient();
const HttpLive = BunHttpServer.layer({ port: 1800 });
const FSLive = BunFileSystem.layer;
const PathLive = BunPath.layer;
const ClientLive = FetchHttpClient.layer;

const AppLive = Layer.mergeAll(HttpLive, FSLive, PathLive, ClientLive, LoggerClientLayer(Logger.defaultLogger, logger));

const program = router.pipe(HttpServer.serve, Layer.launch).pipe(Effect.provide(AppLive), Effect.sandbox, Effect.catchAll(Effect.logError));

Effect.runPromise(program as Effect.Effect<void, never, never>);
