/**
 * Tests for MCP tool handlers.
 * @module tests/unit/mcp/handlers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRecall, handleReflect } from "../../../src/mcp/handlers.js";
import type { Mind } from "../../../src/mind.js";

describe("MCP handlers", () => {
  let mockMind: Mind;

  beforeEach(() => {
    mockMind = {
      recall: vi.fn(),
      reflect: vi.fn(),
    } as unknown as Mind;
  });

  describe("handleRecall()", () => {
    it("should return formatted memories on success", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "mem-1",
          text: "Test memory content",
          factType: "world",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ]);

      const result = await handleRecall(mockMind, { query: "test query" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Found 1 relevant memories");
      expect(result.content[0].text).toContain("Test memory content");
      expect(result.content[0].text).toContain("[world]");
    });

    it("should pass type filter to recall", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await handleRecall(mockMind, { query: "test", type: "experience" });

      expect(mockMind.recall).toHaveBeenCalledWith("test", {
        factType: "experience",
      });
    });

    it("should not pass filter for type 'all'", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await handleRecall(mockMind, { query: "test", type: "all" });

      expect(mockMind.recall).toHaveBeenCalledWith("test", undefined);
    });

    it("should handle empty results", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await handleRecall(mockMind, { query: "test" });

      expect(result.content[0].text).toBe("No relevant memories found.");
    });

    it("should include confidence for opinions", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "mem-1",
          text: "An opinion",
          factType: "opinion",
          createdAt: "2024-01-01T00:00:00Z",
          confidence: 0.85,
        },
      ]);

      const result = await handleRecall(mockMind, { query: "test" });

      expect(result.content[0].text).toContain("Confidence: 85%");
    });

    it("should include context when available", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "mem-1",
          text: "Memory with context",
          factType: "experience",
          createdAt: "2024-01-01T00:00:00Z",
          context: "Additional context info",
        },
      ]);

      const result = await handleRecall(mockMind, { query: "test" });

      expect(result.content[0].text).toContain("Context: Additional context info");
    });

    it("should return error on failure", async () => {
      (mockMind.recall as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection failed"),
      );

      const result = await handleRecall(mockMind, { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error searching memories");
      expect(result.content[0].text).toContain("Connection failed");
    });
  });

  describe("handleReflect()", () => {
    it("should return formatted reflection on success", async () => {
      (mockMind.reflect as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "This is my reflection on the topic.",
        opinions: [{ opinion: "Test opinion", confidence: 0.9 }],
        basedOn: {
          world: [{ id: "w1", text: "World fact", factType: "world", createdAt: "" }],
          experience: [],
          opinion: [],
        },
      });

      const result = await handleReflect(mockMind, { query: "What do you think?" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("This is my reflection");
      expect(result.content[0].text).toContain("Opinions formed:");
      expect(result.content[0].text).toContain("Test opinion (90% confidence)");
      expect(result.content[0].text).toContain("Based on 1 memories");
    });

    it("should handle reflection with no opinions", async () => {
      (mockMind.reflect as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "Simple reflection",
        opinions: [],
        basedOn: { world: [], experience: [], opinion: [] },
      });

      const result = await handleReflect(mockMind, { query: "test" });

      expect(result.content[0].text).toContain("Simple reflection");
      expect(result.content[0].text).not.toContain("Opinions formed:");
    });

    it("should show memory counts by type", async () => {
      (mockMind.reflect as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "Reflection",
        opinions: [],
        basedOn: {
          world: [{ id: "w1", text: "", factType: "world", createdAt: "" }],
          experience: [
            { id: "e1", text: "", factType: "experience", createdAt: "" },
            { id: "e2", text: "", factType: "experience", createdAt: "" },
          ],
          opinion: [{ id: "o1", text: "", factType: "opinion", createdAt: "" }],
        },
      });

      const result = await handleReflect(mockMind, { query: "test" });

      expect(result.content[0].text).toContain("4 memories");
      expect(result.content[0].text).toContain("1 world facts");
      expect(result.content[0].text).toContain("2 experiences");
      expect(result.content[0].text).toContain("1 prior opinions");
    });

    it("should return error on failure", async () => {
      (mockMind.reflect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Reflection failed"),
      );

      const result = await handleReflect(mockMind, { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error reflecting");
    });

    it("should handle degraded mode error specifically", async () => {
      (mockMind.reflect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Operation requires Hindsight connection"),
      );

      const result = await handleReflect(mockMind, { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Hindsight server is unavailable");
      expect(result.content[0].text).toContain("degraded mode");
    });
  });
});
