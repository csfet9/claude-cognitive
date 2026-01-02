/**
 * MCP tool execution handlers.
 * @module mcp/handlers
 */

import type { Mind } from "../mind.js";
import type { Memory, ReflectResult } from "../types.js";
import type { RecallToolInput, ReflectToolInput, ToolResult } from "./types.js";

// ============================================
// Formatters
// ============================================

/**
 * Format memories as readable text for Claude.
 */
function formatMemories(memories: Memory[]): string {
  if (memories.length === 0) {
    return "No relevant memories found.";
  }

  const lines: string[] = [`Found ${memories.length} relevant memories:\n`];

  for (const memory of memories) {
    const date = new Date(memory.createdAt).toLocaleDateString();
    const type = memory.factType;

    lines.push(`[${type}] ${date}`);
    lines.push(memory.text);

    // Include confidence for opinions
    if (memory.factType === "opinion" && memory.confidence !== undefined) {
      lines.push(`  Confidence: ${(memory.confidence * 100).toFixed(0)}%`);
    }

    // Include context if available
    if (memory.context) {
      lines.push(`  Context: ${memory.context}`);
    }

    lines.push(""); // Blank line between memories
  }

  return lines.join("\n").trim();
}

/**
 * Format reflect result as readable text for Claude.
 */
function formatReflection(result: ReflectResult): string {
  const lines: string[] = [];

  // Main reflection text
  lines.push(result.text);
  lines.push("");

  // List opinions formed
  if (result.opinions.length > 0) {
    lines.push("Opinions formed:");
    for (const opinion of result.opinions) {
      const confidence = (opinion.confidence * 100).toFixed(0);
      lines.push(`- ${opinion.opinion} (${confidence}% confidence)`);
    }
    lines.push("");
  }

  // Summarize what the reflection was based on
  const worldCount = result.basedOn.world.length;
  const expCount = result.basedOn.experience.length;
  const opinionCount = result.basedOn.opinion.length;
  const total = worldCount + expCount + opinionCount;

  if (total > 0) {
    lines.push(
      `Based on ${total} memories: ${worldCount} world facts, ${expCount} experiences, ${opinionCount} prior opinions.`,
    );
  }

  return lines.join("\n").trim();
}

// ============================================
// Handlers
// ============================================

/**
 * Handle memory_recall tool invocation.
 *
 * @param mind - Mind instance to use for recall
 * @param input - Tool input with query and optional type filter
 * @returns Tool result with formatted memories
 */
export async function handleRecall(
  mind: Mind,
  input: RecallToolInput,
): Promise<ToolResult> {
  try {
    const options =
      input.type && input.type !== "all" ? { factType: input.type } : undefined;

    const memories = await mind.recall(input.query, options);
    const text = formatMemories(memories);

    return {
      content: [{ type: "text", text }],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        { type: "text", text: `Error searching memories: ${message}` },
      ],
      isError: true,
    };
  }
}

/**
 * Handle memory_reflect tool invocation.
 *
 * @param mind - Mind instance to use for reflection
 * @param input - Tool input with query
 * @returns Tool result with formatted reflection
 */
export async function handleReflect(
  mind: Mind,
  input: ReflectToolInput,
): Promise<ToolResult> {
  try {
    const result = await mind.reflect(input.query);
    const text = formatReflection(result);

    return {
      content: [{ type: "text", text }],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Check if this is a degraded mode error
    if (message.includes("requires Hindsight connection")) {
      return {
        content: [
          {
            type: "text",
            text: "Cannot reflect: Hindsight server is unavailable. Memory operations are in degraded mode.",
          },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Error reflecting: ${message}` }],
      isError: true,
    };
  }
}
