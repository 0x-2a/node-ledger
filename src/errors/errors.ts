/**
 * Canonical error type identifiers used across the service boundary.
 *
 * These values are stable string constants that can be serialized over HTTP
 * and mapped to appropriate status codes and client error types.
 */
export const ErrorTypeMap = {
  AccountAlreadyExists: 'ACCOUNT_ALREADY_EXISTS',
  AccountNotFound: 'ACCOUNT_NOT_FOUND',
  TxAlreadyExists: 'TX_ALREADY_EXISTS',
  InvalidInput: 'INVALID_INPUT',
  ReqCancelled: 'REQUEST_CANCELLED',
  Unknown: 'UNKNOWN',
} as const;

export type ErrorNameKey = typeof ErrorTypeMap[keyof typeof ErrorTypeMap];

/**
 * Mapping from error type identifier to HTTP status code.
 *
 * Used by the error handler to translate domain-specific errors into
 * consistent HTTP responses.
 */
export const ErrorNameStatusCodeMap: Record<ErrorNameKey, number> = {
  [ErrorTypeMap.AccountAlreadyExists]: 409,
  [ErrorTypeMap.TxAlreadyExists]: 409,
  [ErrorTypeMap.AccountNotFound]: 404,
  [ErrorTypeMap.InvalidInput]: 400,
  [ErrorTypeMap.ReqCancelled]: 499,
  [ErrorTypeMap.Unknown]: 500,
};

/**
 * Base class for typed domain errors.
 *
 * All domain errors extend this class and expose a `typeKey` that can be
 * mapped to an HTTP status code and a stable wire-level error identifier.
 */
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
