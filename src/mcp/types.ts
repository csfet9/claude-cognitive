/**
 * Type definitions for MCP (Model Context Protocol) server.
 * @module mcp/types
 */

import type { Mind } from "../mind.js";

// ============================================
// Transport Types
// ============================================

/**
 * Transport type for MCP server.
 */
export type McpTransportType = "stdio" | "http";

/**
 * HTTP transport configuration.
 */
export interface HttpTransportConfig {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: "127.0.0.1") */
  host?: string;
  /** Enable CORS (default: false) */
  cors?: boolean;
  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeout?: number;
}

// ============================================
// Server Options
// ============================================

/**
 * Options for creating the MCP server.
 */
export interface McpServerOptions {
  /** Mind instance to use for operations */
  mind: Mind;
  /** Transport type (default: "stdio") */
  transport?: McpTransportType;
  /** HTTP transport configuration (only used when transport is "http") */
  http?: HttpTransportConfig;
  /** Server name for MCP identification (default: "claude-mind") */
  name?: string;
  /** Server version (default: from package.json) */
  version?: string;
}

// ============================================
// Tool Types
// ============================================

/**
 * MCP tool result content item.
 */
export interface ToolResultContent {
  type: "text";
  text: string;
}

/**
 * Tool result format for MCP responses.
 */
export interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
}

/**
 * Recall tool input schema type.
 */
export interface RecallToolInput {
  query: string;
  type?: "world" | "experience" | "opinion" | "all";
}

/**
 * Reflect tool input schema type.
 */
export interface ReflectToolInput {
  query: string;
}
