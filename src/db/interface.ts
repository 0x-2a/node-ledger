import type {Account, Transaction} from '../models';

export interface AccountsDB {
  getAccount(id: string): Promise<Account | null>;

  saveAccount(account: Account): Promise<void>;

  /** Atomically read-modify-write an account balance. */
  updateAccountBalance(
      id: string,
      updater: (current: number) => number,
  ): Promise<Account>;
}

export interface LedgerDB {
  getTransaction(id: string): Promise<Transaction | undefined>;

  saveTransaction(tx: Transaction): Promise<void>;
}
