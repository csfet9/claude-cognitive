/**
 * Mind class - the orchestrator for claude-cognitive.
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
import { FeedbackService, createFeedbackService } from "./feedback/index.js";
import { OfflineFeedbackQueue } from "./feedback/offline-queue.js";
import { OfflineMemoryStore } from "./offline.js";
import type {
  Bank,
  BankUsefulnessStats,
  Disposition,
  FactType,
  LearnOptions,
  LearnResult,
  Memory,
  MetricsResult,
  MindOptions,
  RecallOptions,
  ReflectResult,
  SignalItem,
  SignalResult,
  TimeoutConfig,
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

/** First-person perspective prefix for bank background */
const FIRST_PERSON_PREFIX =
  "I am Claude, an AI assistant. I speak in first person (I believe, I noticed, I learned). " +
  "When forming opinions, I say 'I believe...' not 'User believes...'. ";

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

  // Client (nullable for graceful degradation)
  private client: HindsightClient | null = null;

  // Offline memory store (always available)
  private offlineStore: OfflineMemoryStore | null = null;

  // Feedback service (optional, enabled via config)
  private feedbackService: FeedbackService | null = null;

  // Offline feedback queue (for degraded mode)
  private feedbackQueue: OfflineFeedbackQueue | null = null;

  // State
  private initialized = false;
  private initializing = false;
  private degraded = false;
  private sessionActive = false;
  /** Session start time. Used for duration tracking. */
  private sessionStartTime: Date | null = null;
  /** Current session ID for feedback tracking */
  private sessionId: string | null = null;

  // Agent templates (loaded in init())
  private customAgents: AgentTemplate[] = [];

  // Context settings
  private recentMemoryLimit: number = 3;

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
   * @throws {Error} If init() is called twice or concurrently
   */
  async init(): Promise<void> {
    if (this.initialized) {
      throw new Error("Mind already initialized. Call init() only once.");
    }
    if (this.initializing) {
      throw new Error("Mind initialization already in progress.");
    }
    this.initializing = true;

    try {
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
      // Load config with pending options as overrides
      const config = await loadConfig(this.projectPath, overrides);

      // Resolve configuration
      this.bankId = config.bankId ?? (await this.deriveBankId());
      this.disposition = config.disposition ?? DEFAULT_DISPOSITION;
      if (config.background) {
        this.background = config.background;
      }
      this.recentMemoryLimit = config.context?.recentMemoryLimit ?? 3;

      // Create HindsightClient
      const clientOptions: {
        host: string;
        port: number;
        apiKey?: string;
        timeouts?: Partial<TimeoutConfig>;
      } = {
        host: config.hindsight.host,
        port: config.hindsight.port,
      };
      if (config.hindsight.apiKey) {
        clientOptions.apiKey = config.hindsight.apiKey;
      }
      if (config.hindsight.timeouts) {
        clientOptions.timeouts = config.hindsight.timeouts;
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

      // Initialize offline store (always available)
      this.offlineStore = new OfflineMemoryStore({
        projectPath: this.projectPath,
      });

      // Initialize feedback service if enabled
      if (config.feedback?.enabled) {
        this.feedbackService = createFeedbackService(
          config.feedback,
          this.projectPath,
        );
        // Initialize offline feedback queue alongside the service
        this.feedbackQueue = new OfflineFeedbackQueue({
          projectPath: this.projectPath,
        });
      }

      // Mark initialized
      this.initialized = true;

      // Emit ready event
      this.emit("ready");
    } finally {
      this.initializing = false;
    }
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
        // Bank doesn't exist, create it with first-person perspective
        const background = this.background
          ? FIRST_PERSON_PREFIX + this.background
          : FIRST_PERSON_PREFIX.trim();
        await this.client.createBank({
          bankId: this.bankId,
          disposition: this.disposition,
          background,
        });
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
   * @throws {Error} If a session is already active
   */
  async onSessionStart(): Promise<string> {
    this.assertInitialized();
    if (this.sessionActive) {
      throw new Error("Cannot start session: a session is already active.");
    }
    this.sessionActive = true;
    this.sessionStartTime = new Date();
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const contextParts: string[] = [];

    // Add agent orchestration instructions
    const agentInstructions = this.formatAgentInstructions();
    if (agentInstructions.trim().length > 0) {
      contextParts.push(agentInstructions);
    }

    // Recall recent experiences
    // Only fetch a small number (default 3) to keep context small
    if (this.recentMemoryLimit > 0) {
      if (!this.degraded && this.client) {
        // Online mode: fetch from Hindsight
        try {
          const recent = await this.client.recent(
            this.bankId,
            this.recentMemoryLimit,
          );
          if (recent.length > 0) {
            this.emit("memory:recalled", recent);
            contextParts.push(this.formatRecentMemories(recent));
          }
        } catch (error) {
          this.handleError(error, "onSessionStart recall");
          // Fall through to offline on error
        }
      }

      // Offline/degraded mode: fetch from local storage
      if (this.degraded && this.offlineStore) {
        try {
          const offlineRecent = await this.offlineStore.getRecent(
            this.recentMemoryLimit,
          );
          if (offlineRecent.length > 0) {
            const memories = offlineRecent.map(OfflineMemoryStore.toMemory);
            this.emit("memory:recalled", memories);
            contextParts.push(this.formatRecentMemories(memories));
          }
        } catch (error) {
          this.emit(
            "error",
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }

    return contextParts.join("\n\n");
  }

  /**
   * Called at session end. Reflects on session and stores observations.
   *
   * This method:
   * 1. Retains transcript if provided (online or offline)
   * 2. Reflects on the session (online only)
   * 3. Emits opinion events
   *
   * @param transcript - Optional session transcript to store
   * @param sessionId - Optional session ID (extracted from transcript, or falls back to internal)
   * @returns Reflection result, or null in degraded mode
   */
  async onSessionEnd(
    transcript?: string,
    sessionId?: string | null,
  ): Promise<ReflectResult | null> {
    this.assertInitialized();

    // Retain transcript if provided
    if (transcript) {
      if (!this.degraded && this.client) {
        // Online mode: store to Hindsight
        try {
          await this.client.retain({
            bankId: this.bankId,
            content: transcript,
            context: "Session transcript",
          });
          this.emit("memory:retained", transcript);
        } catch (error) {
          this.handleError(error, "onSessionEnd retain");
          // Fall through to offline on error
        }
      }

      // Degraded/offline mode: store locally
      if (this.degraded && this.offlineStore) {
        try {
          await this.offlineStore.retain(transcript, "experience", {
            context: "Session transcript",
          });
          this.emit("memory:retained", transcript);
          this.emit("offline:stored", {
            content: transcript,
            factType: "experience",
          });
        } catch (error) {
          this.emit(
            "error",
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }

    // Process feedback if enabled
    // Use provided sessionId (from transcript) or fall back to internal sessionId
    // Always use a fallback for event emission consistency
    const feedbackSessionId = sessionId || this.sessionId;
    const effectiveFeedbackSessionId = feedbackSessionId ?? "unknown";
    if (this.feedbackService && transcript) {
      try {
        const feedbackResult = await this.feedbackService.processFeedback(
          feedbackSessionId,
          {
            conversationText: transcript,
          },
        );

        if (feedbackResult.success && feedbackResult.feedback.length > 0) {
          if (!this.degraded && this.client) {
            // Online mode: Submit feedback signals to Hindsight
            await this.client.signal({
              bankId: this.bankId,
              signals: feedbackResult.feedback,
            });

            this.emit("feedback:processed", {
              sessionId: effectiveFeedbackSessionId,
              summary: feedbackResult.summary,
            });
          } else if (this.feedbackQueue) {
            // Degraded mode: Queue signals for later sync
            await this.feedbackQueue.enqueueBatch(feedbackResult.feedback);

            this.emit("feedback:queued", {
              sessionId: effectiveFeedbackSessionId,
              count: feedbackResult.feedback.length,
            });
          }
        }
      } catch (error) {
        // Silently ignore feedback processing errors - non-critical
        this.emit(
          "error",
          error instanceof Error
            ? error
            : new Error("Feedback processing failed"),
        );
      }
    }

    // Reflect on session (if not degraded)
    let result: ReflectResult | null = null;
    if (!this.degraded && this.client) {
      try {
        result = await this.client.reflect({
          bankId: this.bankId,
          query: "What insights can I draw from this session?",
        });

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
    this.sessionId = null;

    return result;
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Search memories for relevant context.
   *
   * In degraded mode, searches offline storage (text-based).
   *
   * @param query - What to search for
   * @param options - Search options (budget, factType, etc.)
   * @returns Matching memories
   */
  async recall(query: string, options?: RecallOptions): Promise<Memory[]> {
    this.assertInitialized();

    // Online mode: use Hindsight
    if (!this.degraded && this.client) {
      try {
        // Build recall input, only including defined properties
        const recallInput: {
          bankId: string;
          query: string;
          budget?: "low" | "mid" | "high";
          factType?: FactType | "all";
          maxTokens?: number;
          includeEntities?: boolean;
          boostByUsefulness?: boolean;
          usefulnessWeight?: number;
          minUsefulness?: number;
        } = {
          bankId: this.bankId,
          query,
        };
        if (options?.budget !== undefined) recallInput.budget = options.budget;
        if (options?.factType !== undefined)
          recallInput.factType = options.factType;
        if (options?.maxTokens !== undefined)
          recallInput.maxTokens = options.maxTokens;
        if (options?.includeEntities !== undefined)
          recallInput.includeEntities = options.includeEntities;
        if (options?.boostByUsefulness !== undefined)
          recallInput.boostByUsefulness = options.boostByUsefulness;
        if (options?.usefulnessWeight !== undefined)
          recallInput.usefulnessWeight = options.usefulnessWeight;
        if (options?.minUsefulness !== undefined)
          recallInput.minUsefulness = options.minUsefulness;

        const memories = await this.client.recall(recallInput);
        this.emit("memory:recalled", memories);

        // Track recall for feedback if enabled (unless skipTracking)
        if (
          this.feedbackService &&
          this.sessionId &&
          memories.length > 0 &&
          !options?.skipTracking
        ) {
          try {
            await this.feedbackService.trackRecall(
              this.sessionId,
              query,
              memories,
            );
          } catch {
            // Silently ignore feedback tracking errors
          }
        }

        return memories;
      } catch (error) {
        this.handleError(error, "recall");
        // Fall through to offline on error
      }
    }

    // Degraded/offline mode: use local storage
    if (this.offlineStore) {
      try {
        const recallOptions: { factType?: FactType | "all"; limit?: number } = {
          limit: options?.maxTokens ? Math.floor(options.maxTokens / 100) : 10,
        };
        if (options?.factType) {
          recallOptions.factType = options.factType;
        }
        const offlineMemories = await this.offlineStore.recall(
          query,
          recallOptions,
        );
        const memories = offlineMemories.map(OfflineMemoryStore.toMemory);
        if (memories.length > 0) {
          this.emit("memory:recalled", memories);
        }
        return memories;
      } catch (error) {
        this.emit(
          "error",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    return [];
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

    const result = await this.client.reflect({
      bankId: this.bankId,
      query,
    });

    // Emit opinion events
    for (const opinion of result.opinions) {
      this.emit("opinion:formed", opinion);
    }

    return result;
  }

  /**
   * Submit feedback signals for recalled facts.
   *
   * @param signals - Array of signal items with factId, signalType, etc.
   * @returns Signal result
   * @throws {HindsightError} If in degraded mode (signal requires Hindsight)
   */
  async signal(signals: SignalItem[]): Promise<SignalResult> {
    this.assertInitialized();

    if (this.degraded || !this.client) {
      throw new HindsightError(
        "signal() requires Hindsight connection",
        "HINDSIGHT_UNAVAILABLE",
        { isRetryable: false },
      );
    }

    return this.client.signal({
      bankId: this.bankId,
      signals,
    });
  }

  /**
   * Get the underlying HindsightClient.
   *
   * Use with caution - prefer Mind methods for standard operations.
   * Returns null if in degraded mode.
   *
   * @returns The HindsightClient instance, or null if degraded
   */
  getClient(): HindsightClient | null {
    return this.degraded ? null : this.client;
  }

  /**
   * Get memory effectiveness metrics for the current bank.
   *
   * Combines bank statistics with memory counts to provide
   * a comprehensive view of memory health and usage.
   *
   * @returns Metrics result with bank stats and counts
   * @throws {HindsightError} If in degraded mode (requires Hindsight connection)
   *
   * @example
   * ```typescript
   * const metrics = await mind.getMetrics();
   * console.log(`Total facts: ${metrics.totalFacts}`);
   * console.log(`Average usefulness: ${metrics.bankStats?.averageUsefulness}`);
   * ```
   */
  async getMetrics(): Promise<MetricsResult> {
    this.assertInitialized();

    if (this.degraded || !this.client) {
      throw new HindsightError(
        "getMetrics() requires Hindsight connection",
        "HINDSIGHT_UNAVAILABLE",
        { isRetryable: false },
      );
    }

    // Get bank info for total counts
    const bank = await this.client.getBank(this.bankId);

    // Get bank-level usefulness stats
    let bankStats: BankUsefulnessStats | null = null;
    try {
      bankStats = await this.client.getBankStats(this.bankId);
    } catch {
      // Stats may not exist if no signals have been submitted yet
    }

    // Count facts by type
    const factsByType: Record<FactType, number> = {
      world: 0,
      experience: 0,
      opinion: 0,
      observation: 0,
    };

    // Get counts for each type using listMemories
    for (const factType of ["world", "experience", "opinion"] as FactType[]) {
      try {
        const result = await this.client.listMemories(this.bankId, {
          factType,
          limit: 1,
        });
        factsByType[factType] = result.total;
      } catch {
        // Ignore errors for individual type counts
      }
    }

    // Calculate pruning candidates (facts with low usefulness)
    const pruningCandidates =
      bankStats?.leastUsefulFacts.filter((f) => f.score < 0.3).length ?? 0;

    return {
      bankId: this.bankId,
      totalFacts: bank?.memoryCount ?? 0,
      factsByType,
      bankStats,
      pruningCandidates,
    };
  }

  /**
   * Store content in memory.
   *
   * In degraded mode, stores to offline storage for later sync.
   *
   * @param content - Content to store
   * @param context - Optional additional context
   * @param factType - Memory type (default: experience)
   */
  async retain(
    content: string,
    context?: string,
    factType: FactType = "experience",
  ): Promise<void> {
    this.assertInitialized();

    // Online mode: use Hindsight
    if (!this.degraded && this.client) {
      try {
        // Build retain input, only including defined properties
        const retainInput: {
          bankId: string;
          content: string;
          context?: string;
        } = {
          bankId: this.bankId,
          content,
        };
        if (context !== undefined) retainInput.context = context;

        await this.client.retain(retainInput);
        this.emit("memory:retained", content);
        return;
      } catch (error) {
        this.handleError(error, "retain");
        // Fall through to offline on error
      }
    }

    // Degraded/offline mode: store locally
    if (this.offlineStore) {
      try {
        const retainOptions: { context?: string; confidence?: number } = {};
        if (context) {
          retainOptions.context = context;
        }
        await this.offlineStore.retain(content, factType, retainOptions);
        this.emit("memory:retained", content);
        this.emit("offline:stored", { content, factType });
      } catch (error) {
        this.emit(
          "error",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  // ============================================
  // Learn Operation
  // ============================================

  /**
   * Bootstrap memory from an existing codebase.
   *
   * This solves the **cold start problem** when adopting claude-cognitive
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
   * If successful, syncs offline memories to Hindsight.
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

      // Auto-sync offline memories
      await this.syncOfflineMemories();

      // Auto-sync offline feedback signals
      await this.syncOfflineFeedback();

      return true;
    }

    return false;
  }

  /**
   * Sync offline memories to Hindsight.
   * Called automatically on recovery from degraded mode.
   *
   * @returns Number of memories synced
   */
  async syncOfflineMemories(): Promise<number> {
    if (!this.client || this.degraded || !this.offlineStore) {
      return 0;
    }

    try {
      await this.offlineStore.recordSyncAttempt();
      const unsynced = await this.offlineStore.getUnsynced();

      if (unsynced.length === 0) {
        return 0;
      }

      const syncedIds: string[] = [];

      for (const memory of unsynced) {
        try {
          // Build retain input, only including defined properties
          const retainInput: {
            bankId: string;
            content: string;
            context?: string;
          } = {
            bankId: this.bankId,
            content: memory.text,
          };
          if (memory.context !== undefined)
            retainInput.context = memory.context;

          await this.client.retain(retainInput);
          syncedIds.push(memory.id);
        } catch (error) {
          // Stop on error - don't want to skip memories
          this.emit(
            "error",
            error instanceof Error
              ? error
              : new Error(`Failed to sync memory ${memory.id}`),
          );
          break;
        }
      }

      if (syncedIds.length > 0) {
        await this.offlineStore.markSynced(syncedIds);
        this.emit("offline:synced", { count: syncedIds.length });

        // Clear synced memories to save space
        await this.offlineStore.clearSynced();
      }

      return syncedIds.length;
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  /**
   * Sync offline feedback signals to Hindsight.
   * Called automatically on recovery from degraded mode.
   *
   * @returns Number of feedback signals synced
   */
  async syncOfflineFeedback(): Promise<number> {
    if (!this.client || this.degraded || !this.feedbackQueue) {
      return 0;
    }

    try {
      await this.feedbackQueue.recordSyncAttempt();
      const unsynced = await this.feedbackQueue.getUnsynced();

      if (unsynced.length === 0) {
        return 0;
      }

      // Convert offline signals back to SignalItem format
      const signals: SignalItem[] = unsynced.map(
        OfflineFeedbackQueue.toSignalItem,
      );

      // Submit all signals in one batch
      await this.client.signal({
        bankId: this.bankId,
        signals,
      });

      // Mark all as synced
      const ids = unsynced.map((s) => s.id);
      await this.feedbackQueue.markSynced(ids);
      this.emit("feedback:synced", { count: ids.length });

      // Clear synced signals to save space
      await this.feedbackQueue.clearSynced();

      return ids.length;
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  /**
   * Get offline feedback queue (for CLI commands).
   */
  getOfflineFeedbackQueue(): OfflineFeedbackQueue | null {
    return this.feedbackQueue;
  }

  /**
   * Get offline memory store (for CLI commands).
   */
  getOfflineStore(): OfflineMemoryStore | null {
    return this.offlineStore;
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
   * Shows fuller context since we only fetch a few memories.
   * @internal
   */
  private formatRecentMemories(memories: Memory[]): string {
    if (memories.length === 0) return "";

    const lines = ["## Recent Activity"];
    for (const mem of memories) {
      const date = new Date(mem.createdAt).toLocaleDateString();
      // Show more text since we're fetching fewer memories
      const maxLen = 200;
      const text =
        mem.text.length > maxLen ? `${mem.text.slice(0, maxLen)}...` : mem.text;
      lines.push(`- ${date}: ${text}`);
    }
    return lines.join("\n");
  }

  /**
   * Format agent orchestration instructions.
   * @internal
   */
  formatAgentInstructions(): string {
    const allAgents = this.getAgentTemplates();
    if (allAgents.length === 0) return "";

    const custom = allAgents.filter(
      (a) =>
        !["code-explorer", "code-architect", "code-reviewer"].includes(a.name),
    );

    const lines: string[] = [];
    lines.push("## Agent Orchestration");
    lines.push("");
    lines.push(
      "You are the **orchestrator**. You do NOT write code directly. Delegate ALL coding tasks to specialized agents using the Task tool.",
    );
    lines.push("");

    // Critical rule section
    lines.push("### Critical Rule: Agents Write Code, You Orchestrate");
    lines.push("");
    lines.push(
      "**YOU (the main Claude instance) MUST NOT write code directly.** Your role is to:",
    );
    lines.push("- Plan and coordinate work");
    lines.push("- Provide context and requirements to agents");
    lines.push("- Review agent outputs");
    lines.push("- Communicate with the user");
    lines.push("");
    lines.push("**Agents write ALL code.** Delegate implementation to:");
    lines.push(
      "- Built-in agents (code-explorer, code-architect, code-reviewer)",
    );
    lines.push("- Custom agents in `.claude/agents/` directory");
    lines.push("");
    lines.push(
      "**Exception**: You may write code ONLY if no agents are available (e.g., no built-in agents accessible, no custom agents in `.claude/agents/`).",
    );
    lines.push("");

    lines.push("### Built-in Agents");
    lines.push("");
    lines.push("| Agent | When to Use |");
    lines.push("|-------|-------------|");
    lines.push(
      "| `code-explorer` | Before implementing features - explore codebase patterns, trace execution paths |",
    );
    lines.push(
      "| `code-architect` | Before complex changes - design solutions, create implementation plans |",
    );
    lines.push(
      "| `code-reviewer` | After writing code - review for bugs, security issues, adherence to patterns |",
    );
    lines.push("");

    if (custom.length > 0) {
      lines.push("### Custom Project Agents");
      lines.push("");
      lines.push(
        "The following project-specific agents are available in `.claude/agents/`:",
      );
      lines.push("");
      for (const agent of custom) {
        const firstLine = agent.mission.split("\n")[0] ?? "";
        const mission =
          firstLine.slice(0, 80) + (firstLine.length > 80 ? "..." : "");
        lines.push(`- **${agent.name}**: ${mission}`);
      }
      lines.push("");
    }

    lines.push("### Orchestration Workflow");
    lines.push("");
    lines.push("For ALL coding tasks, follow this workflow:");
    lines.push("");
    lines.push(
      "1. **Explore**: Launch `code-explorer` agents to understand existing patterns",
    );
    lines.push("2. **Clarify**: Ask user questions about unclear requirements");
    lines.push(
      "3. **Design**: Launch `code-architect` agents to create implementation plans",
    );
    lines.push(
      "4. **Implement**: Launch implementation agents to write code (NEVER write code yourself)",
    );
    lines.push(
      "5. **Review**: Launch `code-reviewer` agents to check the work",
    );
    lines.push("");
    lines.push(
      "**Parallelization**: Launch multiple agents with different focuses simultaneously.",
    );
    lines.push(
      "**Memory**: Only YOU (orchestrator) access memory - agents receive context from you.",
    );
    lines.push(
      "**Code Ownership**: Agents own ALL code changes - you coordinate and review.",
    );
    lines.push("");

    return lines.join("\n");
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Dispose of Mind resources.
   *
   * Call this when done with the Mind instance to clean up
   * event listeners and prevent memory leaks.
   *
   * After calling dispose(), the Mind instance should not be used.
   */
  dispose(): void {
    // Clear references
    this.client = null;
    this.offlineStore = null;
    this.feedbackService = null;
    this.feedbackQueue = null;
    this.customAgents = [];

    // Reset state
    this.initialized = false;
    this.sessionActive = false;
    this.sessionStartTime = null;
    this.sessionId = null;
    this.degraded = false;
  }
}
