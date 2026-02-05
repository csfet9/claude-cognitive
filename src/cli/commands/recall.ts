/**
 * CLI recall command - search memories.
 * @module cli/commands/recall
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type {
  FactType,
  RecallBudget,
  RecallOptions as MindRecallOptions,
} from "../../types.js";
import { CLIError, ExitCode, output, formatMemories } from "../utils/index.js";

interface RecallCliOptions {
  project?: string;
  type?: string;
  budget?: string;
  limit?: number;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Register the recall command.
 */
export function registerRecallCommand(cli: CAC): void {
  cli
    .command("recall <query>", "Search memories for relevant context")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option(
      "--type <type>",
      "Memory type: world, experience, opinion, or all (default: all)",
    )
    .option(
      "--budget <level>",
      "Search thoroughness: low, mid, or high (default: mid)",
    )
    .option("--limit <n>", "Maximum number of results")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (query: string, options: RecallCliOptions) => {
      const projectPath = options.project ?? process.cwd();

      // Validate options
      const validTypes = ["world", "experience", "opinion", "all"];
      if (options.type && !validTypes.includes(options.type)) {
        throw new CLIError(
          `Invalid type: ${options.type}. Use one of: ${validTypes.join(", ")}`,
          ExitCode.CONFIG_ERROR,
        );
      }

      const validBudgets = ["low", "mid", "high"];
      if (options.budget && !validBudgets.includes(options.budget)) {
        throw new CLIError(
          `Invalid budget: ${options.budget}. Use one of: ${validBudgets.join(", ")}`,
          ExitCode.CONFIG_ERROR,
        );
      }

      const mind = new Mind({ projectPath });
      await mind.init();

      if (mind.isDegraded) {
        // Return empty results in degraded mode
        output([], formatMemories, options);
        return;
      }

      const recallOptions: MindRecallOptions = {};
      if (options.type) {
        recallOptions.factType = options.type as FactType | "all";
      }
      if (options.budget) {
        recallOptions.budget = options.budget as RecallBudget;
      }

      const memories = await mind.recall(query, recallOptions);

      // Apply limit if specified
      const limited = options.limit
        ? memories.slice(0, options.limit)
        : memories;

      output(limited, formatMemories, options);
    });
}
