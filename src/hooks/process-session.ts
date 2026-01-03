/**
 * Session end hook - process transcript and extract memories.
 * @module hooks/process-session
 */

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { CAC } from "cac";
import { Mind } from "../mind.js";

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
        // Read transcript
        const transcript = await readTranscript(options.transcript);

        if (!transcript || transcript.trim().length === 0) {
          result.error = "No transcript provided";
          outputResult(result, options.json);
          process.exit(0);
          return;
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
