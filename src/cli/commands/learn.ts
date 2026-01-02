/**
 * CLI learn command - bootstrap memory from codebase.
 * @module cli/commands/learn
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type { LearnDepth } from "../../types.js";
import { CLIError, ExitCode, info, output, formatLearnResult } from "../utils/index.js";

interface LearnOptions {
  project?: string;
  depth?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Register the learn command.
 */
export function registerLearnCommand(cli: CAC): void {
  cli
    .command("learn", "Bootstrap memory from codebase")
    .option("--project <path>", "Project directory (default: current directory)")
    .option(
      "--depth <level>",
      "Analysis depth: quick, standard, or full (default: standard)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: LearnOptions) => {
      const projectPath = options.project ?? process.cwd();
      const depth = (options.depth ?? "standard") as LearnDepth;

      if (!["quick", "standard", "full"].includes(depth)) {
        throw new CLIError(
          `Invalid depth: ${depth}. Use 'quick', 'standard', or 'full'.`,
          ExitCode.CONFIG_ERROR,
        );
      }

      const mind = new Mind({ projectPath });
      await mind.init();

      if (mind.isDegraded) {
        throw new CLIError(
          "Cannot learn: Hindsight is unavailable.",
          ExitCode.CONNECTION_ERROR,
          "Make sure Hindsight is running and accessible.",
        );
      }

      info(`Learning from codebase (depth: ${depth})...`, options);

      const result = await mind.learn({ depth });

      output(result, formatLearnResult, options);
    });
}
