/**
 * CLI semantic command - DEPRECATED.
 * Semantic memory (.claude/memory.md) has been removed.
 * Context is now managed via .claude/rules/session-context.md
 * @module cli/commands/semantic
 */

import type { CAC } from "cac";
import { CLIError, ExitCode } from "../utils/index.js";

/**
 * Register the semantic command (deprecated).
 */
export function registerSemanticCommand(cli: CAC): void {
  cli
    .command(
      "semantic [section]",
      "DEPRECATED - semantic memory has been removed",
    )
    .action(async () => {
      throw new CLIError(
        "The semantic command has been removed.",
        ExitCode.CONFIG_ERROR,
        "Context is now managed via .claude/rules/session-context.md at session start.",
      );
    });
}
