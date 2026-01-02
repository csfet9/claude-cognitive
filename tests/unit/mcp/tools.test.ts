/**
 * Tests for MCP tool definitions.
 * @module tests/unit/mcp/tools
 */

import { describe, it, expect } from "vitest";
import {
  recallInputSchema,
  reflectInputSchema,
  TOOL_DEFINITIONS,
} from "../../../src/mcp/tools.js";

describe("MCP tools", () => {
  describe("recallInputSchema", () => {
    it("should accept valid query", () => {
      const result = recallInputSchema.safeParse({ query: "authentication" });
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      const result = recallInputSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing query", () => {
      const result = recallInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept valid type", () => {
      const types = ["world", "experience", "opinion", "all"];
      for (const type of types) {
        const result = recallInputSchema.safeParse({
          query: "test",
          type,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe(type);
        }
      }
    });

    it("should reject invalid type", () => {
      const result = recallInputSchema.safeParse({
        query: "test",
        type: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should make type optional", () => {
      const result = recallInputSchema.safeParse({ query: "test" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBeUndefined();
      }
    });
  });

  describe("reflectInputSchema", () => {
    it("should accept valid query", () => {
      const result = reflectInputSchema.safeParse({
        query: "What patterns do I see?",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      const result = reflectInputSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing query", () => {
      const result = reflectInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("TOOL_DEFINITIONS", () => {
    it("should have memory_recall tool", () => {
      expect(TOOL_DEFINITIONS.memory_recall).toBeDefined();
      expect(TOOL_DEFINITIONS.memory_recall.name).toBe("memory_recall");
      expect(TOOL_DEFINITIONS.memory_recall.description).toContain("memories");
      expect(TOOL_DEFINITIONS.memory_recall.inputSchema).toBe(recallInputSchema);
    });

    it("should have memory_reflect tool", () => {
      expect(TOOL_DEFINITIONS.memory_reflect).toBeDefined();
      expect(TOOL_DEFINITIONS.memory_reflect.name).toBe("memory_reflect");
      expect(TOOL_DEFINITIONS.memory_reflect.description).toContain("Reason");
      expect(TOOL_DEFINITIONS.memory_reflect.inputSchema).toBe(
        reflectInputSchema,
      );
    });

    it("should have descriptive descriptions", () => {
      expect(TOOL_DEFINITIONS.memory_recall.description.length).toBeGreaterThan(
        50,
      );
      expect(
        TOOL_DEFINITIONS.memory_reflect.description.length,
      ).toBeGreaterThan(50);
    });
  });
});
