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
  query: z.string().min(1).max(10000).describe("What to think about or reason through"),
});

/**
 * Zod schema for memory_signal tool input.
 */
export const signalInputSchema = z.object({
  signals: z
    .array(
      z.object({
        factId: z
          .string()
          .describe("The ID of the fact to provide feedback for"),
        signalType: z
          .enum(["used", "ignored", "helpful", "not_helpful"])
          .describe("Type of feedback signal"),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Confidence in this signal (0-1, defaults to 1.0)"),
        context: z
          .string()
          .optional()
          .describe(
            "Additional context about how the fact was used or why it was ignored",
          ),
      }),
    )
    .min(1)
    .describe("Array of feedback signals for recalled facts"),
  query: z
    .string()
    .describe("The query that triggered the recall (for context)"),
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
  memory_signal: {
    name: "memory_signal",
    description:
      "Submit feedback signals for recalled facts. Use after you've used memory_recall to indicate which facts were helpful or not. This improves future recall by boosting useful facts and deprioritizing ignored ones. Signals: 'used' (you referenced/applied the fact), 'ignored' (fact wasn't relevant), 'helpful' (fact was particularly useful), 'not_helpful' (fact was misleading or wrong).",
    inputSchema: signalInputSchema,
  },
} as const;
