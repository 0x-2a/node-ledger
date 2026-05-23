import { v4 as uuidv4 } from 'uuid'
import type { LedgerDB } from '../db/interface.js'
import type {
  CreateTransactionRequest,
  Direction,
  Entry,
  Transaction,
} from '../models/index.js'

export class TransactionService {
  constructor(private readonly store: LedgerDB) {}

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
    req: CreateTransactionRequest,
    signal?: AbortSignal,
  ): Promise<Transaction> {
    this._checkAbort(signal)

    const txId = req.id ?? uuidv4()

    const existing = await this.store.getTransaction(txId)
    if (existing) {
      throw Object.assign(
        new Error(`Transaction with id ${txId} already exists`),
        { statusCode: 409 },
      )
    }

    // 1 & 2 — verify existence and collect directions (direction is immutable)
    const directionMap = new Map<string, Direction>()
    for (const e of req.entries) {
      this._checkAbort(signal)
      if (!directionMap.has(e.account_id)) {
        const acct = await this.store.getAccount(e.account_id)
        if (!acct) {
          throw Object.assign(
            new Error(`Account ${e.account_id} not found`),
            { statusCode: 404 },
          )
        }
        directionMap.set(e.account_id, acct.direction)
      }
    }

    this._checkAbort(signal)

    // 3 — build entry objects
    const entries: Entry[] = req.entries.map((e) => ({
      id: e.id ?? uuidv4(),
      account_id: e.account_id,
      direction: e.direction,
      amount: e.amount,
    }))

    // 4 — apply each entry atomically (per-account mutex inside the store)
    for (const entry of entries) {
      this._checkAbort(signal)
      const accountDirection = directionMap.get(entry.account_id)!
      await this.store.updateAccountBalance(entry.account_id, (balance) =>
        this._applyEntry(balance, accountDirection, entry.direction, entry.amount),
      )
    }

    // 5 — persist transaction
    const transaction: Transaction = {
      id: txId,
      name: req.name,
      entries,
    }
    await this.store.saveTransaction(transaction)
    return transaction
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
    return accountDirection === entryDirection
      ? balance + amount
      : balance - amount
  }

  private _checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw Object.assign(new Error('Request was cancelled'), {
        statusCode: 499,
        code: 'REQUEST_ABORTED',
      })
    }
  }
}
