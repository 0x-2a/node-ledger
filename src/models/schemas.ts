import {z} from 'zod';

export const DirectionSchema = z.enum(['debit', 'credit']);

export const AccountReqSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(255).optional(),
  balance: z.number().finite().default(0),
  direction: DirectionSchema,
});

export const EntryReqSchema = z.object({
  id: z.string().uuid().optional(),
  account_id: z.string().uuid(),
  direction: DirectionSchema,
  amount: z
  .number()
  .positive({message: 'Entry amount must be positive'})
  .finite(),
});

export const TransactionReqSchema = z
.object({
  id: z.string().uuid().optional(),
  name: z.string().max(255).optional(),
  entries: z
  .array(EntryReqSchema)
  .min(2, {message: 'A transaction must have at least 2 entries'}),
})
.refine(
    (data) => {
      // Debit sum must equal credit sum (balanced)
      let debits = 0;
      let credits = 0;
      for (const e of data.entries) {
        if (e.direction === 'debit') {
          debits += e.amount;
        } else {
          credits += e.amount;
        }
      }
      // Use epsilon comparison to handle floating-point rounding
      return Math.abs(debits - credits) < 0.000001;
    },
    {message: 'Transaction entries are not balanced: debits must equal credits'},
);
