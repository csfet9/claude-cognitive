/**
 * Configuration loading for claude-cognitive.
 * @module config
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ClaudeMindConfig,
  Disposition,
  RetainFilterConfig,
  SecurityReviewConfig,
} from "./types.js";

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

/**
 * Partial configuration for merging.
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type PartialConfig = DeepPartial<ClaudeMindConfig>;

/**
 * Check if a value is a plain object (not array, null, etc.).
 * @internal
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep merge configuration objects.
 * @internal
 */
function mergeConfig(
  target: ClaudeMindConfig,
  source: PartialConfig,
): ClaudeMindConfig {
  const result: ClaudeMindConfig = {
    hindsight: { ...target.hindsight },
  };

  // Copy optional fields from target only if defined
  if (target.semantic !== undefined) {
    result.semantic = { ...target.semantic };
  }
  if (target.bankId !== undefined) {
    result.bankId = target.bankId;
  }
  if (target.disposition !== undefined) {
    result.disposition = target.disposition;
  }
  if (target.background !== undefined) {
    result.background = target.background;
  }
  if (target.retainFilter !== undefined) {
    result.retainFilter = { ...target.retainFilter };
  }
  if (target.context !== undefined) {
    result.context = { ...target.context };
  }
  if (target.feedback !== undefined) {
    result.feedback = { ...target.feedback };
  }
  if (target.securityReview !== undefined) {
    result.securityReview = { ...target.securityReview };
  }

  // Merge hindsight settings
  if (source.hindsight) {
    if (source.hindsight.host !== undefined) {
      result.hindsight.host = source.hindsight.host;
    }
    if (source.hindsight.port !== undefined) {
      result.hindsight.port = source.hindsight.port;
    }
    if (source.hindsight.apiKey !== undefined) {
      result.hindsight.apiKey = source.hindsight.apiKey;
    }
    if (source.hindsight.timeout !== undefined) {
      result.hindsight.timeout = source.hindsight.timeout;
    }
    if (source.hindsight.timeouts !== undefined) {
      result.hindsight.timeouts = {
        ...result.hindsight.timeouts,
        ...source.hindsight.timeouts,
      };
    }
  }

  // Merge semantic settings
  if (source.semantic) {
    if (!result.semantic) {
      result.semantic = { path: ".claude/memory.md" };
    }
    if (source.semantic.path !== undefined) {
      result.semantic.path = source.semantic.path;
    }
  }

  // Merge top-level optional fields
  if (source.bankId !== undefined) {
    result.bankId = source.bankId;
  }
  if (source.disposition !== undefined) {
    result.disposition = source.disposition;
  }
  if (source.background !== undefined) {
    result.background = source.background;
  }

  // Merge retainFilter settings
  if (source.retainFilter !== undefined) {
    result.retainFilter = {
      ...result.retainFilter,
      ...source.retainFilter,
    };
  }

  // Merge context settings
  if (source.context !== undefined) {
    result.context = {
      ...result.context,
      ...source.context,
    };
  }

  // Merge feedback settings
  if (source.feedback !== undefined) {
    result.feedback = {
      ...result.feedback,
      ...source.feedback,
    } as typeof source.feedback;
  }

  // Merge securityReview settings
  if (source.securityReview !== undefined) {
    result.securityReview = {
      ...result.securityReview,
      ...source.securityReview,
    };
  }

  return result;
}

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

/**
 * Apply environment variable overrides to config.
 * @internal
 */
function applyEnvConfig(config: ClaudeMindConfig): ClaudeMindConfig {
  const result: ClaudeMindConfig = {
    hindsight: { ...config.hindsight },
  };

  // Copy optional fields from config only if defined
  if (config.semantic !== undefined) {
    result.semantic = { ...config.semantic };
  }
  if (config.bankId !== undefined) {
    result.bankId = config.bankId;
  }
  if (config.disposition !== undefined) {
    result.disposition = config.disposition;
  }
  if (config.background !== undefined) {
    result.background = config.background;
  }
  if (config.retainFilter !== undefined) {
    result.retainFilter = { ...config.retainFilter };
  }
  if (config.context !== undefined) {
    result.context = { ...config.context };
  }
  if (config.feedback !== undefined) {
    result.feedback = { ...config.feedback };
  }
  if (config.securityReview !== undefined) {
    result.securityReview = { ...config.securityReview };
  }

  // Hindsight connection settings
  const host = process.env["HINDSIGHT_HOST"];
  if (host) {
    result.hindsight.host = host;
  }

  const port = process.env["HINDSIGHT_PORT"];
  if (port) {
    const parsed = parseInt(port, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      result.hindsight.port = parsed;
    }
  }

  const apiKey = process.env["HINDSIGHT_API_KEY"];
  if (apiKey) {
    result.hindsight.apiKey = apiKey;
  }

  // Bank settings
  const bankId = process.env["CLAUDEMIND_BANK_ID"];
  if (bankId) {
    result.bankId = bankId;
  }

  return result;
}

/**
 * Validate disposition values are in valid range.
 * @internal
 */
function validateDisposition(disposition: unknown): disposition is Disposition {
  if (!isPlainObject(disposition)) {
    return false;
  }

  const traits = ["skepticism", "literalism", "empathy"] as const;
  for (const trait of traits) {
    const value = disposition[trait];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 5
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Clone a configuration object.
 * @internal
 */
function cloneConfig(config: ClaudeMindConfig): ClaudeMindConfig {
  const result: ClaudeMindConfig = {
    hindsight: { ...config.hindsight },
  };

  if (config.semantic !== undefined) {
    result.semantic = { ...config.semantic };
  }
  if (config.bankId !== undefined) {
    result.bankId = config.bankId;
  }
  if (config.disposition !== undefined) {
    result.disposition = { ...config.disposition };
  }
  if (config.background !== undefined) {
    result.background = config.background;
  }
  if (config.retainFilter !== undefined) {
    result.retainFilter = { ...config.retainFilter };
  }
  if (config.context !== undefined) {
    result.context = { ...config.context };
  }
  if (config.feedback !== undefined) {
    result.feedback = { ...config.feedback };
  }
  if (config.securityReview !== undefined) {
    result.securityReview = { ...config.securityReview };
  }

  return result;
}

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
  // Start with defaults
  let config: ClaudeMindConfig = cloneConfig(DEFAULT_CONFIG);

  // Load from package.json "claudemind" key (lowest priority file config)
  const pkgConfig = await loadPackageJsonConfig(projectPath);
  if (pkgConfig) {
    config = mergeConfig(config, pkgConfig);
  }

  // Load from .claudemindrc (higher priority than package.json)
  const rcConfig = await loadRcConfig(projectPath);
  if (rcConfig) {
    config = mergeConfig(config, rcConfig);
  }

  // Apply environment variables (higher priority than files)
  config = applyEnvConfig(config);

  // Apply explicit overrides (highest priority)
  if (overrides) {
    config = mergeConfig(config, overrides);
  }

  // Validate disposition if present
  if (config.disposition && !validateDisposition(config.disposition)) {
    throw new Error(
      "Invalid disposition in configuration: values must be integers between 1 and 5",
    );
  }

  return config;
}

/**
 * Get default configuration without loading from files.
 * Useful for testing or when you want explicit control.
 */
export function getDefaultConfig(): ClaudeMindConfig {
  return cloneConfig(DEFAULT_CONFIG);
}
