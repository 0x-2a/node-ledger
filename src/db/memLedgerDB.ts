import type {Transaction} from '../models';
import {LedgerDB} from './interface';

export class InMemLedgerDB implements LedgerDB {
  private readonly transactions = new Map<string, Transaction>();

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const tx = this.transactions.get(id);
    return tx ? {...tx, entries: [...tx.entries]} : undefined;
  }

  async saveTransaction(tx: Transaction): Promise<void> {
    this.transactions.set(tx.id, {...tx, entries: [...tx.entries]});
  }

  /** Wipe all data — tests only */
  clear(): void {
    this.transactions.clear();
  }
}
