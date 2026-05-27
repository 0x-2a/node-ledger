import {Account} from '../models';
import {AccountReqSchema} from '../models/schemas';
import {AccountNotFoundError, InvalidInputError} from '../errors/errors';
import {AccountsDB} from './interface';
import {Mutex} from './memMutex';

export class InMemAccountsDB implements AccountsDB {
  private readonly accounts = new Map<string, Account>();
  private readonly locks = new Map<string, Mutex>();

  /**
   * Load an account by id.
   *
   * @param id - Unique account identifier. Falsy values return `null`.
   * @returns A shallow copy of the account, or `null` if it does not exist.
   */
  async getAccount(id: string): Promise<Account | null> {
    if (!id) {
      return null;
    }

    const acct = this.accounts.get(id);
    return acct ? {...acct} : null;
  }

  /**
   * Persist (create or replace) an account.
   *
   * Validates the payload and requires a non-empty `account.id`.
   *
   * @param account - Account to create or update.
   * @throws InvalidInputError If `account.id` is missing or invalid.
   */
  async saveAccount(account: Account): Promise<void> {
    AccountReqSchema.parse(account);

    if (!account.id) {
      throw new InvalidInputError('account.id');
    }

    this.accounts.set(account.id, {...account});
  }

  /**
   * Atomically update an account's balance using an updater function.
   *
   * The updater is applied under a per-account lock to guarantee that
   * concurrent callers see a consistent balance and that the read–modify–write
   * cycle is atomic.
   *
   * @param id - Unique account identifier.
   * @param updater - Pure function that derives the new balance from
   * the current balance.
   * @returns A shallow copy of the updated account.
   * @throws AccountNotFoundError If the account does not exist.
   */
  async updateAccountBalance(
      id: string,
      updater: (current: number) => number,
  ): Promise<Account> {
    const lock = this._getLock(id);
    const release = await lock.acquire();

    try {
      const acct = this.accounts.get(id);
      if (!acct) {
        throw new AccountNotFoundError(id);
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

  // Wipe all data — tests only
  clear(): void {
    this.accounts.clear();
    this.locks.clear();
  }

  private _getLock(accountId: string): Mutex {
    let lock = this.locks.get(accountId);
    if (!lock) {
      lock = new Mutex();
      this.locks.set(accountId, lock);
    }

    return lock;
  }
}
