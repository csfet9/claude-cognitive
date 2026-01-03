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
  HealthStatus,
  HindsightClientOptions,
  Memory,
  RecallOptions,
  TraitValue,
  ReflectResult,
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
   *
   * @param bankId - Bank identifier
   * @param content - Content to store
   * @param context - Optional additional context
   * @returns Number of items processed
   * @throws {HindsightError} If bank doesn't exist
   */
  async retain(
    bankId: string,
    content: string,
    context?: string,
  ): Promise<number> {
    interface RetainApiResponse {
      success: boolean;
      bank_id: string;
      items_count: number;
      async: boolean;
    }
    const response = await this.request<RetainApiResponse>(
      "POST",
      `/v1/default/banks/${encodeURIComponent(bankId)}/memories`,
      {
        body: {
          items: [{ content, context }],
          async: false,
        },
        timeout: this.timeouts.retain,
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
    const response = await this.request<RecallApiResponse>(
      "POST",
      `/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`,
      {
        body: {
          query,
          budget: options.budget ?? "mid",
          type: options.factType !== "all" ? options.factType : undefined,
          max_tokens: options.maxTokens,
        },
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
      `/v1/default/banks/${encodeURIComponent(bankId)}/reflect`,
      {
        body: { query, context },
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
