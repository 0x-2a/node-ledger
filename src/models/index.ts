export type Direction = 'debit' | 'credit'

export interface Account {
  id: string;
  name?: string;
  balance: number;
  direction: Direction;
}

export interface Entry {
  id: string;
  account_id: string;
  direction: Direction;
  amount: number;
}

export interface Transaction {
  id: string;
  name?: string;
  entries: Entry[];
}

// ─── Request / Response shapes ───────────────────────────────────────────────

export interface CreateAccountRequest {
  id?: string;
  name?: string;
  balance: number;
  direction: Direction;
}

export interface CreateTransactionRequest {
  id?: string;
  name?: string;
  entries: Array<{
    id?: string
    account_id: string
    direction: Direction
    amount: number
  }>;
}
