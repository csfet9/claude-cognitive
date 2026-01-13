/**
 * High-level Gemini CLI wrapper with business logic.
 * @module gemini/wrapper
 */

import { readFile, stat, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { GeminiError } from "./errors.js";
import { GeminiExecutor } from "./executor.js";
import { Semaphore } from "./semaphore.js";
import {
  DEFAULT_GEMINI_CONFIG,
  type AnalysisType,
  type GeminiConfig,
  type GeminiModel,
  type GeminiResult,
  type PromptOptions,
} from "./types.js";

/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * High-level wrapper for Gemini CLI operations.
 *
 * Provides business logic for:
 * - Prompt execution with context
 * - File reading with security validation
 * - Code analysis
 * - Research and summarization
 *
 * @example
 * ```typescript
 * const gemini = new GeminiWrapper(
 *   { model: "auto", timeout: 120000 },
 *   "/path/to/project",
 * );
 *
 * // Simple prompt
 * const result = await gemini.prompt({
 *   prompt: "Explain this concept",
 *   context: "In the context of TypeScript...",
 * });
 *
 * // Code analysis
 * const analysis = await gemini.analyzeCode(
 *   ["src/index.ts", "src/utils.ts"],
 *   "security",
 *   "authentication flow",
 * );
 *
 * // Research
 * const research = await gemini.research(
 *   "Best practices for error handling",
 *   ["src/errors.ts"],
 *   "deep",
 * );
 * ```
 */
export class GeminiWrapper {
  private readonly config: GeminiConfig;
  private readonly projectPath: string;
  private readonly executor: GeminiExecutor;
  private readonly semaphore: Semaphore;

  /**
   * Create a new GeminiWrapper.
   *
   * @param config - Gemini configuration (partial, merged with defaults)
   * @param projectPath - Project root directory for file operations
   * @param executor - Optional executor instance (for testing)
   */
  constructor(
    config: Partial<GeminiConfig> = {},
    projectPath: string,
    executor?: GeminiExecutor,
  ) {
    this.config = { ...DEFAULT_GEMINI_CONFIG, ...config };
    this.projectPath = resolve(projectPath);
    this.executor = executor ?? new GeminiExecutor();
    this.semaphore =
      this.config.maxConcurrentRequests > 0
        ? new Semaphore(this.config.maxConcurrentRequests)
        : new Semaphore(Number.MAX_SAFE_INTEGER);
  }

  /**
   * Check if Gemini CLI is available.
   *
   * @returns true if CLI is installed and accessible
   */
  async isAvailable(): Promise<boolean> {
    return this.executor.checkAvailable();
  }

  /**
   * Resolve model name (pass through, CLI handles "auto").
   *
   * @param model - Model name
   * @returns Model name as-is
   */
  resolveModel(model: GeminiModel): GeminiModel {
    return model;
  }

  /**
   * Execute a prompt with optional context.
   *
   * @param options - Prompt options
   * @returns Gemini result with response and metadata
   * @throws {GeminiError} On execution failure
   */
  async prompt(options: PromptOptions): Promise<GeminiResult> {
    const model = this.resolveModel(options.model ?? this.config.model);
    const timeout = options.timeout ?? this.config.timeout;

    // Build full prompt with context
    let fullPrompt = options.prompt;
    if (options.context) {
      fullPrompt = `${options.context}\n\n${options.prompt}`;
    }

    // Acquire semaphore slot for rate limiting
    const release = await this.semaphore.acquire();
    try {
      const startTime = Date.now();
      const response = await this.executor.execute({
        prompt: fullPrompt,
        model,
        timeout,
        ...(options.onProgress && { onProgress: options.onProgress }),
      });
      const duration = Date.now() - startTime;

      return { response, model, duration };
    } finally {
      release();
    }
  }

  /**
   * Read files with security validation.
   *
   * Validates that:
   * - Paths are within projectPath (no ".." traversal outside)
   * - Symlinks resolve to paths within project (prevents symlink attacks)
   * - Target is a regular file (not directory, device, etc.)
   * - Files exist and are readable
   * - Files are not too large (< 10MB)
   *
   * @param paths - File paths relative to project root
   * @returns Map of file path to content
   * @throws {GeminiError} On security violation or file error
   */
  async readFiles(paths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const filePath of paths) {
      // Resolve to absolute path
      const absolutePath = isAbsolute(filePath)
        ? filePath
        : resolve(this.projectPath, filePath);

      // Check file exists and get stats
      let fileStats;
      try {
        fileStats = await stat(absolutePath);
      } catch (error) {
        throw new GeminiError(`File not found: ${filePath}`, "FILE_NOT_FOUND", {
          cause: error as Error,
          isRetryable: false,
        });
      }

      // Verify it's a regular file (not directory, device, etc.)
      if (!fileStats.isFile()) {
        throw new GeminiError(
          `Not a regular file: ${filePath}`,
          "SECURITY_ERROR",
          { isRetryable: false },
        );
      }

      // Resolve symlinks to get real path
      let resolvedPath: string;
      try {
        resolvedPath = await realpath(absolutePath);
      } catch (error) {
        throw new GeminiError(
          `Cannot resolve path: ${filePath}`,
          "FILE_NOT_FOUND",
          {
            cause: error as Error,
            isRetryable: false,
          },
        );
      }

      // Security check: ensure resolved path is within project
      const relativePath = relative(this.projectPath, resolvedPath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new GeminiError(
          `Security violation: path "${filePath}" resolves outside project directory`,
          "SECURITY_ERROR",
          { isRetryable: false },
        );
      }

      // Check file size
      if (fileStats.size > MAX_FILE_SIZE) {
        throw new GeminiError(
          `File too large: ${filePath} (${Math.round(fileStats.size / 1024 / 1024)}MB > 10MB limit)`,
          "FILE_TOO_LARGE",
          { isRetryable: false },
        );
      }

      // Read file content from resolved path
      const content = await readFile(resolvedPath, "utf-8");
      results.set(filePath, content);
    }

    return results;
  }

  /**
   * Analyze code files.
   *
   * @param files - File paths to analyze (relative to project root)
   * @param type - Type of analysis to perform
   * @param focus - Optional specific focus area
   * @returns Analysis result
   * @throws {GeminiError} On file or execution error
   */
  async analyzeCode(
    files: string[],
    type: AnalysisType,
    focus?: string,
  ): Promise<GeminiResult> {
    // Read all files
    const fileContents = await this.readFiles(files);

    // Build analysis prompt
    const analysisPrompts: Record<AnalysisType, string> = {
      security:
        "Analyze the following code for security vulnerabilities. Look for injection risks, authentication issues, data exposure, and other security concerns.",
      performance:
        "Analyze the following code for performance issues. Look for inefficient algorithms, memory leaks, unnecessary computations, and optimization opportunities.",
      quality:
        "Analyze the following code for quality issues. Look for code smells, maintainability concerns, SOLID principle violations, and best practice deviations.",
      architecture:
        "Analyze the following code for architectural concerns. Look for coupling issues, separation of concerns, dependency management, and design pattern usage.",
      documentation:
        "Analyze the following code for documentation completeness. Look for missing docstrings, unclear comments, and documentation that doesn't match the code.",
      testing:
        "Analyze the following code for testability and test coverage needs. Identify untested edge cases, missing test scenarios, and testing improvements.",
      general:
        "Provide a general analysis of the following code. Identify strengths, weaknesses, and suggestions for improvement.",
    };

    let prompt = analysisPrompts[type];
    if (focus) {
      prompt += ` Focus particularly on: ${focus}`;
    }

    // Add file contents
    prompt += "\n\n";
    for (const [path, content] of fileContents) {
      prompt += `--- ${path} ---\n${content}\n\n`;
    }

    return this.prompt({ prompt });
  }

  /**
   * Research a topic with optional file context.
   *
   * @param topic - Research topic or question
   * @param files - Optional files to include as context
   * @param depth - Research depth: "shallow" | "medium" | "deep"
   * @returns Research result
   * @throws {GeminiError} On file or execution error
   */
  async research(
    topic: string,
    files?: string[],
    depth: "shallow" | "medium" | "deep" = "medium",
  ): Promise<GeminiResult> {
    const depthInstructions: Record<string, string> = {
      shallow: "Provide a brief overview with key points only.",
      medium:
        "Provide a comprehensive analysis with examples and best practices.",
      deep: "Provide an in-depth analysis with detailed explanations, examples, trade-offs, and alternative approaches.",
    };

    let prompt = `Research the following topic: ${topic}\n\n${depthInstructions[depth]}`;

    // Add file context if provided
    if (files && files.length > 0) {
      const fileContents = await this.readFiles(files);
      prompt += "\n\nContext from project files:\n";
      for (const [path, content] of fileContents) {
        prompt += `--- ${path} ---\n${content}\n\n`;
      }
    }

    return this.prompt({ prompt });
  }

  /**
   * Summarize content or files.
   *
   * @param content - Text content to summarize
   * @param files - Files to summarize (alternative to content)
   * @param format - Output format: "bullet" | "paragraph" | "technical"
   * @returns Summary result
   * @throws {GeminiError} If neither content nor files provided, or on error
   */
  async summarize(
    content?: string,
    files?: string[],
    format: "bullet" | "paragraph" | "technical" = "bullet",
  ): Promise<GeminiResult> {
    if (!content && (!files || files.length === 0)) {
      throw new GeminiError(
        "Either content or files must be provided for summarization",
        "EXECUTION_FAILED",
        { isRetryable: false },
      );
    }

    const formatInstructions: Record<string, string> = {
      bullet:
        "Provide a summary as a bulleted list with key points and takeaways.",
      paragraph:
        "Provide a summary as a cohesive paragraph that captures the main ideas.",
      technical:
        "Provide a technical summary with implementation details, APIs, and architectural decisions highlighted.",
    };

    let prompt = `Summarize the following. ${formatInstructions[format]}\n\n`;

    if (content) {
      prompt += content;
    } else if (files) {
      const fileContents = await this.readFiles(files);
      for (const [path, fileContent] of fileContents) {
        prompt += `--- ${path} ---\n${fileContent}\n\n`;
      }
    }

    return this.prompt({ prompt });
  }
}
