import pino from 'pino';
import type {Config} from './index';
import moment from 'moment-timezone';

// Initialize as noop logger.
let logger: pino.Logger = pino({ level: 'silent' });

export function initLogger(cfg: Config['logging']) {
  if (cfg.level === logger.level) {
    return;
  }

  // Simple cfg for fast JSON logging.
  if (cfg.format === 'json') {
    logger = pino({
      level: cfg.level,
    });

    return;
  }

  // Detailed cfg for detailed dev logging.
  //
  // NOTE: For Dev or Debug only; the call tracing will add overhead.
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

export function getLogger(): pino.Logger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }

  return logger;
}

function formatTimestamp(): string {
  return moment().tz(moment.tz.guess()).format('YYYY-MM-DD hh:mm:ssA z');
}

// For console logging, wraps the pino logger so every call automatically includes caller location.
function withLocation(logger: pino.Logger): pino.Logger {
  const wrap =
      (level: pino.Level) =>
          (...args: Parameters<pino.LogFn>) => {
            const loc = getCallerLocation(2);

            if (typeof args[0] === 'object' && args[0] !== null) {
              // Default pino passthrough for structured logging, e.g. logger.info({ req, res, userId }).
              const [mergeObj, ...rest] = args as [object, ...unknown[]];
              (logger[level] as pino.LogFn).call(logger, mergeObj, ...rest as [string, ...unknown[]]);
            } else {
              // Inject file:line into the log message.
              const [msg, ...rest] = args as [string, ...unknown[]];
              const locMsg = `${loc}   ${msg}`;
              (logger[level] as pino.LogFn).call(logger, locMsg, ...rest as [string, ...unknown[]]);
            }
          };

  // Inherit the full prototype (gives `child`, `level`, `bindings`, etc.)
  const proxy = Object.create(logger) as pino.Logger;

  // Override only the log-level methods
  for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as pino.Level[]) {
    proxy[level] = wrap(level) as pino.LogFn;
  }

  return proxy;
}

// For console logging, extracts "filename:line" using the Error stack.
function getCallerLocation(skipFrames = 2): string {
  const err = new Error();
  const lines = err.stack?.split('\n') ?? [];
  const targetLine = lines[skipFrames + 1] ?? '';

  const match = targetLine.match(/([^/\\]+\.[jt]s):(\d+)/);
  if (!match) {
    return 'unknown:0';
  }
  return `${match[1]}:${match[2]}`;   // plain string, e.g. "server.ts:123"
}
