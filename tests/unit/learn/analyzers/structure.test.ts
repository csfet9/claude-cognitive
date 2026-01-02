/**
 * Tests for the directory structure analyzer.
 * @module tests/unit/learn/analyzers/structure
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import {
  analyzeStructure,
  getStructureSummary,
} from "../../../../src/learn/analyzers/structure.js";

describe("structure analyzer", () => {
  let tempDir: string;

  beforeEach(async () => {
    const suffix = randomBytes(8).toString("hex");
    tempDir = join(tmpdir(), `claude-cognitive-struct-test-${suffix}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("analyzeStructure()", () => {
    it("should handle empty directory", async () => {
      const result = await analyzeStructure(tempDir);

      expect(result.totalFiles).toBe(0);
      expect(result.sourceDirectories).toEqual([]);
      expect(result.testDirectories).toEqual([]);
    });

    it("should count files", async () => {
      await writeFile(join(tempDir, "file1.ts"), "");
      await writeFile(join(tempDir, "file2.ts"), "");
      await writeFile(join(tempDir, "file3.js"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.totalFiles).toBe(3);
    });

    it("should track file types", async () => {
      await writeFile(join(tempDir, "file1.ts"), "");
      await writeFile(join(tempDir, "file2.ts"), "");
      await writeFile(join(tempDir, "file3.js"), "");
      await writeFile(join(tempDir, "styles.css"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.fileTypes[".ts"]).toBe(2);
      expect(result.fileTypes[".js"]).toBe(1);
      expect(result.fileTypes[".css"]).toBe(1);
    });

    it("should identify source directories", async () => {
      await mkdir(join(tempDir, "src"), { recursive: true });
      await mkdir(join(tempDir, "lib"), { recursive: true });
      await writeFile(join(tempDir, "src", "index.ts"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.sourceDirectories).toContain("src");
      expect(result.sourceDirectories).toContain("lib");
    });

    it("should identify test directories", async () => {
      await mkdir(join(tempDir, "tests"), { recursive: true });
      await mkdir(join(tempDir, "__tests__"), { recursive: true });
      await writeFile(join(tempDir, "tests", "test.ts"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.testDirectories).toContain("tests");
      expect(result.testDirectories).toContain("__tests__");
    });

    it("should skip node_modules", async () => {
      await mkdir(join(tempDir, "node_modules", "package"), { recursive: true });
      await writeFile(join(tempDir, "node_modules", "package", "index.js"), "");
      await writeFile(join(tempDir, "index.ts"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.totalFiles).toBe(1); // Only index.ts
    });

    it("should skip .git directory", async () => {
      await mkdir(join(tempDir, ".git", "objects"), { recursive: true });
      await writeFile(join(tempDir, ".git", "config"), "");
      await writeFile(join(tempDir, "index.ts"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.totalFiles).toBe(1);
    });

    it("should identify config files", async () => {
      await writeFile(join(tempDir, "tsconfig.json"), "{}");
      await writeFile(join(tempDir, "vite.config.ts"), "");
      await writeFile(join(tempDir, ".eslintrc.json"), "{}");
      await writeFile(join(tempDir, ".env"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.configFiles).toContain("tsconfig.json");
      expect(result.configFiles).toContain("vite.config.ts");
      expect(result.configFiles).toContain(".eslintrc.json");
      expect(result.configFiles).toContain(".env");
    });

    it("should identify entry points", async () => {
      await mkdir(join(tempDir, "src"), { recursive: true });
      await writeFile(join(tempDir, "src", "index.ts"), "");
      await writeFile(join(tempDir, "src", "main.ts"), "");
      await writeFile(join(tempDir, "server.js"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.entryPoints).toContain("src/index.ts");
      expect(result.entryPoints).toContain("src/main.ts");
      expect(result.entryPoints).toContain("server.js");
    });

    it("should track top-level directories", async () => {
      await mkdir(join(tempDir, "src"), { recursive: true });
      await mkdir(join(tempDir, "docs"), { recursive: true });
      await mkdir(join(tempDir, "scripts"), { recursive: true });

      const result = await analyzeStructure(tempDir);

      expect(result.topLevelDirs).toContain("src");
      expect(result.topLevelDirs).toContain("docs");
      expect(result.topLevelDirs).toContain("scripts");
    });

    it("should respect maxDepth", async () => {
      await mkdir(join(tempDir, "a", "b", "c", "d", "e"), { recursive: true });
      await writeFile(join(tempDir, "a", "b", "c", "d", "e", "deep.ts"), "");

      const shallow = await analyzeStructure(tempDir, 2);
      const deep = await analyzeStructure(tempDir, 10);

      expect(shallow.totalFiles).toBe(0); // Can't reach depth 5
      expect(deep.totalFiles).toBe(1);
    });

    it("should handle files without extensions", async () => {
      await writeFile(join(tempDir, "Makefile"), "");
      await writeFile(join(tempDir, "Dockerfile"), "");

      const result = await analyzeStructure(tempDir);

      expect(result.fileTypes["(no ext)"]).toBe(2);
    });
  });

  describe("getStructureSummary()", () => {
    it("should summarize source and test directories", async () => {
      await mkdir(join(tempDir, "src"), { recursive: true });
      await mkdir(join(tempDir, "tests"), { recursive: true });
      await writeFile(join(tempDir, "src", "index.ts"), "");

      const analysis = await analyzeStructure(tempDir);
      const summary = getStructureSummary(analysis);

      expect(summary).toContain("Source: src");
      expect(summary).toContain("Tests: tests");
    });

    it("should show top file types", async () => {
      await writeFile(join(tempDir, "a.ts"), "");
      await writeFile(join(tempDir, "b.ts"), "");
      await writeFile(join(tempDir, "c.js"), "");

      const analysis = await analyzeStructure(tempDir);
      const summary = getStructureSummary(analysis);

      expect(summary).toContain(".ts(2)");
      expect(summary).toContain(".js(1)");
    });

    it("should show total file count", async () => {
      await writeFile(join(tempDir, "a.ts"), "");
      await writeFile(join(tempDir, "b.ts"), "");

      const analysis = await analyzeStructure(tempDir);
      const summary = getStructureSummary(analysis);

      expect(summary).toContain("Total: 2 files");
    });
  });
});
