/**
 * Configuration loading for claude-cognitive.
 * Uses Zod schemas for validation and deep merging.
 * @module config
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type {
  ClaudeMindConfig,
  RetainFilterConfig,
  SecurityReviewConfig,
} from "./types.js";
import { DEFAULT_GEMINI_CONFIG, type GeminiModel } from "./gemini/types.js";

// ============================================
// Zod Schemas
// ============================================

const traitValueSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const dispositionSchema = z.object({
  skepticism: traitValueSchema,
  literalism: traitValueSchema,
  empathy: traitValueSchema,
});

const timeoutConfigSchema = z.object({
  default: z.number(),
  health: z.number(),
  recall: z.number(),
  reflect: z.number(),
  retain: z.number(),
});

const hindsightSchema = z.object({
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  apiKey: z.string().optional(),
  timeout: z.number().optional(),
  timeouts: timeoutConfigSchema.partial().optional(),
});

const semanticSchema = z.object({
  path: z.string(),
});

const retainFilterSchema = z.object({
  maxTranscriptLength: z.number().optional(),
  filterToolResults: z.boolean().optional(),
  filterFileContents: z.boolean().optional(),
  maxCodeBlockLines: z.number().optional(),
  maxLineLength: z.number().optional(),
  minSessionLength: z.number().optional(),
  skipToolOnlySessions: z.boolean().optional(),
  customSkipPatterns: z.array(z.string()).optional(),
});

const securityReviewSchema = z.object({
  enabled: z.boolean(),
  model: z.enum(["opus", "sonnet", "haiku"]).optional(),
  blockOnCritical: z.boolean().optional(),
  codeExtensions: z.array(z.string()).optional(),
});

const contextSchema = z.object({
  recentMemoryLimit: z.number().optional(),
});

const geminiSchema = z.object({
  model: z.string(),
  timeout: z.number(),
  maxConcurrentRequests: z.number().default(1),
});

/** Full config schema — used for final validation. */
const configSchema = z.object({
  hindsight: hindsightSchema,
  bankId: z.string().optional(),
  disposition: dispositionSchema.optional(),
  background: z.string().optional(),
  semantic: semanticSchema.optional(),
  retainFilter: retainFilterSchema.optional(),
  context: contextSchema.optional(),
  securityReview: securityReviewSchema.optional(),
  gemini: geminiSchema.optional(),
});

// ============================================
// Defaults
// ============================================

/**
 * Default retain filter configuration.
 * Controls what transcript content gets filtered before retention.
 */
export const DEFAULT_RETAIN_FILTER: RetainFilterConfig = {
  maxTranscriptLength: 25000,
  filterToolResults: true,
  filterFileContents: true,
  maxCodeBlockLines: 30,
  maxLineLength: 1000,
  minSessionLength: 500,
  skipToolOnlySessions: true,
};

/**
 * Default security review configuration.
 * Disabled by default (opt-in feature).
 */
export const DEFAULT_SECURITY_REVIEW_CONFIG: SecurityReviewConfig = {
  enabled: false,
  model: "opus",
  blockOnCritical: true,
  codeExtensions: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".rb",
  ],
};

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: ClaudeMindConfig = {
  hindsight: {
    host: "localhost",
    port: 8888,
    timeout: 10000,
  },
  semantic: {
    path: ".claude/memory.md",
  },
  retainFilter: DEFAULT_RETAIN_FILTER,
  securityReview: DEFAULT_SECURITY_REVIEW_CONFIG,
};

// ============================================
// Partial Config Type
// ============================================

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type PartialConfig = DeepPartial<ClaudeMindConfig>;

// ============================================
// Deep Merge Utility
// ============================================

/**
 * Check if a value is a plain object (not array, null, etc.).
 * @internal
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep merge two plain objects. Source values override target values.
 * Arrays are replaced, not merged.
 * @internal
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

// ============================================
// File Loaders
// ============================================

/**
 * Safely read and parse a JSON file.
 * Returns undefined if file doesn't exist or is invalid JSON.
 * @internal
 */
async function readJsonFile(path: string): Promise<unknown | undefined> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Load configuration from package.json "claudemind" key.
 * @internal
 */
async function loadPackageJsonConfig(
  projectPath: string,
): Promise<PartialConfig | undefined> {
  const pkgPath = join(projectPath, "package.json");
  const pkg = await readJsonFile(pkgPath);

  if (isPlainObject(pkg) && isPlainObject(pkg["claudemind"])) {
    return pkg["claudemind"] as PartialConfig;
  }

  return undefined;
}

/**
 * Load configuration from .claudemindrc file.
 * @internal
 */
async function loadRcConfig(
  projectPath: string,
): Promise<PartialConfig | undefined> {
  const rcPath = join(projectPath, ".claudemindrc");
  const rc = await readJsonFile(rcPath);

  if (isPlainObject(rc)) {
    return rc as PartialConfig;
  }

  return undefined;
}

// ============================================
// Environment Variables
// ============================================

/**
 * Build a partial config from environment variables.
 * @internal
 */
function getEnvConfig(): PartialConfig {
  const partial: PartialConfig = {};

  // Hindsight connection settings
  const host = process.env["HINDSIGHT_HOST"];
  if (host) {
    partial.hindsight = { ...partial.hindsight, host };
  }

  const port = process.env["HINDSIGHT_PORT"];
  if (port) {
    const parsed = parseInt(port, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      partial.hindsight = { ...partial.hindsight, port: parsed };
    }
  }

  const apiKey = process.env["HINDSIGHT_API_KEY"];
  if (apiKey) {
    partial.hindsight = { ...partial.hindsight, apiKey };
  }

  // Bank settings
  const bankId = process.env["CLAUDEMIND_BANK_ID"];
  if (bankId) {
    partial.bankId = bankId;
  }

  // Gemini settings
  const geminiModel = process.env["GEMINI_MODEL"];
  if (geminiModel) {
    partial.gemini = {
      ...DEFAULT_GEMINI_CONFIG,
      model: geminiModel as GeminiModel,
    };
  }

  return partial;
}

// ============================================
// Public API
// ============================================

/**
 * Load configuration from multiple sources with priority order:
 *
 * 1. Constructor overrides (highest priority)
 * 2. Environment variables
 * 3. .claudemindrc file
 * 4. package.json "claudemind" key
 * 5. Default values (lowest priority)
 *
 * @param projectPath - Root directory of the project (default: process.cwd())
 * @param overrides - Explicit configuration overrides
 * @returns Merged configuration
 *
 * @example
 * ```typescript
 * // Load from current directory with defaults
 * const config = await loadConfig();
 *
 * // Load from specific directory with overrides
 * const config = await loadConfig('/path/to/project', {
 *   hindsight: { host: 'hindsight.example.com' }
 * });
 * ```
 */
export async function loadConfig(
  projectPath: string = process.cwd(),
  overrides?: PartialConfig,
): Promise<ClaudeMindConfig> {
  // Collect all config sources (lowest to highest priority)
  const sources: PartialConfig[] = [];

  const pkgConfig = await loadPackageJsonConfig(projectPath);
  if (pkgConfig) {
    sources.push(pkgConfig);
  }

  const rcConfig = await loadRcConfig(projectPath);
  if (rcConfig) {
    sources.push(rcConfig);
  }

  const envConfig = getEnvConfig();
  if (Object.keys(envConfig).length > 0) {
    sources.push(envConfig);
  }

  if (overrides) {
    sources.push(overrides);
  }

  // Start with defaults and merge all sources in priority order
  let merged: Record<string, unknown> = structuredClone(
    DEFAULT_CONFIG,
  ) as unknown as Record<string, unknown>;
  for (const source of sources) {
    merged = deepMerge(merged, source as unknown as Record<string, unknown>);
  }

  // Validate the final merged config with Zod
  const parseResult = configSchema.safeParse(merged);

  if (!parseResult.success) {
    // Check for disposition errors specifically to preserve error message
    const dispositionError = parseResult.error.issues.find((issue) =>
      issue.path.includes("disposition"),
    );
    if (dispositionError) {
      throw new Error(
        "Invalid disposition in configuration: values must be integers between 1 and 5",
      );
    }
    throw new Error(
      `Invalid configuration: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
    );
  }

  return parseResult.data as ClaudeMindConfig;
}

/**
 * Get default configuration without loading from files.
 * Useful for testing or when you want explicit control.
 */
export function getDefaultConfig(): ClaudeMindConfig {
  return structuredClone(DEFAULT_CONFIG);
}
