import pino from 'pino';
import type {Config} from './index';
import {FastifyBaseLogger} from 'fastify';
import moment from 'moment-timezone';

let logger: FastifyBaseLogger | undefined;

export function initLogger(cfg: Config['logging']) {
  if (logger) {
    return;
  }

  if (cfg.format === 'json') {
    logger = pino({
      level: cfg.level,
    });

    return
  }

  logger = withLocation(pino({
    level: cfg.level,
    timestamp: () => `,"time":"${formatTimestamp()}"`,
    base: undefined,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: false,
        translateTime: false,
        ignore: 'pid,hostname',
        levelFirst: true,
      },
    },
  }));
}

export function getLogger(): FastifyBaseLogger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }

  return logger;
}

function formatTimestamp(): string {
  return moment().tz(moment.tz.guess()).format('YYYY-MM-DD hh:mm:ssA z');
}

/** Extract "filename:linenumber" from a fresh Error stack, skipping N internal frames. */
function getCallerLocation(skipFrames = 2): string {
  const err = new Error();
  const lines = err.stack?.split('\n') ?? [];
  const targetLine = lines[skipFrames + 1] ?? '';

  const match = targetLine.match(/([^/\\]+\.[jt]s):(\d+)/);
  if (!match) {
    return 'unknown:0';
  }
  return `${match[1]}:${match[2]}`;   // plain string, e.g. "server.ts:394"
}

/** Wraps a pino logger so every call automatically includes caller location. */
function withLocation(logger: pino.Logger): FastifyBaseLogger {
  const wrap =
      (level: pino.Level) =>
          (...args: Parameters<pino.LogFn>) => {
            const loc = getCallerLocation(2);
            if (typeof args[0] === 'object' && args[0] !== null) {
              const [mergeObj, ...rest] = args as [object, ...unknown[]];
              (logger[level] as pino.LogFn).call(logger, mergeObj, ...rest as [string, ...unknown[]]);
            } else {
              const [msg, ...rest] = args as [string, ...unknown[]];
              const locMsg = `${loc}   ${msg}`;
              (logger[level] as pino.LogFn).call(logger, locMsg, ...rest as [string, ...unknown[]]);
            }
          };

  // Inherit the full prototype (gives Fastify `child`, `level`, `bindings`, etc.)
  const proxy = Object.create(logger) as FastifyBaseLogger;

  // Override only the log-level methods
  for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as pino.Level[]) {
    proxy[level] = wrap(level) as pino.LogFn;
  }

  // Proxy `child` so child loggers are also location-aware
  proxy.child = (bindings: pino.Bindings, options?: pino.ChildLoggerOptions) =>
      withLocation(logger.child(bindings, options));

  return proxy;
}

