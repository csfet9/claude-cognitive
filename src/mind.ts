/**
 * Mind class - the orchestrator for claude-mind.
 * @module mind
 */

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  type AgentTemplate,
  type GetAgentContextOptions,
  BUILT_IN_TEMPLATES,
  getAgentContext as prepareAgentContext,
  formatAgentPrompt,
  loadCustomAgents,
  isBuiltInAgent,
} from "./agents/index.js";
import { HindsightClient } from "./client.js";
import { loadConfig } from "./config.js";
import { HindsightError } from "./errors.js";
import { TypedEventEmitter } from "./events.js";
import type {
  Bank,
  Disposition,
  LearnOptions,
  LearnResult,
  Memory,
  MindOptions,
  RecallOptions,
  ReflectResult,
} from "./types.js";

// ============================================
// Default Values
// ============================================

/** Default disposition if none provided */
const DEFAULT_DISPOSITION: Disposition = {
  skepticism: 3,
  literalism: 3,
  empathy: 3,
};

// ============================================
// Mind Class
// ============================================

/**
 * Mind is the orchestrator layer that wraps HindsightClient and provides
 * session lifecycle management, graceful degradation, and event emission.
 *
 * Claude operates as a **project manager** through Mind:
 * - Manages session workflow and delegates to specialized agents
 * - Owns all memory operations (agents don't access memory)
 * - Synthesizes findings from multiple agents
 *
 * @example
 * ```typescript
 * const mind = new Mind({
 *   projectPath: '/path/to/project',
 *   disposition: { skepticism: 4, literalism: 4, empathy: 2 },
 *   background: 'Developer assistant for a React app',
 * });
 *
 * await mind.init();
 *
 * // Session start - get context to inject
 * const context = await mind.onSessionStart();
 *
 * // During work - recall when helpful
 * const memories = await mind.recall('authentication');
 *
 * // Session end - reflect and store observations
 * await mind.onSessionEnd(transcript);
 * ```
 */
export class Mind extends TypedEventEmitter {
  // Configuration
  private readonly projectPath: string;
  private readonly pendingOptions: MindOptions;

  // Resolved configuration (set in init())
  private bankId: string = "";
  private disposition: Disposition = DEFAULT_DISPOSITION;
  private background?: string;
  /** Path to semantic memory file. Used in Phase 3. */
  private semanticPath: string = ".claude/memory.md";

  // Client (nullable for graceful degradation)
  private client: HindsightClient | null = null;

  // State
  private initialized = false;
  private degraded = false;
  private sessionActive = false;
  /** Session start time. Used for duration tracking. */
  private sessionStartTime: Date | null = null;

  // Agent templates (loaded in init())
  private customAgents: AgentTemplate[] = [];

  /**
   * Create a new Mind instance.
   *
   * @param options - Mind configuration options
   */
  constructor(options: MindOptions = {}) {
    super();
    this.projectPath = options.projectPath ?? process.cwd();
    this.pendingOptions = options;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize the Mind instance.
   *
   * This method:
   * 1. Loads configuration from multiple sources
   * 2. Creates HindsightClient
   * 3. Performs health check
   * 4. Creates bank if it doesn't exist
   * 5. Loads custom agent templates
   *
   * @throws {Error} If init() is called twice
   */
  async init(): Promise<void> {
    if (this.initialized) {
      throw new Error("Mind already initialized. Call init() only once.");
    }

    // Build config overrides, only including defined values
    const hindsightOverrides: Record<string, string | number> = {};
    if (this.pendingOptions.host !== undefined) {
      hindsightOverrides.host = this.pendingOptions.host;
    }
    if (this.pendingOptions.port !== undefined) {
      hindsightOverrides.port = this.pendingOptions.port;
    }
    if (this.pendingOptions.apiKey !== undefined) {
      hindsightOverrides.apiKey = this.pendingOptions.apiKey;
    }

    // Build overrides object, only including defined values
    const overrides: Record<string, unknown> = {};
    if (Object.keys(hindsightOverrides).length > 0) {
      overrides.hindsight = hindsightOverrides;
    }
    if (this.pendingOptions.bankId !== undefined) {
      overrides.bankId = this.pendingOptions.bankId;
    }
    if (this.pendingOptions.disposition !== undefined) {
      overrides.disposition = this.pendingOptions.disposition;
    }
    if (this.pendingOptions.background !== undefined) {
      overrides.background = this.pendingOptions.background;
    }
    if (this.pendingOptions.semanticPath !== undefined) {
      overrides.semantic = { path: this.pendingOptions.semanticPath };
    }

    // Load config with pending options as overrides
    const config = await loadConfig(this.projectPath, overrides);

    // Resolve configuration
    this.bankId = config.bankId ?? (await this.deriveBankId());
    this.disposition = config.disposition ?? DEFAULT_DISPOSITION;
    if (config.background) {
      this.background = config.background;
    }
    this.semanticPath = config.semantic?.path ?? ".claude/memory.md";

    // Create HindsightClient
    const clientOptions: { host: string; port: number; apiKey?: string } = {
      host: config.hindsight.host,
      port: config.hindsight.port,
    };
    if (config.hindsight.apiKey) {
      clientOptions.apiKey = config.hindsight.apiKey;
    }
    this.client = new HindsightClient(clientOptions);

    // Health check
    const health = await this.client.health();

    if (!health.healthy) {
      this.enterDegradedMode(
        `Hindsight unavailable: ${health.error ?? "unknown"}`,
      );
    } else {
      // Ensure bank exists
      await this.ensureBank();
    }

    // Load custom agents from .claude/agents/
    this.customAgents = await loadCustomAgents(this.projectPath);

    // Mark initialized
    this.initialized = true;

    // Emit ready event
    this.emit("ready");
  }

  /**
   * Derive bank ID from project name if not specified.
   * @internal
   */
  private async deriveBankId(): Promise<string> {
    // Try to read package.json name
    try {
      const pkgPath = join(this.projectPath, "package.json");
      const pkgContent = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgContent) as { name?: string };
      if (typeof pkg.name === "string" && pkg.name.length > 0) {
        return this.sanitizeBankId(pkg.name);
      }
    } catch {
      // Fall through to directory name
    }

    // Fall back to directory name
    return this.sanitizeBankId(basename(this.projectPath));
  }

  /**
   * Sanitize a string to be a valid bank ID.
   * @internal
   */
  private sanitizeBankId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  }

  /**
   * Ensure the bank exists, creating it if necessary.
   * @internal
   */
  private async ensureBank(): Promise<void> {
    if (!this.client || this.degraded) return;

    try {
      await this.client.getBank(this.bankId);
    } catch (error) {
      if (HindsightError.isHindsightError(error) && error.isBankNotFound) {
        // Bank doesn't exist, create it
        const bankOptions: { bankId: string; disposition: Disposition; background?: string } = {
          bankId: this.bankId,
          disposition: this.disposition,
        };
        if (this.background) {
          bankOptions.background = this.background;
        }
        await this.client.createBank(bankOptions);
      } else {
        throw error;
      }
    }
  }

  // ============================================
  // Session Lifecycle
  // ============================================

  /**
   * Called at session start. Returns context to inject.
   *
   * This method:
   * 1. Loads semantic memory (Phase 3)
   * 2. Recalls recent experiences
   * 3. Formats as context string
   *
   * @returns Formatted context string for injection
   */
  async onSessionStart(): Promise<string> {
    this.assertInitialized();
    this.sessionActive = true;
    this.sessionStartTime = new Date();

    const contextParts: string[] = [];

    // TODO: Phase 3 - Load semantic memory
    // const semanticContext = await this.loadSemanticMemory();
    // if (semanticContext) contextParts.push(semanticContext);

    // Recall recent experiences (if not degraded)
    if (!this.degraded && this.client) {
      try {
        const recent = await this.client.recent(this.bankId, 7);
        if (recent.length > 0) {
          this.emit("memory:recalled", recent);
          contextParts.push(this.formatRecentMemories(recent));
        }
      } catch (error) {
        this.handleError(error, "onSessionStart recall");
      }
    }

    return contextParts.join("\n\n");
  }

  /**
   * Called at session end. Reflects on session and stores observations.
   *
   * This method:
   * 1. Retains transcript if provided
   * 2. Reflects on the session
   * 3. Emits opinion events
   *
   * @param transcript - Optional session transcript to store
   * @returns Reflection result, or null in degraded mode
   */
  async onSessionEnd(transcript?: string): Promise<ReflectResult | null> {
    this.assertInitialized();

    // Retain transcript if provided
    if (transcript && !this.degraded && this.client) {
      try {
        await this.client.retain(this.bankId, transcript, "Session transcript");
        this.emit("memory:retained", transcript);
      } catch (error) {
        this.handleError(error, "onSessionEnd retain");
      }
    }

    // Reflect on session (if not degraded)
    let result: ReflectResult | null = null;
    if (!this.degraded && this.client) {
      try {
        result = await this.client.reflect(
          this.bankId,
          "What insights can I draw from this session?",
        );

        // Emit opinion events
        for (const opinion of result.opinions) {
          this.emit("opinion:formed", opinion);
        }
      } catch (error) {
        this.handleError(error, "onSessionEnd reflect");
      }
    }

    // Reset session state
    this.sessionActive = false;
    this.sessionStartTime = null;

    return result;
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Search memories for relevant context.
   *
   * In degraded mode, returns an empty array.
   *
   * @param query - What to search for
   * @param options - Search options (budget, factType, etc.)
   * @returns Matching memories
   */
  async recall(query: string, options?: RecallOptions): Promise<Memory[]> {
    this.assertInitialized();

    // Degraded mode: return empty array
    if (this.degraded || !this.client) {
      return [];
    }

    try {
      const memories = await this.client.recall(this.bankId, query, options);
      this.emit("memory:recalled", memories);
      return memories;
    } catch (error) {
      this.handleError(error, "recall");
      return [];
    }
  }

  /**
   * Reason about accumulated knowledge and form opinions.
   *
   * @param query - What to think about or reason through
   * @returns Reflection result with opinions
   * @throws {HindsightError} If in degraded mode (reflect requires Hindsight)
   */
  async reflect(query: string): Promise<ReflectResult> {
    this.assertInitialized();

    // Degraded mode: throw (reflect requires Hindsight)
    if (this.degraded || !this.client) {
      throw new HindsightError(
        "reflect() requires Hindsight connection",
        "HINDSIGHT_UNAVAILABLE",
        { isRetryable: false },
      );
    }

    const result = await this.client.reflect(this.bankId, query);

    // Emit opinion events
    for (const opinion of result.opinions) {
      this.emit("opinion:formed", opinion);
    }

    return result;
  }

  /**
   * Store content in memory.
   *
   * In degraded mode, skips silently and emits an error event.
   *
   * @param content - Content to store
   * @param context - Optional additional context
   */
  async retain(content: string, context?: string): Promise<void> {
    this.assertInitialized();

    // Degraded mode: skip silently
    if (this.degraded || !this.client) {
      this.emit("error", new Error("retain() skipped: Hindsight unavailable"));
      return;
    }

    await this.client.retain(this.bankId, content, context);
    this.emit("memory:retained", content);
  }

  // ============================================
  // Learn Operation
  // ============================================

  /**
   * Bootstrap memory from an existing codebase.
   *
   * This solves the **cold start problem** when adopting claude-mind
   * on a mature project.
   *
   * @param options - Learn options (depth, git history, etc.)
   * @returns Learn result with summary and stats
   * @throws {HindsightError} If in degraded mode (learn requires Hindsight)
   */
  async learn(options?: LearnOptions): Promise<LearnResult> {
    this.assertInitialized();

    // Degraded mode: throw (learn requires Hindsight)
    if (this.degraded || !this.client) {
      throw new HindsightError(
        "learn() requires Hindsight connection",
        "HINDSIGHT_UNAVAILABLE",
        { isRetryable: false },
      );
    }

    const depth = options?.depth ?? "standard";
    this.emit("learn:start", { depth });

    // Import learn function dynamically to avoid circular deps
    const { learn } = await import("./learn/index.js");

    const result = await learn(
      this.client,
      this.bankId,
      this.projectPath,
      options,
    );

    // Emit opinion events
    for (const opinion of result.opinions) {
      this.emit("opinion:formed", opinion);
    }

    this.emit("learn:complete", {
      summary: result.summary,
      worldFacts: result.worldFacts,
    });

    return result;
  }

  // ============================================
  // Agent Support
  // ============================================

  /**
   * Get all available agent templates (built-in + custom).
   *
   * @returns Array of agent templates
   */
  getAgentTemplates(): AgentTemplate[] {
    return [...Object.values(BUILT_IN_TEMPLATES), ...this.customAgents];
  }

  /**
   * Get a specific agent template by name.
   *
   * @param name - Agent template name
   * @returns Agent template, or undefined if not found
   */
  getAgentTemplate(name: string): AgentTemplate | undefined {
    // Check built-in first
    if (isBuiltInAgent(name)) {
      return BUILT_IN_TEMPLATES[name];
    }
    // Then custom
    return this.customAgents.find((a) => a.name === name);
  }

  /**
   * Prepare context for delegating to an agent.
   *
   * This should be called by the orchestrator before delegation.
   * It retrieves relevant memories and formats them for the agent.
   *
   * @param agentType - Name of the agent (built-in or custom)
   * @param task - The task description to delegate
   * @param options - Optional configuration
   * @returns Formatted prompt string for the agent
   */
  async getAgentContext(
    agentType: string,
    task: string,
    options?: GetAgentContextOptions,
  ): Promise<string> {
    this.assertInitialized();

    const template = this.getAgentTemplate(agentType);
    if (!template) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    this.emit("agent:context-prepared", { agent: agentType, task });

    // If we're in degraded mode or no client, return minimal context
    if (this.degraded || !this.client) {
      return `# Agent: ${template.name}

## Mission
${template.mission}

## Constraints
${template.constraints.map((c) => `- ${c}`).join("\n")}

## Your Task
${task}

## Expected Output Format
${template.outputFormat}
`;
    }

    // Prepare full context with memories
    const context = await prepareAgentContext(
      this.client,
      this.bankId,
      template,
      task,
      options,
    );

    return formatAgentPrompt(context);
  }

  // ============================================
  // Graceful Degradation
  // ============================================

  /**
   * Whether the Mind is in degraded mode (Hindsight unavailable).
   */
  get isDegraded(): boolean {
    return this.degraded;
  }

  /**
   * Attempt to recover from degraded mode.
   *
   * @returns True if recovery was successful
   */
  async attemptRecovery(): Promise<boolean> {
    if (!this.degraded || !this.client) {
      return !this.degraded;
    }

    const health = await this.client.health();
    if (health.healthy) {
      this.exitDegradedMode();
      await this.ensureBank();
      return true;
    }

    return false;
  }

  /**
   * Enter degraded mode.
   * @internal
   */
  private enterDegradedMode(reason: string): void {
    if (!this.degraded) {
      this.degraded = true;
      this.emit("degraded:change", true);
      this.emit("error", new Error(`Degraded mode: ${reason}`));
    }
  }

  /**
   * Exit degraded mode.
   * @internal
   */
  private exitDegradedMode(): void {
    if (this.degraded) {
      this.degraded = false;
      this.emit("degraded:change", false);
    }
  }

  /**
   * Handle an error, potentially entering degraded mode.
   * @internal
   */
  private handleError(error: unknown, operation: string): void {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check if this is a connection failure
    if (HindsightError.isHindsightError(error) && error.isUnavailable) {
      this.enterDegradedMode(`${operation}: ${err.message}`);
    }

    this.emit("error", err);
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get bank information.
   *
   * @returns Bank info, or null if in degraded mode
   */
  async getBank(): Promise<Bank | null> {
    this.assertInitialized();

    if (this.degraded || !this.client) {
      return null;
    }

    return this.client.getBank(this.bankId);
  }

  /**
   * Get the current bank ID.
   */
  getBankId(): string {
    return this.bankId;
  }

  /**
   * Get the project path.
   */
  getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Check if a session is currently active.
   */
  isSessionActive(): boolean {
    return this.sessionActive;
  }

  /**
   * Get the path to semantic memory file.
   */
  getSemanticPath(): string {
    return this.semanticPath;
  }

  /**
   * Get the session start time, or null if no session is active.
   */
  getSessionStartTime(): Date | null {
    return this.sessionStartTime;
  }

  /**
   * Assert that init() has been called.
   * @internal
   */
  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error("Mind not initialized. Call init() first.");
    }
  }

  /**
   * Format recent memories as context string.
   * @internal
   */
  private formatRecentMemories(memories: Memory[]): string {
    if (memories.length === 0) return "";

    const lines = ["### Recent Context"];
    for (const mem of memories.slice(0, 5)) {
      const date = new Date(mem.createdAt).toLocaleDateString();
      const text =
        mem.text.length > 100 ? `${mem.text.slice(0, 100)}...` : mem.text;
      lines.push(`- ${date}: ${text}`);
    }
    return lines.join("\n");
  }
}

