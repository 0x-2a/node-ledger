/**
 * Promise-chaining mutex for per-account serialization.
 * Each acquire() queues behind the previous one using a promise chain.
 */
export class Mutex {
  private _chain: Promise<void> = Promise.resolve();

  /**
   * Acquire the mutex and get a release function.
   *
   * Each call to `acquire` waits for all previous callers to release the
   * lock, then resolves with a `release` function that must be called to
   * allow the next waiter to proceed.
   *
   * Usage:
   * ```ts
   * const release = await mutex.acquire();
   * try {
   *   // critical section
   * } finally {
   *   release();
   * }
   * ```
   *
   * @returns A promise that resolves to a `release` callback once the caller
   * has exclusive access to the critical section.
   */
  acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    const current = this._chain.then(() => release);
    this._chain = this._chain.then(() => next);

    return current;
  }
}
