import { describe, it, expect, beforeEach } from 'vitest'
import { AccountService } from '../../src/services/account.service.js'
import { InMemLedgerDB } from '../../src/db/memory.js'

let store: InMemLedgerDB
let service: AccountService

beforeEach(() => {
  store = new InMemLedgerDB()
  service = new AccountService(store)
})

describe('AccountService.create', () => {
  it('creates an account with defaults', async () => {
    const acct = await service.create({ direction: 'debit' })
    expect(acct.direction).toBe('debit')
    expect(acct.balance).toBe(0)
    expect(acct.id).toBeTruthy()
  })

  it('respects a provided id', async () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const acct = await service.create({ id, direction: 'credit' })
    expect(acct.id).toBe(id)
  })

  it('uses provided initial balance', async () => {
    const acct = await service.create({ direction: 'debit', balance: 500 })
    expect(acct.balance).toBe(500)
  })

  it('throws 409 on duplicate id', async () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    await service.create({ id, direction: 'debit' })
    await expect(service.create({ id, direction: 'credit' })).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})

describe('AccountService.getById', () => {
  it('returns existing account', async () => {
    const created = await service.create({ direction: 'credit', name: 'Savings' })
    const fetched = await service.getById(created.id)
    expect(fetched).toEqual(created)
  })

  it('throws 404 for unknown id', async () => {
    await expect(service.getById('non-existent')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
