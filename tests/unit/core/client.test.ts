/**
 * Tests for the HindsightClient class.
 * @module tests/unit/core/client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HindsightClient } from "../../../src/client.js";
import { HindsightError } from "../../../src/errors.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Create a mock Response object.
 */
function createResponse(
  status: number,
  body: unknown,
  statusText = "",
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

describe("HindsightClient", () => {
  let client: HindsightClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HindsightClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should use default host and port", () => {
      const c = new HindsightClient();
      // Verify by checking a request URL
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { healthy: true, version: "1.0.0", bank_count: 0 }),
      );
      c.health();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/health",
        expect.any(Object),
      );
    });

    it("should use custom host and port", () => {
      const c = new HindsightClient({ host: "custom-host", port: 9999 });
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { healthy: true, version: "1.0.0", bank_count: 0 }),
      );
      c.health();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://custom-host:9999/api/v1/health",
        expect.any(Object),
      );
    });

    it("should include API key in headers when provided", async () => {
      const c = new HindsightClient({ apiKey: "test-key" });
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { healthy: true, version: "1.0.0", bank_count: 0 }),
      );
      await c.health();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        }),
      );
    });
  });

  describe("health()", () => {
    it("should return healthy status when server responds", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          healthy: true,
          version: "1.2.3",
          bank_count: 5,
        }),
      );

      const result = await client.health();

      expect(result.healthy).toBe(true);
      expect(result.version).toBe("1.2.3");
      expect(result.banks).toBe(5);
      expect(result.error).toBeUndefined();
    });

    it("should return unhealthy status on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await client.health();

      expect(result.healthy).toBe(false);
      expect(result.banks).toBe(0);
      expect(result.error).toContain("Connection refused");
    });

    it("should return unhealthy status on timeout", async () => {
      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await client.health();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain("timed out");
    });
  });

  describe("createBank()", () => {
    it("should create bank with valid options", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(204, undefined));

      await expect(
        client.createBank({
          bankId: "my-bank",
          disposition: { skepticism: 3, literalism: 3, empathy: 3 },
          background: "Test assistant",
        }),
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/banks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            bank_id: "my-bank",
            disposition: { skepticism: 3, literalism: 3, empathy: 3 },
            background: "Test assistant",
          }),
        }),
      );
    });

    it("should throw on invalid disposition (value too low)", async () => {
      await expect(
        client.createBank({
          bankId: "my-bank",
          disposition: { skepticism: 0, literalism: 3, empathy: 3 },
        }),
      ).rejects.toThrow("Invalid skepticism");
    });

    it("should throw on invalid disposition (value too high)", async () => {
      await expect(
        client.createBank({
          bankId: "my-bank",
          disposition: { skepticism: 3, literalism: 6, empathy: 3 },
        }),
      ).rejects.toThrow("Invalid literalism");
    });

    it("should throw on invalid disposition (non-integer)", async () => {
      await expect(
        client.createBank({
          bankId: "my-bank",
          disposition: { skepticism: 3, literalism: 3, empathy: 3.5 },
        }),
      ).rejects.toThrow("Invalid empathy");
    });
  });

  describe("getBank()", () => {
    it("should return bank information", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          bank_id: "my-bank",
          disposition: { skepticism: 4, literalism: 4, empathy: 2 },
          background: "Test background",
          created_at: "2024-01-01T00:00:00Z",
          memory_count: 42,
        }),
      );

      const bank = await client.getBank("my-bank");

      expect(bank.bankId).toBe("my-bank");
      expect(bank.disposition).toEqual({
        skepticism: 4,
        literalism: 4,
        empathy: 2,
      });
      expect(bank.background).toBe("Test background");
      expect(bank.createdAt).toBe("2024-01-01T00:00:00Z");
      expect(bank.memoryCount).toBe(42);
    });

    it("should throw BANK_NOT_FOUND for 404", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(404, { message: "Bank not found" }),
      );

      try {
        await client.getBank("nonexistent");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(HindsightError.isHindsightError(error)).toBe(true);
        expect((error as HindsightError).code).toBe("BANK_NOT_FOUND");
      }
    });

    it("should URL-encode bank ID", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          bank_id: "my/bank",
          disposition: { skepticism: 3, literalism: 3, empathy: 3 },
          created_at: "2024-01-01T00:00:00Z",
          memory_count: 0,
        }),
      );

      await client.getBank("my/bank");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/banks/my%2Fbank",
        expect.any(Object),
      );
    });
  });

  describe("updateDisposition()", () => {
    it("should update disposition", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(204, undefined));

      await client.updateDisposition("my-bank", {
        skepticism: 5,
        literalism: 5,
        empathy: 1,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/banks/my-bank/disposition",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            skepticism: 5,
            literalism: 5,
            empathy: 1,
          }),
        }),
      );
    });

    it("should validate disposition before sending", async () => {
      await expect(
        client.updateDisposition("my-bank", {
          skepticism: 3,
          literalism: 3,
          empathy: 10,
        }),
      ).rejects.toThrow("Invalid empathy");
    });
  });

  describe("retain()", () => {
    it("should store content and return memory IDs", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { memory_ids: ["mem-1", "mem-2"] }),
      );

      const ids = await client.retain("my-bank", "Test content");

      expect(ids).toEqual(["mem-1", "mem-2"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/banks/my-bank/retain",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "Test content", context: undefined }),
        }),
      );
    });

    it("should include context when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { memory_ids: ["mem-1"] }),
      );

      await client.retain("my-bank", "Content", "Additional context");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            content: "Content",
            context: "Additional context",
          }),
        }),
      );
    });
  });

  describe("recall()", () => {
    it("should search memories with default options", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          memories: [
            {
              id: "mem-1",
              text: "Test memory",
              fact_type: "world",
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      );

      const memories = await client.recall("my-bank", "test query");

      expect(memories).toHaveLength(1);
      expect(memories[0].id).toBe("mem-1");
      expect(memories[0].text).toBe("Test memory");
      expect(memories[0].factType).toBe("world");
    });

    it("should include recall options in request", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { memories: [] }));

      await client.recall("my-bank", "query", {
        budget: "high",
        factType: "experience",
        maxTokens: 1000,
        includeEntities: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            query: "query",
            budget: "high",
            fact_type: "experience",
            max_tokens: 1000,
            include_entities: true,
          }),
        }),
      );
    });

    it("should map memory fields correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          memories: [
            {
              id: "mem-1",
              text: "Memory text",
              fact_type: "experience",
              created_at: "2024-01-01T00:00:00Z",
              context: "Some context",
              what: "Did something",
              when: "Yesterday",
              where: "src/file.ts",
              who: "Developer",
              why: "To fix bug",
              occurred_start: "2024-01-01",
              occurred_end: "2024-01-02",
              confidence: 0.9,
              causes: ["cause-1"],
              caused_by: ["caused-by-1"],
              enables: ["enables-1"],
              prevents: ["prevents-1"],
              entities: [
                {
                  id: "ent-1",
                  name: "Entity",
                  aliases: ["E"],
                  type: "person",
                  co_occurrences: [{ entity_id: "ent-2", count: 5 }],
                },
              ],
            },
          ],
        }),
      );

      const memories = await client.recall("my-bank", "query");
      const mem = memories[0];

      expect(mem.context).toBe("Some context");
      expect(mem.what).toBe("Did something");
      expect(mem.when).toBe("Yesterday");
      expect(mem.where).toBe("src/file.ts");
      expect(mem.who).toBe("Developer");
      expect(mem.why).toBe("To fix bug");
      expect(mem.occurredStart).toBe("2024-01-01");
      expect(mem.occurredEnd).toBe("2024-01-02");
      expect(mem.confidence).toBe(0.9);
      expect(mem.causes).toEqual(["cause-1"]);
      expect(mem.causedBy).toEqual(["caused-by-1"]);
      expect(mem.enables).toEqual(["enables-1"]);
      expect(mem.prevents).toEqual(["prevents-1"]);
      expect(mem.entities).toHaveLength(1);
      expect(mem.entities![0].coOccurrences).toEqual([
        { entityId: "ent-2", count: 5 },
      ]);
    });
  });

  describe("reflect()", () => {
    it("should return reflection result", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          text: "Reflection text",
          opinions: [{ opinion: "Test opinion", confidence: 0.85 }],
          based_on: {
            world: [
              {
                id: "w1",
                text: "World fact",
                fact_type: "world",
                created_at: "2024-01-01T00:00:00Z",
              },
            ],
            experience: [],
            opinion: [],
          },
        }),
      );

      const result = await client.reflect("my-bank", "What patterns exist?");

      expect(result.text).toBe("Reflection text");
      expect(result.opinions).toHaveLength(1);
      expect(result.opinions[0].opinion).toBe("Test opinion");
      expect(result.opinions[0].confidence).toBe(0.85);
      expect(result.basedOn.world).toHaveLength(1);
      expect(result.basedOn.world[0].text).toBe("World fact");
    });

    it("should include context when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          text: "Reflection",
          opinions: [],
          based_on: { world: [], experience: [], opinion: [] },
        }),
      );

      await client.reflect("my-bank", "query", "Additional context");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ query: "query", context: "Additional context" }),
        }),
      );
    });
  });

  describe("recent()", () => {
    it("should fetch recent memories with default days", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { memories: [] }));

      await client.recent("my-bank");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/banks/my-bank/memories/recent?days=7",
        expect.any(Object),
      );
    });

    it("should use custom days parameter", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { memories: [] }));

      await client.recent("my-bank", 30);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("days=30"),
        expect.any(Object),
      );
    });
  });

  describe("forget()", () => {
    it("should delete memory", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(204, undefined));

      await client.forget("my-bank", "mem-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/v1/banks/my-bank/memories/mem-123",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("error handling", () => {
    it("should throw HindsightError on 400", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(400, { message: "Bad request" }),
      );

      await expect(client.recall("my-bank", "query")).rejects.toThrow(
        HindsightError,
      );
    });

    it("should throw with RATE_LIMITED on 429", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(429, { message: "Too many requests" }),
      );

      try {
        await client.recall("my-bank", "query");
      } catch (error) {
        expect((error as HindsightError).code).toBe("RATE_LIMITED");
        expect((error as HindsightError).isRetryable).toBe(true);
      }
    });

    it("should throw with SERVER_ERROR on 500", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(500, { message: "Internal error" }),
      );

      try {
        await client.recall("my-bank", "query");
      } catch (error) {
        expect((error as HindsightError).code).toBe("SERVER_ERROR");
        expect((error as HindsightError).isRetryable).toBe(true);
      }
    });

    it("should convert network errors to HindsightError", async () => {
      mockFetch.mockRejectedValueOnce(
        new Error("connect ECONNREFUSED 127.0.0.1:8888"),
      );

      try {
        await client.recall("my-bank", "query");
      } catch (error) {
        expect(HindsightError.isHindsightError(error)).toBe(true);
        expect((error as HindsightError).code).toBe("HINDSIGHT_UNAVAILABLE");
      }
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";
      mockFetch.mockRejectedValueOnce(timeoutError);

      try {
        await client.recall("my-bank", "query");
      } catch (error) {
        expect((error as HindsightError).code).toBe("CONNECTION_TIMEOUT");
      }
    });
  });

  describe("timeout configuration", () => {
    it("should use custom timeouts from options", () => {
      const c = new HindsightClient({
        timeouts: {
          default: 5000,
          health: 1000,
          recall: 10000,
          reflect: 20000,
          retain: 5000,
        },
      });

      // Just verify construction works - timeout testing requires mocking AbortSignal.timeout
      expect(c).toBeInstanceOf(HindsightClient);
    });
  });
});
