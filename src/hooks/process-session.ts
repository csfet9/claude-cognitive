/**
 * Session end hook - process transcript and extract memories.
 * @module hooks/process-session
 *
 * Safety filters:
 * - Only processes projects with .claudemindrc
 * - The stop hook script also filters agent sessions by filename
 * - Content filtering removes noise (tool results, file contents, long code blocks)
 * - Session skip logic filters low-value sessions
 * - Pre-summarization reduces API costs for long transcripts
 */

import { readFile, access } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { CAC } from "cac";
import { Mind } from "../mind.js";
import { loadConfig, DEFAULT_RETAIN_FILTER } from "../config.js";
import type { RetainFilterConfig } from "../types.js";

interface ProcessSessionOptions {
  project?: string;
  transcript?: string;
  json?: boolean;
}

interface ProcessResult {
  processed: boolean;
  transcriptLength: number;
  opinionsFormed: number;
  error?: string;
}

interface TranscriptMessage {
  type?: string;
  message?: {
    role?: string;
    content?:
      | string
      | Array<{ type: string; text?: string; thinking?: string }>;
  };
  uuid?: string;
}

// ============================================
// Content Filtering
// ============================================

/**
 * Patterns to filter from transcript content.
 * Each pattern is replaced with a placeholder to preserve context.
 */
interface FilterPattern {
  pattern: RegExp;
  replacement: string;
}

const TOOL_RESULT_PATTERNS: FilterPattern[] = [
  {
    pattern: /<tool-result>[\s\S]*?<\/tool-result>/g,
    replacement: "[Tool result filtered]",
  },
  {
    pattern: /<read-file-result>[\s\S]*?<\/read-file-result>/g,
    replacement: "[File read filtered]",
  },
  {
    pattern: /<glob-result>[\s\S]*?<\/glob-result>/g,
    replacement: "[Glob result filtered]",
  },
  {
    pattern: /<grep-result>[\s\S]*?<\/grep-result>/g,
    replacement: "[Grep result filtered]",
  },
  {
    pattern: /<bash-stdout>[\s\S]*?<\/bash-stdout>/g,
    replacement: "[Command output filtered]",
  },
];

const FILE_CONTENT_PATTERNS: FilterPattern[] = [
  {
    pattern: /<file-contents[^>]*>[\s\S]*?<\/file-contents>/g,
    replacement: "[File contents filtered]",
  },
  {
    pattern: /<file-content[^>]*>[\s\S]*?<\/file-content>/g,
    replacement: "[File content filtered]",
  },
];

/**
 * Summarize long code blocks while preserving shorter ones.
 * Replaces code blocks exceeding maxLines with a placeholder showing language and line count.
 */
function summarizeLongCodeBlocks(content: string, maxLines: number): string {
  return content.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const lines = code.split("\n").length;
    if (lines > maxLines) {
      const language = lang || "code";
      return `[Code block: ${lines} lines of ${language}]`;
    }
    return match;
  });
}

/**
 * Truncate lines that exceed the maximum length.
 */
function truncateLongLines(content: string, maxLength: number): string {
  return content
    .split("\n")
    .map((line) => {
      if (line.length > maxLength) {
        return line.slice(0, maxLength) + "... [truncated]";
      }
      return line;
    })
    .join("\n");
}

/**
 * Apply content filters to transcript based on configuration.
 */
function applyFilters(content: string, config: RetainFilterConfig): string {
  let filtered = content;

  // Filter tool results
  if (config.filterToolResults !== false) {
    for (const { pattern, replacement } of TOOL_RESULT_PATTERNS) {
      filtered = filtered.replace(pattern, replacement);
    }
  }

  // Filter file contents
  if (config.filterFileContents !== false) {
    for (const { pattern, replacement } of FILE_CONTENT_PATTERNS) {
      filtered = filtered.replace(pattern, replacement);
    }
  }

  // Summarize long code blocks
  const maxCodeBlockLines = config.maxCodeBlockLines ?? 500;
  if (maxCodeBlockLines > 0) {
    filtered = summarizeLongCodeBlocks(filtered, maxCodeBlockLines);
  }

  // Truncate long lines
  const maxLineLength = config.maxLineLength ?? 2000;
  if (maxLineLength > 0) {
    filtered = truncateLongLines(filtered, maxLineLength);
  }

  return filtered;
}

// ============================================
// Session Skip Logic
// ============================================

/**
 * Determine if a session should be skipped based on content analysis.
 * Skips sessions that are too short or mostly tool outputs.
 */
function shouldSkipSession(
  transcript: string,
  config: RetainFilterConfig,
): { skip: boolean; reason?: string } {
  // Skip if too short
  const minLength = config.minSessionLength ?? 200;
  if (transcript.length < minLength) {
    return {
      skip: true,
      reason: `Session too short (${transcript.length} < ${minLength} chars)`,
    };
  }

  // Skip if mostly tool outputs (heuristic check)
  if (config.skipToolOnlySessions !== false) {
    const filterPlaceholders = [
      "[Tool result filtered]",
      "[File read filtered]",
      "[File contents filtered]",
      "[File content filtered]",
      "[Glob result filtered]",
      "[Grep result filtered]",
      "[Command output filtered]",
      "[Code block:",
    ];

    let placeholderCount = 0;
    for (const placeholder of filterPlaceholders) {
      const regex = new RegExp(placeholder.replace(/[[\]]/g, "\\$&"), "g");
      const matches = transcript.match(regex);
      placeholderCount += matches?.length ?? 0;
    }

    // If more than 80% of content is filtered placeholders, skip
    const estimatedFilteredChars = placeholderCount * 50;
    if (
      transcript.length > 0 &&
      estimatedFilteredChars / transcript.length > 0.8
    ) {
      return { skip: true, reason: "Session is mostly tool outputs" };
    }
  }

  return { skip: false };
}

// ============================================
// Pre-Summarization
// ============================================

/**
 * Default prompt for summarizing long transcripts.
 */
const DEFAULT_SUMMARIZE_PROMPT = `Summarize this conversation for memory storage.
Focus on: decisions made, problems solved, key learnings, user preferences.
Omit: file contents, code details, tool outputs, verbose explanations.
Keep it concise (under 5000 characters).`;

/**
 * Summarize a long transcript using Claude CLI.
 * Returns the original transcript if summarization fails.
 */
async function summarizeTranscript(
  transcript: string,
  config: RetainFilterConfig,
): Promise<string> {
  const threshold = config.summarizeThreshold ?? 20000;

  // Don't summarize if below threshold
  if (transcript.length <= threshold) {
    return transcript;
  }

  const prompt = config.summarizePrompt ?? DEFAULT_SUMMARIZE_PROMPT;

  try {
    // Use claude CLI with --print flag for non-interactive mode
    // Pass transcript via stdin to avoid shell escaping issues
    const summary = await new Promise<string>((resolve, reject) => {
      const child = spawn("claude", ["--print", prompt], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });

      // Write transcript to stdin and close
      child.stdin.write(transcript);
      child.stdin.end();
    });

    // Verify we got a reasonable summary
    if (summary.length > 100 && summary.length < transcript.length) {
      return `[Summarized from ${transcript.length} chars]\n\n${summary}`;
    }

    // Fall back to original if summary is too short or longer
    return transcript;
  } catch (error) {
    // Log error but don't fail - return original transcript
    console.error(
      `process-session: Summarization failed: ${error instanceof Error ? error.message : error}`,
    );
    return transcript;
  }
}

// ============================================
// Transcript Parsing
// ============================================

/**
 * Parse JSONL transcript and extract meaningful conversation content.
 * Filters out metadata and extracts only user messages and assistant responses.
 */
function parseTranscript(rawContent: string): string {
  const lines = rawContent.split("\n").filter((l) => l.trim());
  const messages: string[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptMessage;

      // Skip non-message entries (summaries, file-history, etc.)
      if (!entry.message || !entry.type) continue;
      if (entry.type !== "user" && entry.type !== "assistant") continue;

      const role = entry.message.role;
      const content = entry.message.content;

      if (!content) continue;

      // Extract text content
      let text = "";
      if (typeof content === "string") {
        text = content;
      } else if (Array.isArray(content)) {
        // Handle content blocks (text, tool_use, thinking, etc.)
        const textParts = content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text)
          .filter(Boolean);
        text = textParts.join("\n");
      }

      // Skip empty messages
      if (!text.trim()) continue;

      // Skip system reminders and metadata
      if (text.includes("<system-reminder>")) continue;
      if (text.includes("session_id")) continue;
      if (text.includes("transcript_path")) continue;

      // Skip CLI commands that don't provide meaningful content
      if (text.includes("<command-name>/exit</command-name>")) continue;
      if (text.includes("<command-name>/clear</command-name>")) continue;
      if (text.includes("<command-name>/help</command-name>")) continue;
      if (text.includes("<command-name>/compact</command-name>")) continue;
      if (text.includes("<command-name>/config</command-name>")) continue;
      if (text.includes("<local-command-stdout>See ya!</local-command-stdout>"))
        continue;
      if (text.includes("<local-command-stdout>")) continue;

      // Format message
      const prefix = role === "user" ? "User" : "Assistant";
      messages.push(`${prefix}: ${text.trim()}`);
    } catch {
      // Skip invalid JSON lines
      continue;
    }
  }

  return messages.join("\n\n");
}

/**
 * Read transcript from file or stdin.
 */
async function readTranscript(
  filePath: string | undefined,
): Promise<string | null> {
  let rawContent: string | null = null;

  // If file path provided, read from file
  if (filePath) {
    try {
      rawContent = await readFile(filePath, "utf-8");
    } catch (error) {
      console.error(
        `Warning: Could not read transcript file: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  } else if (!process.stdin.isTTY) {
    // Read from stdin if not a TTY
    rawContent = await new Promise<string>((resolve) => {
      const chunks: string[] = [];
      const rl = createInterface({
        input: process.stdin,
        terminal: false,
      });

      rl.on("line", (line) => {
        chunks.push(line);
      });

      rl.on("close", () => {
        resolve(chunks.join("\n"));
      });

      // Timeout after 5 seconds if no input
      setTimeout(() => {
        rl.close();
        resolve(chunks.join("\n"));
      }, 5000);
    });
  }

  if (!rawContent) return null;

  // Check if content is JSONL format (Claude Code transcripts)
  const firstLine = rawContent.split("\n")[0]?.trim() ?? "";
  if (firstLine.startsWith("{")) {
    // Parse JSONL and extract meaningful content
    return parseTranscript(rawContent);
  }

  // Return raw content if not JSONL
  return rawContent;
}

/**
 * Register the process-session hook command.
 *
 * This command is called by Claude Code at session end.
 * It processes the session transcript and extracts memories.
 *
 * IMPORTANT: This command must:
 * - Accept transcript from file or stdin
 * - Log to stderr only
 * - NEVER fail (always exit 0)
 */
/**
 * Check if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function registerProcessSessionCommand(cli: CAC): void {
  cli
    .command("process-session", "Process session transcript (hook)")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--transcript <path>", "Path to transcript file")
    .option("--json", "Output result as JSON")
    .action(async (options: ProcessSessionOptions) => {
      const projectPath = options.project ?? process.cwd();

      const result: ProcessResult = {
        processed: false,
        transcriptLength: 0,
        opinionsFormed: 0,
      };

      try {
        // Safety check: Only process if .claudemindrc exists in project
        const configPath = join(projectPath, ".claudemindrc");
        if (!(await fileExists(configPath))) {
          result.error = "No .claudemindrc found (skipping)";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Load configuration
        const config = await loadConfig(projectPath);
        const filterConfig = config.retainFilter ?? DEFAULT_RETAIN_FILTER;

        // Read transcript
        let transcript = await readTranscript(options.transcript);

        if (!transcript || transcript.trim().length === 0) {
          result.error = "No transcript provided";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Step 1: Apply content filters
        transcript = applyFilters(transcript, filterConfig);

        // Step 2: Check if session should be skipped
        const skipResult = shouldSkipSession(transcript, filterConfig);
        if (skipResult.skip) {
          result.error = `Session skipped: ${skipResult.reason}`;
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Step 3: Pre-summarize if too long
        transcript = await summarizeTranscript(transcript, filterConfig);

        // Step 4: Truncate if still too long
        const maxLength = filterConfig.maxTranscriptLength ?? 50000;
        if (transcript.length > maxLength) {
          transcript = transcript.slice(0, maxLength) + "\n[Truncated]";
        }

        result.transcriptLength = transcript.length;

        // Initialize Mind
        const mind = new Mind({ projectPath });
        await mind.init();

        if (mind.isDegraded) {
          result.error = "Hindsight unavailable (degraded mode)";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Process session end
        const reflectResult = await mind.onSessionEnd(transcript);

        result.processed = true;
        result.opinionsFormed = reflectResult?.opinions.length ?? 0;

        outputResult(result, options.json);
        process.exit(0);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        outputResult(result, options.json);
        // Always exit 0 to not break Claude Code
        process.exit(0);
      }
    });
}

/**
 * Output result to stderr (or stdout for JSON mode).
 */
function outputResult(result: ProcessResult, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.error) {
      console.error(`process-session: ${result.error}`);
    } else if (result.processed) {
      console.error(
        `process-session: Processed ${result.transcriptLength} chars, formed ${result.opinionsFormed} opinions`,
      );
    }
  }
}

// Export filtering functions for testing
export {
  summarizeLongCodeBlocks as _summarizeLongCodeBlocks,
  truncateLongLines as _truncateLongLines,
  applyFilters as _applyFilters,
  shouldSkipSession as _shouldSkipSession,
};
