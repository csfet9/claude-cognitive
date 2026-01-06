/**
 * Feedback Scorer
 *
 * Aggregates detection results into final fact scores and prepares
 * feedback for storage/API submission.
 *
 * @module feedback/scorer
 */

import {
  USED_THRESHOLD,
  IGNORED_THRESHOLD,
  NEGATIVE_SIGNAL_WEIGHT,
} from "./constants.js";
import type { Detection, DetectionResults } from "./detector.js";
import type { SignalItem } from "../types.js";

// =============================================================================
// Types
// =============================================================================

export type Verdict = "used" | "ignored" | "uncertain";

export interface FactScore {
  factId: string;
  verdict: Verdict;
  confidence: number;
  scores: {
    used: number;
    ignored: number;
  };
  detections: Array<
    Detection | { detectionType: string; confidence: number; evidence: unknown }
  >;
}

export interface FeedbackSummary {
  total: number;
  used: number;
  ignored: number;
  uncertain: number;
  usageRate: number;
  avgUsedConfidence: number;
  avgIgnoredConfidence: number;
  topUsed: Array<{
    factId: string;
    confidence: number;
    detectionTypes: string[];
  }>;
  topIgnored: Array<{
    factId: string;
    confidence: number;
  }>;
}

export interface FeedbackResult {
  success: boolean;
  sessionId: string;
  summary: FeedbackSummary;
  factScores: FactScore[];
  feedback: SignalItem[];
  error?: string;
  reason?: string;
}

// =============================================================================
// Score Aggregation
// =============================================================================

interface IntermediateScore {
  factId: string;
  used: number;
  ignored: number;
  detections: Array<
    Detection | { detectionType: string; confidence: number; evidence: unknown }
  >;
}

/**
 * Aggregate all detections into final fact scores
 */
export function aggregateDetections(detections: DetectionResults): FactScore[] {
  const factScores = new Map<string, IntermediateScore>();

  // Process positive signals (additive)
  const positiveDetections: Detection[] = [
    ...(detections.explicit || []),
    ...(detections.semantic || []),
    ...(detections.behavioral || []),
  ];

  for (const detection of positiveDetections) {
    const current = factScores.get(detection.factId) || {
      factId: detection.factId,
      used: 0,
      ignored: 0,
      detections: [],
    };

    // Add confidence (cap at 1.0)
    current.used = Math.min(current.used + detection.confidence, 1.0);
    current.detections.push(detection);

    factScores.set(detection.factId, current);
  }

  // Process negative signals
  for (const signal of detections.negative || []) {
    const current = factScores.get(signal.factId) || {
      factId: signal.factId,
      used: 0,
      ignored: 0,
      detections: [],
    };

    // Add ignore confidence (cap at 1.0)
    current.ignored = Math.min(current.ignored + signal.ignoreConfidence, 1.0);
    current.detections.push({
      detectionType: "negative_signals",
      confidence: signal.ignoreConfidence,
      evidence: { signals: signal.signals },
    });

    factScores.set(signal.factId, current);
  }

  // Calculate final verdicts
  const results: FactScore[] = [];
  for (const scores of factScores.values()) {
    const verdict = calculateVerdict(scores.used, scores.ignored);
    results.push({
      factId: scores.factId,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      scores: {
        used: scores.used,
        ignored: scores.ignored,
      },
      detections: scores.detections,
    });
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}

/**
 * Calculate verdict for a fact based on used and ignored scores
 */
export function calculateVerdict(
  usedScore: number,
  ignoredScore: number,
): { verdict: Verdict; confidence: number } {
  // Net score: positive - (negative * weight)
  // Negative signals weighted less than positive
  const netScore = usedScore - ignoredScore * NEGATIVE_SIGNAL_WEIGHT;

  let verdict: Verdict;
  if (netScore > USED_THRESHOLD) {
    verdict = "used";
  } else if (netScore < IGNORED_THRESHOLD) {
    verdict = "ignored";
  } else {
    verdict = "uncertain";
  }

  return {
    verdict,
    confidence: Math.abs(netScore),
  };
}

// =============================================================================
// Feedback Preparation
// =============================================================================

/**
 * Prepare feedback for Hindsight API submission
 * Sanitizes data to ensure no sensitive information is included
 */
export function prepareFeedback(
  factScores: FactScore[],
  query: string,
): SignalItem[] {
  return factScores
    .filter((score) => score.verdict !== "uncertain")
    .map((score) => ({
      factId: score.factId,
      signalType: score.verdict as "used" | "ignored",
      confidence: score.confidence,
      query,
    }));
}

/**
 * Create a summary of feedback results
 */
export function summarizeFeedback(factScores: FactScore[]): FeedbackSummary {
  const summary: FeedbackSummary = {
    total: factScores.length,
    used: 0,
    ignored: 0,
    uncertain: 0,
    usageRate: 0,
    avgUsedConfidence: 0,
    avgIgnoredConfidence: 0,
    topUsed: [],
    topIgnored: [],
  };

  let usedConfidenceSum = 0;
  let ignoredConfidenceSum = 0;

  for (const score of factScores) {
    switch (score.verdict) {
      case "used":
        summary.used++;
        usedConfidenceSum += score.confidence;
        break;
      case "ignored":
        summary.ignored++;
        ignoredConfidenceSum += score.confidence;
        break;
      default:
        summary.uncertain++;
    }
  }

  // Calculate rates and averages
  if (summary.total > 0) {
    summary.usageRate = summary.used / summary.total;
  }

  if (summary.used > 0) {
    summary.avgUsedConfidence = usedConfidenceSum / summary.used;
  }

  if (summary.ignored > 0) {
    summary.avgIgnoredConfidence = ignoredConfidenceSum / summary.ignored;
  }

  // Get top 5 used and ignored facts
  const used = factScores
    .filter((s) => s.verdict === "used")
    .sort((a, b) => b.confidence - a.confidence);
  const ignored = factScores
    .filter((s) => s.verdict === "ignored")
    .sort((a, b) => b.confidence - a.confidence);

  summary.topUsed = used.slice(0, 5).map((s) => ({
    factId: s.factId,
    confidence: s.confidence,
    detectionTypes: [...new Set(s.detections.map((d) => d.detectionType))],
  }));

  summary.topIgnored = ignored.slice(0, 5).map((s) => ({
    factId: s.factId,
    confidence: s.confidence,
  }));

  return summary;
}

/**
 * Filter feedback to only high-confidence results
 */
export function filterHighConfidence(
  factScores: FactScore[],
  minConfidence = 0.5,
): FactScore[] {
  return factScores.filter(
    (score) =>
      score.verdict !== "uncertain" && score.confidence >= minConfidence,
  );
}

/**
 * Get detection type breakdown
 */
export function getDetectionBreakdown(
  factScores: FactScore[],
): Record<string, number> {
  const breakdown: Record<string, number> = {
    explicit_reference: 0,
    semantic_match: 0,
    file_access_correlation: 0,
    task_topic_correlation: 0,
    negative_signals: 0,
  };

  for (const score of factScores) {
    for (const detection of score.detections || []) {
      const detType = detection.detectionType;
      if (detType && detType in breakdown && breakdown[detType] !== undefined) {
        breakdown[detType] = breakdown[detType] + 1;
      }
    }
  }

  return breakdown;
}
