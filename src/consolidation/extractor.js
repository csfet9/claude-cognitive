/**
 * Significance Extractor
 *
 * Extract significant moments from session transcript.
 */

import { FACT_TYPES } from '../index.js';

const DECISION_PATTERNS = [
  /chose .+ (because|over|instead of)/i,
  /decided to .+ (because|since)/i,
  /went with .+ (because|since)/i,
  /picked .+ over/i,
];

const DISCOVERY_PATTERNS = [
  /found that/i,
  /discovered that/i,
  /realized that/i,
  /learned that/i,
  /turns out/i,
  /it works by/i,
  /the (issue|problem|bug) was/i,
  /fixed by/i,
  /solved by/i,
];

const LOCATION_PATTERNS = [
  /in (src|lib|app|components|features|pages)\/[\w\/-]+\.(ts|tsx|js|jsx|py)/i,
  /at line \d+/i,
  /file:?\s*[\w\/-]+\.(ts|tsx|js|jsx|py)/i,
];

/**
 * Extract significant moments from transcript
 */
export function extractSignificant(transcript) {
  const moments = [];
  const lines = transcript.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for decision
    if (DECISION_PATTERNS.some((p) => p.test(trimmed))) {
      moments.push({
        content: trimmed,
        type: FACT_TYPES.DECISION,
      });
      continue;
    }

    // Check for discovery
    if (DISCOVERY_PATTERNS.some((p) => p.test(trimmed))) {
      moments.push({
        content: trimmed,
        type: FACT_TYPES.DISCOVERY,
      });
      continue;
    }

    // Check for location
    if (LOCATION_PATTERNS.some((p) => p.test(trimmed))) {
      moments.push({
        content: trimmed,
        type: FACT_TYPES.LOCATION,
      });
    }
  }

  return moments;
}
