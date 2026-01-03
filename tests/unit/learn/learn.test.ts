/**
 * Tests for the learn operation.
 * @module tests/unit/learn/learn
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { learn } from "../../../src/learn/index.js";
import type { HindsightClient } from "../../../src/client.js";

// Mock all analyzers
vi.mock("../../../src/learn/analyzers/index.js", () => ({
  analyzeReadme: vi.fn().mockResolvedValue({
    hasReadme: true,
    projectDescription: "Test project",
    features: ["Feature 1", "Feature 2"],
    setupInstructions: ["npm install"],
    sections: [],
  }),
  analyzePackage: vi.fn().mockResolvedValue({
    name: "test-project",
    version: "1.0.0",
    scripts: { build: "tsc", test: "vitest" },
    dependencies: [
      { name: "react", version: "^18.0.0", category: "framework" },
    ],
    devDependencies: [
      { name: "typescript", version: "^5.0.0", category: "build" },
    ],
  }),
  analyzeStructure: vi.fn().mockResolvedValue({
    totalFiles: 10,
    totalDirs: 5,
    sourceDirectories: ["src"],
    testDirectories: ["tests"],
    entryPoints: ["src/index.ts"],
    fileTypes: { ts: 8, md: 2 },
  }),
  analyzeGitHistory: vi.fn().mockResolvedValue({
    totalCommits: 50,
    contributors: [{ name: "Dev", email: "dev@test.com", commits: 50 }],
    hotspots: [{ path: "src/main.ts", changes: 20 }],
    conventions: { commitPrefix: "feat", branchPattern: "main" },
  }),
  analyzeSource: vi.fn().mockResolvedValue({
    namingConventions: { camelCase: true },
    importStyle: "esm",
    asyncStyle: "async-await",
    errorHandling: "try-catch",
    patterns: [],
  }),
}));

// Mock extractor
vi.mock("../../../src/learn/extractor.js", () => ({
  createFactExtractor: vi.fn().mockReturnValue({
    extractFacts: vi.fn().mockReturnValue([
      { content: "Project uses React framework", context: "From package.json" },
      { content: "TypeScript is used", context: "From package.json" },
      { content: "Has 10 source files", context: "From structure" },
    ]),
  }),
}));

describe("learn()", () => {
  let mockClient: HindsightClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      retain: vi.fn().mockResolvedValue(["mem-1"]),
      reflect: vi.fn().mockResolvedValue({
        text: "Reflection text",
        opinions: [{ opinion: "Test opinion", confidence: 0.85 }],
        basedOn: { world: [], experience: [], opinion: [] },
      }),
    } as unknown as HindsightClient;
  });

  describe("quick depth", () => {
    it("should run analysis and return result", async () => {
      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.worldFacts).toBe(3); // 3 facts from mock
      expect(result.filesAnalyzed).toBe(10);
      expect(result.summary).toContain("Learned 3 world facts");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should store facts via retain()", async () => {
      await learn(mockClient, "test-bank", "/test/project", { depth: "quick" });

      expect(mockClient.retain).toHaveBeenCalledTimes(3);
      expect(mockClient.retain).toHaveBeenCalledWith(
        "test-bank",
        "Project uses React framework",
        "From package.json",
      );
    });

    it("should form opinions via reflect()", async () => {
      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      // Quick depth has 1 reflection query
      expect(mockClient.reflect).toHaveBeenCalledTimes(1);
      expect(result.opinions).toHaveLength(1);
      expect(result.opinions[0].confidence).toBe(0.85);
    });
  });

  describe("standard depth", () => {
    it("should run more reflection queries", async () => {
      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "standard",
      });

      // Standard depth has 3 reflection queries
      expect(mockClient.reflect).toHaveBeenCalledTimes(3);
      expect(result.opinions).toHaveLength(3); // 1 opinion per query
    });
  });

  describe("full depth", () => {
    it("should run all reflection queries", async () => {
      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "full",
      });

      // Full depth has 5 reflection queries
      expect(mockClient.reflect).toHaveBeenCalledTimes(5);
    });
  });

  describe("error handling", () => {
    it("should continue if retain() fails for some facts", async () => {
      let callCount = 0;
      (mockClient.retain as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Failed to store"));
        }
        return Promise.resolve(["mem-1"]);
      });

      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.worldFacts).toBe(2); // 2 succeeded, 1 failed
      expect(result.summary).toContain("1 facts failed");
    });

    it("should continue if reflect() fails", async () => {
      (mockClient.reflect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Reflection failed"),
      );

      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.opinions).toEqual([]);
      expect(result.worldFacts).toBe(3); // Facts still stored
    });
  });

  describe("summary generation", () => {
    it("should include facts count and duration", async () => {
      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.summary).toMatch(/Learned \d+ world facts/);
      expect(result.summary).toMatch(/Duration: \d+\.\d+s/);
    });

    it("should include opinions with avg confidence", async () => {
      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.summary).toContain("formed 1 opinions");
      expect(result.summary).toContain("avg confidence");
    });
  });

  describe("entity collection", () => {
    it("should collect entities from reflection results", async () => {
      (mockClient.reflect as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "Reflection",
        opinions: [],
        basedOn: {
          world: [
            {
              id: "mem-1",
              text: "Test",
              factType: "world",
              createdAt: "2024-01-01",
              entities: [
                {
                  id: "ent-1",
                  name: "React",
                  aliases: [],
                  type: "concept",
                  coOccurrences: [],
                },
              ],
            },
          ],
          experience: [],
          opinion: [],
        },
      });

      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe("React");
    });

    it("should deduplicate entities", async () => {
      (mockClient.reflect as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "Reflection",
        opinions: [],
        basedOn: {
          world: [
            {
              id: "mem-1",
              text: "Test",
              factType: "world",
              createdAt: "2024-01-01",
              entities: [
                {
                  id: "ent-1",
                  name: "React",
                  aliases: [],
                  type: "concept",
                  coOccurrences: [],
                },
              ],
            },
            {
              id: "mem-2",
              text: "Test 2",
              factType: "world",
              createdAt: "2024-01-01",
              entities: [
                {
                  id: "ent-1",
                  name: "React",
                  aliases: [],
                  type: "concept",
                  coOccurrences: [],
                }, // Same entity
              ],
            },
          ],
          experience: [],
          opinion: [],
        },
      });

      const result = await learn(mockClient, "test-bank", "/test/project", {
        depth: "quick",
      });

      expect(result.entities).toHaveLength(1); // Deduplicated
    });
  });
});
