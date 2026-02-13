/**
 * Agent templates module.
 * @module agents
 */

// Types
export type {
  AgentTemplate,
  AgentContext,
  BuiltInAgentType,
  GetAgentContextOptions,
  ModelTier,
  TaskCategory,
  AgentMode,
  AgentCost,
  AgentCategory,
  AgentPromptMetadata,
  DelegationTrigger,
} from "./types.js";

export { costForModel } from "./types.js";

// Built-in templates
export {
  ORCHESTRATOR_TEMPLATE,
  DEEP_WORKER_TEMPLATE,
  PLAN_EXECUTOR_TEMPLATE,
  STRATEGIC_PLANNER_TEMPLATE,
  ADVISOR_TEMPLATE,
  RESEARCHER_TEMPLATE,
  EXPLORER_TEMPLATE,
  PRE_ANALYZER_TEMPLATE,
  PLAN_VALIDATOR_TEMPLATE,
  TASK_EXECUTOR_TEMPLATE,
  VISION_ANALYZER_TEMPLATE,
  BUILT_IN_TEMPLATES,
  getBuiltInTemplate,
  getAllBuiltInTemplates,
  isBuiltInAgent,
} from "./templates.js";

// Custom agent loading
export {
  parseAgentMarkdown,
  parseFrontmatter,
  loadCustomAgents,
  templateToMarkdown,
} from "./loader.js";

// Context preparation
export {
  getAgentContext,
  formatAgentPrompt,
  createMinimalContext,
} from "./context.js";

// Built-in agent file generation
export { generateBuiltInAgentFiles } from "./agent-files.js";
