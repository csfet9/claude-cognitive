/**
 * CLI status command - show connection and project status.
 * @module cli/commands/status
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import { output, formatStatus } from "../utils/index.js";

interface StatusOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
}

interface StatusResult {
  hindsight: {
    healthy: boolean;
    version?: string;
    error?: string;
  };
  bankId: string;
  memoryCount?: number;
  semanticPath: string;
  semanticLoaded: boolean;
  degraded: boolean;
}

/**
 * Register the status command.
 */
export function registerStatusCommand(cli: CAC): void {
  cli
    .command("status", "Show connection and project status")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: StatusOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      const result: StatusResult = {
        hindsight: {
          healthy: !mind.isDegraded,
        },
        bankId: mind.getBankId(),
        semanticPath: mind.getSemanticPath(),
        semanticLoaded: mind.getSemanticMemory()?.isLoaded() ?? false,
        degraded: mind.isDegraded,
      };

      // Get bank info if not degraded
      if (!mind.isDegraded) {
        try {
          const bank = await mind.getBank();
          if (bank) {
            result.memoryCount = bank.memoryCount;
          }
        } catch {
          // Ignore errors getting bank info
        }
      }

      output(result, formatStatus, options);
    });
}
