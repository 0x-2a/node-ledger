import Fastify, {FastifyInstance, FastifyServerFactory} from 'fastify';
import cors from '@fastify/cors';
import type {Config} from './config';
import {createLogger} from './config/logger';
import type {AccountsDB, LedgerDB} from './db/interface';
import {registerErrorHandler} from './middleware/errorHandler';
import {AccountService} from './services/account.service';
import {TransactionService} from './services/transaction.service';
import http from 'node:http';
import {FastifyServerFactoryHandler} from 'fastify/types/server-factory';
import https from 'node:https';
import fs from 'node:fs';
import {registerAccountRoutes} from './routes/accountRoutes';
import {registerTransactionRoutes} from './routes/txRoutes';
import {InMemLedgerDB} from './db/memLedgerDB';
import {InMemAccountsDB} from './db/memAccountsDB';

export interface AppOptions {
  config: Config;
  accountsDB?: AccountsDB;
  ledgerDB?: LedgerDB;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const {config} = options;

  let level = config.logging.level;
  if (!level) {
    config.logging.level = 'info';
  }

  const logger = createLogger(config.logging);

  const accountsDB = options.accountsDB || new InMemAccountsDB();
  const ledgerDB = options.ledgerDB || new InMemLedgerDB();

  let serverFactory: FastifyServerFactory;
  if (config.server.protocol === 'https') {
    const tls = config.server.tls;
    if (!tls) {
      throw new Error(
          'protocol is "https" but no tls config found in config.yaml',
      );
    }

    const key = fs.readFileSync(tls.key);
    const cert = fs.readFileSync(tls.cert);

    serverFactory = (handler: FastifyServerFactoryHandler): https.Server => {
      return https.createServer({key, cert}, handler);
    };
  } else {
    serverFactory = (handler: FastifyServerFactoryHandler): http.Server => {
      return http.createServer((req, res) => {
        handler(req, res);
      });
    };
  }

  const app: FastifyInstance = Fastify({
    logger: false,
    bodyLimit: config.server.http.bodyLimit,
    connectionTimeout: config.server.http.connectionTimeout,
    keepAliveTimeout: config.server.http.keepAliveTimeout,
    requestTimeout: config.server.http.requestTimeout,
    genReqId: () => crypto.randomUUID(),
    serverFactory: serverFactory,
  });

  // Handle CORS
  await app.register(cors, {
    origin: config.cors.origin,
    methods: config.cors.methods,
  });

  // Handle request cancellation.
  app.addHook('onRequest', async (request) => {
    const controller = new AbortController();
    Object.defineProperty(request, 'signal', {
      value: controller.signal,
      writable: false,
      configurable: true,
    });
    request.raw.on('close', () => {
      if (!request.raw.complete) {
        controller.abort();
      }
    });
  });

  logger.info(`Server listening on ${config.server.host}:${config.server.port} . . .`);

  // ── Services ──────────────────────────────────────────────────────────────
  const accountService = new AccountService(accountsDB);
  const transactionService = new TransactionService(accountsDB, ledgerDB);

  // ── Routes ────────────────────────────────────────────────────────────────
  registerAccountRoutes(app, accountService);
  registerTransactionRoutes(app, transactionService);

  // ── Error handler ─────────────────────────────────────────────────────────
  registerErrorHandler(app);

  return app;
}
