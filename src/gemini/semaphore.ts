/**
 * Async semaphore for controlling concurrent operations.
 * @module gemini/semaphore
 */

/**
 * Async semaphore that limits concurrent operations.
 *
 * Provides a classic semaphore pattern for Node.js async operations.
 * When all slots are occupied, acquire() returns a promise that resolves
 * when a slot becomes available (FIFO order).
 *
 * @example
 * ```typescript
 * const semaphore = new Semaphore(3); // Max 3 concurrent
 *
 * async function doWork(id: number) {
 *   const release = await semaphore.acquire();
 *   try {
 *     console.log(`Task ${id} started`);
 *     await someAsyncOperation();
 *   } finally {
 *     release(); // Always release, even on error
 *   }
 * }
 * ```
 */
export class Semaphore {
  /** Number of available slots */
  private available: number;

  /** Queue of waiting acquire() calls (FIFO) */
  private readonly waiting: Array<() => void> = [];

  /**
   * Create a new semaphore.
   *
   * @param maxConcurrent - Maximum number of concurrent operations allowed
   * @throws {Error} If maxConcurrent is less than 1
   */
  constructor(private readonly maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error(
        `Semaphore maxConcurrent must be >= 1, got: ${maxConcurrent}`,
      );
    }
    this.available = maxConcurrent;
  }

  /**
   * Acquire a semaphore slot.
   *
   * Returns immediately if a slot is available, otherwise waits until
   * another operation releases a slot. Slots are granted in FIFO order.
   *
   * @returns Promise that resolves to a release function. MUST call
   *          the release function when operation completes (use finally).
   */
  acquire(): Promise<() => void> {
    // If slot available, return immediately (synchronous fast path)
    if (this.available > 0) {
      this.available--;
      return Promise.resolve(() => this.release());
    }

    // No slots available, queue and wait
    return new Promise<() => void>((resolve) => {
      this.waiting.push(() => {
        resolve(() => this.release());
      });
    });
  }

  /**
   * Release a semaphore slot.
   * @internal - Called via release function returned by acquire()
   */
  private release(): void {
    // If someone is waiting, wake them up immediately
    const nextWaiting = this.waiting.shift();
    if (nextWaiting) {
      nextWaiting();
      return;
    }

    // No one waiting, make slot available
    this.available++;

    // Safety check: should never exceed max
    if (this.available > this.maxConcurrent) {
      throw new Error(
        `Semaphore corrupted: available (${this.available}) > max (${this.maxConcurrent})`,
      );
    }
  }

  /**
   * Get current number of available slots.
   */
  get availableSlots(): number {
    return this.available;
  }

  /**
   * Get number of operations waiting for a slot.
   */
  get queueLength(): number {
    return this.waiting.length;
  }
}
