export const ErrorTypeMap = {
  AccountAlreadyExists: 'ACCOUNT_ALREADY_EXISTS',
  AccountNotFound: 'ACCOUNT_NOT_FOUND',
  TxAlreadyExists: 'TX_ALREADY_EXISTS',
  InvalidInput: 'INVALID_INPUT',
  ReqCancelled: 'REQUEST_CANCELLED',
  Unknown: 'UNKNOWN',
} as const;

export type ErrorNameKey = typeof ErrorTypeMap[keyof typeof ErrorTypeMap];

export const ErrorNameStatusCodeMap: Record<ErrorNameKey, number> = {
  [ErrorTypeMap.AccountAlreadyExists]: 409,
  [ErrorTypeMap.TxAlreadyExists]: 409,
  [ErrorTypeMap.AccountNotFound]: 404,
  [ErrorTypeMap.InvalidInput]: 400,
  [ErrorTypeMap.ReqCancelled]: 499,
  [ErrorTypeMap.Unknown]: 500,
};

export abstract class TypedErr extends Error {
  abstract readonly typeKey: string;

  protected constructor(message: string, options?: {cause?: unknown}) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class AccountAlreadyExistsError extends TypedErr {
  readonly typeKey = ErrorTypeMap.AccountAlreadyExists;

  constructor(public readonly accountId: string) {
    super(`Account with id ${accountId} already exists`);
  }
}

export class AccountNotFoundError extends TypedErr {
  readonly typeKey = ErrorTypeMap.AccountNotFound;

  constructor(public readonly accountId: string) {
    super(`Account ${accountId} not found`);
  }
}

export class TxAlreadyExistsError extends TypedErr {
  readonly typeKey = ErrorTypeMap.TxAlreadyExists;

  constructor(public readonly txId: string) {
    super(`Transaction with id ${txId} already exists`);
  }
}

export class ReqCancelledError extends TypedErr {
  readonly typeKey = ErrorTypeMap.ReqCancelled;

  constructor() {
    super(`Request was cancelled`);
  }
}

export class InvalidInputError extends TypedErr {
  readonly typeKey = ErrorTypeMap.InvalidInput;

  constructor(public readonly inputName: string) {
    super(`Input ${inputName} is missing or invalid`);
  }
}
