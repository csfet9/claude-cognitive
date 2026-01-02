/**
 * MCP tool definitions with Zod schemas.
 * @module mcp/tools
 */

import { z } from "zod";

// ============================================
// Input Schemas
// ============================================

/**
 * Zod schema for memory_recall tool input.
 */
export const recallInputSchema = z.object({
  query: z.string().min(1).describe("What to search for in memory"),
  type: z
    .enum(["world", "experience", "opinion", "all"])
    .optional()
    .describe("Type of memory to search (optional, defaults to all)"),
});

/**
 * Zod schema for memory_reflect tool input.
 */
export const reflectInputSchema = z.object({
  query: z.string().min(1).describe("What to think about or reason through"),
});

// ============================================
// Tool Definitions
// ============================================

/**
 * Tool definitions for MCP server registration.
 */
export const TOOL_DEFINITIONS = {
  memory_recall: {
    name: "memory_recall",
    description:
      "Search project memories for relevant context. Use when you want to remember something from previous sessions or find information about the project. Returns memories matching your query, sorted by relevance.",
    inputSchema: recallInputSchema,
  },
  memory_reflect: {
    name: "memory_reflect",
    description:
      "Reason about what you know and form opinions. Use when you want to think about patterns, make judgments based on experience, or synthesize accumulated knowledge. Returns reasoned insights with confidence scores.",
    inputSchema: reflectInputSchema,
  },
} as const;
