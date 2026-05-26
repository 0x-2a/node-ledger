import {beforeEach, describe, expect, it} from 'vitest';
import {AccountService} from '../../src/services/account.service';
import {Account} from '../../src/models';
import {InMemAccountsDB} from '../../src/db/memAccountsDB';
import {AccountAlreadyExistsError, AccountNotFoundError} from '../../src/errors/errors';

let accountsDB: InMemAccountsDB;
let accountService: AccountService;

beforeEach(() => {
  accountsDB = new InMemAccountsDB();
  accountService = new AccountService(accountsDB);
});

describe('AccountService.create', () => {
  it('creates an account with defaults', async () => {
    const acct = await accountService.create({direction: 'debit'} as Account);
    expect(acct.direction).toBe('debit');
    expect(acct.balance).toBe(0);
    expect(acct.id).toBeTruthy();
  });

  it('respects a provided id', async () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const acct = await accountService.create({id, direction: 'credit'} as Account);
    expect(acct.id).toBe(id);
  });

  it('uses provided initial balance', async () => {
    const acct = await accountService.create({direction: 'debit', balance: 500} as Account);
    expect(acct.balance).toBe(500);
  });

  it('throws 409 on duplicate id', async () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await accountService.create({id, direction: 'debit'} as Account);
    await expect(accountService.create({id, direction: 'credit'} as Account)).rejects.toBeInstanceOf(AccountAlreadyExistsError);
  });
});

describe('AccountService.getById', () => {
  it('returns existing account', async () => {
    const created = await accountService.create({direction: 'credit', name: 'Savings'} as Account);
    const fetched = await accountService.getById(created.id);
    expect(fetched).toEqual(created);
  });

  it('throws 404 for unknown id', async () => {
    await expect(accountService.getById('non-existent')).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});
