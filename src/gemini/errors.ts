/**
 * Error handling for Gemini CLI wrapper.
 * @module gemini/errors
 */

// ============================================
// Error Codes
// ============================================

/**
 * Error codes for GeminiError.
 */
export const GeminiErrorCode = {
  /** Gemini CLI not found in PATH */
  CLI_NOT_FOUND: "CLI_NOT_FOUND",
  /** Authentication required (not logged in) */
  AUTH_REQUIRED: "AUTH_REQUIRED",
  /** Invalid model specified */
  INVALID_MODEL: "INVALID_MODEL",
  /** Operation timed out */
  TIMEOUT: "TIMEOUT",
  /** CLI execution failed */
  EXECUTION_FAILED: "EXECUTION_FAILED",
  /** File not found */
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  /** File too large to process */
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  /** Security error (path traversal, etc.) */
  SECURITY_ERROR: "SECURITY_ERROR",
} as const;

export type GeminiErrorCode =
  (typeof GeminiErrorCode)[keyof typeof GeminiErrorCode];

// ============================================
// Error Class
// ============================================

/**
 * Error class for Gemini CLI operations.
 *
 * Includes error code for programmatic handling,
 * isRetryable flag for retry logic, and preserves
 * cause for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await gemini.prompt({ prompt: "Hello" });
 * } catch (error) {
 *   if (GeminiError.isGeminiError(error)) {
 *     if (error.isRetryable) {
 *       // Retry the operation
 *     }
 *     console.error(`Error ${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export class GeminiError extends Error {
  /** Error code for programmatic handling */
  readonly code: GeminiErrorCode;

  /** Whether this error can be retried */
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: GeminiErrorCode,
    options: {
      cause?: Error;
      isRetryable?: boolean;
    } = {},
  ) {
    super(message, { cause: options.cause });

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = "GeminiError";
    this.code = code;
    this.isRetryable = options.isRetryable ?? false;
  }

  /**
   * Type guard to check if an error is a GeminiError.
   */
  static isGeminiError(error: unknown): error is GeminiError {
    return error instanceof GeminiError;
  }

  /** Check if CLI is not installed */
  get isCliNotFound(): boolean {
    return this.code === "CLI_NOT_FOUND";
  }

  /** Check if authentication is required */
  get isAuthRequired(): boolean {
    return this.code === "AUTH_REQUIRED";
  }

  /** Check if this is a timeout error */
  get isTimeout(): boolean {
    return this.code === "TIMEOUT";
  }

  /** Check if this is a security error */
  get isSecurityError(): boolean {
    return this.code === "SECURITY_ERROR";
  }

  /** Check if this is a file error */
  get isFileError(): boolean {
    return this.code === "FILE_NOT_FOUND" || this.code === "FILE_TOO_LARGE";
  }
}
