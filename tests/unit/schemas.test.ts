import {describe, expect, it} from 'vitest';
import {AccountReqSchema, TransactionReqSchema} from '../../src/models/schemas.js';
import {ZodError} from 'zod';

describe('CreateAccountSchema', () => {
  it('requires direction', () => {
    expect(() => AccountReqSchema.parse({})).toThrow(ZodError);
  });

  it('defaults balance to 0', () => {
    const r = AccountReqSchema.parse({direction: 'debit'});
    expect(r.balance).toBe(0);
  });

  it('rejects invalid direction', () => {
    expect(() => AccountReqSchema.parse({direction: 'up'})).toThrow(ZodError);
  });
});

describe('CreateTransactionSchema', () => {
  it('requires at least 2 entries', () => {
    expect(() =>
        TransactionReqSchema.parse({
          entries: [{account_id: 'abc', direction: 'debit', amount: 10}],
        }),
    ).toThrow(ZodError);
  });

  it('requires balanced entries', () => {
    expect(() =>
        TransactionReqSchema.parse({
          entries: [
            {account_id: 'abc', direction: 'debit', amount: 10},
            {account_id: 'def', direction: 'credit', amount: 20},
          ],
        }),
    ).toThrow(ZodError);
  });

  it('accepts balanced entries', () => {
    const r = TransactionReqSchema.parse({
      entries: [
        {account_id: '00000000-0000-0000-0000-000000000001', direction: 'debit', amount: 50},
        {account_id: '00000000-0000-0000-0000-000000000002', direction: 'credit', amount: 50},
      ],
    });
    expect(r.entries).toHaveLength(2);
  });

  it('rejects negative amounts', () => {
    expect(() =>
        TransactionReqSchema.parse({
          entries: [
            {account_id: '00000000-0000-0000-0000-000000000001', direction: 'debit', amount: -10},
            {account_id: '00000000-0000-0000-0000-000000000002', direction: 'credit', amount: -10},
          ],
        }),
    ).toThrow(ZodError);
  });
});
