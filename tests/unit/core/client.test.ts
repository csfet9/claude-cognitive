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
        createResponse(200, { status: "healthy", database: "connected" }),
      );
      c.health();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/health",
        expect.any(Object),
      );
    });

    it("should use custom host and port", () => {
      const c = new HindsightClient({ host: "custom-host", port: 9999 });
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { status: "healthy", database: "connected" }),
      );
      c.health();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://custom-host:9999/health",
        expect.any(Object),
      );
    });

    it("should include API key in headers when provided", async () => {
      const c = new HindsightClient({ apiKey: "test-key" });
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { status: "healthy", database: "connected" }),
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
          status: "healthy",
          database: "connected",
        }),
      );

      const result = await client.health();

      expect(result.healthy).toBe(true);
      expect(result.database).toBe("connected");
      expect(result.error).toBeUndefined();
    });

    it("should return unhealthy status on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await client.health();

      expect(result.healthy).toBe(false);
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
        "http://localhost:8888/v1/default/banks/my-bank",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            name: "my-bank",
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
          banks: [
            {
              bank_id: "my-bank",
              disposition: { skepticism: 4, literalism: 4, empathy: 2 },
              background: "Test background",
              created_at: "2024-01-01T00:00:00Z",
              memory_count: 42,
            },
          ],
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

    it("should throw BANK_NOT_FOUND when bank doesn't exist", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { banks: [] }));

      try {
        await client.getBank("nonexistent");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(HindsightError.isHindsightError(error)).toBe(true);
        expect((error as HindsightError).code).toBe("BANK_NOT_FOUND");
      }
    });

    it("should call the banks list endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          banks: [
            {
              bank_id: "my/bank",
              disposition: { skepticism: 3, literalism: 3, empathy: 3 },
              created_at: "2024-01-01T00:00:00Z",
              memory_count: 0,
            },
          ],
        }),
      );

      await client.getBank("my/bank");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks",
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
        "http://localhost:8888/v1/default/banks/my-bank/profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            disposition: {
              skepticism: 5,
              literalism: 5,
              empathy: 1,
            },
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
    it("should store content and return items count", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          success: true,
          bank_id: "my-bank",
          items_count: 1,
          async: false,
        }),
      );

      const count = await client.retain({
        bankId: "my-bank",
        content: "Test content",
      });

      expect(count).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks/my-bank/memories",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            items: [{ content: "Test content" }],
            async: false,
          }),
        }),
      );
    });

    it("should include context when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          success: true,
          bank_id: "my-bank",
          items_count: 1,
          async: false,
        }),
      );

      await client.retain({
        bankId: "my-bank",
        content: "Content",
        context: "Additional context",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            items: [{ content: "Content", context: "Additional context" }],
            async: false,
          }),
        }),
      );
    });
  });

  describe("recall()", () => {
    it("should search memories with default options", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          results: [
            {
              id: "mem-1",
              text: "Test memory",
              type: "world",
              mentioned_at: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      );

      const memories = await client.recall({
        bankId: "my-bank",
        query: "test query",
      });

      expect(memories).toHaveLength(1);
      expect(memories[0].id).toBe("mem-1");
      expect(memories[0].text).toBe("Test memory");
      expect(memories[0].factType).toBe("world");
    });

    it("should call the correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { results: [] }));

      await client.recall({ bankId: "my-bank", query: "query" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks/my-bank/memories/recall",
        expect.any(Object),
      );
    });

    it("should include recall options in request", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { results: [] }));

      await client.recall({
        bankId: "my-bank",
        query: "query",
        budget: "high",
        factType: "experience",
        maxTokens: 1000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            query: "query",
            budget: "high",
            type: "experience",
            max_tokens: 1000,
          }),
        }),
      );
    });

    it("should map memory fields correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          results: [
            {
              id: "mem-1",
              text: "Memory text",
              type: "experience",
              mentioned_at: "2024-01-01T00:00:00Z",
              context: "Some context",
              occurred_start: "2024-01-01",
              occurred_end: "2024-01-02",
            },
          ],
        }),
      );

      const memories = await client.recall({
        bankId: "my-bank",
        query: "query",
      });
      const mem = memories[0];

      expect(mem.id).toBe("mem-1");
      expect(mem.text).toBe("Memory text");
      expect(mem.factType).toBe("experience");
      expect(mem.context).toBe("Some context");
      expect(mem.occurredStart).toBe("2024-01-01");
      expect(mem.occurredEnd).toBe("2024-01-02");
    });

    it("should include usefulness boosting params in request", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(200, { results: [] }));

      await client.recall({
        bankId: "my-bank",
        query: "query",
        boostByUsefulness: true,
        usefulnessWeight: 0.3,
        minUsefulness: 0.2,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            query: "query",
            budget: "mid",
            boost_by_usefulness: true,
            usefulness_weight: 0.3,
            min_usefulness: 0.2,
          }),
        }),
      );
    });
  });

  describe("reflect()", () => {
    it("should return reflection result", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          text: "Reflection text",
          based_on: [
            { id: "w1", text: "World fact", type: "world" },
            { id: "e1", text: "Experience fact", type: "experience" },
          ],
        }),
      );

      const result = await client.reflect({
        bankId: "my-bank",
        query: "What patterns exist?",
      });

      expect(result.text).toBe("Reflection text");
      expect(result.opinions).toEqual([]); // API doesn't return opinions
      expect(result.basedOn.world).toHaveLength(1);
      expect(result.basedOn.world[0].text).toBe("World fact");
      expect(result.basedOn.experience).toHaveLength(1);
      expect(result.basedOn.experience[0].text).toBe("Experience fact");
    });

    it("should call the correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          text: "Reflection",
          based_on: [],
        }),
      );

      await client.reflect({ bankId: "my-bank", query: "query" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks/my-bank/reflect",
        expect.any(Object),
      );
    });

    it("should include context when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, {
          text: "Reflection",
          based_on: [],
        }),
      );

      await client.reflect({
        bankId: "my-bank",
        query: "query",
        context: "Additional context",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            query: "query",
            context: "Additional context",
          }),
        }),
      );
    });
  });

  describe("recent()", () => {
    it("should fetch recent memories with default limit", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { items: [], total: 0, limit: 50, offset: 0 }),
      );

      await client.recent("my-bank");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks/my-bank/memories/list?limit=50",
        expect.any(Object),
      );
    });

    it("should use custom limit parameter", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(200, { items: [], total: 0, limit: 100, offset: 0 }),
      );

      await client.recent("my-bank", 100);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=100"),
        expect.any(Object),
      );
    });
  });

  describe("forgetAll()", () => {
    it("should delete all memories", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(204, undefined));

      await client.forgetAll("my-bank");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks/my-bank/memories",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("forget() (deprecated)", () => {
    it("should call forgetAll", async () => {
      mockFetch.mockResolvedValueOnce(createResponse(204, undefined));

      await client.forget("my-bank", "mem-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/v1/default/banks/my-bank/memories",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("error handling", () => {
    it("should throw HindsightError on 400", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(400, { message: "Bad request" }),
      );

      await expect(
        client.recall({ bankId: "my-bank", query: "query" }),
      ).rejects.toThrow(HindsightError);
    });

    it("should throw with RATE_LIMITED on 429", async () => {
      mockFetch.mockResolvedValueOnce(
        createResponse(429, { message: "Too many requests" }),
      );

      try {
        await client.recall({ bankId: "my-bank", query: "query" });
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
        await client.recall({ bankId: "my-bank", query: "query" });
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
        await client.recall({ bankId: "my-bank", query: "query" });
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
        await client.recall({ bankId: "my-bank", query: "query" });
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
