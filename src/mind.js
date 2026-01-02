/**
 * Mind - Main entry point
 *
 * Orchestrates the three memory layers:
 * - Semantic (local file)
 * - Episodic (Hindsight)
 * - Working (context window - managed by Claude)
 */

import { EventEmitter } from 'events';
import { SemanticMemory } from './memory/semantic.js';
import { EpisodicMemory } from './memory/episodic.js';
import { HindsightClient } from './hindsight-client.js';
import { Consolidator } from './consolidation/index.js';
import { RecallOrchestrator } from './retrieval/index.js';
import { loadConfig } from './config.js';

export class Mind extends EventEmitter {
  constructor(options = {}) {
    super();

    this.projectPath = options.projectPath || process.cwd();
    this.config = loadConfig(this.projectPath, options);

    // Initialize components (lazy - actual init in init())
    this.hindsightClient = null;
    this.semantic = null;
    this.episodic = null;
    this.consolidator = null;
    this.recallOrchestrator = null;

    this.initialized = false;
  }

  /**
   * Initialize connection to Hindsight and load semantic memory
   */
  async init() {
    if (this.initialized) return;

    // Initialize Hindsight client
    this.hindsightClient = new HindsightClient({
      host: this.config.hindsight.host,
      port: this.config.hindsight.port,
    });

    // Initialize memory layers
    this.semantic = new SemanticMemory(this.config.semantic.path);
    this.episodic = new EpisodicMemory(
      this.hindsightClient,
      this.config.hindsight.bankId
    );

    // Initialize processors
    this.consolidator = new Consolidator(this.episodic, this.config.consolidation);
    this.recallOrchestrator = new RecallOrchestrator(this.episodic);

    // Load semantic memory
    await this.semantic.load();

    // Check Hindsight connection
    try {
      await this.hindsightClient.ping();
    } catch (error) {
      this.emit('error', {
        code: 'HINDSIGHT_UNAVAILABLE',
        message: error.message,
      });
      // Continue in local-only mode
    }

    this.initialized = true;
  }

  /**
   * Session start - return semantic memory as context
   */
  async onSessionStart() {
    await this.ensureInitialized();
    return this.semantic.toContext();
  }

  /**
   * Context change - return triggered memories
   */
  async onContextChange(context) {
    await this.ensureInitialized();

    const memories = await this.recallOrchestrator.onContextChange(context);

    if (memories.length > 0) {
      this.emit('memory:triggered', memories);
    }

    return memories;
  }

  /**
   * Session end - consolidate and cleanup
   */
  async onSessionEnd(transcript) {
    await this.ensureInitialized();

    const consolidateResult = await this.consolidator.consolidate(transcript);
    const cleanupResult = await this.cleanup();

    return {
      consolidated: consolidateResult.stored,
      forgotten: cleanupResult.forgotten,
    };
  }

  /**
   * Store a fact explicitly
   */
  async store(fact, type) {
    await this.ensureInitialized();

    const result = await this.episodic.store(fact, type);

    if (result.stored) {
      this.emit('memory:stored', { id: result.id, content: fact, type });
    }

    return result;
  }

  /**
   * Search episodic memory
   */
  async search(query, options = {}) {
    await this.ensureInitialized();
    return this.episodic.search(query, options);
  }

  /**
   * Get recent memories
   */
  async recent(days = 7) {
    await this.ensureInitialized();
    return this.episodic.recent(days);
  }

  /**
   * Remove a memory
   */
  async remove(id) {
    await this.ensureInitialized();
    await this.episodic.remove(id);
    this.emit('memory:forgotten', [id]);
  }

  /**
   * Run cleanup (decay and forget)
   */
  async cleanup() {
    await this.ensureInitialized();

    // TODO: Implement in Phase 5
    return { forgotten: 0, promoted: 0 };
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }
}
