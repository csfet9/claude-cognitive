/**
 * CLI sync command - DEPRECATED.
 * The .claude/memory.md file has been removed.
 * Context is now managed via .claude/rules/session-context.md at session start.
 * @module cli/commands/sync
 */

import type { CAC } from "cac";
import { CLIError, ExitCode } from "../utils/index.js";

/**
 * Register the sync command (deprecated).
 */
export function registerSyncCommand(cli: CAC): void {
  cli
    .command("sync", "DEPRECATED - memory.md sync has been removed")
    .action(async () => {
      throw new CLIError(
        "The sync command has been removed.",
        ExitCode.CONFIG_ERROR,
        "Context is now automatically managed via .claude/rules/session-context.md at session start.\n" +
          "Memories are stored in Hindsight and fetched when you start Claude Code.",
      );
    });
}
