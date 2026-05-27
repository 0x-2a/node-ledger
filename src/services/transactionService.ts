import {v4 as uuidv4} from 'uuid';
import type {AccountsDB, LedgerDB} from '../db/interface';
import {Direction, Entry, EntryReq, Transaction, TransactionReq,} from '../models';
import {AccountNotFoundError, ReqCancelledError, TxAlreadyExistsError} from '../errors/errors';
import {TransactionReqSchema} from '../models/schemas';

export class TransactionService {
  constructor(
      private readonly accountsDB: AccountsDB,
      private readonly ledgerDB: LedgerDB
  ) {
  }

  /**
   * Creates and applies a balanced transaction.
   *
   * 1. Validate all referenced accounts exist.
   * 2. Pre-fetch each account's (immutable) direction.
   * 3. Apply each entry atomically via per-account mutex in the store.
   * 4. Persist the transaction record.
   *
   * `signal` mirrors Go-style context cancellation: if the HTTP request is
   * dropped before we finish, the AbortSignal fires and we stop early.
   */
  async create(
      tx: TransactionReq,
      signal?: AbortSignal,
  ): Promise<Transaction> {
    this._checkAbort(signal);

    // Validate tx and credit/debit balancing to zero.
    TransactionReqSchema.parse(tx);

    const txId = tx.id || uuidv4();

    const existingTx = await this.ledgerDB.getTransaction(txId);
    if (existingTx) {
      throw new TxAlreadyExistsError(txId);
    }

    // 1 & 2 — verify existence and collect directions (direction is immutable)
    const accountDirectionMap = new Map<string, Direction>();
    for (const e of tx.entries) {
      this._checkAbort(signal);

      if (!accountDirectionMap.has(e.account_id)) {
        const acct = await this.accountsDB.getAccount(e.account_id);
        if (!acct) {
          throw new AccountNotFoundError(e.account_id);
        }

        accountDirectionMap.set(e.account_id, acct.direction);
      }
    }

    this._checkAbort(signal);

    // 3 — build entry objects
    const entries: Entry[] = tx.entries.map((e: EntryReq): Entry => ({
      id: e.id ?? uuidv4(),
      account_id: e.account_id,
      direction: e.direction,
      amount: e.amount,
    }));

    // NOTE
    //  With a real db we would need to begin a transaction here
    //   and apply updates to accounts (with commit/rollback returned).
    //  Then after ledgerDB.saveTransaction commit or rollback on fail.

    // 4 — apply each entry atomically (per-account mutex inside the store)
    for (const entry of entries) {
      const accountDirection = accountDirectionMap.get(entry.account_id)!;
      await this.accountsDB.updateAccountBalance(entry.account_id, (balance) =>
          this._applyEntry(balance, accountDirection, entry.direction, entry.amount),
      );
    }

    // 5 — persist transaction
    const transaction: Transaction = {
      id: txId,
      name: tx.name,
      entries,
    };

    // NOTE
    //   In an RDBMS we would split this out into a transaction table save and entries table.
    await this.ledgerDB.saveTransaction(transaction);

    return transaction;
  }

  /**
   * Double-entry balance rule:
   *   same direction  → balance += amount
   *   diff direction  → balance -= amount
   */
  _applyEntry(
      balance: number,
      accountDirection: Direction,
      entryDirection: Direction,
      amount: number,
  ): number {
    const isSameDirection = accountDirection === entryDirection;

    if (isSameDirection) {
      return balance + amount;
    }

    return balance - amount;
  }

  private _checkAbort(signal?: AbortSignal): void {
    if (!signal) {
      return;
    }

    if (signal.aborted) {
      throw new ReqCancelledError();
    }
  }
}
