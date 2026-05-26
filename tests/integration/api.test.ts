import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {FastifyInstance} from 'fastify';
import {buildApp} from '../../src/app.js';
import type {Config} from '../../src/config';
import {InMemLedgerDB} from '../../src/db/memLedgerDB';
import {initLogger} from '../../src/config/logger';

const testConfig: Config = {
  server: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 3000,
    http: {
      bodyLimit: 1_048_576,
      connectionTimeout: 10_000,
      keepAliveTimeout: 72_000,
      requestTimeout: 30_000,
    },
  },
  logging: {format: 'json', level: 'debug'},
  cors: {origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']},
};

initLogger(testConfig.logging);

let app: FastifyInstance;
let store: InMemLedgerDB;

beforeEach(async () => {
  store = new InMemLedgerDB();
  app = await buildApp({config: testConfig, ledgerDB: store});
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function createAccount(body: object) {
  return app.inject({method: 'POST', url: '/accounts', payload: body});
}

async function getAccount(id: string) {
  return app.inject({method: 'GET', url: `/accounts/${id}`});
}

async function createTransaction(body: object) {
  return app.inject({method: 'POST', url: '/transactions', payload: body});
}

describe('POST /accounts', () => {
  it('creates a debit account with generated id', async () => {
    const res = await createAccount({direction: 'debit', name: 'Checking'});
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.direction).toBe('debit');
    expect(body.balance).toBe(0);
    expect(body.id).toBeTruthy();
    expect(body.name).toBe('Checking');
  });

  it('creates an account with a provided id', async () => {
    const id = '71cde2aa-b9bc-496a-a6f1-34964d05e6fd';
    const res = await createAccount({id, direction: 'debit', name: 'test3'});
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(id);
  });

  it('creates a credit account', async () => {
    const res = await createAccount({direction: 'credit'});
    expect(res.statusCode).toBe(201);
    expect(res.json().direction).toBe('credit');
  });

  it('returns 400 when direction is missing', async () => {
    const res = await createAccount({name: 'Bad'});
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid direction', async () => {
    const res = await createAccount({direction: 'sideways'});
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on duplicate id', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    await createAccount({id, direction: 'debit'});
    const res = await createAccount({id, direction: 'credit'});
    expect(res.statusCode).toBe(409);
  });
});

describe('GET /accounts/:id', () => {
  it('retrieves a created account', async () => {
    const id = '22222222-2222-2222-2222-222222222222';
    await createAccount({id, direction: 'credit', name: 'Savings'});
    const res = await getAccount(id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(id);
    expect(body.direction).toBe('credit');
    expect(body.name).toBe('Savings');
  });

  it('returns 404 for unknown account', async () => {
    const res = await getAccount('99999999-9999-9999-9999-999999999999');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /transactions', () => {
  it('creates a balanced transaction and updates balances', async () => {
    const aRes = await createAccount({direction: 'debit'});
    const bRes = await createAccount({direction: 'credit'});
    const aId = aRes.json().id;
    const bId = bRes.json().id;

    const txRes = await createTransaction({
      name: 'transfer',
      entries: [
        {account_id: aId, direction: 'debit', amount: 100},
        {account_id: bId, direction: 'credit', amount: 100},
      ],
    });

    expect(txRes.statusCode).toBe(201);
    const tx = txRes.json();
    expect(tx.entries).toHaveLength(2);
    expect(tx.entries[0].id).toBeTruthy();

    expect((await getAccount(aId)).json().balance).toBe(100);
    expect((await getAccount(bId)).json().balance).toBe(100);
  });

  it('uses provided transaction id', async () => {
    const a = (await createAccount({direction: 'debit'})).json();
    const b = (await createAccount({direction: 'credit'})).json();
    const txId = '3256dc3c-7b18-4a21-95c6-146747cf2971';
    const res = await createTransaction({
      id: txId,
      entries: [
        {account_id: a.id, direction: 'debit', amount: 50},
        {account_id: b.id, direction: 'credit', amount: 50},
      ],
    });
    expect(res.json().id).toBe(txId);
  });

  it('cross-direction: debit entry on credit account decreases balance', async () => {
    const creditAcct = (await createAccount({direction: 'credit', balance: 200})).json();
    const debitAcct = (await createAccount({direction: 'debit'})).json();

    await createTransaction({
      entries: [
        {account_id: creditAcct.id, direction: 'debit', amount: 50},
        {account_id: debitAcct.id, direction: 'credit', amount: 50},
      ],
    });

    expect((await getAccount(creditAcct.id)).json().balance).toBe(150);
    expect((await getAccount(debitAcct.id)).json().balance).toBe(-50);
  });

  it('returns 400 for unbalanced entries', async () => {
    const a = (await createAccount({direction: 'debit'})).json();
    const b = (await createAccount({direction: 'credit'})).json();
    const res = await createTransaction({
      entries: [
        {account_id: a.id, direction: 'debit', amount: 100},
        {account_id: b.id, direction: 'credit', amount: 60},
      ],
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for only one entry', async () => {
    const a = (await createAccount({direction: 'debit'})).json();
    const res = await createTransaction({
      entries: [{account_id: a.id, direction: 'debit', amount: 10}],
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when an account does not exist', async () => {
    const a = (await createAccount({direction: 'debit'})).json();
    const res = await createTransaction({
      entries: [
        {account_id: a.id, direction: 'debit', amount: 10},
        {account_id: '00000000-0000-0000-0000-000000000000', direction: 'credit', amount: 10},
      ],
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 on duplicate transaction id', async () => {
    const a = (await createAccount({direction: 'debit'})).json();
    const b = (await createAccount({direction: 'credit'})).json();
    const txId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const entries = [
      {account_id: a.id, direction: 'debit' as const, amount: 25},
      {account_id: b.id, direction: 'credit' as const, amount: 25},
    ];
    await createTransaction({id: txId, entries});
    const res = await createTransaction({id: txId, entries});
    expect(res.statusCode).toBe(409);
  });

  it('handles CORS preflight', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/accounts',
      headers: {
        origin: 'http://example.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('rejects oversized body', async () => {
    const tinyStore = new InMemLedgerDB();
    const tinyApp = await buildApp({
      config: {...testConfig, server: {...testConfig.server, http: {...testConfig.server.http, bodyLimit: 10}}},
      ledgerDB: tinyStore,
    });
    await tinyApp.ready();

    const res = await tinyApp.inject({
      method: 'POST',
      url: '/accounts',
      payload: {direction: 'debit', name: 'a'.repeat(100)},
    });
    expect(res.statusCode).toBe(413);
    await tinyApp.close();
  });
});

describe('Concurrent transactions', () => {
  it('processes 50 concurrent transactions without balance corruption', async () => {
    const src = (await createAccount({direction: 'debit', balance: 0})).json();
    const dst = (await createAccount({direction: 'credit', balance: 0})).json();

    const ops = Array.from({length: 50}, () =>
        createTransaction({
          entries: [
            {account_id: src.id, direction: 'debit', amount: 1},
            {account_id: dst.id, direction: 'credit', amount: 1},
          ],
        }),
    );
    const results = await Promise.all(ops);
    expect(results.every((r) => r.statusCode === 201)).toBe(true);

    expect((await getAccount(src.id)).json().balance).toBe(50);
    expect((await getAccount(dst.id)).json().balance).toBe(50);
  });
}, 30_000);
