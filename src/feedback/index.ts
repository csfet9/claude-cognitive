/**
 * Memory Feedback Loop Module
 *
 * Provides a closed-loop feedback system that:
 * 1. Tracks which recalled facts Claude actually uses
 * 2. Scores facts based on usefulness signals
 * 3. Prepares feedback for Hindsight API
 *
 * @module feedback
 */

import { DEFAULT_FEEDBACK_CONFIG } from "./constants.js";
import {
  trackRecall,
  loadRecallSession,
  getSessionStats,
  type RecallSession,
} from "./tracker.js";
import { runDetectionPipeline, type SessionActivity } from "./detector.js";
import {
  aggregateDetections,
  summarizeFeedback,
  prepareFeedback,
  type FeedbackResult,
  type FeedbackSummary,
} from "./scorer.js";
import type { FeedbackConfig, Memory, SignalItem } from "../types.js";

// =============================================================================
// Re-exports
// =============================================================================

// Constants
export {
  EXPLICIT_CONFIDENCE,
  SEMANTIC_THRESHOLD,
  SEMANTIC_MAX_CONFIDENCE,
  BEHAVIORAL_CONFIDENCE_BASE,
  USED_THRESHOLD,
  IGNORED_THRESHOLD,
  EXPLICIT_TRIGGERS,
  FILE_REFERENCE_PATTERNS,
  DEFAULT_FEEDBACK_CONFIG,
  SESSION_DATA_RETENTION_DAYS,
} from "./constants.js";

// Tracker
export {
  createRecallSession,
  addRecalledFacts,
  saveRecallSession,
  loadRecallSession,
  trackRecall,
  cleanupOldSessions,
  getSessionStats,
  getRecallSessionPath,
  getSessionActivityDir,
  type RecallSession,
  type RecalledFact,
  type SessionStats,
} from "./tracker.js";

// Detector
export {
  detectExplicitReferences,
  detectSemanticMatches,
  detectBehavioralSignals,
  detectNegativeSignals,
  runDetectionPipeline,
  extractFileReferences,
  extractTopics,
  type Detection,
  type NegativeSignal,
  type DetectionResults,
  type SessionActivity,
} from "./detector.js";

// Scorer
export {
  aggregateDetections,
  calculateVerdict,
  prepareFeedback,
  summarizeFeedback,
  filterHighConfidence,
  getDetectionBreakdown,
  type FactScore,
  type FeedbackSummary,
  type FeedbackResult,
  type Verdict,
} from "./scorer.js";

// Similarity
export { calculateSimilarity, jaccardSimilarity } from "./similarity.js";

// =============================================================================
// FeedbackService Class
// =============================================================================

export interface ProcessFeedbackOptions {
  conversationText?: string;
  sessionActivity?: SessionActivity;
}

export interface TrackRecallResult {
  success: boolean;
  sessionId?: string;
  factsTracked?: number;
  reason?: string;
  error?: string;
}

export interface StatsResult {
  success: boolean;
  enabled: boolean;
  currentSession?: RecallSession | null;
  archivedSessions?: number;
  totalFactsTracked?: number;
  oldestSession?: string | null;
  newestSession?: string | null;
  error?: string;
}

/**
 * FeedbackService - Main facade class for the feedback loop
 *
 * Provides a high-level interface for:
 * - Tracking recall sessions
 * - Processing feedback at session end
 * - Viewing statistics and patterns
 */
export class FeedbackService {
  private projectDir: string;
  private config: FeedbackConfig;

  /**
   * Create a new FeedbackService
   */
  constructor(config: FeedbackConfig, projectDir: string) {
    this.projectDir = projectDir;
    this.config = { ...DEFAULT_FEEDBACK_CONFIG, ...config };
  }

  /**
   * Check if feedback loop is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled === true;
  }

  /**
   * Track a recall operation
   */
  async trackRecall(
    sessionId: string,
    query: string,
    facts: Memory[],
  ): Promise<TrackRecallResult> {
    if (!this.isEnabled()) {
      return { success: false, reason: "Feedback loop disabled" };
    }

    try {
      const session = await trackRecall({
        sessionId,
        projectDir: this.projectDir,
        query,
        facts,
      });

      return {
        success: true,
        sessionId: session.sessionId,
        factsTracked: session.totalFacts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Process feedback for a session
   */
  async processFeedback(
    sessionId: string,
    options: ProcessFeedbackOptions = {},
  ): Promise<FeedbackResult> {
    if (!this.isEnabled()) {
      return {
        success: false,
        sessionId,
        reason: "Feedback loop disabled",
        summary: createEmptySummary(),
        factScores: [],
        feedback: [],
      };
    }

    try {
      // Load recall session
      const recallSession = await loadRecallSession(sessionId, this.projectDir);
      if (!recallSession) {
        return {
          success: false,
          sessionId,
          reason: "No recall session found for this session ID",
          summary: createEmptySummary(),
          factScores: [],
          feedback: [],
        };
      }

      // Run detection pipeline
      const detections = runDetectionPipeline(
        options.conversationText || null,
        options.sessionActivity || null,
        recallSession.factsRecalled,
        this.config.detection || {},
      );

      // Aggregate scores
      const factScores = aggregateDetections(detections);

      // Get summary
      const summary = summarizeFeedback(factScores);

      // Prepare feedback for API (if enabled)
      let feedback: SignalItem[] = [];
      if (this.config.hindsight?.sendFeedback) {
        feedback = prepareFeedback(factScores, recallSession.recall.query);
      }

      return {
        success: true,
        sessionId,
        summary,
        factScores,
        feedback,
      };
    } catch (error) {
      return {
        success: false,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        summary: createEmptySummary(),
        factScores: [],
        feedback: [],
      };
    }
  }

  /**
   * Get feedback statistics for the project
   */
  async getStats(): Promise<StatsResult> {
    try {
      const sessionStats = await getSessionStats(this.projectDir);

      return {
        success: true,
        enabled: this.isEnabled(),
        ...sessionStats,
      };
    } catch (error) {
      return {
        success: false,
        enabled: this.isEnabled(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): FeedbackConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function createEmptySummary(): FeedbackSummary {
  return {
    total: 0,
    used: 0,
    ignored: 0,
    uncertain: 0,
    usageRate: 0,
    avgUsedConfidence: 0,
    avgIgnoredConfidence: 0,
    topUsed: [],
    topIgnored: [],
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new FeedbackService instance
 */
export function createFeedbackService(
  config: FeedbackConfig,
  projectDir: string,
): FeedbackService {
  return new FeedbackService(config, projectDir);
}
