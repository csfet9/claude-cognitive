/**
 * Tests for the git history analyzer.
 * @module tests/unit/learn/analyzers/git
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeGitHistory, getGitSummary } from "../../../../src/learn/analyzers/git.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  exec: vi.fn((cmd, opts, callback) => {
    // Handle callback form
    if (typeof opts === "function") {
      callback = opts;
    }
  }),
}));

// Mock promisify to return our mock exec
vi.mock("node:util", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:util")>();
  return {
    ...original,
    promisify: vi.fn(() => {
      return vi.fn();
    }),
  };
});

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  stat: vi.fn(),
}));

describe("git analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeGitHistory()", () => {
    it("should return null if .git directory does not exist", async () => {
      const { stat } = await import("node:fs/promises");
      (stat as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("ENOENT"),
      );

      const result = await analyzeGitHistory("/test/project");

      expect(result).toBeNull();
    });
  });

  describe("getGitSummary()", () => {
    it("should format basic summary", () => {
      const analysis = {
        totalCommits: 50,
        contributors: ["Alice", "Bob", "Charlie"],
        significantCommits: [],
        hotspots: [],
        commitPatterns: {
          avgCommitsPerDay: 2.5,
        },
      };

      const summary = getGitSummary(analysis);

      expect(summary).toContain("50 commits");
      expect(summary).toContain("3 contributors");
    });

    it("should include commit convention if detected", () => {
      const analysis = {
        totalCommits: 100,
        contributors: ["Dev"],
        significantCommits: [],
        hotspots: [],
        commitPatterns: {
          avgCommitsPerDay: 5,
          messageConvention: "Conventional Commits",
        },
      };

      const summary = getGitSummary(analysis);

      expect(summary).toContain("Conventional Commits");
    });

    it("should include top hotspots", () => {
      const analysis = {
        totalCommits: 75,
        contributors: ["Dev1", "Dev2"],
        significantCommits: [],
        hotspots: [
          { file: "src/main.ts", changeCount: 20 },
          { file: "src/utils.ts", changeCount: 15 },
          { file: "src/api.ts", changeCount: 10 },
          { file: "tests/main.test.ts", changeCount: 8 },
        ],
        commitPatterns: {
          avgCommitsPerDay: 3,
        },
      };

      const summary = getGitSummary(analysis);

      expect(summary).toContain("Hotspots:");
      expect(summary).toContain("src/main.ts");
      expect(summary).toContain("src/utils.ts");
      expect(summary).toContain("src/api.ts");
      // Should only show top 3
      expect(summary).not.toContain("tests/main.test.ts");
    });

    it("should handle empty analysis", () => {
      const analysis = {
        totalCommits: 0,
        contributors: [],
        significantCommits: [],
        hotspots: [],
        commitPatterns: {
          avgCommitsPerDay: 0,
        },
      };

      const summary = getGitSummary(analysis);

      expect(summary).toContain("0 commits");
      expect(summary).toContain("0 contributors");
    });
  });
});
