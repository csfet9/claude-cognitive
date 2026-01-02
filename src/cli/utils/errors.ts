/**
 * CLI error handling utilities.
 * @module cli/utils/errors
 */

// ============================================
// Exit Codes
// ============================================

/**
 * CLI exit codes.
 */
export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_ERROR: 2,
  CONNECTION_ERROR: 3,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

// ============================================
// CLI Error Class
// ============================================

/**
 * CLI-specific error with exit code and optional hint.
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = ExitCode.GENERAL_ERROR,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "CLIError";
  }
}

// ============================================
// Error Handler
// ============================================

/**
 * Handle CLI errors consistently.
 *
 * @param error - The error to handle
 * @param options - Output options
 */
export function handleError(
  error: unknown,
  options: { json?: boolean } = {},
): never {
  const cliError =
    error instanceof CLIError
      ? error
      : new CLIError(
          error instanceof Error ? error.message : String(error),
          ExitCode.GENERAL_ERROR,
        );

  if (options.json) {
    console.error(
      JSON.stringify({
        error: cliError.message,
        code: cliError.code,
        hint: cliError.hint,
      }),
    );
  } else {
    console.error(`Error: ${cliError.message}`);
    if (cliError.hint) {
      console.error(`Hint: ${cliError.hint}`);
    }
  }

  process.exit(cliError.code);
}

/**
 * Wrap an async function with error handling.
 *
 * @param fn - The function to wrap
 * @param options - Output options
 * @returns Wrapped function
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options: { json?: boolean } = {},
): (...args: T) => Promise<R | never> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, options);
    }
  };
}
