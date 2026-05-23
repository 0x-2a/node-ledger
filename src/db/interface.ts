import type { Account, Transaction } from '../models'

/**
 * Minimal persistence interface.
 * Swap this out with a SQL / Redis / etc. adapter without touching services.
 */
export interface LedgerDB {
  // Accounts
  getAccount(id: string): Promise<Account | undefined>
  saveAccount(account: Account): Promise<void>
  /** Atomically read-modify-write an account balance. */
  updateAccountBalance(
    id: string,
    updater: (current: number) => number,
  ): Promise<Account>

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>
  saveTransaction(tx: Transaction): Promise<void>
}
