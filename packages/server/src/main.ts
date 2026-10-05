import { BunFileSystem, BunHttpServer, BunPath } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';
import { FetchHttpClient, HttpRouter, HttpServerResponse } from 'effect/http';

import { exchangeRatesRoutes } from './api/exchange-rates/Router';
import { interestRatesRoutes } from './api/interest-rates/Router';
import { LoggerClientLayer, makeLoggerClient } from './structures/LoggerClient';

const routesLayer = Layer.mergeAll(
  HttpRouter.addAll([HttpRouter.route('*', '*', HttpServerResponse.empty({ status: 404 }))]),
  exchangeRatesRoutes,
  interestRatesRoutes,
  HttpRouter.cors(),
).pipe(Layer.provideMerge(HttpRouter.layer));

const HttpLive = HttpRouter.serve(routesLayer).pipe(
  Layer.provide(BunHttpServer.layer({ port: 1730, idleTimeout: 0 })),
  Layer.provide(BunPath.layer),
  Layer.provide(BunFileSystem.layer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(LoggerClientLayer(makeLoggerClient())),
);

const program = Layer.launch(HttpLive).pipe(Effect.sandbox, Effect.catch(Effect.logError));

Effect.runPromise(program as Effect.Effect<never, never, never>);
