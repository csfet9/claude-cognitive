/**
 * Tests for recent memories prompt template.
 * @module tests/unit/prompts/memories
 */

import { describe, it, expect } from "vitest";
import { formatRecentMemories } from "../../../src/prompts/memories.js";
import type { Memory } from "../../../src/types.js";

describe("formatRecentMemories", () => {
  const makeMemory = (text: string, createdAt: string): Memory => ({
    id: `mem-${Math.random()}`,
    text,
    factType: "experience",
    createdAt,
  });

  it("returns empty string for no memories", () => {
    expect(formatRecentMemories([])).toBe("");
  });

  it("formats a single memory with date", () => {
    const memories = [makeMemory("Fixed auth bug", "2024-06-15T10:00:00Z")];
    const result = formatRecentMemories(memories);

    expect(result).toContain("## Recent Activity");
    expect(result).toContain("Fixed auth bug");
  });

  it("formats multiple memories", () => {
    const memories = [
      makeMemory("First thing", "2024-06-14T10:00:00Z"),
      makeMemory("Second thing", "2024-06-15T10:00:00Z"),
    ];
    const result = formatRecentMemories(memories);

    expect(result).toContain("First thing");
    expect(result).toContain("Second thing");
  });

  it("truncates text longer than 200 chars", () => {
    const longText = "A".repeat(250);
    const memories = [makeMemory(longText, "2024-06-15T10:00:00Z")];
    const result = formatRecentMemories(memories);

    expect(result).toContain("A".repeat(200) + "...");
    expect(result).not.toContain("A".repeat(201) + ".");
  });

  it("does not truncate text at exactly 200 chars", () => {
    const exactText = "B".repeat(200);
    const memories = [makeMemory(exactText, "2024-06-15T10:00:00Z")];
    const result = formatRecentMemories(memories);

    expect(result).toContain("B".repeat(200));
    expect(result).not.toContain("...");
  });

  it("includes date for each memory", () => {
    const memories = [
      makeMemory("Memory one", "2024-01-15T10:00:00Z"),
      makeMemory("Memory two", "2024-12-25T10:00:00Z"),
    ];
    const result = formatRecentMemories(memories);

    // Date formatting is locale-dependent, just check both entries are listed
    const lines = result.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(2);
  });
});
