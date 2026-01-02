/**
 * Importance Scorer
 *
 * Score the importance of a moment.
 */

const HIGH_IMPORTANCE_PATTERNS = [
  // Decisions with rationale
  { pattern: /chose .+ (because|over|instead of)/i, weight: 0.3 },
  { pattern: /decided to .+ (because|since)/i, weight: 0.3 },

  // Problem resolution
  { pattern: /fixed|solved|resolved|figured out/i, weight: 0.25 },
  { pattern: /the (issue|problem|bug) was/i, weight: 0.2 },

  // Discoveries
  { pattern: /found that|discovered|realized|learned/i, weight: 0.2 },
  { pattern: /turns out|actually|it works by/i, weight: 0.15 },

  // Emotional weight
  { pattern: /finally|crucial|critical|important|breaking/i, weight: 0.2 },

  // Specific locations
  { pattern: /:\d+(-\d+)?/, weight: 0.1 }, // file:line
];

const LOW_IMPORTANCE_PATTERNS = [
  // Routine operations
  { pattern: /read the file|looked at|checked|opened/i, weight: -0.2 },
  { pattern: /ran the (command|build|test)/i, weight: -0.15 },

  // Process narrative
  { pattern: /then I|next I|after that|first I/i, weight: -0.25 },
  { pattern: /started by|began with/i, weight: -0.15 },

  // Hedging
  { pattern: /maybe|might|not sure|probably|possibly/i, weight: -0.2 },
];

/**
 * Score importance of content (0.0 - 1.0)
 */
export function scoreImportance(content) {
  let score = 0.5; // Base score

  // Apply high importance patterns
  for (const { pattern, weight } of HIGH_IMPORTANCE_PATTERNS) {
    if (pattern.test(content)) {
      score += weight;
    }
  }

  // Apply low importance patterns
  for (const { pattern, weight } of LOW_IMPORTANCE_PATTERNS) {
    if (pattern.test(content)) {
      score += weight; // weight is negative
    }
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}
