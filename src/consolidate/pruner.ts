/**
 * Pruning logic for memory consolidation.
 * @module consolidate/pruner
 */

import type { HindsightClient } from "../client.js";
import type {
  ConsolidationReport,
  FactType,
  PruningCandidate,
  PruningCriteria,
  SignalType,
} from "../types.js";

/**
 * Default pruning criteria.
 */
const DEFAULT_CRITERIA: Required<PruningCriteria> = {
  minUsefulness: 0.3,
  minSignals: 5,
};

/**
 * Options for pruning analysis.
 */
export interface PruningAnalysisOptions extends PruningCriteria {
  /** Maximum number of candidates to return (default: 50) */
  maxCandidates?: number;
}

/**
 * Analyze a memory bank and identify pruning candidates.
 *
 * This function examines facts with low usefulness scores and identifies
 * those that have been consistently ignored. It does NOT delete anything -
 * it only produces a report of candidates.
 *
 * @param client - HindsightClient instance
 * @param bankId - Bank identifier to analyze
 * @param options - Pruning criteria and options
 * @returns Consolidation report with pruning candidates
 *
 * @example
 * ```typescript
 * const report = await analyzePruningCandidates(client, "my-project", {
 *   minUsefulness: 0.2,
 *   minSignals: 3,
 * });
 * console.log(`Found ${report.candidates.length} pruning candidates`);
 * ```
 */
export async function analyzePruningCandidates(
  client: HindsightClient,
  bankId: string,
  options: PruningAnalysisOptions = {},
): Promise<ConsolidationReport> {
  const criteria: Required<PruningCriteria> = {
    minUsefulness: options.minUsefulness ?? DEFAULT_CRITERIA.minUsefulness,
    minSignals: options.minSignals ?? DEFAULT_CRITERIA.minSignals,
  };
  const maxCandidates = options.maxCandidates ?? 50;

  // Get bank info for total count
  const bank = await client.getBank(bankId);

  // Get bank stats for low-usefulness facts
  let bankStats;
  try {
    bankStats = await client.getBankStats(bankId);
  } catch {
    // No stats available - return empty report
    return {
      bankId,
      criteria,
      candidates: [],
      totalMemories: bank?.memoryCount ?? 0,
    };
  }

  const candidates: PruningCandidate[] = [];

  // Check least useful facts from bank stats
  for (const fact of bankStats.leastUsefulFacts) {
    if (candidates.length >= maxCandidates) break;

    // Skip if above usefulness threshold
    if (fact.score >= criteria.minUsefulness) continue;

    // Get detailed stats for this fact
    try {
      const factStats = await client.getFactStats({
        bankId,
        factId: fact.factId,
      });

      // Skip if not enough signals to be confident
      if (factStats.signalCount < criteria.minSignals) continue;

      const ignoredCount = factStats.signalBreakdown.ignored ?? 0;
      const usedCount = factStats.signalBreakdown.used ?? 0;

      // Candidate if ignored more than used
      if (ignoredCount > usedCount) {
        candidates.push({
          factId: fact.factId,
          text: fact.text,
          factType: "world" as FactType, // API doesn't expose type in stats
          usefulnessScore: fact.score,
          signalCount: factStats.signalCount,
          signalBreakdown: factStats.signalBreakdown as Record<
            SignalType,
            number
          >,
          reason: buildPruningReason(fact.score, ignoredCount, usedCount),
        });
      }
    } catch {
      // Skip facts we can't get stats for
      continue;
    }
  }

  return {
    bankId,
    criteria,
    candidates,
    totalMemories: bank?.memoryCount ?? 0,
  };
}

/**
 * Build a human-readable reason for why a fact is a pruning candidate.
 */
function buildPruningReason(
  score: number,
  ignoredCount: number,
  usedCount: number,
): string {
  const scorePercent = (score * 100).toFixed(0);
  return `Low usefulness (${scorePercent}%), ignored ${ignoredCount}x vs used ${usedCount}x`;
}
