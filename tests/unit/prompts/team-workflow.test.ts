/**
 * Tests for team-first workflow prompt template.
 * @module tests/unit/prompts/team-workflow
 */

import { describe, it, expect } from "vitest";
import { formatTeamWorkflow } from "../../../src/prompts/team-workflow.js";

describe("formatTeamWorkflow", () => {
  it("returns a non-empty string", () => {
    const result = formatTeamWorkflow();
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it("includes team-first workflow header", () => {
    const result = formatTeamWorkflow();
    expect(result).toContain("## Team-First Workflow");
  });

  it("includes when to create a team section", () => {
    const result = formatTeamWorkflow();
    expect(result).toContain("### When to Create a Team");
  });

  it("includes standard team patterns", () => {
    const result = formatTeamWorkflow();
    expect(result).toContain("### Standard Team Patterns");
    expect(result).toContain("**Feature**");
    expect(result).toContain("**Bugfix**");
    expect(result).toContain("**Refactor**");
  });

  it("includes model routing guidance", () => {
    const result = formatTeamWorkflow();
    expect(result).toContain("### Model Routing");
    expect(result).toContain("**haiku**");
    expect(result).toContain("**sonnet**");
    expect(result).toContain("**opus**");
  });

  it("includes context preservation strategy", () => {
    const result = formatTeamWorkflow();
    expect(result).toContain("### Context Preservation");
    expect(result).toContain("TaskList");
  });
});
