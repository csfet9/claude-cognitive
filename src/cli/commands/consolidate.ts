/**
 * CLI consolidate command - analyze and identify low-value memories for pruning.
 * @module cli/commands/consolidate
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type { ConsolidationReport } from "../../types.js";
import { analyzePruningCandidates } from "../../consolidate/index.js";
import { CLIError, ExitCode, info, output, warn } from "../utils/index.js";

interface ConsolidateOptions {
  project?: string;
  dryRun?: boolean;
  minUsefulness?: string;
  minSignals?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Format consolidation report for human-readable output.
 */
function formatConsolidationReport(report: ConsolidationReport): string {
  const lines: string[] = [];

  lines.push("Memory Consolidation Report");
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`Bank: ${report.bankId}`);
  lines.push(`Total memories: ${report.totalMemories}`);
  lines.push("");

  lines.push("Pruning criteria:");
  lines.push(
    `  Min usefulness: ${((report.criteria.minUsefulness ?? 0.3) * 100).toFixed(0)}%`,
  );
  lines.push(`  Min signals: ${report.criteria.minSignals ?? 5}`);
  lines.push("");

  if (report.candidates.length === 0) {
    lines.push("No pruning candidates found.");
    lines.push("All memories meet the usefulness threshold.");
  } else {
    lines.push(`Found ${report.candidates.length} pruning candidate(s):`);
    lines.push("");

    for (const candidate of report.candidates.slice(0, 20)) {
      const score = (candidate.usefulnessScore * 100).toFixed(0);
      const text =
        candidate.text.slice(0, 50) + (candidate.text.length > 50 ? "..." : "");
      lines.push(`  [${score}%] "${text}"`);
      lines.push(`         ${candidate.reason}`);
    }

    if (report.candidates.length > 20) {
      lines.push("");
      lines.push(`  ... and ${report.candidates.length - 20} more`);
    }

    lines.push("");
    lines.push("NOTE: Automatic deletion is not yet supported.");
    lines.push(
      "Individual fact deletion requires an upstream Hindsight API change.",
    );
  }

  return lines.join("\n");
}

/**
 * Register the consolidate command.
 */
export function registerConsolidateCommand(cli: CAC): void {
  cli
    .command(
      "consolidate",
      "Analyze and identify low-value memories for pruning",
    )
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--dry-run", "Only show what would be pruned (default behavior)")
    .option(
      "--min-usefulness <score>",
      "Minimum usefulness score threshold (0.0-1.0, default: 0.3)",
    )
    .option(
      "--min-signals <count>",
      "Minimum signal count to consider (default: 5)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: ConsolidateOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      if (mind.isDegraded) {
        throw new CLIError(
          "Cannot consolidate: Hindsight is unavailable.",
          ExitCode.CONNECTION_ERROR,
          "Make sure Hindsight is running and accessible.",
        );
      }

      // Parse and validate criteria
      let minUsefulness: number | undefined;
      if (options.minUsefulness !== undefined) {
        minUsefulness = parseFloat(options.minUsefulness);
        if (isNaN(minUsefulness) || minUsefulness < 0 || minUsefulness > 1) {
          throw new CLIError(
            "Invalid --min-usefulness: must be a number between 0.0 and 1.0",
            ExitCode.CONFIG_ERROR,
          );
        }
      }

      let minSignals: number | undefined;
      if (options.minSignals !== undefined) {
        minSignals = parseInt(options.minSignals, 10);
        if (isNaN(minSignals) || minSignals < 0) {
          throw new CLIError(
            "Invalid --min-signals: must be a non-negative integer",
            ExitCode.CONFIG_ERROR,
          );
        }
      }

      info("Analyzing memory bank for pruning candidates...", options);

      const client = mind.getClient();
      if (!client) {
        throw new CLIError(
          "Cannot get client: Mind is in degraded mode",
          ExitCode.CONNECTION_ERROR,
        );
      }

      // Build options object, only including defined values
      const analysisOptions: Parameters<typeof analyzePruningCandidates>[2] =
        {};
      if (minUsefulness !== undefined)
        analysisOptions.minUsefulness = minUsefulness;
      if (minSignals !== undefined) analysisOptions.minSignals = minSignals;

      const report = await analyzePruningCandidates(
        client,
        mind.getBankId(),
        analysisOptions,
      );

      // Note about dry-run being the only mode currently
      if (!options.dryRun && report.candidates.length > 0) {
        warn(
          "Note: Automatic deletion not yet supported. Showing report only.",
          options,
        );
      }

      output(report, formatConsolidationReport, options);
    });
}
