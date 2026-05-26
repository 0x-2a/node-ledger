import {Account} from '../models';
import {CreateAccountSchema} from '../models/schemas';
import {InvalidInputError} from '../errors/errors';
import {AccountsDB} from './interface';

/**
 * Promise-chaining mutex for per-account serialisation.
 * Each acquire() queues behind the previous one using a promise chain.
 */
class Mutex {
  private _chain: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = this._chain.then(() => release);
    this._chain = this._chain.then(() => next);
    return current;
  }
}

export class InMemAccountsDB implements AccountsDB {
  private readonly accounts = new Map<string, Account>();
  private readonly locks = new Map<string, Mutex>();

  private _getLock(accountId: string): Mutex {
    let lock = this.locks.get(accountId);
    if (!lock) {
      lock = new Mutex();
      this.locks.set(accountId, lock);
    }
    return lock;
  }

  async getAccount(id: string): Promise<Account | null> {
    if (!id) {
      return null;
    }

    const acct = this.accounts.get(id);
    return acct ? {...acct} : null;
  }

  async saveAccount(account: Account): Promise<void> {
    CreateAccountSchema.parse(account);

    if (!account.id) {
      throw new InvalidInputError('account.id');
    }

    this.accounts.set(account.id, {...account});
  }

  async updateAccountBalance(
      id: string,
      updater: (current: number) => number,
  ): Promise<Account> {
    const lock = this._getLock(id);
    const release = await lock.acquire();

    try {
      const acct = this.accounts.get(id);
      if (!acct) {
        throw new Error(`Account ${id} not found`);
      }

      const updated: Account = {
        ...acct,
        balance: updater(acct.balance),
      };

      this.accounts.set(id, updated);
      return {...updated};
    } finally {
      release();
    }
  }

  /** Wipe all data — tests only */
  clear(): void {
    this.accounts.clear();
    this.locks.clear();
  }
}
