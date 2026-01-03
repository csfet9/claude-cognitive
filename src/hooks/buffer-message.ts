/**
 * Session buffer hook - captures messages during session for manual sync.
 * @module hooks/buffer-message
 */

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CAC } from "cac";

interface BufferMessageOptions {
  project?: string;
  role?: string;
  content?: string;
  clear?: boolean;
}

/**
 * Get the session buffer file path.
 */
export function getBufferPath(projectPath: string): string {
  return join(projectPath, ".claude", ".session-buffer.jsonl");
}

/**
 * Append a message to the session buffer.
 */
async function appendToBuffer(
  projectPath: string,
  role: string,
  content: string,
): Promise<void> {
  const bufferPath = getBufferPath(projectPath);
  const bufferDir = join(projectPath, ".claude");

  // Ensure .claude directory exists
  await mkdir(bufferDir, { recursive: true });

  const entry = {
    timestamp: new Date().toISOString(),
    role,
    content,
  };

  await appendFile(bufferPath, JSON.stringify(entry) + "\n", "utf-8");
}

/**
 * Clear the session buffer.
 */
export async function clearBuffer(projectPath: string): Promise<void> {
  const bufferPath = getBufferPath(projectPath);
  try {
    await writeFile(bufferPath, "", "utf-8");
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Read all buffered messages.
 */
export async function readBuffer(
  projectPath: string,
): Promise<Array<{ timestamp: string; role: string; content: string }>> {
  const bufferPath = getBufferPath(projectPath);
  try {
    const content = await readFile(bufferPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    return lines.map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Format buffered messages as a transcript string.
 */
export function formatBufferAsTranscript(
  messages: Array<{ timestamp: string; role: string; content: string }>,
): string {
  return messages
    .map((m) => {
      const prefix = m.role === "user" ? "User" : "Assistant";
      return `${prefix}: ${m.content}`;
    })
    .join("\n\n");
}

/**
 * Register the buffer-message hook command.
 *
 * This command is called by Claude Code on PostToolUse to buffer interactions.
 * It can also be used to clear the buffer or read its contents.
 *
 * IMPORTANT: This command must:
 * - NEVER fail (always exit 0)
 * - Be fast to not slow down tool execution
 */
export function registerBufferMessageCommand(cli: CAC): void {
  cli
    .command("buffer-message", "Buffer a message for session sync (hook)")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--role <role>", "Message role (user/assistant)")
    .option("--content <content>", "Message content")
    .option("--clear", "Clear the buffer instead of appending")
    .action(async (options: BufferMessageOptions) => {
      const projectPath = options.project ?? process.cwd();

      try {
        if (options.clear) {
          await clearBuffer(projectPath);
          console.error("buffer-message: Buffer cleared");
          process.exit(0);
          return;
        }

        // Read from stdin if no content provided
        let content = options.content;
        if (!content && !process.stdin.isTTY) {
          const chunks: string[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk.toString());
          }
          content = chunks.join("");
        }

        if (!content || !options.role) {
          // Silent exit if no content - this is normal for empty tool results
          process.exit(0);
          return;
        }

        await appendToBuffer(projectPath, options.role, content);
        process.exit(0);
      } catch (error) {
        // Log error but don't fail
        console.error(
          `buffer-message: ${error instanceof Error ? error.message : error}`,
        );
        process.exit(0);
      }
    });
}
