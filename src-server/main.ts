import { FetchHttpClient, HttpServer } from '@effect/platform';
import { BunFileSystem, BunHttpServer, BunPath } from '@effect/platform-bun';
import { Effect, Layer, Logger } from 'effect';

import { kursRouter } from './api/kurs/Router';
import { LoggerClientLayer, makeLoggerClient } from './structures/LoggerClient';

const logger = makeLoggerClient();
const HttpLive = BunHttpServer.layer({ port: 1800 });
const FSLive = BunFileSystem.layer;
const PathLive = BunPath.layer;
const ClientLive = FetchHttpClient.layer;

const AppLive = Layer.mergeAll(HttpLive, FSLive, PathLive, ClientLive, LoggerClientLayer(Logger.defaultLogger, logger));

const program = kursRouter.pipe(HttpServer.serve, Layer.launch).pipe(Effect.provide(AppLive), Effect.sandbox, Effect.catchAll(Effect.logError));

Effect.runPromise(program as Effect.Effect<void, never, never>);
