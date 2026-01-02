/**
 * Association Finder
 *
 * Find memories associated with triggers.
 */

import { FACT_TYPES } from '../index.js';

/**
 * Find memories associated with triggers
 */
export async function findAssociated(episodic, triggers) {
  const results = [];

  // File triggers location memories
  if (triggers.file) {
    try {
      const byPath = await episodic.search(triggers.file, {
        type: FACT_TYPES.LOCATION,
        limit: 3,
      });
      results.push(...byPath);
    } catch (error) {
      // Ignore search errors
    }
  }

  // Keywords trigger semantic search
  if (triggers.keywords.length > 0) {
    try {
      const query = triggers.keywords.slice(0, 5).join(' ');
      const byKeyword = await episodic.search(query, {
        limit: 5,
      });
      results.push(...byKeyword);
    } catch (error) {
      // Ignore search errors
    }
  }

  // Errors trigger discoveries
  if (triggers.error) {
    try {
      const byError = await episodic.search(triggers.error, {
        type: FACT_TYPES.DISCOVERY,
        limit: 3,
      });
      results.push(...byError);
    } catch (error) {
      // Ignore search errors
    }
  }

  // Entities trigger all types
  if (triggers.entities.length > 0) {
    try {
      const query = triggers.entities.slice(0, 3).join(' ');
      const byEntity = await episodic.search(query, {
        limit: 3,
      });
      results.push(...byEntity);
    } catch (error) {
      // Ignore search errors
    }
  }

  // Dedupe and rank
  return rankByRelevance(dedupeResults(results));
}

/**
 * Remove duplicate results
 */
function dedupeResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    if (seen.has(result.id)) return false;
    seen.add(result.id);
    return true;
  });
}

/**
 * Rank results by relevance
 */
function rankByRelevance(results) {
  return results.sort((a, b) => {
    // Combine score and strength
    const aScore = (a.score || 0.5) * (a.strength || 0.5);
    const bScore = (b.score || 0.5) * (b.strength || 0.5);
    return bScore - aScore;
  });
}
