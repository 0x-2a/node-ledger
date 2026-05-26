import {beforeEach, describe, expect, it} from 'vitest';
import {TransactionService} from '../../src/services/transaction.service.js';
import {AccountService} from '../../src/services/account.service.js';
import {Account} from '../../src/models';
import {InMemAccountsDB} from '../../src/db/memAccountsDB';
import {InMemLedgerDB} from '../../src/db/memLedgerDB';
import {
  AccountNotFoundError,
  ReqCancelledError,
  TxAlreadyExistsError
} from '../../src/errors/errors';
import {v4} from 'uuid';

let accountsDB: InMemAccountsDB;
let ledgerDB: InMemLedgerDB;

let accountService: AccountService;
let txService: TransactionService;

beforeEach(() => {
  accountsDB = new InMemAccountsDB();
  ledgerDB = new InMemLedgerDB();

  accountService = new AccountService(accountsDB);
  txService = new TransactionService(accountsDB, ledgerDB);
});

async function makeAcct(direction: 'debit' | 'credit', balance = 0) {
  return accountService.create({direction, balance} as Account);
}

describe('TransactionService.create', () => {
  it('applies a balanced debit/credit transaction', async () => {
    const debitAcct = await makeAcct('debit');
    const creditAcct = await makeAcct('credit');

    await txService.create({
      entries: [
        {account_id: debitAcct.id, direction: 'debit', amount: 100},
        {account_id: creditAcct.id, direction: 'credit', amount: 100},
      ],
    });

    const updatedDebit = await accountsDB.getAccount(debitAcct.id);
    const updatedCredit = await accountsDB.getAccount(creditAcct.id);
    // debit acct + debit entry → balance increases
    expect(updatedDebit!.balance).toBe(100);
    // credit acct + credit entry → balance increases
    expect(updatedCredit!.balance).toBe(100);
  });

  it('decreases balance when directions differ', async () => {
    const debitAcct = await makeAcct('debit', 200);
    const creditAcct = await makeAcct('credit', 200);

    await txService.create({
      entries: [
        {account_id: debitAcct.id, direction: 'credit', amount: 50},
        {account_id: creditAcct.id, direction: 'debit', amount: 50},
      ],
    });

    expect((await accountsDB.getAccount(debitAcct.id))!.balance).toBe(150);
    expect((await accountsDB.getAccount(creditAcct.id))!.balance).toBe(150);
  });

  it('returns a transaction with generated entry ids', async () => {
    const a = await makeAcct('debit');
    const b = await makeAcct('credit');
    const tx = await txService.create({
      entries: [
        {account_id: a.id, direction: 'debit', amount: 10},
        {account_id: b.id, direction: 'credit', amount: 10},
      ],
    });
    expect(tx.entries).toHaveLength(2);
    expect(tx.entries[0].id).toBeTruthy();
    expect(tx.entries[1].id).toBeTruthy();
  });

  it('throws 404 when an account does not exist', async () => {
    const a = await makeAcct('debit');
    await expect(
        txService.create({
          entries: [
            {account_id: a.id, direction: 'debit', amount: 50},
            {account_id: v4(), direction: 'credit', amount: 50},
          ],
        }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('throws 409 on duplicate transaction id', async () => {
    const a = await makeAcct('debit');
    const b = await makeAcct('credit');
    const id = '3256dc3c-7b18-4a21-95c6-146747cf2971';
    const entries = [
      {account_id: a.id, direction: 'debit' as const, amount: 20},
      {account_id: b.id, direction: 'credit' as const, amount: 20},
    ];
    await txService.create({id, entries});
    await expect(txService.create({id, entries})).rejects.toBeInstanceOf(TxAlreadyExistsError);
  });

  it('aborts if signal fires before completion', async () => {
    const controller = new AbortController();
    controller.abort();
    const a = await makeAcct('debit');
    const b = await makeAcct('credit');
    await expect(
        txService.create(
            {
              entries: [
                {account_id: a.id, direction: 'debit', amount: 10},
                {account_id: b.id, direction: 'credit', amount: 10},
              ],
            },
            controller.signal,
        ),
    ).rejects.toBeInstanceOf(ReqCancelledError);
  });
});

describe('TransactionService._applyEntry', () => {
  const cases: Array<[number, 'debit' | 'credit', 'debit' | 'credit', number, number]> = [
    [0, 'debit', 'debit', 100, 100],
    [0, 'credit', 'credit', 100, 100],
    [100, 'debit', 'credit', 100, 0],
    [100, 'credit', 'debit', 100, 0],
  ];
  it.each(cases)(
      'balance=%s acctDir=%s entryDir=%s amount=%s → %s',
      (start, acctDir, entryDir, amount, expected) => {
        expect(txService._applyEntry(start, acctDir, entryDir, amount)).toBe(expected);
      },
  );
});
