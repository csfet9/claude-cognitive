/**
 * Feedback Loop Constants
 *
 * Centralized configuration for detection thresholds, trigger patterns,
 * and default values for the memory feedback loop system.
 *
 * @module feedback/constants
 */

import type { FeedbackConfig } from "../types.js";

// =============================================================================
// Detection Confidence Thresholds
// =============================================================================

/** Confidence score for explicit reference detection (highest confidence) */
export const EXPLICIT_CONFIDENCE = 0.95;

/**
 * Similarity threshold for semantic matching (Jaccard similarity)
 * Lower than dedup threshold (0.85) to catch paraphrased content
 */
export const SEMANTIC_THRESHOLD = 0.5;

/** Maximum confidence for semantic matches (scaled down from explicit) */
export const SEMANTIC_MAX_CONFIDENCE = 0.85;

/** Base confidence for behavioral signals (file access, task correlation) */
export const BEHAVIORAL_CONFIDENCE_BASE = 0.4;

/** Confidence multiplier for file access correlation */
export const FILE_ACCESS_CONFIDENCE = 0.5;

/** Confidence multiplier for task topic correlation */
export const TASK_TOPIC_CONFIDENCE = 0.4;

// =============================================================================
// Verdict Thresholds
// =============================================================================

/** Net score threshold above which a fact is considered "used" */
export const USED_THRESHOLD = 0.2;

/** Net score threshold below which a fact is considered "ignored" */
export const IGNORED_THRESHOLD = -0.2;

/** Weight applied to negative signals (lower than positive) */
export const NEGATIVE_SIGNAL_WEIGHT = 0.5;

// =============================================================================
// Negative Signal Weights
// =============================================================================

/** Weight for facts at low positions (position > 15) */
export const LOW_POSITION_WEIGHT = 0.3;

/** Position threshold for low position signal */
export const LOW_POSITION_THRESHOLD = 15;

/** Weight for topic mismatch signal */
export const TOPIC_MISMATCH_WEIGHT = 0.5;

/** Minimum topic overlap to avoid mismatch signal */
export const TOPIC_MISMATCH_THRESHOLD = 0.1;

/** Weight for files not accessed signal */
export const FILES_NOT_ACCESSED_WEIGHT = 0.3;

/** Maximum ignore confidence (cap) */
export const MAX_IGNORE_CONFIDENCE = 0.9;

// =============================================================================
// Explicit Reference Trigger Patterns
// =============================================================================

/**
 * Regex patterns that indicate Claude explicitly referenced context.
 * These are high-confidence signals that a fact was used.
 */
export const EXPLICIT_TRIGGERS: RegExp[] = [
  // Direct context references
  /based on the (recalled |session |)context/i,
  /according to (the |my )?(recalled )?memory/i,
  /from the session context/i,
  /from the (recalled |)context/i,
  /as (mentioned|noted|stated|indicated) (in|from) (the )?(recalled )?context/i,
  /the (recalled |session )?(fact|memory|context) (shows|indicates|mentions|states)/i,
  /referring to the (recalled |session )?context/i,

  // Bracketed references (common in structured responses)
  /\[from context\]/i,
  /\[context\]/i,
  /\[recalled\]/i,
  /\[memory\]/i,
  /\(from context\)/i,
  /\(from memory\)/i,

  // Header-style references
  /context reference:/i,
  /recalled context:/i,
  /from previous sessions?:/i,

  // Knowledge acknowledgment
  /I recall that/i,
  /I remember that/i,
  /from what I've learned/i,
  /based on prior knowledge/i,
  /drawing from (the |)context/i,
  /the context (tells|shows|indicates|mentions) (me |us |)/i,
];

// =============================================================================
// File Reference Patterns
// =============================================================================

/**
 * Factory function to create fresh regex patterns for file reference extraction.
 * Creates new RegExp instances on each call to avoid shared mutable state issues
 * with the global flag, and includes length limits for ReDoS protection.
 *
 * @returns Fresh array of regex patterns (safe to use with exec/matchAll)
 */
export function createFileReferencePatterns(): RegExp[] {
  return [
    // Explicit file paths (limited to 100 chars for ReDoS protection)
    /(?:^|[\s(,])([a-zA-Z0-9_-]{1,100}\.[a-zA-Z]{2,4})(?:[\s),]|$)/g,
    // Path-like references (limited to 200 chars for ReDoS protection)
    /(?:in |at |from |to |file |path )['"]?([a-zA-Z0-9_/-]{1,200}\.[a-zA-Z]{2,4})['"]?/gi,
    // src/ or lib/ paths (limited to 200 chars for ReDoS protection)
    /(?:src|lib|app|components|pages|utils|hooks|services|api)\/[a-zA-Z0-9_/-]{1,200}\.[a-zA-Z]{2,4}/gi,
  ];
}

/**
 * @deprecated Use createFileReferencePatterns() instead to avoid shared state issues.
 * Kept for backward compatibility but will be removed in next major version.
 */
export const FILE_REFERENCE_PATTERNS: RegExp[] = createFileReferencePatterns();

// =============================================================================
// Chunking Parameters (for semantic detection)
// =============================================================================

/** Maximum words per chunk when splitting response for comparison */
export const CHUNK_MAX_WORDS = 50;

/** Word overlap between chunks */
export const CHUNK_OVERLAP_WORDS = 10;

// =============================================================================
// Data Retention
// =============================================================================

/** Days to retain recall session data */
export const SESSION_DATA_RETENTION_DAYS = 7;

// =============================================================================
// Default Feedback Configuration
// =============================================================================

/**
 * Default configuration for the feedback loop.
 * Merged with user config from .claudemindrc
 */
export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  enabled: false,
  detection: {
    explicit: true,
    semantic: true,
    behavioral: true,
    semanticThreshold: SEMANTIC_THRESHOLD,
  },
  hindsight: {
    sendFeedback: true,
    boostByUsefulness: true,
    boostWeight: 0.3,
  },
  debug: false,
};
