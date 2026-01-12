/**
 * MCP tool definitions for Gemini CLI integration.
 * @module mcp/gemini-tools
 */

import { z } from "zod";

// ============================================
// Input Schemas
// ============================================

/**
 * Zod schema for gemini_prompt tool input.
 */
export const geminiPromptSchema = z.object({
  prompt: z.string().min(1).describe("The prompt to send to Gemini"),
  context: z.string().optional().describe("Additional context to include"),
});

/**
 * Zod schema for gemini_research tool input.
 */
export const geminiResearchSchema = z.object({
  topic: z.string().min(1).describe("The topic to research"),
  files: z
    .array(z.string())
    .optional()
    .describe("File paths to include as context"),
  depth: z
    .enum(["shallow", "medium", "deep"])
    .optional()
    .describe("Research depth (default: medium)"),
});

/**
 * Zod schema for gemini_analyze_code tool input.
 */
export const geminiAnalyzeCodeSchema = z.object({
  files: z.array(z.string()).min(1).describe("File paths to analyze"),
  analysis_type: z
    .enum([
      "security",
      "performance",
      "quality",
      "architecture",
      "documentation",
      "testing",
      "general",
    ])
    .optional()
    .describe("Type of analysis (default: general)"),
  focus: z.string().optional().describe("Specific aspect to focus on"),
});

/**
 * Zod schema for gemini_summarize tool input.
 */
export const geminiSummarizeSchema = z.object({
  content: z.string().optional().describe("Text content to summarize"),
  files: z.array(z.string()).optional().describe("File paths to summarize"),
  format: z
    .enum(["bullet", "paragraph", "technical"])
    .optional()
    .describe("Output format (default: bullet)"),
});

// ============================================
// Input Types
// ============================================

/** Input type for gemini_prompt tool */
export type GeminiPromptInput = z.infer<typeof geminiPromptSchema>;

/** Input type for gemini_research tool */
export type GeminiResearchInput = z.infer<typeof geminiResearchSchema>;

/** Input type for gemini_analyze_code tool */
export type GeminiAnalyzeCodeInput = z.infer<typeof geminiAnalyzeCodeSchema>;

/** Input type for gemini_summarize tool */
export type GeminiSummarizeInput = z.infer<typeof geminiSummarizeSchema>;

// ============================================
// Tool Definitions
// ============================================

/**
 * Gemini tool definitions for MCP server registration.
 */
export const GEMINI_TOOL_DEFINITIONS = {
  gemini_prompt: {
    name: "gemini_prompt",
    description:
      "Send a prompt to Gemini for general-purpose AI assistance. Use when you need Gemini's help with reasoning, explanations, or creative tasks. Returns Gemini's response with model and timing metadata.",
    inputSchema: geminiPromptSchema,
  },
  gemini_research: {
    name: "gemini_research",
    description:
      "Research a topic using Gemini with optional file context. Use when you need in-depth analysis of a topic, potentially informed by project files. Depth levels: 'shallow' (key points), 'medium' (comprehensive), 'deep' (detailed with trade-offs). Returns research findings with model and timing metadata.",
    inputSchema: geminiResearchSchema,
  },
  gemini_analyze_code: {
    name: "gemini_analyze_code",
    description:
      "Analyze code files using Gemini. Use when you need code review, security audit, performance analysis, or documentation assessment. Analysis types: 'security', 'performance', 'quality', 'architecture', 'documentation', 'testing', 'general'. Returns analysis results with model and timing metadata.",
    inputSchema: geminiAnalyzeCodeSchema,
  },
  gemini_summarize: {
    name: "gemini_summarize",
    description:
      "Summarize content or files using Gemini. Use when you need concise summaries of text or code files. Provide either 'content' (text) or 'files' (paths). Formats: 'bullet' (key points), 'paragraph' (cohesive narrative), 'technical' (implementation details). Returns summary with model and timing metadata.",
    inputSchema: geminiSummarizeSchema,
  },
} as const;

/**
 * All Gemini tool schemas for validation.
 */
export const GEMINI_SCHEMAS = {
  gemini_prompt: geminiPromptSchema,
  gemini_research: geminiResearchSchema,
  gemini_analyze_code: geminiAnalyzeCodeSchema,
  gemini_summarize: geminiSummarizeSchema,
} as const;
