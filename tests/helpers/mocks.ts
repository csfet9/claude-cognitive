/**
 * Shared mock implementations for tests.
 * @module tests/helpers/mocks
 */

import { vi } from "vitest";
import type {
  Bank,
  HealthStatus,
  Memory,
  Opinion,
  ReflectResult,
} from "../../src/types.js";

/**
 * Create a mock Memory object.
 */
export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: "mem-123",
    text: "Test memory content",
    factType: "world",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Bank object.
 */
export function createMockBank(overrides: Partial<Bank> = {}): Bank {
  return {
    bankId: "test-bank",
    disposition: { skepticism: 3, literalism: 3, empathy: 3 },
    createdAt: new Date().toISOString(),
    memoryCount: 0,
    ...overrides,
  };
}

/**
 * Create a mock HealthStatus object.
 */
export function createMockHealthStatus(
  overrides: Partial<HealthStatus> = {},
): HealthStatus {
  return {
    healthy: true,
    database: "connected",
    ...overrides,
  };
}

/**
 * Create a mock ReflectResult object.
 */
export function createMockReflectResult(
  overrides: Partial<ReflectResult> = {},
): ReflectResult {
  return {
    text: "Test reflection",
    opinions: [{ opinion: "Test opinion", confidence: 0.8 }],
    basedOn: {
      world: [],
      experience: [],
      opinion: [],
    },
    ...overrides,
  };
}

/**
 * Create a mock Opinion object.
 */
export function createMockOpinion(overrides: Partial<Opinion> = {}): Opinion {
  return {
    opinion: "Test opinion",
    confidence: 0.8,
    ...overrides,
  };
}

/**
 * Options for creating a mock HindsightClient.
 */
export interface MockHindsightClientOptions {
  healthy?: boolean;
  memories?: Memory[];
  reflection?: ReflectResult;
  bank?: Bank;
  retainIds?: string[];
}

/**
 * Create a mock HindsightClient for testing.
 */
export function createMockHindsightClient(
  options: MockHindsightClientOptions = {},
) {
  const {
    healthy = true,
    memories = [],
    reflection = createMockReflectResult(),
    bank = createMockBank(),
    retainIds = ["mem-new-1"],
  } = options;

  return {
    health: vi.fn().mockResolvedValue(
      createMockHealthStatus({
        healthy,
        error: healthy ? undefined : "Connection refused",
      }),
    ),
    createBank: vi.fn().mockResolvedValue(undefined),
    getBank: vi.fn().mockResolvedValue(bank),
    updateDisposition: vi.fn().mockResolvedValue(undefined),
    retain: vi.fn().mockResolvedValue(retainIds),
    recall: vi.fn().mockResolvedValue(memories),
    recent: vi.fn().mockResolvedValue(memories),
    reflect: vi.fn().mockResolvedValue(reflection),
    forget: vi.fn().mockResolvedValue(undefined),
    ensureBankExists: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Options for creating a mock Mind instance.
 */
export interface MockMindOptions {
  degraded?: boolean;
  memories?: Memory[];
  reflection?: ReflectResult;
  context?: string;
  bankId?: string;
}

/**
 * Create a mock Mind instance for testing CLI/MCP components.
 */
export function createMockMind(options: MockMindOptions = {}) {
  const {
    degraded = false,
    memories = [],
    reflection = createMockReflectResult(),
    context = "",
    bankId = "test-bank",
  } = options;

  return {
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: degraded,
    recall: vi.fn().mockResolvedValue(memories),
    reflect: vi.fn().mockResolvedValue(reflection),
    retain: vi.fn().mockResolvedValue(["mem-1"]),
    onSessionStart: vi.fn().mockResolvedValue(context),
    onSessionEnd: vi.fn().mockResolvedValue(null),
    learn: vi.fn().mockResolvedValue({
      summary: "Learned 5 facts",
      worldFacts: 5,
      opinions: [],
      entities: [],
      filesAnalyzed: 3,
      duration: 1000,
    }),
    getBankId: vi.fn().mockReturnValue(bankId),
    getAgentTemplates: vi.fn().mockReturnValue([]),
    getAgentTemplate: vi.fn().mockReturnValue(undefined),
    getAgentContext: vi.fn().mockResolvedValue(""),
    attemptRecovery: vi.fn().mockResolvedValue(false),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
}

/**
 * Create a mock fetch function for testing HTTP requests.
 */
export function createMockFetch(
  responses: Map<string, { status: number; body: unknown }> = new Map(),
) {
  return vi
    .fn()
    .mockImplementation(async (url: string, options?: RequestInit) => {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const method = options?.method ?? "GET";
      const key = `${method}:${path}`;

      // Check for exact match first
      if (responses.has(key)) {
        const { status, body } = responses.get(key)!;
        return createMockResponse(status, body);
      }

      // Default responses based on path patterns
      if (path === "/api/v1/health") {
        return createMockResponse(200, {
          healthy: true,
          version: "1.0.0",
          bank_count: 1,
        });
      }

      if (path.match(/\/api\/v1\/banks\/[^/]+$/) && method === "GET") {
        return createMockResponse(200, {
          bank_id: "test-bank",
          disposition: { skepticism: 3, literalism: 3, empathy: 3 },
          created_at: new Date().toISOString(),
          memory_count: 10,
        });
      }

      if (path.includes("/recall") && method === "POST") {
        return createMockResponse(200, { memories: [] });
      }

      if (path.includes("/reflect") && method === "POST") {
        return createMockResponse(200, {
          text: "Reflection result",
          opinions: [],
          based_on: { world: [], experience: [], opinion: [] },
        });
      }

      if (path.includes("/retain") && method === "POST") {
        return createMockResponse(200, { memory_ids: ["mem-1"] });
      }

      // Default 404
      return createMockResponse(404, { error: "Not found" });
    });
}

/**
 * Helper to create a mock Response object.
 */
function createMockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

/**
 * Mock console for testing output.
 */
export function mockConsole() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  };
}

/**
 * Restore console after testing.
 */
export function restoreConsole(mocks: ReturnType<typeof mockConsole>) {
  mocks.log.mockRestore();
  mocks.error.mockRestore();
  mocks.warn.mockRestore();
}
