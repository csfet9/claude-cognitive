/**
 * Agent template type definitions.
 * @module agents/types
 */

import type { Memory } from "../types.js";

// ============================================
// Model & Cost Routing Types
// ============================================

/** Claude model tiers for agent delegation */
export type ModelTier = "opus" | "sonnet" | "haiku";

/** Derive cost from model tier (opus→expensive, sonnet→standard, haiku→cheap) */
const MODEL_COST: Record<ModelTier, string> = {
  opus: "expensive",
  sonnet: "standard",
  haiku: "cheap",
};

export function costForModel(model: ModelTier): string {
  return MODEL_COST[model];
}

/** Task categories that map to model tiers */
export type TaskCategory =
  | "exploration" // Read-only codebase analysis → haiku
  | "implementation" // Write code, standard complexity → sonnet
  | "review" // Code/security review → sonnet (security → opus)
  | "architecture" // Design, complex planning → sonnet/opus
  | "research" // Web search, doc lookup → haiku
  | "testing" // Write/run tests → sonnet
  | "debugging" // Trace issues, fix bugs → sonnet
  | "security" // Security analysis → opus
  | "reasoning"; // Deep reasoning, memory ops → opus

// ============================================
// Agent Template Types
// ============================================

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
  /** Model tier for this agent */
  model?: ModelTier;
  /** Task categories this agent handles */
  categories?: TaskCategory[];
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
