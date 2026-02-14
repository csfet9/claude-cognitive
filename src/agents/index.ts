/**
 * Agent templates module.
 * @module agents
 */

// Types
export type {
  AgentTemplate,
  AgentContext,
  GetAgentContextOptions,
} from "./types.js";

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
