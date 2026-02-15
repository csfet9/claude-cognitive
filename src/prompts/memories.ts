/**
 * Recent memories prompt template.
 * @module prompts/memories
 */

import type { Memory } from "../types.js";

/**
 * Format recent memories as context string.
 * Shows fuller context since we only fetch a few memories.
 *
 * @param memories - Recent memories to format
 * @returns Formatted markdown string, or empty string if no memories
 */
export function formatRecentMemories(memories: Memory[]): string {
  if (memories.length === 0) return "";

  const items = memories
    .map((mem) => {
      const date = new Date(mem.createdAt).toLocaleDateString();
      const maxLen = 200;
      const text =
        mem.text.length > maxLen ? `${mem.text.slice(0, maxLen)}...` : mem.text;
      return `- ${date}: ${text}`;
    })
    .join("\n");

  return `## Recent Activity\n${items}`;
}
