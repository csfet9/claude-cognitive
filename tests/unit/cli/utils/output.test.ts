/**
 * Tests for CLI output utilities.
 * @module tests/unit/cli/utils/output
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  output,
  info,
  warn,
  formatMemories,
  formatOpinions,
  formatStatus,
  formatLearnResult,
  formatConfig,
} from "../../../../src/cli/utils/output.js";
import type { Memory, Opinion } from "../../../../src/types.js";

describe("CLI output", () => {
  let mockLog: ReturnType<typeof vi.spyOn>;
  let mockError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
  });

  describe("output()", () => {
    const formatter = (data: { value: number }) => `Value: ${data.value}`;

    it("should output formatted data", () => {
      output({ value: 42 }, formatter);

      expect(mockLog).toHaveBeenCalledWith("Value: 42");
    });

    it("should output JSON when json option is true", () => {
      output({ value: 42 }, formatter, { json: true });

      expect(mockLog).toHaveBeenCalledWith(
        JSON.stringify({ value: 42 }, null, 2),
      );
    });

    it("should suppress output when quiet is true", () => {
      output({ value: 42 }, formatter, { quiet: true });

      expect(mockLog).not.toHaveBeenCalled();
    });
  });

  describe("info()", () => {
    it("should output to stderr", () => {
      info("Information message");

      expect(mockError).toHaveBeenCalledWith("Information message");
    });

    it("should suppress in quiet mode", () => {
      info("Information message", { quiet: true });

      expect(mockError).not.toHaveBeenCalled();
    });

    it("should suppress in json mode", () => {
      info("Information message", { json: true });

      expect(mockError).not.toHaveBeenCalled();
    });
  });

  describe("warn()", () => {
    it("should output warning to stderr", () => {
      warn("Something is wrong");

      expect(mockError).toHaveBeenCalledWith("Warning: Something is wrong");
    });

    it("should suppress in quiet mode", () => {
      warn("Something is wrong", { quiet: true });

      expect(mockError).not.toHaveBeenCalled();
    });

    it("should suppress in json mode", () => {
      warn("Something is wrong", { json: true });

      expect(mockError).not.toHaveBeenCalled();
    });
  });

  describe("formatMemories()", () => {
    it("should format empty array", () => {
      const result = formatMemories([]);
      expect(result).toBe("No memories found.");
    });

    it("should format memories with all fields", () => {
      const memories: Memory[] = [
        {
          id: "mem-1",
          text: "The project uses TypeScript.",
          factType: "world",
          createdAt: "2024-01-15T10:00:00Z",
          context: "From package.json",
        },
      ];

      const result = formatMemories(memories);

      expect(result).toContain("[WORLD]");
      expect(result).toContain("1/15/2024");
      expect(result).toContain("The project uses TypeScript.");
      expect(result).toContain("Context: From package.json");
    });

    it("should include confidence for opinions", () => {
      const memories: Memory[] = [
        {
          id: "mem-1",
          text: "This is a well-structured codebase.",
          factType: "opinion",
          createdAt: "2024-01-15T10:00:00Z",
          confidence: 0.85,
        },
      ];

      const result = formatMemories(memories);

      expect(result).toContain("[OPINION]");
      expect(result).toContain("(85%)");
    });

    it("should format multiple memories", () => {
      const memories: Memory[] = [
        {
          id: "mem-1",
          text: "First memory.",
          factType: "world",
          createdAt: "2024-01-15T10:00:00Z",
        },
        {
          id: "mem-2",
          text: "Second memory.",
          factType: "experience",
          createdAt: "2024-01-16T10:00:00Z",
        },
      ];

      const result = formatMemories(memories);

      expect(result).toContain("First memory.");
      expect(result).toContain("Second memory.");
      expect(result).toContain("[WORLD]");
      expect(result).toContain("[EXPERIENCE]");
    });
  });

  describe("formatOpinions()", () => {
    it("should format empty array", () => {
      const result = formatOpinions([]);
      expect(result).toBe("No opinions formed.");
    });

    it("should format opinions with confidence", () => {
      const opinions: Opinion[] = [
        { opinion: "Code is well organized.", confidence: 0.9 },
        { opinion: "Tests need improvement.", confidence: 0.75 },
      ];

      const result = formatOpinions(opinions);

      expect(result).toContain("Code is well organized. (90% confidence)");
      expect(result).toContain("Tests need improvement. (75% confidence)");
    });
  });

  describe("formatStatus()", () => {
    it("should format connected status", () => {
      const status = {
        hindsight: { healthy: true, version: "1.0.0" },
        bankId: "test-bank",
        memoryCount: 42,
        semanticPath: ".claude/memory.md",
        semanticLoaded: true,
        degraded: false,
      };

      const result = formatStatus(status);

      expect(result).toContain("Hindsight: Connected (v1.0.0)");
      expect(result).toContain("Bank: test-bank");
      expect(result).toContain("Memories: 42");
      expect(result).toContain("Semantic: .claude/memory.md (loaded)");
      expect(result).not.toContain("DEGRADED");
    });

    it("should format disconnected status", () => {
      const status = {
        hindsight: { healthy: false, error: "Connection refused" },
        bankId: "test-bank",
        semanticPath: ".claude/memory.md",
        semanticLoaded: false,
        degraded: true,
      };

      const result = formatStatus(status);

      expect(result).toContain("Hindsight: Disconnected - Connection refused");
      expect(result).toContain("not loaded");
      expect(result).toContain("DEGRADED mode");
    });
  });

  describe("formatLearnResult()", () => {
    it("should format learn result", () => {
      const result = {
        summary: "Learned 10 facts about the project.",
        worldFacts: 10,
        opinions: [{ opinion: "Well structured.", confidence: 0.85 }],
        filesAnalyzed: 50,
        duration: 2500,
      };

      const formatted = formatLearnResult(result);

      expect(formatted).toContain("Learned 10 facts about the project.");
      expect(formatted).toContain("Files analyzed: 50");
      expect(formatted).toContain("World facts stored: 10");
      expect(formatted).toContain("Opinions formed: 1");
      expect(formatted).toContain("Duration: 2.5s");
      expect(formatted).toContain("Well structured. (85%)");
    });

    it("should handle no opinions", () => {
      const result = {
        summary: "Learned 5 facts.",
        worldFacts: 5,
        opinions: [],
        filesAnalyzed: 20,
        duration: 1000,
      };

      const formatted = formatLearnResult(result);

      expect(formatted).toContain("Opinions formed: 0");
      expect(formatted).not.toContain("Opinions:");
    });
  });

  describe("formatConfig()", () => {
    it("should format complete config", () => {
      const config = {
        hindsight: { host: "localhost", port: 8888, apiKey: "secret" },
        bankId: "my-project",
        disposition: { skepticism: 3, literalism: 4, empathy: 5 },
        background: "Senior developer",
        semantic: { path: ".claude/memory.md" },
      };

      const result = formatConfig(config);

      expect(result).toContain("Host: localhost");
      expect(result).toContain("Port: 8888");
      expect(result).toContain("API Key: ***");
      expect(result).toContain("Bank ID: my-project");
      expect(result).toContain("Skepticism: 3/5");
      expect(result).toContain("Literalism: 4/5");
      expect(result).toContain("Empathy: 5/5");
      expect(result).toContain("Background: Senior developer");
      expect(result).toContain("Semantic Memory: .claude/memory.md");
    });

    it("should format minimal config", () => {
      const config = {
        hindsight: { host: "localhost", port: 8888 },
      };

      const result = formatConfig(config);

      expect(result).toContain("Host: localhost");
      expect(result).toContain("Port: 8888");
      expect(result).toContain("API Key: (not set)");
      expect(result).not.toContain("Bank ID:");
      expect(result).not.toContain("Disposition:");
    });
  });
});
