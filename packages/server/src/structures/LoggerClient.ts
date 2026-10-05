import { join } from 'node:path';
import { Cause, Layer, Logger, LogLevel, References } from 'effect';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

import type { ReadonlyRecord } from 'effect/Record';
import type { LevelWithSilent, StreamEntry } from 'pino';

const PINO_LEVEL_MAP: ReadonlyRecord<string, LogLevel.LogLevel> = {
  trace: 'Trace',
  debug: 'Debug',
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  fatal: 'Fatal',
  silent: 'None',
};

const EFFECT_LEVEL_MAP: ReadonlyRecord<LogLevel.LogLevel, LevelWithSilent> = {
  All: 'trace',
  Trace: 'trace',
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
  Fatal: 'fatal',
  None: 'silent',
};

export const makeLoggerClient = (): pino.Logger => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const level: LevelWithSilent = isDevelopment ? 'debug' : 'info';

  const streams: ReadonlyArray<StreamEntry> = [
    {
      level: 'warn',
      stream: pino.destination({
        mkdir: true,
        dest: join(process.cwd(), 'logs', 'errors.log'),
      }),
    },
    {
      level,
      stream: pinoPretty({
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        sync: isDevelopment,
        singleLine: process.env.NODE_ENV === 'production',
      }),
    },
  ];

  const instance = pino(
    {
      level,
      base: null,
      nestedKey: 'payload',
      hooks: {
        logMethod(args, method) {
          if (args.length >= 2) {
            const [arg0, arg1, ...rest] = args;
            if (typeof arg0 === 'string' && typeof arg1 === 'object') {
              return method.apply(this, [arg1, arg0, ...rest]);
            }

            if (args.every((r) => typeof r === 'string')) {
              return method.apply(this, [args.join(' ')]);
            }
          }
          return method.apply(this, args);
        },
      },
    },
    pino.multistream(streams as StreamEntry[]),
  );

  if (process.listenerCount('uncaughtException') === 0) {
    process.on('uncaughtException', (error, origin) => {
      instance.fatal({ error, origin }, 'UncaughtException');
    });
  }

  if (process.listenerCount('unhandledRejection') === 0) {
    process.on('unhandledRejection', (reason, promise) => {
      instance.fatal({ reason, promise }, 'UnhandledRejection');
    });
  }

  return instance;
};

export const LoggerClientLayer = (logger: pino.Logger) =>
  Layer.mergeAll(
    Logger.layer([
      Logger.make(({ logLevel, message, cause }) => {
        // Ignore internal Effect errors
        if (!Array.isArray(message)) {
          return;
        }

        const level = EFFECT_LEVEL_MAP[logLevel] ?? 'info';
        if (cause.reasons.length > 0) {
          const [failure] = cause.reasons.filter(Cause.isFailReason);
          const causePretty = { cause: Cause.pretty(cause) };

          if (failure && typeof failure === 'object' && 'cause' in failure && failure.cause) {
            message.push({ ...failure.cause, ...causePretty });
          } else {
            message.push(causePretty);
          }
        }

        const logMethod = logger[level] as (...args: readonly unknown[]) => void;
        logMethod.call(logger, ...message);
      }),
    ]),
    Layer.succeed(References.MinimumLogLevel, PINO_LEVEL_MAP[logger.level] ?? 'Info'),
  );
