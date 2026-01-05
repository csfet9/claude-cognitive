/**
 * Agent context preparation for delegation.
 * @module agents/context
 */

import type { HindsightClient } from "../client.js";
import type { Memory } from "../types.js";
import type {
  AgentContext,
  AgentTemplate,
  GetAgentContextOptions,
} from "./types.js";

/**
 * Prepare context for agent delegation.
 *
 * This is called by the orchestrator BEFORE delegating to an agent.
 * It retrieves relevant memories and formats them for the agent.
 *
 * @param client - HindsightClient instance
 * @param bankId - Memory bank ID
 * @param template - Agent template to use
 * @param task - Task description for the agent
 * @param options - Context preparation options
 * @returns Agent context with memories and task
 */
export async function getAgentContext(
  client: HindsightClient,
  bankId: string,
  template: AgentTemplate,
  task: string,
  options: GetAgentContextOptions = {},
): Promise<AgentContext> {
  const { budget = "mid", additionalContext, maxMemories = 10 } = options;

  let memories: Memory[] = [];
  try {
    memories = await client.recall({
      bankId,
      query: task,
      budget,
      factType: "all", // Agent benefits from all memory types
      includeEntities: true,
    });
    // Limit to maxMemories
    memories = memories.slice(0, maxMemories);
  } catch {
    // If recall fails, proceed without memories
    memories = [];
  }

  const result: AgentContext = {
    template,
    memories,
    task,
  };

  if (additionalContext) {
    result.additionalContext = additionalContext;
  }

  return result;
}

/**
 * Format agent context as a prompt string.
 *
 * This creates the system prompt / context injection for the agent.
 *
 * @param context - Agent context to format
 * @returns Formatted prompt string
 */
export function formatAgentPrompt(context: AgentContext): string {
  const { template, memories, task, additionalContext } = context;

  const sections: string[] = [];

  // Mission and identity
  sections.push(`# Agent: ${template.name}`);
  sections.push("");
  sections.push("## Mission");
  sections.push(template.mission);
  sections.push("");

  // Tools
  sections.push("## Tools Available");
  for (const tool of template.tools) {
    sections.push(`- ${tool}`);
  }
  sections.push("");

  // Constraints (emphasized)
  sections.push("## Constraints (MUST FOLLOW)");
  for (const constraint of template.constraints) {
    sections.push(`- ${constraint}`);
  }
  sections.push("");

  // Relevant context from memory (provided by orchestrator)
  if (memories.length > 0) {
    sections.push("## Relevant Project Context");
    sections.push(
      "The orchestrator has provided the following relevant memories:",
    );
    sections.push("");

    for (const memory of memories) {
      const prefix = getMemoryPrefix(memory);
      sections.push(`- [${prefix}] ${memory.text}`);
    }
    sections.push("");
  }

  // Additional context from orchestrator
  if (additionalContext) {
    sections.push("## Additional Context");
    sections.push(additionalContext);
    sections.push("");
  }

  // The task
  sections.push("## Your Task");
  sections.push(task);
  sections.push("");

  // Expected output format
  sections.push("## Expected Output Format");
  sections.push(template.outputFormat);
  sections.push("");

  return sections.join("\n");
}

/**
 * Get a human-readable prefix for a memory based on its type.
 * @internal
 */
function getMemoryPrefix(memory: Memory): string {
  switch (memory.factType) {
    case "experience":
      return "Past experience";
    case "opinion":
      return `Opinion (${memory.confidence?.toFixed(2) ?? "?"})`;
    case "observation":
      return "Observation";
    case "world":
    default:
      return "Fact";
  }
}

/**
 * Create a minimal context string for quick delegation.
 *
 * Useful when you don't need full memory retrieval.
 *
 * @param template - Agent template
 * @param task - Task description
 * @returns Minimal context string
 */
export function createMinimalContext(
  template: AgentTemplate,
  task: string,
): string {
  return `# Agent: ${template.name}

## Mission
${template.mission}

## Constraints
${template.constraints.map((c) => `- ${c}`).join("\n")}

## Your Task
${task}

## Expected Output Format
${template.outputFormat}
`;
}
