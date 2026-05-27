import type {Transaction} from '../models';
import {LedgerDB} from './interface';

export class InMemLedgerDB implements LedgerDB {
  private readonly transactions = new Map<string, Transaction>();

  /**
   * Retrieve a transaction by its id.
   *
   * Returns a shallow copy of the transaction so callers cannot mutate
   * the internal store by modifying the returned object.
   *
   * @param id - Unique transaction identifier.
   * @returns A copy of the transaction, or `null` if no transaction exists with that id.
   */
  async getTransaction(id: string): Promise<Transaction | null> {
    const tx = this.transactions.get(id);
    if (!tx) {
      return null;
    }

    return this._copyTx(tx);
  }

  /**
   * Persist (create or replace) a transaction in the in-memory store.
   *
   * Stores a deep copy of the transaction (and its entries) to avoid
   * retaining references to objects owned by the caller.
   *
   * @param tx - Transaction to save.
   */
  async saveTransaction(tx: Transaction): Promise<void> {
    this.transactions.set(tx.id, this._copyTx(tx));
  }

  // Wipe all data — tests only.
  clear(): void {
    this.transactions.clear();
  }

  // Creates a deep copy to prevent external mutation.
  private _copyTx(tx: Transaction): Transaction {
    return {
      ...tx,
      entries: tx.entries.map(entry => ({...entry})),
    };
  }
}
