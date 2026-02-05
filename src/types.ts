/**
 * Type definitions for claude-cognitive Hindsight client.
 * @module types
 */

import type { GeminiConfig as GeminiConfigType } from "./gemini/types.js";

// Re-export GeminiConfig for external use
export type { GeminiConfig } from "./gemini/types.js";

// Alias for internal use
type GeminiConfig = GeminiConfigType;

// ============================================
// Error Codes
// ============================================

/**
 * Error codes for HindsightError.
 * These match the codes documented in API.md.
 */
export const HindsightErrorCode = {
  /** Cannot connect to Hindsight server */
  HINDSIGHT_UNAVAILABLE: "HINDSIGHT_UNAVAILABLE",
  /** Request timed out */
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
  /** Bank ID doesn't exist */
  BANK_NOT_FOUND: "BANK_NOT_FOUND",
  /** Disposition values not 1-5 */
  INVALID_DISPOSITION: "INVALID_DISPOSITION",
  /** Bad request or validation error */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** Rate limited by server */
  RATE_LIMITED: "RATE_LIMITED",
  /** Server error (5xx) */
  SERVER_ERROR: "SERVER_ERROR",
  /** Unknown error */
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type HindsightErrorCode =
  (typeof HindsightErrorCode)[keyof typeof HindsightErrorCode];

// ============================================
// Disposition Types
// ============================================

/** Valid trait values: 1 (low) to 5 (high) */
export type TraitValue = 1 | 2 | 3 | 4 | 5;

/**
 * Bank personality traits that influence reflect() behavior.
 * Each trait is a value from 1-5.
 */
export interface Disposition {
  /** 1=trusting, 5=questions claims and looks for inconsistencies */
  skepticism: TraitValue;
  /** 1=flexible interpretation, 5=precise/literal */
  literalism: TraitValue;
  /** 1=fact-focused, 5=considers emotional context */
  empathy: TraitValue;
}

// ============================================
// Bank Types
// ============================================

/** Options for creating a new memory bank */
export interface BankOptions {
  /** Unique identifier for the bank */
  bankId: string;
  /** Personality traits for the bank */
  disposition: Disposition;
  /** Natural language background/identity description */
  background?: string;
}

/** Memory bank information */
export interface Bank {
  /** Unique identifier */
  bankId: string;
  /** Personality traits */
  disposition: Disposition;
  /** Natural language background/identity */
  background?: string;
  /** When the bank was created (ISO 8601) */
  createdAt: string;
  /** Total number of memories stored */
  memoryCount: number;
}

// ============================================
// Memory Types
// ============================================

/** Memory classification types */
export type FactType = "world" | "experience" | "opinion" | "observation";

/** Entity types in the knowledge graph */
export type EntityType = "person" | "component" | "file" | "concept";

/** Co-occurrence relationship between entities */
export interface CoOccurrence {
  /** Related entity ID */
  entityId: string;
  /** Number of times entities appeared together */
  count: number;
}

/** Entity in the knowledge graph */
export interface Entity {
  /** Unique entity identifier */
  id: string;
  /** Canonical entity name */
  name: string;
  /** Alternative names for this entity */
  aliases: string[];
  /** Entity classification */
  type: EntityType;
  /** Entities that frequently appear with this one */
  coOccurrences: CoOccurrence[];
}

/**
 * A memory unit stored in Hindsight.
 * Contains the content, 5-dimension extraction, and metadata.
 */
export interface Memory {
  /** Unique memory identifier */
  id: string;
  /** The actual memory content */
  text: string;
  /** Classification of the memory */
  factType: FactType;
  /** Optional context that was provided when storing */
  context?: string;

  // 5-dimension extraction (populated by Hindsight LLM)
  /** Complete description of what happened */
  what?: string;
  /** Temporal context (dates, times, durations) */
  when?: string;
  /** Location context (files, paths, lines) */
  where?: string;
  /** Entities involved (people, components, concepts) */
  who?: string[];
  /** Motivation and reasoning */
  why?: string;

  // Metadata
  /** When the memory was stored (ISO 8601) */
  createdAt: string;
  /** When the event started (if different from storage) */
  occurredStart?: string;
  /** When the event ended */
  occurredEnd?: string;

  // For opinion type
  /** Confidence score (0.0-1.0) for opinions */
  confidence?: number;

  // Entity links
  /** Entities extracted from this memory */
  entities?: Entity[];

  // Causal links
  /** Memory IDs this memory causes */
  causes?: string[];
  /** Memory IDs that caused this memory */
  causedBy?: string[];
  /** Memory IDs this memory enables */
  enables?: string[];
  /** Memory IDs this memory prevents */
  prevents?: string[];
}

// ============================================
// Recall Types
// ============================================

/** Search budget affecting thoroughness */
export type RecallBudget = "low" | "mid" | "high";

/** Filter options for recall() - used internally by Mind */
export interface RecallOptions {
  /**
   * Search thoroughness:
   * - low: ~2048 tokens, 1 graph hop
   * - mid: ~4096 tokens, 2 graph hops (default)
   * - high: ~8192 tokens, 3+ graph hops
   */
  budget?: RecallBudget;
  /** Filter by memory type ('all' returns all types) */
  factType?: FactType | "all";
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Include entity metadata in results */
  includeEntities?: boolean;
}

/**
 * Input for HindsightClient.recall() operation.
 * Uses object-based parameters for cleaner API.
 */
export interface RecallInput {
  /** Memory bank identifier */
  bankId: string;
  /** Search query */
  query: string;
  /**
   * Search thoroughness:
   * - low: ~2048 tokens, 1 graph hop
   * - mid: ~4096 tokens, 2 graph hops (default)
   * - high: ~8192 tokens, 3+ graph hops
   */
  budget?: RecallBudget;
  /** Filter by memory type ('all' returns all types) */
  factType?: FactType | "all";
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Include entity metadata in results */
  includeEntities?: boolean;
}

/**
 * Input for HindsightClient.retain() operation.
 */
export interface RetainInput {
  /** Memory bank identifier */
  bankId: string;
  /** Content to store */
  content: string;
  /** Optional additional context */
  context?: string;
  /** Use async mode for processing (default: auto based on content length) */
  async?: boolean;
  /** User-provided entities to combine with auto-extracted entities */
  entities?: EntityInput[];
}

/**
 * Input for HindsightClient.reflect() operation.
 */
export interface ReflectInput {
  /** Memory bank identifier */
  bankId: string;
  /** What to think about or reason through */
  query: string;
  /** Optional additional context */
  context?: string;
}

// ============================================
// Reflect Types
// ============================================

/** An opinion formed through reflect() */
export interface Opinion {
  /** First-person opinion statement */
  opinion: string;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
}

/** Result from reflect() operation */
export interface ReflectResult {
  /** Natural language reasoned response */
  text: string;
  /** New opinions formed with confidence scores */
  opinions: Opinion[];
  /** Memories that informed the reflection */
  basedOn: {
    /** World facts used in reasoning */
    world: Memory[];
    /** Experiences used in reasoning */
    experience: Memory[];
    /** Prior opinions used in reasoning */
    opinion: Memory[];
  };
}

// ============================================
// Entity Input Types
// ============================================

/** Entity to associate with retained content */
export interface EntityInput {
  /** The entity name/text */
  text: string;
  /** Optional entity type (e.g., 'PERSON', 'ORG', 'CONCEPT') */
  type?: string;
}

/** Options for retain operation */
export interface RetainOptions {
  /** Use async mode for processing */
  async?: boolean;
  /** User-provided entities to combine with auto-extracted entities */
  entities?: EntityInput[];
}

// ============================================
// Health Types
// ============================================

/** Health check response */
export interface HealthStatus {
  /** Whether Hindsight is healthy and reachable */
  healthy: boolean;
  /** Database connection status */
  database?: string;
  /** Error message if unhealthy */
  error?: string;
}

// ============================================
// Client Configuration Types
// ============================================

/** Timeout configuration for different operations */
export interface TimeoutConfig {
  /** Default timeout for most operations (ms) */
  default: number;
  /** Timeout for health checks (ms) */
  health: number;
  /** Timeout for recall operations (ms) */
  recall: number;
  /** Timeout for reflect operations - LLM involved (ms) */
  reflect: number;
  /** Timeout for retain operations (ms) */
  retain: number;
}

/** Options for HindsightClient constructor */
export interface HindsightClientOptions {
  /** Hindsight server hostname (default: 'localhost') */
  host?: string;
  /** Hindsight server port (default: 8888) */
  port?: number;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Timeout configuration (all values in milliseconds) */
  timeouts?: Partial<TimeoutConfig>;
}

// ============================================
// Configuration Types
// ============================================

/**
 * Configuration for filtering transcript content before retention.
 * Reduces API costs and improves memory quality by removing noise.
 */
export interface RetainFilterConfig {
  // Content filtering
  /** Maximum transcript length before truncation (default: 25000) */
  maxTranscriptLength?: number;
  /** Filter tool result blocks (default: true) */
  filterToolResults?: boolean;
  /** Filter file content blocks (default: true) */
  filterFileContents?: boolean;
  /** Summarize code blocks exceeding this line count (default: 30) */
  maxCodeBlockLines?: number;
  /** Truncate lines exceeding this character count (default: 1000) */
  maxLineLength?: number;

  // Session skip logic
  /** Minimum session length to retain - skip shorter sessions (default: 500) */
  minSessionLength?: number;
  /** Skip sessions that are mostly tool outputs (default: true) */
  skipToolOnlySessions?: boolean;
}

/**
 * Security review configuration for pre-commit hooks.
 * Enables automated security analysis before commits.
 */
export interface SecurityReviewConfig {
  /** Enable/disable pre-commit security review (default: false) */
  enabled: boolean;
  /** Model to use for review agent (default: "opus") */
  model?: "opus" | "sonnet" | "haiku";
  /** Block commits on critical security issues (default: true) */
  blockOnCritical?: boolean;
  /** Code file extensions to review */
  codeExtensions?: string[];
}

/** Full configuration schema for claude-cognitive */
export interface ClaudeMindConfig {
  /** Hindsight server connection settings */
  hindsight: {
    host: string;
    port: number;
    apiKey?: string;
    /** @deprecated Use timeouts.default instead */
    timeout?: number;
    /** Operation-specific timeouts (ms) */
    timeouts?: Partial<TimeoutConfig>;
  };
  /** Memory bank identifier */
  bankId?: string;
  /** Bank disposition traits */
  disposition?: Disposition;
  /** Bank background/identity description */
  background?: string;
  /** Semantic memory file settings */
  semantic?: {
    path: string;
  };
  /** Transcript filtering configuration for session retention */
  retainFilter?: RetainFilterConfig;
  /** Context injection settings for session start */
  context?: {
    /** Maximum number of recent memories to inject (default: 3) */
    recentMemoryLimit?: number;
  };
  /** Security review configuration for pre-commit hooks */
  securityReview?: SecurityReviewConfig;
  /** Gemini CLI integration configuration */
  gemini?: GeminiConfig;
}

// ============================================
// Internal DTO Types (for API response mapping)
// ============================================

/** @internal Raw API response for entity */
export interface EntityResponseDTO {
  id: string;
  name: string;
  aliases: string[];
  type: string;
  co_occurrences: Array<{ entity_id: string; count: number }>;
}

/** @internal Raw API response for memory */
export interface MemoryResponseDTO {
  id: string;
  text: string;
  fact_type: string;
  context?: string;
  what?: string;
  when?: string;
  where?: string;
  who?: string[];
  why?: string;
  created_at: string;
  occurred_start?: string;
  occurred_end?: string;
  confidence?: number;
  entities?: EntityResponseDTO[];
  causes?: string[];
  caused_by?: string[];
  enables?: string[];
  prevents?: string[];
}

/** @internal Raw API response for bank */
export interface BankResponseDTO {
  bank_id: string;
  disposition: Disposition;
  background?: string;
  created_at: string;
  memory_count: number;
}

/** @internal Raw API response for retain */
export interface RetainResponseDTO {
  memory_ids: string[];
}

/** @internal Raw API response for recall */
export interface RecallResponseDTO {
  memories: MemoryResponseDTO[];
}

/** @internal Raw API response for reflect */
export interface ReflectResponseDTO {
  text: string;
  opinions: Array<{ opinion: string; confidence: number }>;
  based_on: {
    world: MemoryResponseDTO[];
    experience: MemoryResponseDTO[];
    opinion: MemoryResponseDTO[];
  };
}

/** @internal Raw API response for health */
export interface HealthResponseDTO {
  healthy: boolean;
  version: string;
  bank_count: number;
}

// ============================================
// Mind Class Types
// ============================================

/**
 * Options for Mind constructor.
 */
export interface MindOptions {
  /** Project root directory (default: process.cwd()) */
  projectPath?: string;
  /** Memory bank identifier (default: derived from project name) */
  bankId?: string;
  /** Hindsight server host */
  host?: string;
  /** Hindsight server port */
  port?: number;
  /** API key for Hindsight */
  apiKey?: string;
  /** Bank disposition traits */
  disposition?: Disposition;
  /** Bank background/identity description */
  background?: string;
  /** Path to semantic memory file */
  semanticPath?: string;
}

// ============================================
// Learn Operation Types
// ============================================

/** Depth levels for learn() operation */
export type LearnDepth = "quick" | "standard" | "full";

/**
 * Options for the learn() operation.
 */
export interface LearnOptions {
  /**
   * Analysis depth:
   * - quick: README, package.json, directory structure (~10-30s)
   * - standard: + key source files, git history (last 50 commits) (~1-5min)
   * - full: + all source files, full git history, dependency analysis (~5-15min)
   */
  depth?: LearnDepth;
  /** Whether to analyze git history (default: true) */
  includeGitHistory?: boolean;
  /** Maximum commits to analyze (default: 100) */
  maxCommits?: number;
  /** Whether to analyze dependencies (default: true) */
  includeDependencies?: boolean;
}

/**
 * Result from the learn() operation.
 */
export interface LearnResult {
  /** Human-readable summary of what was learned */
  summary: string;
  /** Number of world facts stored */
  worldFacts: number;
  /** Initial opinions formed with confidence scores */
  opinions: Opinion[];
  /** Entities discovered in the codebase */
  entities: Entity[];
  /** Number of files analyzed */
  filesAnalyzed: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Reflection queries that failed (undefined if all succeeded) */
  reflectionFailures?: string[];
}

/** Categories for extracted facts */
export type FactCategory =
  | "structure"
  | "stack"
  | "patterns"
  | "history"
  | "decisions";

/**
 * A fact extracted from codebase analysis.
 * @internal Used by learn() operation.
 */
export interface ExtractedFact {
  /** The fact content to store */
  content: string;
  /** Context about where this fact came from */
  context: string;
  /** Category for organization */
  category: FactCategory;
}
