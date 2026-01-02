/**
 * Tests for the SemanticMemory class.
 * @module tests/semantic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SemanticMemory, DEFAULT_TEMPLATE } from "../src/semantic.js";

describe("SemanticMemory", () => {
  let testDir: string;
  let semanticPath: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `claude-mind-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    semanticPath = ".claude/memory.md";
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("constructor", () => {
    it("should create instance with default path", () => {
      const semantic = new SemanticMemory(testDir);
      expect(semantic.getFilePath()).toBe(join(testDir, ".claude/memory.md"));
    });

    it("should create instance with custom path", () => {
      const semantic = new SemanticMemory(testDir, "custom/memory.md");
      expect(semantic.getFilePath()).toBe(join(testDir, "custom/memory.md"));
    });

    it("should handle absolute paths", () => {
      const absolutePath = "/tmp/absolute/memory.md";
      const semantic = new SemanticMemory(testDir, absolutePath);
      expect(semantic.getFilePath()).toBe(absolutePath);
    });
  });

  describe("load()", () => {
    it("should load existing file", async () => {
      // Create file
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## Section One\n\nContent here\n\n## Section Two\n\nMore content\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.isLoaded()).toBe(true);
      expect(semantic.get("Section One")).toBe("\nContent here\n");
      expect(semantic.get("Section Two")).toBe("\nMore content\n");
    });

    it("should parse sections correctly", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## Tech Stack\n\n- React\n- Node.js\n\n## Decisions\n\n- Use TypeScript\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.getSectionNames()).toEqual(["Tech Stack", "Decisions"]);
      expect(semantic.get("Tech Stack")).toContain("React");
      expect(semantic.get("Decisions")).toContain("TypeScript");
    });

    it("should create file if missing and createIfMissing is true", async () => {
      const semantic = new SemanticMemory(testDir, semanticPath, {
        createIfMissing: true,
      });
      await semantic.load();

      expect(semantic.isLoaded()).toBe(true);
      expect(semantic.getSectionNames()).toContain("Tech Stack");
      expect(semantic.getSectionNames()).toContain("Observations");

      // Verify file was created
      const content = await readFile(join(testDir, semanticPath), "utf-8");
      expect(content).toBe(DEFAULT_TEMPLATE);
    });

    it("should throw if file missing and createIfMissing is false", async () => {
      const semantic = new SemanticMemory(testDir, semanticPath, {
        createIfMissing: false,
      });

      await expect(semantic.load()).rejects.toThrow();
    });

    it("should handle empty file", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(filePath, "", "utf-8");

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.isLoaded()).toBe(true);
      expect(semantic.getSectionNames()).toEqual([]);
    });

    it("should preserve preamble content", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `# Title\n\nPreamble text here.\n\n## Section\n\nContent\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      // Preamble is preserved internally and in output
      expect(semantic.getSectionNames()).toEqual(["Section"]);
    });

    it("should preserve section order", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## Zebra\n\n## Alpha\n\n## Middle\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.getSectionNames()).toEqual(["Zebra", "Alpha", "Middle"]);
    });
  });

  describe("save()", () => {
    it("should throw if not loaded", async () => {
      const semantic = new SemanticMemory(testDir);

      await expect(semantic.save()).rejects.toThrow(
        "SemanticMemory not loaded",
      );
    });

    it("should not write if not dirty", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      // Should not throw and should be a no-op
      await semantic.save();
      expect(semantic.isDirty()).toBe(false);
    });

    it("should write modified content", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.set("Tech Stack", "\n- Custom content\n");
      await semantic.save();

      const content = await readFile(join(testDir, semanticPath), "utf-8");
      expect(content).toContain("Custom content");
    });

    it("should create parent directory if missing", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      // Delete the directory
      await rm(join(testDir, ".claude"), { recursive: true, force: true });

      semantic.set("Test", "\nContent\n");
      await semantic.save();

      // Should recreate and save
      const content = await readFile(join(testDir, semanticPath), "utf-8");
      expect(content).toContain("Content");
    });

    it("should handle concurrent save calls", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.set("Test1", "\nContent 1\n");
      const save1 = semantic.save();

      semantic.set("Test2", "\nContent 2\n");
      const save2 = semantic.save();

      await Promise.all([save1, save2]);

      const content = await readFile(join(testDir, semanticPath), "utf-8");
      expect(content).toContain("Content 1");
      expect(content).toContain("Content 2");
    });
  });

  describe("get()", () => {
    it("should return section content", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(filePath, `## Test\n\nHello world\n`, "utf-8");

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.get("Test")).toContain("Hello world");
    });

    it("should return undefined for missing section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.get("NonExistent")).toBeUndefined();
    });

    it("should throw if not loaded", () => {
      const semantic = new SemanticMemory(testDir);

      expect(() => semantic.get("Test")).toThrow("SemanticMemory not loaded");
    });
  });

  describe("set()", () => {
    it("should update existing section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.set("Tech Stack", "\n- Updated\n");

      expect(semantic.get("Tech Stack")).toBe("\n- Updated\n");
      expect(semantic.isDirty()).toBe(true);
    });

    it("should create new section at end", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      const originalSections = semantic.getSectionNames().length;
      semantic.set("New Section", "\nNew content\n");

      expect(semantic.getSectionNames()).toContain("New Section");
      expect(semantic.getSectionNames().length).toBe(originalSections + 1);
      expect(semantic.getSectionNames().at(-1)).toBe("New Section");
    });

    it("should mark as dirty", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.isDirty()).toBe(false);
      semantic.set("Test", "Content");
      expect(semantic.isDirty()).toBe(true);
    });
  });

  describe("append()", () => {
    it("should append to existing section", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(filePath, `## Test\n\n- Item 1\n`, "utf-8");

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.append("Test", "- Item 2");

      expect(semantic.get("Test")).toContain("- Item 1");
      expect(semantic.get("Test")).toContain("- Item 2");
    });

    it("should create section if missing", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.append("New Section", "- First item");

      expect(semantic.has("New Section")).toBe(true);
      expect(semantic.get("New Section")).toBe("- First item");
    });

    it("should handle empty section", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(filePath, `## Empty\n\n`, "utf-8");

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.append("Empty", "- New item");

      expect(semantic.get("Empty")).toBe("- New item");
    });

    it("should add proper newlines", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(filePath, `## List\n\n- Item 1`, "utf-8");

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      semantic.append("List", "- Item 2");

      const content = semantic.get("List");
      // Content starts with newline because that's how the parser works (content after ## header)
      expect(content).toBe("\n- Item 1\n- Item 2");
    });
  });

  describe("has()", () => {
    it("should return true for existing section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.has("Tech Stack")).toBe(true);
    });

    it("should return false for missing section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.has("NonExistent")).toBe(false);
    });
  });

  describe("delete()", () => {
    it("should delete existing section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.has("Tech Stack")).toBe(true);
      const deleted = semantic.delete("Tech Stack");

      expect(deleted).toBe(true);
      expect(semantic.has("Tech Stack")).toBe(false);
      expect(semantic.isDirty()).toBe(true);
    });

    it("should return false for missing section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      const deleted = semantic.delete("NonExistent");
      expect(deleted).toBe(false);
    });
  });

  describe("toContext()", () => {
    it("should format sections with header", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## Stack\n\n- React\n\n## Notes\n\n- Important\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      const context = semantic.toContext();

      expect(context).toContain("### Semantic Memory");
      expect(context).toContain("## Stack");
      expect(context).toContain("- React");
      expect(context).toContain("## Notes");
      expect(context).toContain("- Important");
    });

    it("should skip empty sections", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## Empty\n\n## HasContent\n\n- Item\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      const context = semantic.toContext();

      expect(context).not.toContain("## Empty");
      expect(context).toContain("## HasContent");
    });

    it("should skip sections with only comments", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## OnlyComment\n\n<!-- Just a comment -->\n\n## HasContent\n\n- Item\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      const context = semantic.toContext();

      expect(context).not.toContain("## OnlyComment");
      expect(context).toContain("## HasContent");
    });

    it("should maintain section order", async () => {
      const filePath = join(testDir, semanticPath);
      await mkdir(join(testDir, ".claude"), { recursive: true });
      await writeFile(
        filePath,
        `## First\n\nA\n\n## Second\n\nB\n\n## Third\n\nC\n`,
        "utf-8",
      );

      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      const context = semantic.toContext();
      const firstIdx = context.indexOf("## First");
      const secondIdx = context.indexOf("## Second");
      const thirdIdx = context.indexOf("## Third");

      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });
  });

  describe("promoteObservation()", () => {
    it("should append to Observations section", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      await semantic.promoteObservation({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      const observations = semantic.get("Observations");
      expect(observations).toContain("Test observation");
    });

    it("should include timestamp and confidence", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      await semantic.promoteObservation({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      const observations = semantic.get("Observations");
      expect(observations).toContain("promoted:");
      expect(observations).toContain("confidence: 0.95");
    });

    it("should auto-save by default", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      await semantic.promoteObservation({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      expect(semantic.isDirty()).toBe(false);

      // Verify file was updated
      const content = await readFile(join(testDir, semanticPath), "utf-8");
      expect(content).toContain("Test observation");
    });

    it("should not save if autoSave is false", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      await semantic.promoteObservation(
        {
          text: "Test observation",
          confidence: 0.95,
          source: "test",
        },
        false,
      );

      expect(semantic.isDirty()).toBe(true);
    });
  });

  describe("utility methods", () => {
    it("getFilePath() should return correct path", () => {
      const semantic = new SemanticMemory(testDir, "custom/path.md");
      expect(semantic.getFilePath()).toBe(join(testDir, "custom/path.md"));
    });

    it("isDirty() should track modifications", async () => {
      const semantic = new SemanticMemory(testDir);
      await semantic.load();

      expect(semantic.isDirty()).toBe(false);
      semantic.set("Test", "Content");
      expect(semantic.isDirty()).toBe(true);
      await semantic.save();
      expect(semantic.isDirty()).toBe(false);
    });

    it("isLoaded() should return correct state", async () => {
      const semantic = new SemanticMemory(testDir);

      expect(semantic.isLoaded()).toBe(false);
      await semantic.load();
      expect(semantic.isLoaded()).toBe(true);
    });
  });
});
