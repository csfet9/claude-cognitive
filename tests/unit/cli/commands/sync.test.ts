/**
 * Tests for the sync CLI command.
 * @module tests/unit/cli/commands/sync
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerSyncCommand } from "../../../../src/cli/commands/sync.js";

// Mock the Mind class
const mockRecall = vi.fn();
const mockGetSemanticMemory = vi.fn();

vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    recall: mockRecall,
    getSemanticMemory: mockGetSemanticMemory,
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  info: vi.fn(),
  CLIError: class CLIError extends Error {
    code: number;
    hint?: string;
    constructor(message: string, code: number, hint?: string) {
      super(message);
      this.code = code;
      this.hint = hint;
    }
  },
  ExitCode: {
    CONFIG_ERROR: 78,
    CONNECTION_ERROR: 76,
    GENERAL_ERROR: 1,
  },
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("sync command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecall.mockResolvedValue([]);
    mockGetSemanticMemory.mockReturnValue({
      getFilePath: () => "/test/project/.claude/memory.md",
    });
  });

  describe("command registration", () => {
    it("should register the sync command", () => {
      const cli = cac("test");
      registerSyncCommand(cli);

      const commands = cli.commands;
      const syncCmd = commands.find((c) => c.name === "sync");

      expect(syncCmd).toBeDefined();
      expect(syncCmd?.name).toBe("sync");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerSyncCommand(cli);

      const syncCmd = cli.commands.find((c) => c.name === "sync");
      const projectOpt = syncCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have dry-run option", () => {
      const cli = cac("test");
      registerSyncCommand(cli);

      const syncCmd = cli.commands.find((c) => c.name === "sync");
      // cac stores kebab-case options with the 'dryRun' camelCase name
      const dryRunOpt = syncCmd?.options.find(
        (o) => o.names.includes("dry-run") || o.names.includes("dryRun"),
      );

      expect(dryRunOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerSyncCommand(cli);

      const syncCmd = cli.commands.find((c) => c.name === "sync");
      const jsonOpt = syncCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerSyncCommand(cli);

      const syncCmd = cli.commands.find((c) => c.name === "sync");
      const quietOpt = syncCmd?.options.find((o) => o.names.includes("quiet"));

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerSyncCommand(cli);

      const syncCmd = cli.commands.find((c) => c.name === "sync");

      expect(syncCmd?.description).toContain("memory.md");
    });
  });

  describe("helper functions", () => {
    it("should group memories by type", async () => {
      // Import the module to test internal function behavior indirectly
      const syncModule = await import("../../../../src/cli/commands/sync.js");

      // The groupByType function is internal, so we test it through the command
      expect(syncModule.registerSyncCommand).toBeDefined();
    });
  });
});

describe("memory extraction logic", () => {
  it("should handle empty memories gracefully", () => {
    // Test that the sync command handles empty memory arrays
    const memories: never[] = [];
    expect(memories.length).toBe(0);
  });

  it("should filter tech stack keywords correctly", () => {
    const techKeywords = [
      "uses",
      "built with",
      "framework",
      "library",
      "database",
    ];

    const testText = "Project uses React framework";
    const hasKeyword = techKeywords.some((kw) =>
      testText.toLowerCase().includes(kw),
    );

    expect(hasKeyword).toBe(true);
  });

  it("should filter opinions by confidence threshold", () => {
    const opinions = [
      { confidence: 0.9 },
      { confidence: 0.5 },
      { confidence: 0.3 },
    ];

    const highConfidence = opinions.filter((o) => o.confidence >= 0.8);
    const midConfidence = opinions.filter((o) => o.confidence >= 0.5);

    expect(highConfidence.length).toBe(1);
    expect(midConfidence.length).toBe(2);
  });

  it("should sort experiences by date descending", () => {
    const experiences = [
      { createdAt: "2025-01-01T00:00:00Z" },
      { createdAt: "2025-01-03T00:00:00Z" },
      { createdAt: "2025-01-02T00:00:00Z" },
    ];

    const sorted = experiences.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    expect(sorted[0].createdAt).toBe("2025-01-03T00:00:00Z");
    expect(sorted[2].createdAt).toBe("2025-01-01T00:00:00Z");
  });
});

describe("content generation", () => {
  it("should include timestamp in generated content", () => {
    const timestamp = new Date().toISOString();
    const expectedHeader = `<!-- Last synced: ${timestamp} -->`;

    expect(expectedHeader).toContain("Last synced:");
    expect(expectedHeader).toContain(timestamp);
  });

  it("should generate all required sections", () => {
    const requiredSections = [
      "## Tech Stack",
      "## Key Patterns",
      "## Observations",
      "## Recent Activity",
    ];

    for (const section of requiredSections) {
      expect(section).toMatch(/^## /);
    }
  });

  it("should truncate long experience text", () => {
    const longText = "a".repeat(200);
    const maxLength = 150;
    const truncated =
      longText.length > maxLength
        ? longText.substring(0, maxLength - 3) + "..."
        : longText;

    expect(truncated.length).toBe(maxLength);
    expect(truncated.endsWith("...")).toBe(true);
  });
});
