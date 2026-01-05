/**
 * claude-cognitive - Memory integration layer for Claude Code with Hindsight.
 *
 * LLM thinks. Hindsight remembers. Together = mind.
 *
 * @example
 * ```typescript
 * import { HindsightClient, loadConfig } from 'claude-cognitive';
 *
 * // Load configuration from .claudemindrc or defaults
 * const config = await loadConfig();
 *
 * // Create client
 * const client = new HindsightClient({
 *   host: config.hindsight.host,
 *   port: config.hindsight.port,
 * });
 *
 * // Check health
 * const health = await client.health();
 * if (health.healthy) {
 *   // Store a memory
 *   await client.retain('my-project', 'Fixed the auth bug');
 *
 *   // Search memories
 *   const memories = await client.recall('my-project', 'authentication');
 * }
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { HindsightClient } from "./client.js";

// Mind orchestrator
export { Mind } from "./mind.js";

// Event system
export { TypedEventEmitter } from "./events.js";
export type { MindEventMap, MindEventName, Observation } from "./events.js";

// Semantic memory
export { SemanticMemory, DEFAULT_TEMPLATE } from "./semantic.js";
export type { SemanticMemoryOptions, ParseResult } from "./semantic.js";

// Offline memory
export { OfflineMemoryStore } from "./offline.js";
export type { OfflineMemory, OfflineMemoryStoreOptions } from "./offline.js";

// Promotion
export {
  PromotionManager,
  DEFAULT_PROMOTION_THRESHOLD,
  opinionToObservation,
  shouldPromote,
} from "./promotion.js";
export type { PromotionOptions, PromotionResult } from "./promotion.js";

// Learn operation
export { learn } from "./learn/index.js";

// Agent templates
export {
  BUILT_IN_TEMPLATES,
  getBuiltInTemplate,
  getAllBuiltInTemplates,
  isBuiltInAgent,
} from "./agents/index.js";
export { loadCustomAgents, parseAgentMarkdown } from "./agents/index.js";
export { getAgentContext, formatAgentPrompt } from "./agents/index.js";

// Configuration
export { loadConfig, getDefaultConfig } from "./config.js";

// Error handling
export { HindsightError } from "./errors.js";

// Retry utilities
export { withRetry, createRetryable } from "./retry.js";
export type { RetryOptions } from "./retry.js";

// Types - Client configuration
export type {
  HindsightClientOptions,
  TimeoutConfig,
  ClaudeMindConfig,
} from "./types.js";

// Types - Disposition
export type { Disposition, TraitValue } from "./types.js";

// Types - Bank
export type { BankOptions, Bank } from "./types.js";

// Types - Memory
export type {
  Memory,
  FactType,
  Entity,
  EntityType,
  CoOccurrence,
} from "./types.js";

// Types - Recall
export type { RecallOptions, RecallBudget } from "./types.js";

// Types - Reflect
export type { ReflectResult, Opinion } from "./types.js";

// Types - Health
export type { HealthStatus } from "./types.js";

// Types - Error codes
export { HindsightErrorCode } from "./types.js";
export type { HindsightErrorCode as HindsightErrorCodeType } from "./types.js";

// Types - Mind
export type { MindOptions } from "./types.js";

// Types - Learn
export type {
  LearnOptions,
  LearnResult,
  LearnDepth,
  ExtractedFact,
} from "./types.js";

// Types - Agents
export type {
  AgentTemplate,
  AgentContext,
  BuiltInAgentType,
  GetAgentContextOptions,
} from "./agents/index.js";

// MCP Server
export { ClaudeMindMcpServer, createMcpServer } from "./mcp/index.js";
export { TOOL_DEFINITIONS } from "./mcp/index.js";
export type {
  McpServerOptions,
  McpTransportType,
  HttpTransportConfig,
  ToolResult,
} from "./mcp/index.js";
