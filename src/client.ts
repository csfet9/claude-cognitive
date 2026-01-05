/**
 * HindsightClient - TypeScript client for the Hindsight memory API.
 * @module client
 */

import {
  HindsightError,
  createErrorFromResponse,
  createErrorFromNetworkFailure,
} from "./errors.js";
import type {
  Bank,
  BankOptions,
  BankResponseDTO,
  Disposition,
  FactType,
  FactUsefulnessStats,
  FactStatsInput,
  HealthStatus,
  HindsightClientOptions,
  Memory,
  RecallInput,
  ReflectInput,
  ReflectResult,
  RetainInput,
  SignalInput,
  SignalResult,
  TimeoutConfig,
  TraitValue,
} from "./types.js";

/**
 * Default timeout configuration (milliseconds).
 * Increased for slower LLMs like Gemini that need more thinking time.
 */
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  default: 30_000, // 30 seconds
  health: 10_000, // 10 seconds - health check with LLM warmup
  recall: 120_000, // 2 minutes - 4-way search + reranking (Gemini needs more time)
  reflect: 180_000, // 3 minutes - involves LLM reasoning (Gemini thinking time)
  retain: 90_000, // 1.5 minutes - write operation with LLM extraction
};

/**
 * Internal request options.
 */
interface RequestOptions {
  body?: unknown;
  timeout?: number;
  params?: Record<string, string | number>;
}

/**
 * HindsightClient provides a TypeScript interface to the Hindsight memory API.
 *
 * @example
 * ```typescript
 * const client = new HindsightClient({
 *   host: 'localhost',
 *   port: 8888,
 * });
 *
 * // Check health
 * const health = await client.health();
 * if (!health.healthy) {
 *   console.error('Hindsight unavailable');
 * }
 *
 * // Create a bank
 * await client.createBank({
 *   bankId: 'my-project',
 *   disposition: { skepticism: 4, literalism: 4, empathy: 2 },
 *   background: 'Developer assistant for a React app',
 * });
 *
 * // Store a memory
 * await client.retain({
 *   bankId: 'my-project',
 *   content: 'Fixed auth redirect by moving AuthProvider to root',
 *   context: 'User was experiencing infinite redirects'
 * });
 *
 * // Recall memories
 * const memories = await client.recall({
 *   bankId: 'my-project',
 *   query: 'authentication issues'
 * });
 *
 * // Recall with usefulness boosting
 * const boosted = await client.recall({
 *   bankId: 'my-project',
 *   query: 'authentication issues',
 *   boostByUsefulness: true,
 *   usefulnessWeight: 0.3
 * });
 *
 * // Reflect and form opinions
 * const reflection = await client.reflect({
 *   bankId: 'my-project',
 *   query: 'What patterns have I noticed?'
 * });
 *
 * // Submit feedback signals
 * await client.signal({
 *   bankId: 'my-project',
 *   signals: [
 *     { factId: memories[0].id, signalType: 'used', query: 'auth issues' }
 *   ]
 * });
 * ```
 */
export class HindsightClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeouts: TimeoutConfig;

  /**
   * Create a new HindsightClient.
   *
   * @param options - Client configuration options
   */
  constructor(options: HindsightClientOptions = {}) {
    const host = options.host ?? "localhost";
    const port = options.port ?? 8888;

    this.baseUrl = `http://${host}:${port}`;
    if (options.apiKey !== undefined) {
      this.apiKey = options.apiKey;
    }
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
  }

  // ============================================
  // Bank Management
  // ============================================

  /**
   * Create a new memory bank with disposition.
   *
   * @param options - Bank creation options
   * @throws {HindsightError} If bank already exists or disposition is invalid
   */
  async createBank(options: BankOptions): Promise<void> {
    this.validateDisposition(options.disposition);

    await this.request<void>(
      "PUT",
      `/v1/default/banks/${encodeURIComponent(options.bankId)}`,
      {
        body: {
          name: options.bankId,
          disposition: options.disposition,
          background: options.background ?? "",
        },
      },
    );
  }

  /**
   * Get bank information.
   *
   * @param bankId - Bank identifier
   * @returns Bank information
   * @throws {HindsightError} If bank doesn't exist
   */
  async getBank(bankId: string): Promise<Bank> {
    // List all banks and find the one we want
    const response = await this.request<{ banks: BankResponseDTO[] }>(
      "GET",
      "/v1/default/banks",
    );
    const bank = response.banks.find((b) => b.bank_id === bankId);
    if (!bank) {
      throw new HindsightError(`Bank not found: ${bankId}`, "BANK_NOT_FOUND", {
        isRetryable: false,
      });
    }
    return this.mapBankResponse(bank);
  }

  /**
   * Update bank disposition traits.
   *
   * @param bankId - Bank identifier
   * @param disposition - New disposition values
   * @throws {HindsightError} If bank doesn't exist or disposition is invalid
   */
  async updateDisposition(
    bankId: string,
    disposition: Disposition,
  ): Promise<void> {
    this.validateDisposition(disposition);

    await this.request<void>(
      "PUT",
      `/v1/default/banks/${encodeURIComponent(bankId)}/profile`,
      { body: { disposition } },
    );
  }

  /**
   * Update bank settings (background and/or disposition).
   *
   * @param bankId - Bank identifier
   * @param updates - Fields to update
   * @throws {HindsightError} If bank doesn't exist
   */
  async updateBank(
    bankId: string,
    updates: {
      background?: string;
      disposition?: {
        skepticism?: TraitValue;
        literalism?: TraitValue;
        empathy?: TraitValue;
      };
    },
  ): Promise<void> {
    const body: Record<string, unknown> = {};

    if (updates.background !== undefined) {
      body.background = updates.background;
    }

    if (updates.disposition) {
      body.disposition = updates.disposition;
    }

    // Use PUT to update bank (Hindsight doesn't support PATCH)
    // First get current bank to merge with updates
    const current = await this.getBank(bankId);

    const mergedBody = {
      name: bankId,
      disposition: {
        ...current.disposition,
        ...(updates.disposition ?? {}),
      },
      background: updates.background ?? current.background ?? "",
    };

    await this.request<void>(
      "PUT",
      `/v1/default/banks/${encodeURIComponent(bankId)}`,
      { body: mergedBody },
    );
  }

  /**
   * Delete a memory bank and all its memories.
   *
   * @param bankId - Bank identifier
   * @throws {HindsightError} If bank doesn't exist
   */
  async deleteBank(bankId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/v1/default/banks/${encodeURIComponent(bankId)}`,
    );
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Store content with automatic extraction.
   *
   * Hindsight automatically extracts entities, relationships, and metadata.
   * You can optionally provide user-defined entities to combine with auto-extracted ones.
   *
   * @param input - Retain input with bankId, content, and optional context/entities
   * @returns Number of items processed
   * @throws {HindsightError} If bank doesn't exist
   *
   * @example
   * ```typescript
   * await client.retain({
   *   bankId: 'my-project',
   *   content: 'Fixed auth redirect by moving AuthProvider to root',
   *   context: 'User was experiencing infinite redirects'
   * });
   * ```
   */
  async retain(input: RetainInput): Promise<number> {
    interface RetainApiResponse {
      success: boolean;
      bank_id: string;
      items_count: number;
      async: boolean;
    }
    // Use async mode for content > 2KB to avoid timeout from LLM extraction
    const useAsync = input.async ?? input.content.length > 2000;

    // Build item with optional entities
    const item: Record<string, unknown> = { content: input.content };
    if (input.context) {
      item.context = input.context;
    }

    if (input.entities && input.entities.length > 0) {
      item.entities = input.entities.map((e) => {
        const entity: { text: string; type?: string } = { text: e.text };
        if (e.type) {
          entity.type = e.type;
        }
        return entity;
      });
    }

    const response = await this.request<RetainApiResponse>(
      "POST",
      `/v1/default/banks/${encodeURIComponent(input.bankId)}/memories`,
      {
        body: {
          items: [item],
          async: useAsync,
        },
        timeout: useAsync ? 5000 : this.timeouts.retain, // Quick return for async
      },
    );
    return response.items_count;
  }

  /**
   * Search memories using 4-way parallel retrieval.
   *
   * Uses four search strategies in parallel:
   * - Semantic: Vector similarity for conceptual matches
   * - BM25: Full-text keyword search for exact terms
   * - Graph: Entity traversal for indirect relationships
   * - Temporal: Time-range + semantic for historical queries
   *
   * Results are fused using Reciprocal Rank Fusion (RRF),
   * then reranked with a neural cross-encoder.
   *
   * Optionally boost results by usefulness score (based on feedback signals).
   *
   * @param input - Recall input with bankId, query, and optional search options
   * @returns Ranked list of matching memories
   * @throws {HindsightError} If bank doesn't exist
   *
   * @example
   * ```typescript
   * // Basic recall
   * const memories = await client.recall({
   *   bankId: 'my-project',
   *   query: 'authentication issues'
   * });
   *
   * // With usefulness boosting
   * const boosted = await client.recall({
   *   bankId: 'my-project',
   *   query: 'authentication issues',
   *   boostByUsefulness: true,
   *   usefulnessWeight: 0.3
   * });
   * ```
   */
  async recall(input: RecallInput): Promise<Memory[]> {
    interface RecallResult {
      id: string;
      text: string;
      type?: string;
      context?: string;
      entities?: string[];
      occurred_start?: string;
      occurred_end?: string;
      mentioned_at?: string;
    }
    interface RecallApiResponse {
      results: RecallResult[];
    }

    // Build request body
    const body: Record<string, unknown> = {
      query: input.query,
      budget: input.budget ?? "mid",
    };

    // Add type filter if not 'all'
    if (input.factType && input.factType !== "all") {
      body.type = input.factType;
    }

    // Add max tokens if specified
    if (input.maxTokens !== undefined) {
      body.max_tokens = input.maxTokens;
    }

    // Add usefulness boosting parameters
    if (input.boostByUsefulness) {
      body.boost_by_usefulness = true;
      if (input.usefulnessWeight !== undefined) {
        body.usefulness_weight = input.usefulnessWeight;
      }
      if (input.minUsefulness !== undefined) {
        body.min_usefulness = input.minUsefulness;
      }
    }

    const response = await this.request<RecallApiResponse>(
      "POST",
      `/v1/default/banks/${encodeURIComponent(input.bankId)}/memories/recall`,
      {
        body,
        timeout: this.timeouts.recall,
      },
    );
    return response.results.map((r): Memory => {
      const mem: Memory = {
        id: r.id,
        text: r.text,
        factType: (r.type as FactType) ?? "world",
        createdAt: r.mentioned_at ?? new Date().toISOString(),
      };
      if (r.context) mem.context = r.context;
      if (r.occurred_start) mem.occurredStart = r.occurred_start;
      if (r.occurred_end) mem.occurredEnd = r.occurred_end;
      return mem;
    });
  }

  /**
   * Reason about accumulated knowledge through disposition lens.
   *
   * Process:
   * 1. Recalls relevant memories (world, experience, opinion)
   * 2. Loads bank disposition (skepticism, literalism, empathy)
   * 3. LLM reasons through disposition lens
   * 4. Extracts new opinions with confidence scores
   * 5. Stores opinions asynchronously (influences future reflects)
   * 6. Returns reasoned response with citations
   *
   * @param input - Reflect input with bankId, query, and optional context
   * @returns Reflection result with text, opinions, and citations
   * @throws {HindsightError} If bank doesn't exist
   *
   * @example
   * ```typescript
   * const reflection = await client.reflect({
   *   bankId: 'my-project',
   *   query: 'What patterns have I noticed in the codebase?'
   * });
   * ```
   */
  async reflect(input: ReflectInput): Promise<ReflectResult> {
    interface ReflectFact {
      id: string;
      text: string;
      type?: string;
    }
    interface ReflectApiResponse {
      text: string;
      based_on?: ReflectFact[];
      structured_output?: unknown;
    }
    const response = await this.request<ReflectApiResponse>(
      "POST",
      `/v1/default/banks/${encodeURIComponent(input.bankId)}/reflect`,
      {
        body: { query: input.query, context: input.context },
        timeout: this.timeouts.reflect,
      },
    );
    // Map the simpler API response to our ReflectResult structure
    const basedOn = response.based_on ?? [];
    return {
      text: response.text,
      opinions: [], // API doesn't return opinions separately
      basedOn: {
        world: basedOn
          .filter((f) => f.type === "world")
          .map(
            (f): Memory => ({
              id: f.id,
              text: f.text,
              factType: "world",
              createdAt: new Date().toISOString(),
            }),
          ),
        experience: basedOn
          .filter((f) => f.type === "experience")
          .map(
            (f): Memory => ({
              id: f.id,
              text: f.text,
              factType: "experience",
              createdAt: new Date().toISOString(),
            }),
          ),
        opinion: basedOn
          .filter((f) => f.type === "opinion")
          .map(
            (f): Memory => ({
              id: f.id,
              text: f.text,
              factType: "opinion",
              createdAt: new Date().toISOString(),
            }),
          ),
      },
    };
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Check Hindsight connection health.
   *
   * Unlike other methods, this returns a status object instead of
   * throwing on failure. This makes it safe to use for health checks.
   *
   * @returns Health status
   */
  async health(): Promise<HealthStatus> {
    try {
      const response = await this.request<{ status: string; database: string }>(
        "GET",
        "/health",
        {
          timeout: this.timeouts.health,
        },
      );

      return {
        healthy: response.status === "healthy",
        database: response.database,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        healthy: false,
        error: message,
      };
    }
  }

  /**
   * Get recent memories from a bank.
   *
   * @param bankId - Bank identifier
   * @param limit - Maximum number of memories to return (default: 50)
   * @returns Recent memories sorted by creation time (newest first)
   * @throws {HindsightError} If bank doesn't exist
   */
  async recent(bankId: string, limit: number = 50): Promise<Memory[]> {
    interface ListItem {
      id: string;
      text: string;
      type?: string;
      context?: string;
      date?: string;
      entities?: string;
    }
    interface ListResponse {
      items: ListItem[];
      total: number;
      limit: number;
      offset: number;
    }
    const response = await this.request<ListResponse>(
      "GET",
      `/v1/default/banks/${encodeURIComponent(bankId)}/memories/list`,
      { params: { limit: limit.toString() } },
    );
    return response.items.map((item): Memory => {
      const mem: Memory = {
        id: item.id,
        text: item.text,
        factType: (item.type as FactType) ?? "world",
        createdAt: item.date ?? new Date().toISOString(),
      };
      if (item.context) mem.context = item.context;
      return mem;
    });
  }

  /**
   * Clear all memories from a bank.
   *
   * Note: The Hindsight API only supports clearing all memories at once,
   * not removing individual memories.
   *
   * @param bankId - Bank identifier
   * @throws {HindsightError} If bank doesn't exist
   */
  async forgetAll(bankId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/v1/default/banks/${encodeURIComponent(bankId)}/memories`,
    );
  }

  /**
   * @deprecated Use forgetAll() instead - individual memory deletion not supported
   */
  async forget(bankId: string, _memoryId?: string): Promise<void> {
    await this.forgetAll(bankId);
  }

  // ============================================
  // Feedback Signal Operations
  // ============================================

  /**
   * Submit feedback signals for recalled facts.
   *
   * Signal types and their weights:
   * - `used`: Fact was referenced in response (weight: +1.0)
   * - `ignored`: Fact was recalled but not used (weight: -0.5)
   * - `helpful`: Explicit positive feedback (weight: +1.5)
   * - `not_helpful`: Explicit negative feedback (weight: -1.0)
   *
   * @param input - Signal input with bankId and array of signals
   * @returns Result with number of signals processed
   * @throws {HindsightError} If bank doesn't exist
   *
   * @example
   * ```typescript
   * await client.signal({
   *   bankId: 'my-project',
   *   signals: [
   *     { factId: 'fact-1', signalType: 'used', query: 'auth issues', confidence: 1.0 },
   *     { factId: 'fact-2', signalType: 'ignored', query: 'auth issues', confidence: 0.5 }
   *   ]
   * });
   * ```
   */
  async signal(input: SignalInput): Promise<SignalResult> {
    interface SignalApiResponse {
      success: boolean;
      signals_processed: number;
      updated_facts: string[];
    }
    const response = await this.request<SignalApiResponse>(
      "POST",
      `/v1/default/banks/${encodeURIComponent(input.bankId)}/signal`,
      {
        body: {
          signals: input.signals.map((s) => ({
            fact_id: s.factId,
            signal_type: s.signalType,
            confidence: s.confidence ?? 1.0,
            query: s.query,
            context: s.context,
          })),
        },
      },
    );
    return {
      success: response.success,
      signalsProcessed: response.signals_processed,
      updatedFacts: response.updated_facts,
    };
  }

  /**
   * Get usefulness statistics for a specific fact.
   *
   * @param input - Input with bankId and factId
   * @returns Usefulness statistics for the fact
   * @throws {HindsightError} If bank or fact doesn't exist
   *
   * @example
   * ```typescript
   * const stats = await client.getFactStats({
   *   bankId: 'my-project',
   *   factId: 'fact-123'
   * });
   * console.log(`Usefulness: ${stats.usefulnessScore}`);
   * ```
   */
  async getFactStats(input: FactStatsInput): Promise<FactUsefulnessStats> {
    interface FactStatsApiResponse {
      fact_id: string;
      usefulness_score: number;
      signal_count: number;
      signal_breakdown: Record<string, number>;
      last_signal_at: string | null;
      created_at: string;
    }
    const response = await this.request<FactStatsApiResponse>(
      "GET",
      `/v1/default/banks/${encodeURIComponent(input.bankId)}/facts/${encodeURIComponent(input.factId)}/stats`,
    );
    const result: FactUsefulnessStats = {
      factId: response.fact_id,
      usefulnessScore: response.usefulness_score,
      signalCount: response.signal_count,
      signalBreakdown: response.signal_breakdown as Record<
        "used" | "ignored" | "helpful" | "not_helpful",
        number
      >,
      createdAt: response.created_at,
    };
    if (response.last_signal_at) {
      result.lastSignalAt = response.last_signal_at;
    }
    return result;
  }

  // ============================================
  // Bank Listing
  // ============================================

  /**
   * List all memory banks.
   *
   * @returns Array of all banks
   */
  async listBanks(): Promise<Bank[]> {
    const response = await this.request<{ banks: BankResponseDTO[] }>(
      "GET",
      "/v1/default/banks",
    );
    return response.banks.map((b) => this.mapBankResponse(b));
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Make an HTTP request to the Hindsight API.
   * @internal
   */
  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const timeout = options.timeout ?? this.timeouts.default;
    let url = `${this.baseUrl}${path}`;

    // Add query parameters if present
    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        searchParams.set(key, String(value));
      }
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(timeout),
      };
      if (options.body !== undefined) {
        fetchOptions.body = JSON.stringify(options.body);
      }
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const body = await this.safeParseJson(response);
        throw createErrorFromResponse(response, body, path);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      // Re-throw HindsightErrors as-is
      if (HindsightError.isHindsightError(error)) {
        throw error;
      }

      // Convert network errors to HindsightError
      throw createErrorFromNetworkFailure(error as Error);
    }
  }

  /**
   * Safely parse JSON from response, returning undefined on failure.
   * @internal
   */
  private async safeParseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  /**
   * Validate disposition values are in the valid range (1-5).
   * @internal
   */
  private validateDisposition(disposition: Disposition): void {
    const traits = ["skepticism", "literalism", "empathy"] as const;

    for (const trait of traits) {
      const value = disposition[trait];
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
      ) {
        throw new HindsightError(
          `Invalid ${trait}: must be an integer between 1 and 5, got: ${value}`,
          "INVALID_DISPOSITION",
          { isRetryable: false },
        );
      }
    }
  }

  /**
   * Map bank response DTO to public Bank interface.
   * @internal
   */
  private mapBankResponse(raw: BankResponseDTO): Bank {
    const result: Bank = {
      bankId: raw.bank_id,
      disposition: raw.disposition,
      createdAt: raw.created_at,
      memoryCount: raw.memory_count,
    };
    if (raw.background !== undefined) {
      result.background = raw.background;
    }
    return result;
  }
}
