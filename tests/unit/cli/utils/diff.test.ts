/**
 * Tests for memory diff utilities.
 */

import { describe, it, expect } from "vitest";
import {
  calculateMemoryDiff,
  formatMemoryDiff,
} from "../../../../src/cli/utils/diff.js";

describe("calculateMemoryDiff", () => {
  it("should detect no changes when content is identical", () => {
    const content = "## Section\nContent here";
    const diff = calculateMemoryDiff(content, content);
    expect(diff.hasChanges).toBe(false);
    expect(diff.linesAdded).toBe(0);
    expect(diff.linesRemoved).toBe(0);
    expect(diff.sectionsChanged).toHaveLength(0);
  });

  it("should detect added lines", () => {
    const before = "## Section\nLine 1";
    const after = "## Section\nLine 1\nLine 2";
    const diff = calculateMemoryDiff(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.linesAdded).toBe(1);
    expect(diff.linesRemoved).toBe(0);
  });

  it("should detect removed lines", () => {
    const before = "## Section\nLine 1\nLine 2";
    const after = "## Section\nLine 1";
    const diff = calculateMemoryDiff(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.linesAdded).toBe(0);
    expect(diff.linesRemoved).toBe(1);
  });

  it("should detect changed sections", () => {
    const before = "## Tech Stack\nReact";
    const after = "## Tech Stack\nReact\nTypeScript";
    const diff = calculateMemoryDiff(before, after);
    expect(diff.sectionsChanged).toContain("Tech Stack");
  });

  it("should detect removed sections", () => {
    const before = "## Section A\nContent A\n\n## Section B\nContent B";
    const after = "## Section A\nContent A";
    const diff = calculateMemoryDiff(before, after);
    expect(diff.sectionsChanged).toContain("Section B");
  });

  it("should detect new sections", () => {
    const before = "## Section A\nContent A";
    const after = "## Section A\nContent A\n\n## Section B\nContent B";
    const diff = calculateMemoryDiff(before, after);
    expect(diff.sectionsChanged).toContain("Section B");
  });

  it("should handle empty content", () => {
    const diff = calculateMemoryDiff("", "## New\nContent");
    expect(diff.hasChanges).toBe(true);
    expect(diff.linesAdded).toBeGreaterThan(0);
  });

  it("should handle content with multiple sections", () => {
    const before = "## A\nOld A\n\n## B\nOld B\n\n## C\nOld C";
    const after = "## A\nNew A\n\n## B\nOld B\n\n## C\nNew C";
    const diff = calculateMemoryDiff(before, after);
    expect(diff.sectionsChanged).toContain("A");
    expect(diff.sectionsChanged).toContain("C");
    expect(diff.sectionsChanged).not.toContain("B");
  });
});

describe("formatMemoryDiff", () => {
  it("should format no changes message", () => {
    const diff = {
      hasChanges: false,
      linesAdded: 0,
      linesRemoved: 0,
      sectionsChanged: [],
    };
    expect(formatMemoryDiff(diff)).toBe("No changes to memory.md");
  });

  it("should format added lines", () => {
    const diff = {
      hasChanges: true,
      linesAdded: 5,
      linesRemoved: 0,
      sectionsChanged: [],
    };
    const output = formatMemoryDiff(diff);
    expect(output).toContain("+ 5 lines added");
    expect(output).toContain("- 0 lines removed");
  });

  it("should format removed lines", () => {
    const diff = {
      hasChanges: true,
      linesAdded: 0,
      linesRemoved: 3,
      sectionsChanged: [],
    };
    const output = formatMemoryDiff(diff);
    expect(output).toContain("- 3 lines removed");
  });

  it("should format sections affected", () => {
    const diff = {
      hasChanges: true,
      linesAdded: 2,
      linesRemoved: 1,
      sectionsChanged: ["Tech Stack", "Observations"],
    };
    const output = formatMemoryDiff(diff);
    expect(output).toContain("Sections affected: Tech Stack, Observations");
  });

  it("should not show sections line when no sections changed", () => {
    const diff = {
      hasChanges: true,
      linesAdded: 1,
      linesRemoved: 0,
      sectionsChanged: [],
    };
    const output = formatMemoryDiff(diff);
    expect(output).not.toContain("Sections affected");
  });
});
