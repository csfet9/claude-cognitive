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
  query: z.string().min(1).max(10000).describe("What to search for in memory"),
  type: z
    .enum(["world", "experience", "opinion", "all"])
    .optional()
    .describe("Type of memory to search (optional, defaults to all)"),
});

/**
 * Zod schema for memory_reflect tool input.
 */
export const reflectInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(10000)
    .describe("What to think about or reason through"),
});

/**
 * Zod schema for memory_retain tool input.
 */
export const retainInputSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(10000)
    .describe("The information to store in memory"),
  context: z
    .string()
    .max(1000)
    .optional()
    .describe("Optional description providing additional context"),
  type: z
    .enum(["world", "experience", "opinion"])
    .optional()
    .describe("Type of memory to store (default: experience)"),
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
  memory_retain: {
    name: "memory_retain",
    description:
      "Store important information in memory for future sessions. Use when you learn something significant about the project, discover a pattern, or want to remember a decision. Stored memories persist across sessions.",
    inputSchema: retainInputSchema,
  },
} as const;
