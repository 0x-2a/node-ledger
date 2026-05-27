export type Direction = 'debit' | 'credit'

export interface Account {
  id: string;
  name?: string;
  balance: number;
  direction: Direction;
}

export interface AccountReq {
  id?: string;
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

export interface EntryReq {
  id?: string;
  account_id: string;
  direction: Direction;
  amount: number;
}

export interface Transaction {
  id: string;
  name?: string;
  entries: Entry[];
}

export interface TransactionReq {
  id?: string;
  name?: string;
  entries: EntryReq[];
}
