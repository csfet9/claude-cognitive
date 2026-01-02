/**
 * Consolidator
 *
 * Session-end processing - like sleep.
 * Extract, score, abstract, store.
 */

import { extractSignificant } from './extractor.js';
import { scoreImportance } from './importance.js';
import { abstractToEssence } from './abstractor.js';

export class Consolidator {
  constructor(episodicMemory, config = {}) {
    this.episodic = episodicMemory;
    this.minImportance = config.minImportance || 0.5;
  }

  /**
   * Consolidate a session transcript
   */
  async consolidate(transcript) {
    // 1. Extract significant moments
    const moments = extractSignificant(transcript);

    // 2. Score by importance
    const scored = moments.map((moment) => ({
      ...moment,
      importance: scoreImportance(moment.content),
    }));

    // 3. Keep only what matters
    const toRemember = scored.filter((m) => m.importance >= this.minImportance);

    // 4. Abstract to essence
    const memories = toRemember.map((m) => ({
      ...m,
      content: abstractToEssence(m.content),
    }));

    // 5. Store in episodic memory
    let stored = 0;
    for (const memory of memories) {
      const result = await this.episodic.store(memory.content, memory.type);
      if (result.stored) stored++;
    }

    return {
      extracted: moments.length,
      scored: scored.length,
      toRemember: toRemember.length,
      stored,
    };
  }
}
