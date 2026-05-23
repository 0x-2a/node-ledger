import { describe, it, expect, beforeEach } from 'vitest'
import { InMemLedgerDB } from '../../src/db/memory.js'

let store: InMemLedgerDB

beforeEach(() => {
  store = new InMemLedgerDB()
})

describe('InMemoryStore', () => {
  it('saves and retrieves an account', async () => {
    const acct = { id: 'a1', direction: 'debit' as const, balance: 0 }
    await store.saveAccount(acct)
    expect(await store.getAccount('a1')).toEqual(acct)
  })

  it('returns undefined for unknown account', async () => {
    expect(await store.getAccount('missing')).toBeUndefined()
  })

  it('updateAccountBalance applies updater atomically', async () => {
    await store.saveAccount({ id: 'x', direction: 'debit', balance: 100 })
    const updated = await store.updateAccountBalance('x', (b) => b + 50)
    expect(updated.balance).toBe(150)
    expect((await store.getAccount('x'))!.balance).toBe(150)
  })

  it('handles concurrent updates without data races', async () => {
    await store.saveAccount({ id: 'race', direction: 'debit', balance: 0 })
    // 100 concurrent increments of +1 → expected final balance = 100
    const ops = Array.from({ length: 100 }, () =>
      store.updateAccountBalance('race', (b) => b + 1),
    )
    await Promise.all(ops)
    expect((await store.getAccount('race'))!.balance).toBe(100)
  })

  it('throws when updating a non-existent account', async () => {
    await expect(
      store.updateAccountBalance('ghost', (b) => b + 1),
    ).rejects.toThrow()
  })

  it('saves and retrieves a transaction', async () => {
    const tx = { id: 't1', entries: [] }
    await store.saveTransaction(tx)
    expect(await store.getTransaction('t1')).toEqual(tx)
  })
})
