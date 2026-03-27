import { FetchHttpClient, HttpMiddleware, HttpRouter, HttpServer, HttpServerResponse } from '@effect/platform';
import { BunFileSystem, BunHttpServer, BunPath } from '@effect/platform-bun';
import { Effect, Layer, Logger } from 'effect';

import { exchangeRatesRouter } from './api/exchange-rates/Router';
import { interestRatesRouter } from './api/interest-rates/Router';
import { LoggerClientLayer, makeLoggerClient } from './structures/LoggerClient';

const router = HttpRouter.empty.pipe(
  HttpRouter.concat(exchangeRatesRouter),
  HttpRouter.concat(interestRatesRouter),
  HttpRouter.all('*', HttpServerResponse.empty({ status: 404 })),
  HttpMiddleware.cors(),
);

const logger = makeLoggerClient();

const HttpLive = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(
    BunHttpServer.layer({
      port: 1730,
      idleTimeout: 0,
    }),
  ),
  Layer.provide(BunPath.layer),
  Layer.provide(BunFileSystem.layer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(LoggerClientLayer(Logger.defaultLogger, logger)),
);

const program = Layer.launch(HttpLive).pipe(Effect.sandbox, Effect.catchAll(Effect.logError));

Effect.runPromise(program as Effect.Effect<never, never, never>);
