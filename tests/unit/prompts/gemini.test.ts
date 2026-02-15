/**
 * Tests for Gemini guidance prompt template.
 * @module tests/unit/prompts/gemini
 */

import { describe, it, expect } from "vitest";
import { formatGeminiGuidance } from "../../../src/prompts/gemini.js";
import type { GeminiConfig } from "../../../src/gemini/types.js";

describe("formatGeminiGuidance", () => {
  it("returns empty string when config is undefined", () => {
    expect(formatGeminiGuidance(undefined)).toBe("");
  });

  it("returns guidance when config is present", () => {
    const config: GeminiConfig = {
      model: "auto",
      timeout: 0,
      maxConcurrentRequests: 3,
    };
    const result = formatGeminiGuidance(config);

    expect(result).toContain("## Gemini CLI for Code Exploration");
    expect(result).toContain("### CLI Usage Patterns");
    expect(result).toContain("### Guidelines");
    expect(result).toContain("### IMPORTANT: Gemini findings require verification");
  });

  it("includes gemini -y usage examples", () => {
    const config: GeminiConfig = { model: "auto", timeout: 0, maxConcurrentRequests: 3 };
    const result = formatGeminiGuidance(config);

    expect(result).toContain("gemini -y");
    expect(result).toContain("Quick summary");
    expect(result).toContain("Architecture analysis");
  });
});
