import type {Account, Transaction} from '../models';

export interface AccountsDB {
  getAccount(id: string): Promise<Account | null>;

  saveAccount(account: Account): Promise<void>;

  // Support atomic updates by deferring the balance change
  //   to the db impl after it acquires a lock on current balance.
  updateAccountBalance(
      id: string,
      modifyBalance: (priorBalance: number) => number,
  ): Promise<Account>;
}

export interface LedgerDB {
  getTransaction(id: string): Promise<Transaction | null>;

  saveTransaction(tx: Transaction): Promise<void>;
}
