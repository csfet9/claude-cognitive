/**
 * Episodic Memory
 *
 * Manages Hindsight storage - recent experiences and discoveries.
 * Decays over time, searched on-demand.
 */

import { FACT_TYPES } from '../index.js';
import { isMetaContent } from './meta-filter.js';

export class EpisodicMemory {
  constructor(hindsightClient, bankId) {
    this.client = hindsightClient;
    this.bankId = bankId;
  }

  /**
   * Store a fact with type validation
   */
  async store(content, type) {
    // Validate type
    if (!Object.values(FACT_TYPES).includes(type)) {
      return {
        stored: false,
        error: `Invalid type. Use: ${Object.values(FACT_TYPES).join(', ')}`,
      };
    }

    // Block meta-content
    if (isMetaContent(content)) {
      return {
        stored: false,
        error: 'Meta-content blocked',
      };
    }

    try {
      const result = await this.client.retain(this.bankId, content, {
        factType: type,
        metadata: {
          storedAt: new Date().toISOString(),
          accessCount: 0,
        },
      });

      return {
        stored: true,
        id: result.id,
      };
    } catch (error) {
      return {
        stored: false,
        error: error.message,
      };
    }
  }

  /**
   * Search for memories
   */
  async search(query, options = {}) {
    try {
      const results = await this.client.recall(this.bankId, query, {
        limit: options.limit || 10,
        factType: options.type,
      });

      return this.enrichResults(results);
    } catch (error) {
      console.error('Search error:', error.message);
      return [];
    }
  }

  /**
   * Get recent memories
   */
  async recent(days = 7) {
    try {
      const results = await this.client.recent(this.bankId, days);
      return this.enrichResults(results);
    } catch (error) {
      console.error('Recent error:', error.message);
      return [];
    }
  }

  /**
   * Remove a memory
   */
  async remove(id) {
    await this.client.forget(this.bankId, id);
  }

  /**
   * Enrich results with calculated fields
   */
  enrichResults(results) {
    const now = new Date();

    return results.map((result) => ({
      ...result,
      strength: this.calculateStrength(result, now),
    }));
  }

  /**
   * Calculate memory strength (decay)
   */
  calculateStrength(memory, now) {
    const lastAccess = new Date(memory.lastAccessedAt || memory.createdAt);
    const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);

    // Exponential decay
    const decay = Math.exp(-0.1 * daysSinceAccess);

    // Importance boost
    const importance = memory.importance || 0.5;
    const importanceBoost = importance * 0.5;

    // Rehearsal boost
    const accessCount = memory.metadata?.accessCount || 0;
    const rehearsalBoost = Math.log(accessCount + 1) * 0.1;

    return Math.min(1, decay + importanceBoost + rehearsalBoost);
  }
}
