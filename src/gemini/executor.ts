/**
 * Low-level Gemini CLI executor.
 * @module gemini/executor
 */

import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { GeminiError } from "./errors.js";
import type { ExecuteOptions } from "./types.js";

/**
 * Low-level executor for Gemini CLI commands.
 *
 * Handles:
 * - CLI availability checking
 * - Secure prompt passing via temp files
 * - Process spawning with timeout
 * - Error parsing and classification
 *
 * @example
 * ```typescript
 * const executor = new GeminiExecutor();
 *
 * if (await executor.checkAvailable()) {
 *   const response = await executor.execute({
 *     prompt: "Explain this code",
 *     model: "gemini-2.5-flash",
 *     timeout: 60000,
 *   });
 *   console.log(response);
 * }
 * ```
 */
/** Valid Gemini models that can be used with the CLI */
const VALID_MODELS = [
  "auto",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
] as const;

export class GeminiExecutor {
  /**
   * Validate that a model name is one of the allowed values.
   * Prevents shell injection via malicious model strings.
   *
   * @param model - Model name to validate
   * @throws {GeminiError} If model is not in the allowed list
   * @internal
   */
  private validateModel(model: string): void {
    if (!VALID_MODELS.includes(model as (typeof VALID_MODELS)[number])) {
      throw new GeminiError(
        `Invalid model: ${model}. Valid models: ${VALID_MODELS.join(", ")}`,
        "INVALID_MODEL",
        { isRetryable: false },
      );
    }
  }

  /**
   * Check if Gemini CLI is available.
   *
   * @returns true if CLI is installed and accessible
   */
  async checkAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("gemini", ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        resolve(false);
      }, 5000);

      proc.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
    });
  }

  /**
   * Execute a Gemini CLI command.
   *
   * Writes prompt to a secure temp file (mode 0o600), pipes it to stdin,
   * and collects the response. Cleans up temp file in finally block.
   *
   * @param options - Execution options
   * @returns Response text from Gemini
   * @throws {GeminiError} On CLI errors, timeout, or execution failure
   */
  async execute(options: ExecuteOptions): Promise<string> {
    const { prompt, model, timeout } = options;

    // Create secure temp file for prompt
    const tempPath = join(tmpdir(), `gemini-prompt-${randomUUID()}.txt`);

    try {
      // Write prompt to temp file with secure permissions (owner read/write only)
      await writeFile(tempPath, prompt, { mode: 0o600 });

      // Execute CLI with prompt from stdin
      const response = await this.spawnGemini(tempPath, model, timeout);
      return response;
    } finally {
      // Always clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Spawn the Gemini CLI process.
   *
   * Spawns gemini directly without shell to prevent injection attacks.
   * Pipes prompt file content directly to stdin.
   *
   * @internal
   */
  private spawnGemini(
    promptFile: string,
    model: string,
    timeout: number,
  ): Promise<string> {
    // Validate model first to prevent injection
    this.validateModel(model);

    return new Promise((resolve, reject) => {
      // Build args conditionally: when model is "auto", omit -m flag to let CLI choose
      const args =
        model === "auto" ? ["-o", "text"] : ["-m", model, "-o", "text"];

      // Spawn gemini directly without shell
      const proc = spawn("gemini", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      // Set up timeout handler (only if timeout > 0)
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill("SIGTERM");
        }, timeout);
      }

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("error", (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(this.parseError(error.message, "spawn"));
      });

      proc.on("close", (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (timedOut) {
          reject(
            new GeminiError(
              `Gemini CLI timed out after ${timeout}ms`,
              "TIMEOUT",
              { isRetryable: true },
            ),
          );
          return;
        }

        if (code !== 0) {
          reject(this.parseError(stderr || `Exit code: ${code}`, "execution"));
          return;
        }

        resolve(stdout.trim());
      });

      // Read prompt file and pipe to stdin
      const stream = createReadStream(promptFile);
      stream.pipe(proc.stdin);
      stream.on("error", (err) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        proc.kill("SIGTERM");
        reject(this.parseError(err.message, "spawn"));
      });
    });
  }

  /**
   * Parse stderr or error message into a typed GeminiError.
   * @internal
   */
  private parseError(
    message: string,
    context: "spawn" | "execution",
  ): GeminiError {
    const lowerMessage = message.toLowerCase();

    // CLI not found
    if (
      lowerMessage.includes("not found") ||
      lowerMessage.includes("enoent") ||
      lowerMessage.includes("command not found")
    ) {
      return new GeminiError(
        "Gemini CLI not found. Install with: npm install -g @google/gemini-cli",
        "CLI_NOT_FOUND",
        { isRetryable: false },
      );
    }

    // Authentication required
    if (
      lowerMessage.includes("auth") ||
      lowerMessage.includes("login") ||
      lowerMessage.includes("api key") ||
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("unauthenticated")
    ) {
      return new GeminiError(
        "Gemini authentication required. Run: gemini auth login",
        "AUTH_REQUIRED",
        { isRetryable: false },
      );
    }

    // Invalid model
    if (
      lowerMessage.includes("invalid model") ||
      lowerMessage.includes("model not found") ||
      lowerMessage.includes("unknown model")
    ) {
      return new GeminiError(
        `Invalid Gemini model: ${message}`,
        "INVALID_MODEL",
        { isRetryable: false },
      );
    }

    // Timeout (already handled in spawnGemini, but for completeness)
    if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out")
    ) {
      return new GeminiError(`Gemini CLI timed out: ${message}`, "TIMEOUT", {
        isRetryable: true,
      });
    }

    // Generic execution failure
    return new GeminiError(
      `Gemini CLI ${context} failed: ${message}`,
      "EXECUTION_FAILED",
      { isRetryable: context === "execution" },
    );
  }
}
