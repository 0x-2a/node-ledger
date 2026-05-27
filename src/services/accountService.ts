import {v4 as uuidv4} from 'uuid';
import {Account, AccountReq} from '../models';
import {AccountAlreadyExistsError, AccountNotFoundError, InvalidInputError} from '../errors/errors';
import {AccountReqSchema} from '../models/schemas';
import {AccountsDB} from '../db/interface';

export class AccountService {
  constructor(private readonly accountsDB: AccountsDB) {
  }

  async create(accountReq: AccountReq): Promise<Account> {
    if (accountReq.id) {
      const existing = await this.accountsDB.getAccount(accountReq.id);
      if (existing) {
        throw new AccountAlreadyExistsError(accountReq.id);
      }
    } else {
      accountReq.id = uuidv4();
    }

    const account = AccountReqSchema.parse(accountReq) as Account;

    await this.accountsDB.saveAccount(account);

    return account;
  }

  async getById(id: string): Promise<Account> {
    if (!id) {
      throw new InvalidInputError('id');
    }

    const account = await this.accountsDB.getAccount(id);
    if (!account) {
      throw new AccountNotFoundError(id);
    }

    return account;
  }
}
