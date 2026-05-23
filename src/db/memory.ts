import type {Account, Transaction} from '../models';
import type {LedgerDB} from './interface.js';

/**
 * Promise-chaining mutex for per-account serialisation.
 * Each acquire() queues behind the previous one using a promise chain.
 */
class Mutex {
  private _chain: Promise<void> = Promise.resolve();

  /**
   * Acquire the lock. Returns a release function.
   * Callers must always call release() in a finally block.
   */
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

export class InMemLedgerDB implements LedgerDB {
  private readonly accounts = new Map<string, Account>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly locks = new Map<string, Mutex>();

  private _getLock(accountId: string): Mutex {
    let lock = this.locks.get(accountId);
    if (!lock) {
      lock = new Mutex();
      this.locks.set(accountId, lock);
    }
    return lock;
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const acct = this.accounts.get(id);
    return acct ? {...acct} : undefined;
  }

  async saveAccount(account: Account): Promise<void> {
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
      acct.balance = updater(acct.balance);
      this.accounts.set(id, acct);
      return {...acct};
    } finally {
      release();
    }
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const tx = this.transactions.get(id);
    return tx ? {...tx, entries: [...tx.entries]} : undefined;
  }

  async saveTransaction(tx: Transaction): Promise<void> {
    this.transactions.set(tx.id, {...tx, entries: [...tx.entries]});
  }

  /** Wipe all data — tests only */
  clear(): void {
    this.accounts.clear();
    this.transactions.clear();
    this.locks.clear();
  }
}
