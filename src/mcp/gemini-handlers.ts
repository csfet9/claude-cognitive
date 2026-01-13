/**
 * MCP tool handlers for Gemini CLI integration.
 * @module mcp/gemini-handlers
 */

import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolResult } from "./types.js";
import type { GeminiWrapper } from "../gemini/wrapper.js";
import type {
  GeminiPromptInput,
  GeminiResearchInput,
  GeminiAnalyzeCodeInput,
  GeminiSummarizeInput,
} from "./gemini-tools.js";
import { GeminiError } from "../gemini/errors.js";

// ============================================
// Formatters
// ============================================

/**
 * Format a successful Gemini response with metadata footer.
 *
 * @param response - The response text from Gemini
 * @param model - The model that was used
 * @param duration - Execution duration in milliseconds
 * @returns Formatted ToolResult
 */
function formatSuccess(
  response: string,
  model: string,
  duration: number,
): ToolResult {
  const footer = `\n\n---\n_Model: ${model} | Duration: ${(duration / 1000).toFixed(1)}s_`;
  return {
    content: [{ type: "text", text: response + footer }],
  };
}

/**
 * Format an error response with helpful guidance.
 *
 * Provides actionable error messages based on error type:
 * - AUTH_REQUIRED: How to authenticate
 * - CLI_NOT_FOUND: How to install the CLI
 * - TIMEOUT: Suggestions for resolution
 * - Other errors: Direct message passthrough
 *
 * @param error - The error to format
 * @returns Formatted ToolResult with isError flag
 */
function formatError(error: unknown): ToolResult {
  let message: string;

  if (GeminiError.isGeminiError(error)) {
    switch (error.code) {
      case "AUTH_REQUIRED":
        message = "Gemini authentication required. Run: gemini auth login";
        break;
      case "CLI_NOT_FOUND":
        message =
          "Gemini CLI not found. Install with: npm install -g @google/gemini-cli";
        break;
      case "FILE_NOT_FOUND":
      case "FILE_TOO_LARGE":
      case "SECURITY_ERROR":
        message = error.message;
        break;
      case "TIMEOUT":
        message =
          "Request timed out. Try a simpler prompt or increase timeout.";
        break;
      default:
        message = `Gemini error: ${error.message}`;
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Create a progress callback from MCP request metadata.
 *
 * Sends progress notifications to prevent client-side timeout during long operations.
 *
 * @param extra - Request handler extra data from MCP SDK
 * @returns Progress callback or undefined if no progress token available
 */
function createProgressCallback(
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): ((params: { progress: number; message?: string }) => Promise<void>) | undefined {
  if (!extra?.sendNotification || !extra._meta?.progressToken) {
    return undefined;
  }

  const progressToken = extra._meta.progressToken;

  return async (params) => {
    try {
      await extra.sendNotification({
        method: "notifications/progress",
        params: {
          progressToken,
          progress: params.progress,
          message: params.message,
        },
      });
    } catch (error) {
      console.error("[gemini-handlers] Progress notification failed:", error);
    }
  };
}

// ============================================
// Handlers
// ============================================

/**
 * Handle gemini_prompt tool invocation.
 *
 * Executes a prompt with optional context using the Gemini CLI.
 *
 * @param wrapper - GeminiWrapper instance to use for execution
 * @param input - Tool input with prompt and optional context
 * @param extra - Optional MCP request handler extra data for progress notifications
 * @returns Tool result with formatted response or error
 */
export async function handleGeminiPrompt(
  wrapper: GeminiWrapper,
  input: GeminiPromptInput,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<ToolResult> {
  try {
    const onProgress = createProgressCallback(extra);
    const result = await wrapper.prompt({
      prompt: input.prompt,
      ...(input.context ? { context: input.context } : {}),
      ...(onProgress ? { onProgress } : {}),
    });
    return formatSuccess(result.response, result.model, result.duration);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handle gemini_research tool invocation.
 *
 * Researches a topic with optional file context at specified depth.
 *
 * @param wrapper - GeminiWrapper instance to use for execution
 * @param input - Tool input with topic, optional files, and depth
 * @param extra - Optional MCP request handler extra data for progress notifications
 * @returns Tool result with formatted research findings or error
 */
export async function handleGeminiResearch(
  wrapper: GeminiWrapper,
  input: GeminiResearchInput,
  _extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<ToolResult> {
  try {
    // Note: progress callback not yet supported by wrapper.research()
    const result = await wrapper.research(
      input.topic,
      input.files,
      input.depth ?? "medium",
    );
    return formatSuccess(result.response, result.model, result.duration);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handle gemini_analyze_code tool invocation.
 *
 * Analyzes code files for the specified analysis type with optional focus area.
 *
 * @param wrapper - GeminiWrapper instance to use for execution
 * @param input - Tool input with files, analysis type, and optional focus
 * @param extra - Optional MCP request handler extra data for progress notifications
 * @returns Tool result with formatted analysis or error
 */
export async function handleGeminiAnalyzeCode(
  wrapper: GeminiWrapper,
  input: GeminiAnalyzeCodeInput,
  _extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<ToolResult> {
  try {
    // Note: progress callback not yet supported by wrapper.analyzeCode()
    const result = await wrapper.analyzeCode(
      input.files,
      input.analysis_type ?? "general",
      input.focus,
    );
    return formatSuccess(result.response, result.model, result.duration);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handle gemini_summarize tool invocation.
 *
 * Summarizes content or files in the specified format.
 * Either content or files must be provided.
 *
 * @param wrapper - GeminiWrapper instance to use for execution
 * @param input - Tool input with content/files and format
 * @param extra - Optional MCP request handler extra data for progress notifications
 * @returns Tool result with formatted summary or error
 */
export async function handleGeminiSummarize(
  wrapper: GeminiWrapper,
  input: GeminiSummarizeInput,
  _extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<ToolResult> {
  try {
    // Validate that either content or files is provided
    if (!input.content && (!input.files || input.files.length === 0)) {
      return {
        content: [
          { type: "text", text: "Either content or files must be provided" },
        ],
        isError: true,
      };
    }

    // Note: progress callback not yet supported by wrapper.summarize()
    const result = await wrapper.summarize(
      input.content,
      input.files,
      input.format ?? "bullet",
    );
    return formatSuccess(result.response, result.model, result.duration);
  } catch (error) {
    return formatError(error);
  }
}
