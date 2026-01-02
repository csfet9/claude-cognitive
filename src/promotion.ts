/**
 * Observation promotion logic for claude-mind.
 * Handles auto-promotion of high-confidence observations to semantic memory.
 * @module promotion
 */

import type { Observation, TypedEventEmitter } from "./events.js";
import type { SemanticMemory } from "./semantic.js";
import type { Opinion } from "./types.js";

// ============================================
// Constants
// ============================================

/** Default confidence threshold for auto-promotion */
export const DEFAULT_PROMOTION_THRESHOLD = 0.9;

// ============================================
// Types
// ============================================

/** Options for the PromotionManager */
export interface PromotionOptions {
  /** Confidence threshold for auto-promotion (default: 0.9) */
  threshold?: number;
  /** Whether to deduplicate similar observations (default: true) */
  deduplicate?: boolean;
  /** Similarity threshold for deduplication (0-1, default: 0.8) */
  similarityThreshold?: number;
}

/** Result of a promotion attempt */
export interface PromotionResult {
  /** Whether the observation was promoted */
  promoted: boolean;
  /** Reason if not promoted */
  reason?: "below_threshold" | "duplicate" | "error";
  /** Error message if promotion failed */
  error?: string;
}

// ============================================
// PromotionManager Class
// ============================================

/**
 * Manages observation promotion to semantic memory.
 *
 * Listens for opinion:formed events and auto-promotes observations
 * that meet the confidence threshold.
 *
 * @example
 * ```typescript
 * const manager = new PromotionManager(semanticMemory, mind, {
 *   threshold: 0.9
 * });
 *
 * // Manager automatically listens to mind events
 * // Or promote manually:
 * await manager.promote({
 *   text: "Auth changes need nav updates",
 *   confidence: 0.95,
 *   source: "reflect"
 * });
 * ```
 */
export class PromotionManager {
  private readonly semantic: SemanticMemory;
  private readonly emitter: TypedEventEmitter;
  private readonly options: Required<PromotionOptions>;

  /** Track promoted texts to prevent duplicates within session */
  private promotedTexts: Set<string> = new Set();

  /** Bound handler for cleanup */
  private boundHandleOpinion: (opinion: Opinion) => Promise<void>;

  constructor(
    semantic: SemanticMemory,
    emitter: TypedEventEmitter,
    options: PromotionOptions = {},
  ) {
    this.semantic = semantic;
    this.emitter = emitter;
    this.options = {
      threshold: options.threshold ?? DEFAULT_PROMOTION_THRESHOLD,
      deduplicate: options.deduplicate ?? true,
      similarityThreshold: options.similarityThreshold ?? 0.8,
    };

    // Bind handler once for proper removal
    this.boundHandleOpinion = this.handleOpinion.bind(this);
  }

  /**
   * Start listening for opinion events and auto-promote.
   *
   * Call this after Mind initialization to enable auto-promotion.
   */
  startListening(): void {
    this.emitter.on("opinion:formed", this.boundHandleOpinion);
  }

  /**
   * Stop listening for opinion events.
   */
  stopListening(): void {
    this.emitter.off("opinion:formed", this.boundHandleOpinion);
  }

  /**
   * Manually promote an observation.
   *
   * @param observation - Observation to promote
   * @returns Result of promotion attempt
   */
  async promote(observation: Observation): Promise<PromotionResult> {
    // Check threshold
    if (observation.confidence < this.options.threshold) {
      return {
        promoted: false,
        reason: "below_threshold",
      };
    }

    // Check for duplicates
    if (this.options.deduplicate) {
      const normalized = this.normalizeText(observation.text);

      if (this.promotedTexts.has(normalized)) {
        return {
          promoted: false,
          reason: "duplicate",
        };
      }

      // Check existing observations in semantic memory
      if (this.semantic.isLoaded()) {
        const existing = this.semantic.get("Observations") ?? "";
        if (this.isSimilar(observation.text, existing)) {
          return {
            promoted: false,
            reason: "duplicate",
          };
        }
      }
    }

    // Perform promotion
    try {
      await this.semantic.promoteObservation(observation);
      this.promotedTexts.add(this.normalizeText(observation.text));

      // Emit event
      this.emitter.emit("observation:promoted", observation);

      return { promoted: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        promoted: false,
        reason: "error",
        error: msg,
      };
    }
  }

  /**
   * Get the current promotion threshold.
   */
  getThreshold(): number {
    return this.options.threshold;
  }

  /**
   * Handle an opinion event and potentially promote it.
   * @internal
   */
  private async handleOpinion(opinion: Opinion): Promise<void> {
    const observation: Observation = {
      text: opinion.opinion,
      confidence: opinion.confidence,
      source: "reflect",
    };

    await this.promote(observation);
  }

  /**
   * Normalize text for comparison.
   * @internal
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Check if text is similar to existing content.
   * Uses simple word overlap for efficiency.
   * @internal
   */
  private isSimilar(newText: string, existingContent: string): boolean {
    const newWords = new Set(this.normalizeText(newText).split(" "));
    const existingWords = new Set(
      this.normalizeText(existingContent).split(" "),
    );

    if (newWords.size === 0) return false;

    let overlap = 0;
    for (const word of newWords) {
      if (existingWords.has(word)) {
        overlap++;
      }
    }

    const similarity = overlap / newWords.size;
    return similarity >= this.options.similarityThreshold;
  }

  /**
   * Clear the session's promoted texts cache.
   * Call this at session end if needed.
   */
  clearCache(): void {
    this.promotedTexts.clear();
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create an Observation from an Opinion.
 *
 * Convenience function for converting between types.
 */
export function opinionToObservation(
  opinion: Opinion,
  source: string = "reflect",
): Observation {
  return {
    text: opinion.opinion,
    confidence: opinion.confidence,
    source,
  };
}

/**
 * Check if an opinion meets the promotion threshold.
 */
export function shouldPromote(
  opinion: Opinion,
  threshold: number = DEFAULT_PROMOTION_THRESHOLD,
): boolean {
  return opinion.confidence >= threshold;
}
