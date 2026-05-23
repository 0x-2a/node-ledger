import Fastify, {FastifyInstance, FastifyServerFactory} from 'fastify';
import cors from '@fastify/cors';
import type {Config} from './config';
import {createLogger} from './config/logger.js';
import {InMemLedgerDB} from './db/memory.js';
import type {LedgerDB} from './db/interface.js';
import {registerErrorHandler} from './middleware/errorHandler.js';
import {registerAccountRoutes} from './routes/accounts.js';
import {registerTransactionRoutes} from './routes/transactions.js';
import {AccountService} from './services/account.service.js';
import {TransactionService} from './services/transaction.service.js';
import http from 'node:http';
import {FastifyServerFactoryHandler} from 'fastify/types/server-factory';
import https from 'node:https';
import fs from 'node:fs';

export interface AppOptions {
  config: Config;
  ledgerRepo?: LedgerDB;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const {config} = options;

  let level = config.logging.level;
  if (!level){
    config.logging.level = 'info'
  }

  const logger= createLogger(config.logging);

  const ledgerRepo = options.ledgerRepo || new InMemLedgerDB();

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
  const accountService = new AccountService(ledgerRepo);
  const transactionService = new TransactionService(ledgerRepo);

  // ── Routes ────────────────────────────────────────────────────────────────
  registerAccountRoutes(app, accountService);
  registerTransactionRoutes(app, transactionService);

  // ── Error handler ─────────────────────────────────────────────────────────
  registerErrorHandler(app);



  return app;
}

//
// declare module 'fastify' {
//   interface FastifyRequest {
//     signal: AbortSignal;
//   }
// }
