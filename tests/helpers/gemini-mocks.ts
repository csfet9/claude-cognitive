/**
 * Mock factories for Gemini CLI wrapper components.
 * @module tests/helpers/gemini-mocks
 */

import { vi } from "vitest";
import type { GeminiResult } from "../../src/gemini/types.js";
import type { GeminiExecutor } from "../../src/gemini/executor.js";
import type { GeminiWrapper } from "../../src/gemini/wrapper.js";

/**
 * Create a mock GeminiExecutor for testing.
 */
export function createMockGeminiExecutor(): GeminiExecutor {
  return {
    checkAvailable: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue("Mock Gemini response"),
  } as unknown as GeminiExecutor;
}

/**
 * Create a mock GeminiWrapper for testing.
 */
export function createMockGeminiWrapper(): GeminiWrapper {
  const mockResult: GeminiResult = {
    response: "Mock Gemini response",
    model: "auto",
    duration: 1500,
  };

  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    resolveModel: vi.fn().mockImplementation((model: string) => model),
    prompt: vi.fn().mockResolvedValue(mockResult),
    readFiles: vi
      .fn()
      .mockResolvedValue(new Map([["test.ts", "test content"]])),
    analyzeCode: vi.fn().mockResolvedValue({
      ...mockResult,
      response: "Code analysis result",
    }),
    research: vi.fn().mockResolvedValue({
      ...mockResult,
      response: "Research result",
    }),
    summarize: vi.fn().mockResolvedValue({
      ...mockResult,
      response: "Summary result",
    }),
  } as unknown as GeminiWrapper;
}
