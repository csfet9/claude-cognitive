/**
 * Gemini CLI wrapper module.
 *
 * Provides a TypeScript wrapper around the Gemini CLI for
 * code analysis, research, and AI-powered operations.
 *
 * @module gemini
 *
 * @example
 * ```typescript
 * import { GeminiWrapper, GeminiError } from "./gemini/index.js";
 *
 * const gemini = new GeminiWrapper(
 *   { model: "auto", timeout: 120000 },
 *   process.cwd(),
 * );
 *
 * // Check availability
 * if (await gemini.isAvailable()) {
 *   // Execute prompt
 *   const result = await gemini.prompt({
 *     prompt: "Explain this concept",
 *   });
 *   console.log(result.response);
 *
 *   // Analyze code
 *   const analysis = await gemini.analyzeCode(
 *     ["src/index.ts"],
 *     "security",
 *   );
 *   console.log(analysis.response);
 * }
 * ```
 */

// Types
export type {
  GeminiModel,
  GeminiConfig,
  ExecuteOptions,
  PromptOptions,
  GeminiResult,
  AnalysisType,
  AnalyzeOptions,
  ResearchOptions,
  SummarizeOptions,
  ProgressCallback,
} from "./types.js";

export { DEFAULT_GEMINI_CONFIG } from "./types.js";

// Errors
export type { GeminiErrorCode } from "./errors.js";
export { GeminiError } from "./errors.js";

// Executor
export { GeminiExecutor } from "./executor.js";

// Wrapper
export { GeminiWrapper } from "./wrapper.js";

// Semaphore
export { Semaphore } from "./semaphore.js";
