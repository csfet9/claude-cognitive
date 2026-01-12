/**
 * Tests for MCP Gemini tool handlers.
 * @module tests/unit/mcp/gemini-handlers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleGeminiPrompt,
  handleGeminiResearch,
  handleGeminiAnalyzeCode,
  handleGeminiSummarize,
} from "../../../src/mcp/gemini-handlers.js";
import { GeminiError, GeminiErrorCode } from "../../../src/gemini/errors.js";
import { createMockGeminiWrapper } from "../../helpers/gemini-mocks.js";
import type { GeminiWrapper } from "../../../src/gemini/wrapper.js";

describe("MCP Gemini handlers", () => {
  let mockWrapper: GeminiWrapper;

  beforeEach(() => {
    mockWrapper = createMockGeminiWrapper();
  });

  describe("handleGeminiPrompt()", () => {
    it("should return formatted success response", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: "Test response",
        model: "auto",
        duration: 1500,
      });

      const result = await handleGeminiPrompt(mockWrapper, {
        prompt: "Test prompt",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Test response");
      expect(result.content[0].text).toContain("Model: auto");
      expect(result.content[0].text).toContain("Duration: 1.5s");
    });

    it("should pass prompt to wrapper", async () => {
      await handleGeminiPrompt(mockWrapper, {
        prompt: "What is TypeScript?",
      });

      expect(mockWrapper.prompt).toHaveBeenCalledWith({
        prompt: "What is TypeScript?",
      });
    });

    it("should pass context to wrapper when provided", async () => {
      await handleGeminiPrompt(mockWrapper, {
        prompt: "Question",
        context: "Context information",
      });

      expect(mockWrapper.prompt).toHaveBeenCalledWith({
        prompt: "Question",
        context: "Context information",
      });
    });

    it("should return error on failure", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Execution failed"),
      );

      const result = await handleGeminiPrompt(mockWrapper, {
        prompt: "Test",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Execution failed");
    });

    it("should format AUTH_REQUIRED error with helpful message", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GeminiError("Auth needed", GeminiErrorCode.AUTH_REQUIRED),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("gemini auth login");
    });

    it("should format CLI_NOT_FOUND error with install instructions", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GeminiError("CLI not found", GeminiErrorCode.CLI_NOT_FOUND),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("npm install -g");
    });

    it("should format TIMEOUT error with suggestion", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GeminiError("Timed out", GeminiErrorCode.TIMEOUT),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("timed out");
      expect(result.content[0].text).toContain("simpler prompt");
    });

    it("should format FILE_NOT_FOUND error", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GeminiError("File not found: test.ts", GeminiErrorCode.FILE_NOT_FOUND),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("File not found: test.ts");
    });

    it("should format FILE_TOO_LARGE error", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GeminiError(
          "File too large: large.ts (15MB > 10MB limit)",
          GeminiErrorCode.FILE_TOO_LARGE,
        ),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("File too large");
      expect(result.content[0].text).toContain("15MB > 10MB");
    });

    it("should format SECURITY_ERROR", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GeminiError(
          "Security violation: path outside project",
          GeminiErrorCode.SECURITY_ERROR,
        ),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Security violation");
    });

    it("should handle non-GeminiError errors", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Generic error"),
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Generic error");
    });

    it("should handle non-Error objects", async () => {
      (mockWrapper.prompt as ReturnType<typeof vi.fn>).mockRejectedValue(
        "String error",
      );

      const result = await handleGeminiPrompt(mockWrapper, { prompt: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("String error");
    });
  });

  describe("handleGeminiResearch()", () => {
    it("should return formatted success response", async () => {
      (mockWrapper.research as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: "Research findings",
        model: "auto",
        duration: 2000,
      });

      const result = await handleGeminiResearch(mockWrapper, {
        topic: "TypeScript best practices",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Research findings");
      expect(result.content[0].text).toContain("Model: auto");
      expect(result.content[0].text).toContain("Duration: 2.0s");
    });

    it("should pass topic to wrapper", async () => {
      await handleGeminiResearch(mockWrapper, {
        topic: "Async programming patterns",
      });

      expect(mockWrapper.research).toHaveBeenCalledWith(
        "Async programming patterns",
        undefined,
        "medium",
      );
    });

    it("should handle file context", async () => {
      await handleGeminiResearch(mockWrapper, {
        topic: "Code quality",
        files: ["src/test.ts", "src/utils.ts"],
      });

      expect(mockWrapper.research).toHaveBeenCalledWith(
        "Code quality",
        ["src/test.ts", "src/utils.ts"],
        "medium",
      );
    });

    it("should use depth parameter", async () => {
      await handleGeminiResearch(mockWrapper, {
        topic: "Topic",
        depth: "deep",
      });

      expect(mockWrapper.research).toHaveBeenCalledWith(
        "Topic",
        undefined,
        "deep",
      );
    });

    it("should default to medium depth", async () => {
      await handleGeminiResearch(mockWrapper, {
        topic: "Topic",
      });

      expect(mockWrapper.research).toHaveBeenCalledWith(
        "Topic",
        undefined,
        "medium",
      );
    });

    it("should return error on failure", async () => {
      (mockWrapper.research as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Research failed"),
      );

      const result = await handleGeminiResearch(mockWrapper, {
        topic: "Test",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Research failed");
    });
  });

  describe("handleGeminiAnalyzeCode()", () => {
    it("should return formatted success response", async () => {
      (mockWrapper.analyzeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: "Security analysis results",
        model: "auto",
        duration: 1800,
      });

      const result = await handleGeminiAnalyzeCode(mockWrapper, {
        files: ["src/auth.ts"],
        analysis_type: "security",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Security analysis results");
      expect(result.content[0].text).toContain("Model: auto");
      expect(result.content[0].text).toContain("Duration: 1.8s");
    });

    it("should pass files to wrapper", async () => {
      await handleGeminiAnalyzeCode(mockWrapper, {
        files: ["src/index.ts", "src/utils.ts"],
        analysis_type: "quality",
      });

      expect(mockWrapper.analyzeCode).toHaveBeenCalledWith(
        ["src/index.ts", "src/utils.ts"],
        "quality",
        undefined,
      );
    });

    it("should validate and pass analysis type", async () => {
      const types = [
        "security",
        "performance",
        "quality",
        "architecture",
        "documentation",
        "testing",
      ] as const;

      for (const type of types) {
        vi.clearAllMocks();
        await handleGeminiAnalyzeCode(mockWrapper, {
          files: ["test.ts"],
          analysis_type: type,
        });

        expect(mockWrapper.analyzeCode).toHaveBeenCalledWith(
          expect.any(Array),
          type,
          undefined,
        );
      }
    });

    it("should default to general analysis type", async () => {
      await handleGeminiAnalyzeCode(mockWrapper, {
        files: ["test.ts"],
      });

      expect(mockWrapper.analyzeCode).toHaveBeenCalledWith(
        ["test.ts"],
        "general",
        undefined,
      );
    });

    it("should pass focus parameter", async () => {
      await handleGeminiAnalyzeCode(mockWrapper, {
        files: ["src/auth.ts"],
        analysis_type: "security",
        focus: "authentication flow",
      });

      expect(mockWrapper.analyzeCode).toHaveBeenCalledWith(
        ["src/auth.ts"],
        "security",
        "authentication flow",
      );
    });

    it("should return error on failure", async () => {
      (mockWrapper.analyzeCode as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Analysis failed"),
      );

      const result = await handleGeminiAnalyzeCode(mockWrapper, {
        files: ["test.ts"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Analysis failed");
    });
  });

  describe("handleGeminiSummarize()", () => {
    it("should return formatted success response", async () => {
      (mockWrapper.summarize as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: "Summary of content",
        model: "auto",
        duration: 1200,
      });

      const result = await handleGeminiSummarize(mockWrapper, {
        content: "Long text to summarize",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Summary of content");
      expect(result.content[0].text).toContain("Model: auto");
      expect(result.content[0].text).toContain("Duration: 1.2s");
    });

    it("should summarize content", async () => {
      await handleGeminiSummarize(mockWrapper, {
        content: "Text to summarize",
      });

      expect(mockWrapper.summarize).toHaveBeenCalledWith(
        "Text to summarize",
        undefined,
        "bullet",
      );
    });

    it("should summarize files", async () => {
      await handleGeminiSummarize(mockWrapper, {
        files: ["docs/readme.md"],
      });

      expect(mockWrapper.summarize).toHaveBeenCalledWith(
        undefined,
        ["docs/readme.md"],
        "bullet",
      );
    });

    it("should use format parameter", async () => {
      await handleGeminiSummarize(mockWrapper, {
        content: "Text",
        format: "paragraph",
      });

      expect(mockWrapper.summarize).toHaveBeenCalledWith(
        "Text",
        undefined,
        "paragraph",
      );
    });

    it("should default to bullet format", async () => {
      await handleGeminiSummarize(mockWrapper, {
        content: "Text",
      });

      expect(mockWrapper.summarize).toHaveBeenCalledWith(
        "Text",
        undefined,
        "bullet",
      );
    });

    it("should validate content or files requirement", async () => {
      const result = await handleGeminiSummarize(mockWrapper, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Either content or files must be provided",
      );
      expect(mockWrapper.summarize).not.toHaveBeenCalled();
    });

    it("should validate empty files array", async () => {
      const result = await handleGeminiSummarize(mockWrapper, {
        files: [],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Either content or files must be provided",
      );
      expect(mockWrapper.summarize).not.toHaveBeenCalled();
    });

    it("should return error on failure", async () => {
      (mockWrapper.summarize as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Summarization failed"),
      );

      const result = await handleGeminiSummarize(mockWrapper, {
        content: "Text",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Summarization failed");
    });

    it("should format all error types correctly", async () => {
      const errorTypes: Array<[GeminiErrorCode, string, string]> = [
        [GeminiErrorCode.AUTH_REQUIRED, "Auth error", "gemini auth login"],
        [GeminiErrorCode.CLI_NOT_FOUND, "CLI error", "npm install -g"],
        [GeminiErrorCode.TIMEOUT, "Timeout error", "timed out"],
        [GeminiErrorCode.FILE_NOT_FOUND, "File not found: test.ts", "File not found"],
        [GeminiErrorCode.FILE_TOO_LARGE, "File too large: test.ts", "File too large"],
        [GeminiErrorCode.SECURITY_ERROR, "Security violation", "Security violation"],
      ];

      for (const [code, errorMessage, expectedText] of errorTypes) {
        vi.clearAllMocks();
        (mockWrapper.summarize as ReturnType<typeof vi.fn>).mockRejectedValue(
          new GeminiError(errorMessage, code),
        );

        const result = await handleGeminiSummarize(mockWrapper, {
          content: "Test",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(expectedText);
      }
    });
  });
});
