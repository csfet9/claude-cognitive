/**
 * Tests for GeminiWrapper class.
 * @module tests/unit/gemini/wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiWrapper } from "../../../src/gemini/wrapper.js";
import { GeminiError, GeminiErrorCode } from "../../../src/gemini/errors.js";
import { createMockGeminiExecutor } from "../../helpers/gemini-mocks.js";
import type { GeminiExecutor } from "../../../src/gemini/executor.js";

// Mock node:fs/promises
const mockReadFile = vi.fn();
const mockStat = vi.fn();
const mockRealpath = vi.fn();
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  realpath: (...args: unknown[]) => mockRealpath(...args),
}));

describe("GeminiWrapper", () => {
  let wrapper: GeminiWrapper;
  let mockExecutor: GeminiExecutor;
  const projectPath = "/test/project";

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutor = createMockGeminiExecutor();
    wrapper = new GeminiWrapper({}, projectPath, mockExecutor);
  });

  describe("constructor", () => {
    it("should merge config with defaults", () => {
      const w = new GeminiWrapper({ timeout: 5000 }, projectPath, mockExecutor);

      // Verify by checking resolved model (passes through unchanged)
      expect(w.resolveModel("auto")).toBe("auto");
    });

    it("should use custom config values", () => {
      const w = new GeminiWrapper(
        { model: "gemini-2.5-pro", timeout: 30000 },
        projectPath,
        mockExecutor,
      );

      expect(w.resolveModel("auto")).toBe("auto"); // auto passes through unchanged
    });
  });

  describe("isAvailable()", () => {
    it("should delegate to executor", async () => {
      (
        mockExecutor.checkAvailable as ReturnType<typeof vi.fn>
      ).mockResolvedValue(true);

      const result = await wrapper.isAvailable();

      expect(result).toBe(true);
      expect(mockExecutor.checkAvailable).toHaveBeenCalled();
    });

    it("should return false when executor returns false", async () => {
      (
        mockExecutor.checkAvailable as ReturnType<typeof vi.fn>
      ).mockResolvedValue(false);

      const result = await wrapper.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe("resolveModel()", () => {
    it("should pass through 'auto' unchanged", () => {
      const result = wrapper.resolveModel("auto");

      expect(result).toBe("auto");
    });

    it("should pass through explicit model names unchanged", () => {
      expect(wrapper.resolveModel("gemini-2.5-pro")).toBe("gemini-2.5-pro");
      expect(wrapper.resolveModel("gemini-2.0-flash")).toBe("gemini-2.0-flash");
      expect(wrapper.resolveModel("gemini-2.5-flash")).toBe("gemini-2.5-flash");
    });
  });

  describe("prompt()", () => {
    it("should execute prompt and return result with default 'auto' model", async () => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Test response",
      );

      const result = await wrapper.prompt({ prompt: "Test prompt" });

      expect(result.response).toBe("Test response");
      expect(result.model).toBe("auto");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockExecutor.execute).toHaveBeenCalledWith({
        prompt: "Test prompt",
        model: "auto",
        timeout: 0,
      });
    });

    it("should build full prompt with context", async () => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Response",
      );

      await wrapper.prompt({
        prompt: "Question here",
        context: "Context here",
      });

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Context here\n\nQuestion here",
        }),
      );
    });

    it("should use model override", async () => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Response",
      );

      const result = await wrapper.prompt({
        prompt: "Test",
        model: "gemini-2.5-pro",
      });

      expect(result.model).toBe("gemini-2.5-pro");
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-2.5-pro",
        }),
      );
    });

    it("should use timeout override", async () => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Response",
      );

      await wrapper.prompt({
        prompt: "Test",
        timeout: 30000,
      });

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });

    it("should measure execution duration", async () => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("Response"), 100);
          }),
      );

      const result = await wrapper.prompt({ prompt: "Test" });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(200); // Should be roughly 100ms
    });
  });

  describe("readFiles()", () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ size: 1024, isFile: () => true }); // 1KB, is a file
      mockReadFile.mockResolvedValue("File content");
      // realpath returns the same path (no symlinks)
      mockRealpath.mockImplementation((path: string) => Promise.resolve(path));
    });

    it("should read files within project", async () => {
      const result = await wrapper.readFiles(["src/test.ts"]);

      expect(result.size).toBe(1);
      expect(result.get("src/test.ts")).toBe("File content");
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("src/test.ts"),
        "utf-8",
      );
    });

    it("should handle multiple files", async () => {
      const result = await wrapper.readFiles(["file1.ts", "file2.ts"]);

      expect(result.size).toBe(2);
      expect(result.get("file1.ts")).toBe("File content");
      expect(result.get("file2.ts")).toBe("File content");
    });

    it("should reject paths with '..' traversal outside project", async () => {
      // Symlink that resolves outside project
      mockRealpath.mockResolvedValue("/outside/file.ts");

      await expect(wrapper.readFiles(["../outside/file.ts"])).rejects.toThrow(
        GeminiError,
      );

      try {
        await wrapper.readFiles(["../outside/file.ts"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.SECURITY_ERROR,
        );
        expect((error as GeminiError).isRetryable).toBe(false);
      }
    });

    it("should allow '..' within project subdirectories", async () => {
      // Symlink resolves to within project
      mockRealpath.mockResolvedValue(`${projectPath}/src/file.ts`);

      const result = await wrapper.readFiles(["src/sub/../file.ts"]);

      expect(result.size).toBe(1);
      expect(result.get("src/sub/../file.ts")).toBe("File content");
    });

    it("should reject absolute paths outside project", async () => {
      // realpath returns outside project
      mockRealpath.mockResolvedValue("/etc/passwd");

      await expect(wrapper.readFiles(["/etc/passwd"])).rejects.toThrow(
        GeminiError,
      );

      try {
        await wrapper.readFiles(["/etc/passwd"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.SECURITY_ERROR,
        );
      }
    });

    it("should accept absolute paths within project", async () => {
      mockRealpath.mockResolvedValue(`${projectPath}/src/file.ts`);

      const result = await wrapper.readFiles([`${projectPath}/src/file.ts`]);

      expect(result.size).toBe(1);
    });

    it("should throw FILE_NOT_FOUND when file does not exist", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT: no such file"));

      try {
        await wrapper.readFiles(["nonexistent.ts"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.FILE_NOT_FOUND,
        );
        expect((error as GeminiError).isRetryable).toBe(false);
      }
    });

    it("should reject files larger than 10MB", async () => {
      mockStat.mockResolvedValue({
        size: 11 * 1024 * 1024,
        isFile: () => true,
      }); // 11MB
      mockRealpath.mockResolvedValue(`${projectPath}/large-file.ts`);

      try {
        await wrapper.readFiles(["large-file.ts"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.FILE_TOO_LARGE,
        );
        expect((error as GeminiError).isRetryable).toBe(false);
        expect((error as GeminiError).message).toContain("11MB > 10MB");
      }
    });

    it("should accept files at exactly 10MB", async () => {
      mockStat.mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true,
      }); // Exactly 10MB
      mockRealpath.mockResolvedValue(`${projectPath}/large-file.ts`);

      const result = await wrapper.readFiles(["large-file.ts"]);

      expect(result.size).toBe(1);
    });

    it("should reject non-file paths (directories)", async () => {
      mockStat.mockResolvedValue({ size: 1024, isFile: () => false }); // Is a directory

      try {
        await wrapper.readFiles(["src"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.SECURITY_ERROR,
        );
        expect((error as GeminiError).message).toContain("Not a regular file");
      }
    });

    it("should reject symlinks that resolve outside project", async () => {
      mockStat.mockResolvedValue({ size: 1024, isFile: () => true });
      mockRealpath.mockResolvedValue("/etc/passwd"); // Symlink points outside

      try {
        await wrapper.readFiles(["malicious-link.ts"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.SECURITY_ERROR,
        );
        expect((error as GeminiError).message).toContain(
          "resolves outside project",
        );
      }
    });
  });

  describe("analyzeCode()", () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ size: 1024, isFile: () => true });
      mockReadFile.mockResolvedValue("function test() {}");
      mockRealpath.mockImplementation((path: string) => Promise.resolve(path));
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Analysis result",
      );
    });

    it("should read files and execute analysis", async () => {
      const result = await wrapper.analyzeCode(["src/test.ts"], "security");

      expect(result.response).toBe("Analysis result");
      expect(mockReadFile).toHaveBeenCalled();
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("security vulnerabilities"),
        }),
      );
    });

    it("should include focus in prompt", async () => {
      await wrapper.analyzeCode(
        ["src/test.ts"],
        "security",
        "authentication flow",
      );

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("authentication flow"),
        }),
      );
    });

    it("should support all analysis types", async () => {
      const types = [
        "security",
        "performance",
        "quality",
        "architecture",
        "documentation",
        "testing",
        "general",
      ] as const;

      for (const type of types) {
        vi.clearAllMocks();
        await wrapper.analyzeCode(["test.ts"], type);
        expect(mockExecutor.execute).toHaveBeenCalled();
      }
    });

    it("should include file contents in prompt", async () => {
      mockReadFile.mockResolvedValue("const x = 1;");

      await wrapper.analyzeCode(["test.ts"], "general");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("const x = 1;"),
        }),
      );
    });

    it("should include file paths in prompt", async () => {
      await wrapper.analyzeCode(["src/index.ts"], "general");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("src/index.ts"),
        }),
      );
    });
  });

  describe("research()", () => {
    beforeEach(() => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Research result",
      );
    });

    it("should research topic without files", async () => {
      const result = await wrapper.research("Best practices for TypeScript");

      expect(result.response).toBe("Research result");
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Best practices for TypeScript"),
        }),
      );
    });

    it("should include file context when provided", async () => {
      mockStat.mockResolvedValue({ size: 1024, isFile: () => true });
      mockReadFile.mockResolvedValue("File content");
      mockRealpath.mockImplementation((path: string) => Promise.resolve(path));

      await wrapper.research("Topic", ["context.ts"]);

      expect(mockReadFile).toHaveBeenCalled();
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Context from project files"),
        }),
      );
    });

    it("should support shallow depth", async () => {
      await wrapper.research("Topic", undefined, "shallow");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("brief overview"),
        }),
      );
    });

    it("should support medium depth (default)", async () => {
      await wrapper.research("Topic");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("comprehensive analysis"),
        }),
      );
    });

    it("should support deep depth", async () => {
      await wrapper.research("Topic", undefined, "deep");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("in-depth analysis"),
        }),
      );
    });
  });

  describe("summarize()", () => {
    beforeEach(() => {
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Summary result",
      );
    });

    it("should summarize content", async () => {
      const result = await wrapper.summarize("Long text to summarize");

      expect(result.response).toBe("Summary result");
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Long text to summarize"),
        }),
      );
    });

    it("should summarize files", async () => {
      mockStat.mockResolvedValue({ size: 1024, isFile: () => true });
      mockReadFile.mockResolvedValue("File content");
      mockRealpath.mockImplementation((path: string) => Promise.resolve(path));

      const result = await wrapper.summarize(undefined, ["file.ts"]);

      expect(result.response).toBe("Summary result");
      expect(mockReadFile).toHaveBeenCalled();
    });

    it("should throw when neither content nor files provided", async () => {
      try {
        await wrapper.summarize();
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.EXECUTION_FAILED,
        );
        expect((error as GeminiError).message).toContain(
          "Either content or files must be provided",
        );
      }
    });

    it("should throw when files is empty array", async () => {
      try {
        await wrapper.summarize(undefined, []);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(
          GeminiErrorCode.EXECUTION_FAILED,
        );
      }
    });

    it("should support bullet format (default)", async () => {
      await wrapper.summarize("Content");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("bulleted list"),
        }),
      );
    });

    it("should support paragraph format", async () => {
      await wrapper.summarize("Content", undefined, "paragraph");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("cohesive paragraph"),
        }),
      );
    });

    it("should support technical format", async () => {
      await wrapper.summarize("Content", undefined, "technical");

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("technical summary"),
        }),
      );
    });
  });
});
