/**
 * Agent template type definitions.
 * @module agents/types
 */

import type { Memory } from "../types.js";

/**
 * Base agent template structure.
 * Defines what an agent does and how it operates.
 */
export interface AgentTemplate {
  /** Unique agent identifier */
  name: string;
  /** What this agent specializes in */
  mission: string;
  /** Tools the agent can use */
  tools: string[];
  /** Expected output format/structure */
  outputFormat: string;
  /** Operational constraints */
  constraints: string[];
  /** Optional system prompt additions */
  systemPromptAdditions?: string;
}

/**
 * Agent context prepared by orchestrator before delegation.
 */
export interface AgentContext {
  /** The agent template */
  template: AgentTemplate;
  /** Relevant memories retrieved via recall() */
  memories: Memory[];
  /** The specific task to perform */
  task: string;
  /** Additional context from orchestrator */
  additionalContext?: string;
}

/**
 * Built-in agent type identifiers.
 */
export type BuiltInAgentType =
  | "code-explorer"
  | "code-architect"
  | "code-reviewer";

/**
 * Options for preparing agent context.
 */
export interface GetAgentContextOptions {
  /** Recall budget for memory retrieval */
  budget?: "low" | "mid" | "high";
  /** Additional context to include */
  additionalContext?: string;
  /** Maximum memories to include */
  maxMemories?: number;
}
