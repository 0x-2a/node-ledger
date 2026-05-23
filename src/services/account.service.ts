import {v4 as uuidv4} from 'uuid';
import type {LedgerDB} from '../db/interface.js';
import type {Account, CreateAccountRequest} from '../models';

export class AccountService {
  constructor(private readonly store: LedgerDB) {
  }

  async create(req: CreateAccountRequest): Promise<Account> {
    const id = req.id ?? uuidv4();

    const existing = await this.store.getAccount(id);
    if (existing) {
      throw Object.assign(new Error(`Account with id ${id} already exists`), {
        statusCode: 409,
      });
    }

    const account: Account = {
      id,
      name: req.name,
      balance: req.balance ?? 0,
      direction: req.direction,
    };

    await this.store.saveAccount(account);
    return account;
  }

  async getById(id: string): Promise<Account> {
    const account = await this.store.getAccount(id);
    if (!account) {
      throw Object.assign(new Error(`Account ${id} not found`), {
        statusCode: 404,
      });
    }
    return account;
  }
}
