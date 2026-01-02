/**
 * claude-mind
 *
 * Human-inspired memory system for Claude.
 * LLM thinks. Hindsight remembers. Together = mind.
 */

export { Mind } from './mind.js';
export { SemanticMemory } from './memory/semantic.js';
export { EpisodicMemory } from './memory/episodic.js';
export { HindsightClient } from './hindsight-client.js';
export { Consolidator } from './consolidation/index.js';

// Fact types
export const FACT_TYPES = {
  DECISION: 'DECISION',
  DISCOVERY: 'DISCOVERY',
  LOCATION: 'LOCATION',
};
