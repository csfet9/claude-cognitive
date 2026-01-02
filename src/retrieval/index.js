/**
 * Recall Orchestrator
 *
 * Context-triggered memory retrieval.
 * Memories activate by similarity, not explicit search.
 */

import { extractTriggers } from './triggers.js';
import { findAssociated } from './association.js';

export class RecallOrchestrator {
  constructor(episodicMemory) {
    this.episodic = episodicMemory;
  }

  /**
   * Handle context change - return relevant memories
   */
  async onContextChange(context) {
    // Extract triggers from context
    const triggers = extractTriggers(context);

    // Find associated memories
    const memories = await findAssociated(this.episodic, triggers);

    // Mark as accessed (strengthens memory)
    // TODO: Update access count in Phase 5

    return memories;
  }
}
