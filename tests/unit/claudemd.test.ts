/**
 * Tests for the CLAUDE.md managed section writer.
 * @module tests/unit/claudemd
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock the agents loader
vi.mock("../../src/agents/loader.js", () => {
  return {
    loadCustomAgents: vi.fn().mockResolvedValue([]),
  };
});

import {
  generateClaudeMdSection,
  updateClaudeMd,
  removeClaudeMdSection,
} from "../../src/claudemd.js";
import type { ClaudeMindConfig } from "../../src/types.js";

function makeConfig(
  overrides: Partial<ClaudeMindConfig> = {},
): ClaudeMindConfig {
  return {
    hindsight: { host: "localhost", port: 8888 },
    ...overrides,
  };
}

describe("claudemd", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claudemd-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("generateClaudeMdSection()", () => {
    it("should always include team workflow", async () => {
      const section = await generateClaudeMdSection(tempDir, makeConfig());
      expect(section).toContain("<!-- claude-cognitive:start -->");
      expect(section).toContain("<!-- claude-cognitive:end -->");
      expect(section).toContain("## Team-First Workflow");
    });

    it("should include security review when enabled", async () => {
      const config = makeConfig({
        securityReview: { enabled: true },
      });
      const section = await generateClaudeMdSection(tempDir, config);
      expect(section).toContain("## Security Review Required");
      expect(section).toContain("security-code-reviewer");
    });

    it("should not include security review when disabled", async () => {
      const config = makeConfig({
        securityReview: { enabled: false },
      });
      const section = await generateClaudeMdSection(tempDir, config);
      expect(section).not.toContain("## Security Review Required");
    });

    it("should include changelog when enabled", async () => {
      const config = makeConfig({
        changelog: { enabled: true },
      });
      const section = await generateClaudeMdSection(tempDir, config);
      expect(section).toContain("## Changelog Required");
      expect(section).toContain("CHANGELOG.md");
    });

    it("should use custom changelog path", async () => {
      const config = makeConfig({
        changelog: { enabled: true, path: "docs/CHANGES.md" },
      });
      const section = await generateClaudeMdSection(tempDir, config);
      expect(section).toContain("docs/CHANGES.md");
    });

    it("should include gemini guidance when configured", async () => {
      const config = makeConfig({
        gemini: { model: "auto", timeout: 120000 },
      });
      const section = await generateClaudeMdSection(tempDir, config);
      expect(section).toContain("## Gemini CLI for Code Exploration");
    });

    it("should not include gemini guidance when not configured", async () => {
      const section = await generateClaudeMdSection(tempDir, makeConfig());
      expect(section).not.toContain("Gemini");
    });
  });

  describe("updateClaudeMd()", () => {
    it("should create CLAUDE.md if it does not exist", async () => {
      await updateClaudeMd(tempDir, makeConfig());

      const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("<!-- claude-cognitive:start -->");
      expect(content).toContain("## Team-First Workflow");
      expect(content).toContain("<!-- claude-cognitive:end -->");
    });

    it("should append section to existing CLAUDE.md", async () => {
      const existing = "# My Project\n\nSome docs here.\n";
      await writeFile(join(tempDir, "CLAUDE.md"), existing);

      await updateClaudeMd(tempDir, makeConfig());

      const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("Some docs here.");
      expect(content).toContain("<!-- claude-cognitive:start -->");
    });

    it("should replace existing managed section", async () => {
      // Write initial section
      await updateClaudeMd(
        tempDir,
        makeConfig({ securityReview: { enabled: true } }),
      );

      let content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("## Security Review Required");

      // Update with security review disabled
      await updateClaudeMd(
        tempDir,
        makeConfig({ securityReview: { enabled: false } }),
      );

      content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).not.toContain("## Security Review Required");
      expect(content).toContain("## Team-First Workflow");
    });

    it("should preserve user content when replacing section", async () => {
      const userContent =
        "# My Project\n\nImportant docs.\n\n## Custom Section\n\nUser stuff.\n";
      await writeFile(join(tempDir, "CLAUDE.md"), userContent);

      await updateClaudeMd(tempDir, makeConfig());

      const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("Important docs.");
      expect(content).toContain("## Custom Section");
      expect(content).toContain("<!-- claude-cognitive:start -->");
    });
  });

  describe("removeClaudeMdSection()", () => {
    it("should remove managed section from CLAUDE.md", async () => {
      await updateClaudeMd(tempDir, makeConfig());

      const removed = await removeClaudeMdSection(tempDir);
      expect(removed).toBe(true);

      const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).not.toContain("<!-- claude-cognitive:start -->");
      expect(content).not.toContain("## Team-First Workflow");
    });

    it("should return false when no section exists", async () => {
      await writeFile(
        join(tempDir, "CLAUDE.md"),
        "# My Project\n\nNo managed section.\n",
      );

      const removed = await removeClaudeMdSection(tempDir);
      expect(removed).toBe(false);
    });

    it("should return false when CLAUDE.md does not exist", async () => {
      const removed = await removeClaudeMdSection(tempDir);
      expect(removed).toBe(false);
    });

    it("should preserve surrounding content", async () => {
      const before = "# My Project\n\nBefore section.\n";
      await writeFile(join(tempDir, "CLAUDE.md"), before);
      await updateClaudeMd(tempDir, makeConfig());

      // Add content after
      let content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      content += "\n## After Section\n\nAfter content.\n";
      await writeFile(join(tempDir, "CLAUDE.md"), content);

      await removeClaudeMdSection(tempDir);

      const result = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(result).toContain("# My Project");
      expect(result).toContain("Before section.");
      expect(result).toContain("## After Section");
      expect(result).not.toContain("claude-cognitive");
    });
  });
});
