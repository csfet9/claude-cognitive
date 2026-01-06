/**
 * MCP tool execution handlers.
 * @module mcp/handlers
 */

import type { Mind } from "../mind.js";
import type { Memory, ReflectResult, SignalResult } from "../types.js";
import type {
  RecallToolInput,
  ReflectToolInput,
  SignalToolInput,
  ToolResult,
} from "./types.js";

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
      content: [{ type: "text", text: `Error searching memories: ${message}` }],
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

/**
 * Format signal result as readable text for Claude.
 */
function formatSignalResult(result: SignalResult, signalCount: number): string {
  const lines: string[] = [];

  lines.push(
    `Submitted ${signalCount} feedback signal${signalCount === 1 ? "" : "s"}.`,
  );
  lines.push("");

  if (result.signalsProcessed > 0) {
    lines.push(`Processed: ${result.signalsProcessed} signals`);
  }

  if (result.updatedFacts.length > 0) {
    lines.push(`Updated ${result.updatedFacts.length} facts`);
  }

  lines.push("");
  lines.push(
    "The feedback will be used to improve future memory recall by boosting useful facts and deprioritizing ignored ones.",
  );

  return lines.join("\n").trim();
}

/**
 * Handle memory_signal tool invocation.
 *
 * @param mind - Mind instance to use for signaling
 * @param input - Tool input with signals array and query
 * @returns Tool result with confirmation
 */
export async function handleSignal(
  mind: Mind,
  input: SignalToolInput,
): Promise<ToolResult> {
  try {
    // Transform input signals to SignalItem format
    // Handle exactOptionalPropertyTypes by conditionally adding optional fields
    const signals = input.signals.map((s) => {
      const signal: {
        factId: string;
        signalType: "used" | "ignored" | "helpful" | "not_helpful";
        confidence: number;
        query: string;
        context?: string;
      } = {
        factId: s.factId,
        signalType: s.signalType,
        confidence: s.confidence ?? 1.0,
        query: input.query,
      };
      if (s.context !== undefined) {
        signal.context = s.context;
      }
      return signal;
    });

    const result = await mind.signal(signals);
    const text = formatSignalResult(result, signals.length);

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
            text: "Cannot submit signals: Hindsight server is unavailable. Memory operations are in degraded mode.",
          },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Error submitting signals: ${message}` }],
      isError: true,
    };
  }
}
