/**
 * Type definitions for Gemini CLI wrapper.
 * @module gemini/types
 */

// ============================================
// Model Types
// ============================================

/**
 * Available Gemini models.
 * "auto" lets the Gemini CLI choose the best model automatically.
 */
export type GeminiModel =
  | "auto"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-2.0-flash";

// ============================================
// Configuration Types
// ============================================

/**
 * Configuration for Gemini CLI wrapper.
 */
export interface GeminiConfig {
  /** Model to use (default: "auto") */
  model: GeminiModel;
  /** Timeout in milliseconds for CLI execution (0 = no timeout, default: 0) */
  timeout: number;
}

/**
 * Default configuration for Gemini CLI wrapper.
 */
export const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  model: "auto",
  timeout: 0, // 0 = no timeout, wait indefinitely
};

// ============================================
// Execution Types
// ============================================

/**
 * Options for low-level CLI execution.
 */
export interface ExecuteOptions {
  /** The prompt to send to Gemini */
  prompt: string;
  /** Model to use (including "auto" which lets CLI choose) */
  model: GeminiModel;
  /** Timeout in milliseconds */
  timeout: number;
}

/**
 * Options for high-level prompt operation.
 */
export interface PromptOptions {
  /** The prompt to send to Gemini */
  prompt: string;
  /** Optional additional context to prepend */
  context?: string;
  /** Model override (default: from config) */
  model?: GeminiModel;
  /** Timeout override (default: from config) */
  timeout?: number;
}

/**
 * Result from Gemini operations.
 */
export interface GeminiResult {
  /** The response text from Gemini */
  response: string;
  /** Model that was used (may be "auto" if CLI chose automatically) */
  model: GeminiModel;
  /** Execution duration in milliseconds */
  duration: number;
}

// ============================================
// Analysis Types
// ============================================

/**
 * Types of code analysis supported.
 */
export type AnalysisType =
  | "security"
  | "performance"
  | "quality"
  | "architecture"
  | "documentation"
  | "testing"
  | "general";

/**
 * Options for code analysis.
 */
export interface AnalyzeOptions {
  /** Files to analyze (relative paths from project root) */
  files: string[];
  /** Type of analysis to perform */
  type: AnalysisType;
  /** Optional specific focus area */
  focus?: string;
  /** Model override */
  model?: GeminiModel;
  /** Timeout override */
  timeout?: number;
}

/**
 * Options for research operation.
 */
export interface ResearchOptions {
  /** Research topic or question */
  topic: string;
  /** Optional files to include as context */
  files?: string[];
  /** Research depth: "shallow" | "medium" | "deep" (default: "medium") */
  depth?: "shallow" | "medium" | "deep";
  /** Model override */
  model?: GeminiModel;
  /** Timeout override */
  timeout?: number;
}

/**
 * Options for summarization operation.
 */
export interface SummarizeOptions {
  /** Content to summarize (either content or files required) */
  content?: string;
  /** Files to summarize (either content or files required) */
  files?: string[];
  /** Output format: "bullet" | "paragraph" | "technical" (default: "bullet") */
  format?: "bullet" | "paragraph" | "technical";
  /** Model override */
  model?: GeminiModel;
  /** Timeout override */
  timeout?: number;
}
