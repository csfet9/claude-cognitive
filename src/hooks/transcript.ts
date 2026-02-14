/**
 * Transcript parsing for Claude Code session transcripts.
 * @module hooks/transcript
 *
 * Reads and parses JSONL transcript files, extracting meaningful
 * conversation content (user messages and assistant responses)
 * while filtering out metadata and system entries.
 */

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

export interface TranscriptMessage {
  type?: string;
  message?: {
    role?: string;
    content?:
      | string
      | Array<{ type: string; text?: string; thinking?: string }>;
  };
  uuid?: string;
  session_id?: string;
}

/**
 * Parse JSONL transcript and extract meaningful conversation content.
 * Filters out metadata and extracts only user messages and assistant responses.
 */
export function parseTranscript(rawContent: string): string {
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
 * Extract session ID from transcript JSONL.
 * Returns the first session_id found in metadata entries.
 */
export function extractSessionId(rawContent: string): string | null {
  const lines = rawContent.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.session_id && typeof entry.session_id === "string") {
        return entry.session_id;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Read transcript from file or stdin.
 * Returns both the parsed transcript and the extracted session ID.
 */
export async function readTranscript(
  filePath: string | undefined,
): Promise<{ transcript: string | null; sessionId: string | null }> {
  let rawContent: string | null = null;

  // If file path provided, read from file
  if (filePath) {
    try {
      rawContent = await readFile(filePath, "utf-8");
    } catch (error) {
      console.error(
        `Warning: Could not read transcript file: ${error instanceof Error ? error.message : error}`,
      );
      return { transcript: null, sessionId: null };
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

  if (!rawContent) return { transcript: null, sessionId: null };

  // Check if content is JSONL format (Claude Code transcripts)
  const firstLine = rawContent.split("\n")[0]?.trim() ?? "";
  if (firstLine.startsWith("{")) {
    // Parse JSONL and extract meaningful content
    const sessionId = extractSessionId(rawContent);
    return { transcript: parseTranscript(rawContent), sessionId };
  }

  // Return raw content if not JSONL (no session ID available)
  return { transcript: rawContent, sessionId: null };
}
