/**
 * CLI metrics command - show memory effectiveness metrics.
 * @module cli/commands/metrics
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type { MetricsResult } from "../../types.js";
import { CLIError, ExitCode, output } from "../utils/index.js";

interface MetricsOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Format metrics for human-readable output.
 */
function formatMetrics(result: MetricsResult): string {
  const lines: string[] = [];

  lines.push("Memory Health Report");
  lines.push("=".repeat(40));
  lines.push("");

  // Total facts by type
  lines.push(`Total facts: ${result.totalFacts}`);
  const typeBreakdown = Object.entries(result.factsByType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${type}: ${count}`)
    .join(" | ");
  if (typeBreakdown) {
    lines.push(`  ${typeBreakdown}`);
  }

  // Signal breakdown
  if (result.bankStats) {
    const stats = result.bankStats;
    lines.push("");
    lines.push(`Signal breakdown (${stats.totalSignals} total signals):`);

    const dist = stats.signalDistribution;
    const total = stats.totalSignals || 1;

    for (const [type, count] of Object.entries(dist)) {
      const pct = ((count / total) * 100).toFixed(0);
      lines.push(`  ${type}: ${count} (${pct}%)`);
    }

    lines.push("");
    lines.push(
      `Average usefulness: ${(stats.averageUsefulness * 100).toFixed(0)}%`,
    );

    // Top useful memories
    if (stats.topUsefulFacts.length > 0) {
      lines.push("");
      lines.push("Top 5 most useful memories:");
      for (const fact of stats.topUsefulFacts.slice(0, 5)) {
        const score = (fact.score * 100).toFixed(0);
        const text =
          fact.text.slice(0, 60) + (fact.text.length > 60 ? "..." : "");
        lines.push(`  - "${text}" (${score}%)`);
      }
    }

    // Least useful / pruning candidates
    if (stats.leastUsefulFacts.length > 0) {
      lines.push("");
      lines.push("Least useful memories (pruning candidates):");
      for (const fact of stats.leastUsefulFacts.slice(0, 5)) {
        const score = (fact.score * 100).toFixed(0);
        const text =
          fact.text.slice(0, 60) + (fact.text.length > 60 ? "..." : "");
        lines.push(`  - "${text}" (${score}%)`);
      }
    }
  } else {
    lines.push("");
    lines.push("No signal data available yet.");
    lines.push("Signals are collected when memories are recalled and used.");
  }

  if (result.pruningCandidates > 0) {
    lines.push("");
    lines.push(
      `Candidates for pruning: ${result.pruningCandidates} facts (score < 30%)`,
    );
  }

  return lines.join("\n");
}

/**
 * Register the metrics command.
 */
export function registerMetricsCommand(cli: CAC): void {
  cli
    .command("metrics", "Show memory effectiveness metrics")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: MetricsOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      if (mind.isDegraded) {
        throw new CLIError(
          "Cannot get metrics: Hindsight is unavailable.",
          ExitCode.CONNECTION_ERROR,
          "Make sure Hindsight is running and accessible.",
        );
      }

      const result = await mind.getMetrics();

      output(result, formatMetrics, options);
    });
}
