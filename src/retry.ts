/**
 * Retry logic with exponential backoff for claude-cognitive.
 * @module retry
 */

import { HindsightError } from "./errors.js";

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelayMs: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter: boolean;
  /**
   * Custom function to determine if error is retryable.
   * If not provided, uses HindsightError.isRetryable or defaults to false.
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /**
   * Callback invoked before each retry attempt.
   * Useful for logging or metrics.
   */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Sleep for a given number of milliseconds.
 * @internal
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable using default logic.
 * @internal
 */
function isDefaultRetryable(error: Error): boolean {
  // Check for HindsightError.isRetryable
  if (HindsightError.isHindsightError(error)) {
    return error.isRetryable;
  }

  // Retry on timeout errors
  if (error.name === "TimeoutError") {
    return true;
  }

  // Don't retry unknown errors by default
  return false;
}

/**
 * Calculate delay for a given attempt with exponential backoff.
 * @internal
 */
function calculateDelay(attempt: number, opts: RetryOptions): number {
  // Exponential: initialDelay * multiplier^(attempt-1)
  const exponentialDelay =
    opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);

  // Add jitter (0-50% of delay) to prevent thundering herd
  if (opts.jitter) {
    const jitterRange = cappedDelay * 0.5;
    return Math.floor(cappedDelay + Math.random() * jitterRange);
  }

  return cappedDelay;
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * Retries are attempted when:
 * 1. The error has `isRetryable: true` (for HindsightError)
 * 2. The custom `shouldRetry` function returns true
 * 3. The error is a TimeoutError
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => client.recall(bankId, query),
 *   { maxAttempts: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isRetryable = opts.shouldRetry
        ? opts.shouldRetry(lastError, attempt)
        : isDefaultRetryable(lastError);

      // If not retryable or last attempt, throw immediately
      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, opts);

      // Invoke onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt, delay);
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error("Retry failed");
}

/**
 * Create a retryable version of an async function.
 *
 * @param fn - The async function to wrap
 * @param options - Retry configuration options
 * @returns A wrapped function that automatically retries on failure
 *
 * @example
 * ```typescript
 * const retryableRecall = createRetryable(
 *   (query: string) => client.recall(bankId, query),
 *   { maxAttempts: 3 }
 * );
 *
 * const result = await retryableRecall('authentication flow');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: Partial<RetryOptions> = {},
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
