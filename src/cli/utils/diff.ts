/**
 * Utilities for calculating and displaying memory diffs.
 * @module cli/utils/diff
 */

/**
 * Result of comparing two versions of memory content.
 */
export interface MemoryDiff {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Number of lines added */
  linesAdded: number;
  /** Number of lines removed */
  linesRemoved: number;
  /** Section names that were modified */
  sectionsChanged: string[];
}

/**
 * Calculate diff between two versions of memory.md content.
 *
 * @param before - Content before sync
 * @param after - Content after sync
 * @returns Diff summary
 */
export function calculateMemoryDiff(before: string, after: string): MemoryDiff {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  const added = afterLines.filter((line) => !beforeSet.has(line));
  const removed = beforeLines.filter((line) => !afterSet.has(line));

  // Detect sections that changed
  const sectionsChanged: string[] = [];

  // Extract sections and compare content
  const beforeSections = extractSections(before);
  const afterSections = extractSections(after);

  for (const [section, content] of afterSections) {
    const beforeContent = beforeSections.get(section);
    if (beforeContent !== content && !sectionsChanged.includes(section)) {
      sectionsChanged.push(section);
    }
  }

  // Check for removed sections
  for (const section of beforeSections.keys()) {
    if (!afterSections.has(section) && !sectionsChanged.includes(section)) {
      sectionsChanged.push(section);
    }
  }

  return {
    hasChanges: added.length > 0 || removed.length > 0,
    linesAdded: added.length,
    linesRemoved: removed.length,
    sectionsChanged,
  };
}

/**
 * Extract sections from markdown content.
 */
function extractSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match?.[1]) {
      if (currentSection) {
        sections.set(currentSection, currentContent.join("\n"));
      }
      currentSection = match[1];
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.set(currentSection, currentContent.join("\n"));
  }

  return sections;
}

/**
 * Format memory diff for human-readable display.
 *
 * @param diff - Diff result to format
 * @returns Formatted string
 */
export function formatMemoryDiff(diff: MemoryDiff): string {
  if (!diff.hasChanges) {
    return "No changes to memory.md";
  }

  const lines: string[] = [];
  lines.push("Memory changes:");
  lines.push(`  + ${diff.linesAdded} lines added`);
  lines.push(`  - ${diff.linesRemoved} lines removed`);

  if (diff.sectionsChanged.length > 0) {
    lines.push(`  ~ Sections affected: ${diff.sectionsChanged.join(", ")}`);
  }

  return lines.join("\n");
}
