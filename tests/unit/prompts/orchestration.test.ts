/**
 * Tests for orchestration prompt template.
 * @module tests/unit/prompts/orchestration
 */

import { describe, it, expect } from "vitest";
import { formatOrchestration } from "../../../src/prompts/orchestration.js";
import type { AgentTemplate } from "../../../src/agents/types.js";

describe("formatOrchestration", () => {
  const makeAgent = (
    name: string,
    mission: string,
  ): AgentTemplate => ({
    name,
    mission,
    tools: ["Read"],
    outputFormat: "markdown",
    constraints: ["Stay focused"],
  });

  it("returns empty string for no agents", () => {
    expect(formatOrchestration([])).toBe("");
  });

  it("includes agent name and mission for a single agent", () => {
    const agents = [makeAgent("reviewer", "Review code for bugs")];
    const result = formatOrchestration(agents);

    expect(result).toContain("## Agent Orchestration");
    expect(result).toContain("**reviewer**");
    expect(result).toContain("Review code for bugs");
  });

  it("lists multiple agents", () => {
    const agents = [
      makeAgent("reviewer", "Review code for bugs"),
      makeAgent("tester", "Write comprehensive tests"),
    ];
    const result = formatOrchestration(agents);

    expect(result).toContain("**reviewer**");
    expect(result).toContain("**tester**");
    expect(result).toContain("Write comprehensive tests");
  });

  it("truncates long missions to 80 chars", () => {
    const longMission = "A".repeat(100);
    const agents = [makeAgent("agent", longMission)];
    const result = formatOrchestration(agents);

    expect(result).toContain("A".repeat(80) + "...");
    expect(result).not.toContain("A".repeat(81));
  });

  it("uses only first line of multi-line mission", () => {
    const agents = [makeAgent("agent", "First line\nSecond line\nThird")];
    const result = formatOrchestration(agents);

    expect(result).toContain("First line");
    expect(result).not.toContain("Second line");
  });

  it("prefers systemPromptAdditions over mission for description", () => {
    const agent: AgentTemplate = {
      name: "security-reviewer",
      mission: "You are an elite security code reviewer with deep expertise...",
      tools: ["Read"],
      outputFormat: "markdown",
      constraints: [],
      systemPromptAdditions: "Reviews code for security vulnerabilities",
    };
    const result = formatOrchestration([agent]);

    expect(result).toContain("**security-reviewer**: Reviews code for security vulnerabilities");
    expect(result).not.toContain("elite security");
  });

  it("includes all expected sections", () => {
    const agents = [makeAgent("agent", "Do things")];
    const result = formatOrchestration(agents);

    expect(result).toContain("### Main Session Role");
    expect(result).toContain("### Project Agents");
    expect(result).toContain("### Cost-Effective Model Routing");
    expect(result).toContain("### Orchestration Workflow");
  });
});
