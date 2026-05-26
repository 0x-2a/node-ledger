import {beforeEach, describe, expect, it} from 'vitest';
import {InMemAccountsDB} from '../../src/db/memAccountsDB';
import {InMemLedgerDB} from '../../src/db/memLedgerDB';
import {v4} from 'uuid';

let accountsDB: InMemAccountsDB;
let ledgerDB: InMemLedgerDB;

beforeEach(() => {
  accountsDB = new InMemAccountsDB();
  ledgerDB = new InMemLedgerDB();
});

describe('InMemoryStore', () => {
  it('saves and retrieves an account', async () => {
    const id = v4();
    const acct = {id: id, direction: 'debit' as const, balance: 0};
    await accountsDB.saveAccount(acct);
    expect(await accountsDB.getAccount(id)).toEqual(acct);
  });

  it('returns undefined for unknown account', async () => {
    expect(await accountsDB.getAccount('missing')).toBeNull();
  });

  it('updateAccountBalance applies updater atomically', async () => {
    const id = v4();
    await accountsDB.saveAccount({id: id, direction: 'debit', balance: 100});
    const updated = await accountsDB.updateAccountBalance(id, (b) => b + 50);
    expect(updated.balance).toBe(150);
    expect((await accountsDB.getAccount(id))!.balance).toBe(150);
  });

  it('handles concurrent updates without data races', async () => {
    const id = v4();
    await accountsDB.saveAccount({id: id, direction: 'debit', balance: 0});
    // 100 concurrent increments of +1 → expected final balance = 100
    const ops = Array.from({length: 100}, () =>
        accountsDB.updateAccountBalance(id, (b) => b + 1),
    );
    await Promise.all(ops);
    expect((await accountsDB.getAccount(id))!.balance).toBe(100);
  });

  it('throws when updating a non-existent account', async () => {
    await expect(
        accountsDB.updateAccountBalance('ghost', (b) => b + 1),
    ).rejects.toThrow();
  });

  it('saves and retrieves a transaction', async () => {
    const tx = {id: 't1', entries: []};
    await ledgerDB.saveTransaction(tx);
    expect(await ledgerDB.getTransaction('t1')).toEqual(tx);
  });
});
