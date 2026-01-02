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
} from "./types.js";

// Built-in templates
export {
  CODE_EXPLORER_TEMPLATE,
  CODE_ARCHITECT_TEMPLATE,
  CODE_REVIEWER_TEMPLATE,
  BUILT_IN_TEMPLATES,
  getBuiltInTemplate,
  getAllBuiltInTemplates,
  isBuiltInAgent,
} from "./templates.js";

// Custom agent loading
export {
  parseAgentMarkdown,
  loadCustomAgents,
  templateToMarkdown,
} from "./loader.js";

// Context preparation
export {
  getAgentContext,
  formatAgentPrompt,
  createMinimalContext,
} from "./context.js";
