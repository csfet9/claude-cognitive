/**
 * Tests for model routing and generateClaudeMdSection.
 * @module tests/unit/core/routing
 */

import { describe, it, expect } from "vitest";
import { generateClaudeMdSection } from "../../../src/mind.js";
import { DEFAULT_CATEGORY_ROUTING } from "../../../src/config.js";

describe("generateClaudeMdSection()", () => {
  it("should include basic agent orchestration", () => {
    const result = generateClaudeMdSection({});

    expect(result).toContain("## Claude Cognitive");
    expect(result).toContain("### Agent Orchestration");
    expect(result).toContain("orchestrator");
  });

  it("should include security review section when enabled", () => {
    const result = generateClaudeMdSection({ securityReview: true });

    expect(result).toContain("### Pre-Commit Security Review");
    expect(result).toContain("security-code-reviewer");
  });

  it("should not include security review when disabled", () => {
    const result = generateClaudeMdSection({ securityReview: false });

    expect(result).not.toContain("### Pre-Commit Security Review");
  });

  it("should include gemini section when available", () => {
    const result = generateClaudeMdSection({ geminiAvailable: true });

    expect(result).toContain("### Gemini CLI");
    expect(result).toContain("gemini -y");
  });

  it("should include model routing table when agents provided", () => {
    const result = generateClaudeMdSection({
      agents: [
        {
          name: "code-explorer",
          model: "haiku",
          categories: ["exploration", "research"],
        },
        {
          name: "code-architect",
          model: "sonnet",
          categories: ["architecture"],
        },
      ],
    });

    expect(result).toContain("### Model Routing");
    expect(result).toContain("| `code-explorer` | **haiku** | cheap |");
    expect(result).toContain("| `code-architect` | **sonnet** | standard |");
  });

  it("should handle agents without optional fields", () => {
    const result = generateClaudeMdSection({
      agents: [{ name: "plain-agent" }],
    });

    expect(result).toContain("| `plain-agent` | **sonnet** | standard | - |");
  });

  it("should include category routing guide", () => {
    const result = generateClaudeMdSection({});

    expect(result).toContain("### Task Category Routing");
    expect(result).toContain("| exploration | **haiku**");
    expect(result).toContain("| security | **opus**");
    expect(result).toContain("| implementation | **sonnet**");
    expect(result).toContain("Cost optimization");
  });

  it("should include Agent Teams guidance when enabled", () => {
    const result = generateClaudeMdSection({ enableTeams: true });

    expect(result).toContain("### Agent Teams");
    expect(result).toContain("Shift+Tab");
    expect(result).toContain("Team composition pattern");
    expect(result).toContain("Explorers (haiku)");
    expect(result).toContain("Implementers (sonnet)");
  });

  it("should not include Agent Teams guidance when disabled", () => {
    const result = generateClaudeMdSection({ enableTeams: false });

    expect(result).not.toContain("### Agent Teams");
  });

  it("should combine all sections", () => {
    const result = generateClaudeMdSection({
      securityReview: true,
      geminiAvailable: true,
      agents: [{ name: "test-agent", model: "haiku" }],
      enableTeams: true,
    });

    expect(result).toContain("### Pre-Commit Security Review");
    expect(result).toContain("### Agent Orchestration");
    expect(result).toContain("### Model Routing");
    expect(result).toContain("### Task Category Routing");
    expect(result).toContain("### Agent Teams");
    expect(result).toContain("### Gemini CLI");
  });
});

describe("DEFAULT_CATEGORY_ROUTING", () => {
  it("should map exploration to haiku with background", () => {
    expect(DEFAULT_CATEGORY_ROUTING.exploration.model).toBe("haiku");
    expect(DEFAULT_CATEGORY_ROUTING.exploration.background).toBe(true);
  });

  it("should map research to haiku with background", () => {
    expect(DEFAULT_CATEGORY_ROUTING.research.model).toBe("haiku");
    expect(DEFAULT_CATEGORY_ROUTING.research.background).toBe(true);
  });

  it("should map implementation to sonnet", () => {
    expect(DEFAULT_CATEGORY_ROUTING.implementation.model).toBe("sonnet");
  });

  it("should map security to opus", () => {
    expect(DEFAULT_CATEGORY_ROUTING.security.model).toBe("opus");
  });

  it("should map reasoning to opus", () => {
    expect(DEFAULT_CATEGORY_ROUTING.reasoning.model).toBe("opus");
  });

  it("should have all nine categories defined", () => {
    const categories = Object.keys(DEFAULT_CATEGORY_ROUTING);
    expect(categories).toHaveLength(9);
    expect(categories).toContain("exploration");
    expect(categories).toContain("research");
    expect(categories).toContain("implementation");
    expect(categories).toContain("review");
    expect(categories).toContain("testing");
    expect(categories).toContain("debugging");
    expect(categories).toContain("architecture");
    expect(categories).toContain("security");
    expect(categories).toContain("reasoning");
  });
});
