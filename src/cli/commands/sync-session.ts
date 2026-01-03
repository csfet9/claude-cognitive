/**
 * CLI sync-session command - sync current session to Hindsight before /clear.
 * @module cli/commands/sync-session
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import {
  readBuffer,
  formatBufferAsTranscript,
  clearBuffer,
} from "../../hooks/buffer-message.js";
import { CLIError, ExitCode, info, output } from "../utils/index.js";

interface SyncSessionOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
  keepBuffer?: boolean;
}

interface SyncSessionResult {
  synced: boolean;
  messagesProcessed: number;
  transcriptLength: number;
  opinionsFormed: number;
  bufferCleared: boolean;
  error?: string;
}

/**
 * Format sync-session result for human-readable output.
 */
function formatSyncSessionResult(result: SyncSessionResult): string {
  const lines: string[] = [];

  if (!result.synced && result.messagesProcessed === 0) {
    lines.push("No session data to sync.");
    lines.push("The session buffer is empty - nothing to sync.");
    lines.push("");
    lines.push("Tip: The buffer captures tool interactions during your session.");
    lines.push("     Use /clear only after running 'claude-cognitive sync-session'.");
    return lines.join("\n");
  }

  if (result.error) {
    lines.push(`Error: ${result.error}`);
    return lines.join("\n");
  }

  if (!result.synced) {
    lines.push("No session data to sync.");
    return lines.join("\n");
  }

  lines.push("Session synced to Hindsight successfully!");
  lines.push(`  Messages processed: ${result.messagesProcessed}`);
  lines.push(`  Transcript length: ${result.transcriptLength} chars`);
  lines.push(`  Opinions formed: ${result.opinionsFormed}`);
  if (result.bufferCleared) {
    lines.push(`  Buffer cleared: yes`);
  }

  return lines.join("\n");
}

/**
 * Register the sync-session command.
 *
 * This command syncs the current session buffer to Hindsight.
 * Use this before running /clear to ensure your session is saved.
 *
 * Usage:
 *   claude-cognitive sync-session          # Sync and clear buffer
 *   claude-cognitive sync-session --keep-buffer  # Sync but keep buffer
 */
export function registerSyncSessionCommand(cli: CAC): void {
  cli
    .command(
      "sync-session",
      "Sync current session to Hindsight (use before /clear)",
    )
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .option("--keep-buffer", "Keep buffer after syncing (default: clear)")
    .action(async (options: SyncSessionOptions) => {
      const projectPath = options.project ?? process.cwd();

      const result: SyncSessionResult = {
        synced: false,
        messagesProcessed: 0,
        transcriptLength: 0,
        opinionsFormed: 0,
        bufferCleared: false,
      };

      try {
        // Read buffered messages
        const messages = await readBuffer(projectPath);

        if (messages.length === 0) {
          // No messages - output empty buffer message
          output(result, formatSyncSessionResult, options);
          return;
        }

        result.messagesProcessed = messages.length;

        // Format as transcript
        const transcript = formatBufferAsTranscript(messages);
        result.transcriptLength = transcript.length;

        if (transcript.trim().length === 0) {
          result.error = "Buffer contains no meaningful content";
          output(result, formatSyncSessionResult, options);
          return;
        }

        // Initialize Mind
        info("Connecting to Hindsight...", options);
        const mind = new Mind({ projectPath });
        await mind.init();

        if (mind.isDegraded) {
          throw new CLIError(
            "Cannot sync: Hindsight is unavailable.",
            ExitCode.CONNECTION_ERROR,
            "Make sure Hindsight is running and accessible.",
          );
        }

        // Process session end (retain + reflect)
        info("Syncing session...", options);
        const reflectResult = await mind.onSessionEnd(transcript);

        result.synced = true;
        result.opinionsFormed = reflectResult?.opinions.length ?? 0;

        // Clear buffer unless --keep-buffer is set
        if (!options.keepBuffer) {
          await clearBuffer(projectPath);
          result.bufferCleared = true;
        }

        output(result, formatSyncSessionResult, options);
      } catch (error) {
        if (error instanceof CLIError) {
          throw error;
        }
        result.error = error instanceof Error ? error.message : String(error);
        output(result, formatSyncSessionResult, options);
      }
    });
}
