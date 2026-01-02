/**
 * Error handling for claude-cognitive Hindsight client.
 * @module errors
 */

import type { HindsightErrorCode } from "./types.js";

/**
 * Base error class for all Hindsight-related errors.
 *
 * Includes error code for programmatic handling,
 * isRetryable flag for retry logic, and preserves
 * cause for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await client.recall(bankId, query);
 * } catch (error) {
 *   if (HindsightError.isHindsightError(error)) {
 *     if (error.isRetryable) {
 *       // Retry the operation
 *     }
 *     console.error(`Error ${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export class HindsightError extends Error {
  /** Error code for programmatic handling */
  readonly code: HindsightErrorCode;

  /** Whether this error can be retried */
  readonly isRetryable: boolean;

  /** HTTP status code if this was an HTTP error */
  readonly statusCode?: number;

  constructor(
    message: string,
    code: HindsightErrorCode,
    options: {
      cause?: Error;
      isRetryable?: boolean;
      statusCode?: number;
    } = {},
  ) {
    super(message, { cause: options.cause });

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = "HindsightError";
    this.code = code;
    this.isRetryable = options.isRetryable ?? false;
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
  }

  /**
   * Type guard to check if an error is a HindsightError.
   */
  static isHindsightError(error: unknown): error is HindsightError {
    return error instanceof HindsightError;
  }

  /** Check if Hindsight server is unavailable */
  get isUnavailable(): boolean {
    return this.code === "HINDSIGHT_UNAVAILABLE";
  }

  /** Check if bank was not found */
  get isBankNotFound(): boolean {
    return this.code === "BANK_NOT_FOUND";
  }

  /** Check if this is a validation error */
  get isValidationError(): boolean {
    return (
      this.code === "VALIDATION_ERROR" || this.code === "INVALID_DISPOSITION"
    );
  }

  /** Check if this is a timeout error */
  get isTimeout(): boolean {
    return this.code === "CONNECTION_TIMEOUT";
  }
}

/**
 * Extract error message from an API response body.
 * @internal
 */
export function extractErrorMessage(body: unknown): string | undefined {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj["message"] === "string") {
      return obj["message"];
    }
    if (typeof obj["error"] === "string") {
      return obj["error"];
    }
  }

  return undefined;
}

/**
 * Parse Retry-After header value to milliseconds.
 * @internal
 */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  // Try parsing as seconds (integer)
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : undefined;
  }

  return undefined;
}

/**
 * Create a HindsightError from an HTTP response.
 * @internal
 */
export function createErrorFromResponse(
  response: Response,
  body: unknown,
  path: string,
): HindsightError {
  const status = response.status;
  const message =
    extractErrorMessage(body) || response.statusText || "Request failed";

  switch (status) {
    case 400:
      return new HindsightError(`Bad request: ${message}`, "VALIDATION_ERROR", {
        statusCode: status,
        isRetryable: false,
      });

    case 401:
    case 403:
      return new HindsightError(
        `Authentication failed: ${message}`,
        "VALIDATION_ERROR",
        { statusCode: status, isRetryable: false },
      );

    case 404:
      // Check if this is a bank not found error
      if (path.includes("/banks/")) {
        return new HindsightError(
          `Bank not found: ${message}`,
          "BANK_NOT_FOUND",
          {
            statusCode: 404,
            isRetryable: false,
          },
        );
      }
      return new HindsightError(`Not found: ${message}`, "VALIDATION_ERROR", {
        statusCode: 404,
        isRetryable: false,
      });

    case 422:
      // Check if this is a disposition validation error
      if (message.toLowerCase().includes("disposition")) {
        return new HindsightError(
          `Invalid disposition: ${message}`,
          "INVALID_DISPOSITION",
          { statusCode: 422, isRetryable: false },
        );
      }
      return new HindsightError(
        `Validation failed: ${message}`,
        "VALIDATION_ERROR",
        { statusCode: 422, isRetryable: false },
      );

    case 429:
      return new HindsightError(`Rate limited: ${message}`, "RATE_LIMITED", {
        statusCode: 429,
        isRetryable: true,
      });

    case 500:
    case 502:
    case 503:
    case 504:
      return new HindsightError(
        `Server error (${status}): ${message}`,
        "SERVER_ERROR",
        { statusCode: status, isRetryable: true },
      );

    default:
      if (status >= 500) {
        return new HindsightError(
          `Server error (${status}): ${message}`,
          "SERVER_ERROR",
          { statusCode: status, isRetryable: true },
        );
      }
      return new HindsightError(
        `HTTP error (${status}): ${message}`,
        "UNKNOWN_ERROR",
        { statusCode: status, isRetryable: false },
      );
  }
}

/**
 * Create a HindsightError from a network failure.
 * @internal
 */
export function createErrorFromNetworkFailure(error: Error): HindsightError {
  // Timeout via AbortSignal.timeout()
  if (error.name === "TimeoutError") {
    return new HindsightError("Request timed out", "CONNECTION_TIMEOUT", {
      cause: error,
      isRetryable: true,
    });
  }

  // User-initiated abort
  if (error.name === "AbortError") {
    return new HindsightError("Request was cancelled", "UNKNOWN_ERROR", {
      cause: error,
      isRetryable: false,
    });
  }

  // Network failure (DNS, connection refused, etc.)
  const message = error.message.toLowerCase();
  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return new HindsightError(
      "Cannot connect to Hindsight server",
      "HINDSIGHT_UNAVAILABLE",
      { cause: error, isRetryable: true },
    );
  }

  // Unknown error
  return new HindsightError(
    `Network error: ${error.message}`,
    "HINDSIGHT_UNAVAILABLE",
    { cause: error, isRetryable: true },
  );
}
