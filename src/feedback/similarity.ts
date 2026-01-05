/**
 * Text Similarity Functions
 *
 * Provides Jaccard similarity calculation for semantic matching.
 *
 * @module feedback/similarity
 */

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate Jaccard similarity between two texts
 * @param text1 - First text
 * @param text2 - Second text
 * @returns Similarity score (0-1)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(/\s+/).filter(Boolean));
  const words2 = new Set(normalizeText(text2).split(/\s+/).filter(Boolean));

  if (words1.size === 0 && words2.size === 0) {
    return 1; // Both empty = identical
  }

  if (words1.size === 0 || words2.size === 0) {
    return 0; // One empty = no similarity
  }

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersectionSize = [...set1].filter((x) => set2.has(x)).length;
  const unionSize = new Set([...set1, ...set2]).size;

  return intersectionSize / unionSize;
}
