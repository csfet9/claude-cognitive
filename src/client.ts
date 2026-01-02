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
  Entity,
  EntityResponseDTO,
  EntityType,
  FactType,
  HealthResponseDTO,
  HealthStatus,
  HindsightClientOptions,
  Memory,
  MemoryResponseDTO,
  Opinion,
  RecallOptions,
  RecallResponseDTO,
  ReflectResponseDTO,
  ReflectResult,
  RetainResponseDTO,
  TimeoutConfig,
} from "./types.js";

/**
 * Default timeout configuration (milliseconds).
 */
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  default: 10_000, // 10 seconds
  health: 3_000, // 3 seconds - quick check
  recall: 15_000, // 15 seconds - 4-way search
  reflect: 30_000, // 30 seconds - involves LLM
  retain: 10_000, // 10 seconds - write operation
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
 * await client.retain(
 *   'my-project',
 *   'Fixed auth redirect by moving AuthProvider to root',
 *   'User was experiencing infinite redirects'
 * );
 *
 * // Recall memories
 * const memories = await client.recall('my-project', 'authentication issues');
 *
 * // Reflect and form opinions
 * const reflection = await client.reflect('my-project', 'What patterns have I noticed?');
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

    this.baseUrl = `http://${host}:${port}/api/v1`;
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

    await this.request<void>("POST", "/banks", {
      body: {
        bank_id: options.bankId,
        disposition: options.disposition,
        background: options.background,
      },
    });
  }

  /**
   * Get bank information.
   *
   * @param bankId - Bank identifier
   * @returns Bank information
   * @throws {HindsightError} If bank doesn't exist
   */
  async getBank(bankId: string): Promise<Bank> {
    const response = await this.request<BankResponseDTO>(
      "GET",
      `/banks/${encodeURIComponent(bankId)}`,
    );
    return this.mapBankResponse(response);
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
      "PATCH",
      `/banks/${encodeURIComponent(bankId)}/disposition`,
      { body: disposition },
    );
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Store content with automatic 5-dimension extraction.
   *
   * Hindsight automatically extracts:
   * - what: Complete description of what happened
   * - when: Temporal context (dates, times, durations)
   * - where: Location context (files, paths, lines)
   * - who: Entities involved (people, components, concepts)
   * - why: Motivation and reasoning
   *
   * @param bankId - Bank identifier
   * @param content - Content to store
   * @param context - Optional additional context
   * @returns Array of created memory IDs
   * @throws {HindsightError} If bank doesn't exist
   */
  async retain(
    bankId: string,
    content: string,
    context?: string,
  ): Promise<string[]> {
    const response = await this.request<RetainResponseDTO>(
      "POST",
      `/banks/${encodeURIComponent(bankId)}/retain`,
      {
        body: { content, context },
        timeout: this.timeouts.retain,
      },
    );
    return response.memory_ids;
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
   * @param bankId - Bank identifier
   * @param query - Search query
   * @param options - Search options
   * @returns Ranked list of matching memories
   * @throws {HindsightError} If bank doesn't exist
   */
  async recall(
    bankId: string,
    query: string,
    options: RecallOptions = {},
  ): Promise<Memory[]> {
    const response = await this.request<RecallResponseDTO>(
      "POST",
      `/banks/${encodeURIComponent(bankId)}/recall`,
      {
        body: {
          query,
          budget: options.budget ?? "mid",
          fact_type: options.factType ?? "all",
          max_tokens: options.maxTokens,
          include_entities: options.includeEntities ?? false,
        },
        timeout: this.timeouts.recall,
      },
    );
    return response.memories.map((m) => this.mapMemoryResponse(m));
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
   * @param bankId - Bank identifier
   * @param query - What to think about or reason through
   * @param context - Optional additional context
   * @returns Reflection result with text, opinions, and citations
   * @throws {HindsightError} If bank doesn't exist
   */
  async reflect(
    bankId: string,
    query: string,
    context?: string,
  ): Promise<ReflectResult> {
    const response = await this.request<ReflectResponseDTO>(
      "POST",
      `/banks/${encodeURIComponent(bankId)}/reflect`,
      {
        body: { query, context },
        timeout: this.timeouts.reflect,
      },
    );
    return this.mapReflectResponse(response);
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
      const response = await this.request<HealthResponseDTO>("GET", "/health", {
        timeout: this.timeouts.health,
      });

      return {
        healthy: response.healthy,
        version: response.version,
        banks: response.bank_count,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        healthy: false,
        banks: 0,
        error: message,
      };
    }
  }

  /**
   * Get recent memories from a bank.
   *
   * @param bankId - Bank identifier
   * @param days - Number of days to look back (default: 7)
   * @returns Recent memories sorted by creation time
   * @throws {HindsightError} If bank doesn't exist
   */
  async recent(bankId: string, days: number = 7): Promise<Memory[]> {
    const response = await this.request<RecallResponseDTO>(
      "GET",
      `/banks/${encodeURIComponent(bankId)}/memories/recent`,
      { params: { days: days.toString() } },
    );
    return response.memories.map((m) => this.mapMemoryResponse(m));
  }

  /**
   * Remove a specific memory from a bank.
   *
   * @param bankId - Bank identifier
   * @param memoryId - Memory identifier
   * @throws {HindsightError} If bank or memory doesn't exist
   */
  async forget(bankId: string, memoryId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/banks/${encodeURIComponent(bankId)}/memories/${encodeURIComponent(memoryId)}`,
    );
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

  /**
   * Map memory response DTO to public Memory interface.
   * @internal
   */
  private mapMemoryResponse(raw: MemoryResponseDTO): Memory {
    const result: Memory = {
      id: raw.id,
      text: raw.text,
      factType: raw.fact_type as FactType,
      createdAt: raw.created_at,
    };

    // Optional fields - only set if defined
    if (raw.context !== undefined) result.context = raw.context;
    if (raw.what !== undefined) result.what = raw.what;
    if (raw.when !== undefined) result.when = raw.when;
    if (raw.where !== undefined) result.where = raw.where;
    if (raw.who !== undefined) result.who = raw.who;
    if (raw.why !== undefined) result.why = raw.why;
    if (raw.occurred_start !== undefined)
      result.occurredStart = raw.occurred_start;
    if (raw.occurred_end !== undefined) result.occurredEnd = raw.occurred_end;
    if (raw.confidence !== undefined) result.confidence = raw.confidence;
    if (raw.entities !== undefined) {
      result.entities = raw.entities.map((e) => this.mapEntityResponse(e));
    }
    if (raw.causes !== undefined) result.causes = raw.causes;
    if (raw.caused_by !== undefined) result.causedBy = raw.caused_by;
    if (raw.enables !== undefined) result.enables = raw.enables;
    if (raw.prevents !== undefined) result.prevents = raw.prevents;

    return result;
  }

  /**
   * Map entity response DTO to public Entity interface.
   * @internal
   */
  private mapEntityResponse(raw: EntityResponseDTO): Entity {
    return {
      id: raw.id,
      name: raw.name,
      aliases: raw.aliases,
      type: raw.type as EntityType,
      coOccurrences: raw.co_occurrences.map((co) => ({
        entityId: co.entity_id,
        count: co.count,
      })),
    };
  }

  /**
   * Map reflect response DTO to public ReflectResult interface.
   * @internal
   */
  private mapReflectResponse(raw: ReflectResponseDTO): ReflectResult {
    return {
      text: raw.text,
      opinions: raw.opinions.map(
        (o): Opinion => ({
          opinion: o.opinion,
          confidence: o.confidence,
        }),
      ),
      basedOn: {
        world: raw.based_on.world.map((m) => this.mapMemoryResponse(m)),
        experience: raw.based_on.experience.map((m) =>
          this.mapMemoryResponse(m),
        ),
        opinion: raw.based_on.opinion.map((m) => this.mapMemoryResponse(m)),
      },
    };
  }
}
