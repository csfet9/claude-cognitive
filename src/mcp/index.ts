/**
 * MCP (Model Context Protocol) server for claude-cognitive.
 * @module mcp
 */

// Server
export { ClaudeMindMcpServer } from "./server.js";

// Tools
export {
  TOOL_DEFINITIONS,
  recallInputSchema,
  reflectInputSchema,
} from "./tools.js";

// Handlers
export { handleRecall, handleReflect } from "./handlers.js";

// Types
export type {
  HttpTransportConfig,
  McpServerOptions,
  McpTransportType,
  RecallToolInput,
  ReflectToolInput,
  ToolResult,
  ToolResultContent,
} from "./types.js";

// ============================================
// Factory Function
// ============================================

import { ClaudeMindMcpServer } from "./server.js";
import type { McpServerOptions } from "./types.js";

/**
 * Factory function to create and start an MCP server.
 *
 * @param options - Server configuration options
 * @returns Started MCP server instance
 *
 * @example
 * ```typescript
 * import { createMcpServer } from 'claude-cognitive/mcp';
 * import { Mind } from 'claude-cognitive';
 *
 * const mind = new Mind({ projectPath: process.cwd() });
 * await mind.init();
 *
 * const server = await createMcpServer({
 *   mind,
 *   transport: 'stdio',
 * });
 * ```
 */
export async function createMcpServer(
  options: McpServerOptions,
): Promise<ClaudeMindMcpServer> {
  const server = new ClaudeMindMcpServer(options);
  await server.start();
  return server;
}
