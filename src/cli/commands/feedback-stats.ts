/**
 * CLI feedback-stats command - show feedback queue and processing statistics.
 * @module cli/commands/feedback-stats
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type { QueueStats } from "../../feedback/offline-queue.js";
import { output, info } from "../utils/index.js";

interface FeedbackStatsOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
}

interface FeedbackStatsResult {
  feedbackEnabled: boolean;
  degraded: boolean;
  queue?: QueueStats;
  bankId: string;
}

/**
 * Format feedback stats for human-readable output.
 */
function formatFeedbackStats(result: FeedbackStatsResult): string {
  const lines: string[] = [];

  lines.push("Feedback System Status");
  lines.push("=".repeat(40));

  lines.push(`Bank: ${result.bankId}`);
  lines.push(`Feedback enabled: ${result.feedbackEnabled ? "Yes" : "No"}`);
  lines.push(`Mode: ${result.degraded ? "Degraded (offline)" : "Online"}`);

  if (result.queue) {
    lines.push("");
    lines.push("Offline Queue:");
    lines.push(`  Total signals: ${result.queue.total}`);
    lines.push(`  Pending sync: ${result.queue.pending}`);
    lines.push(`  Already synced: ${result.queue.synced}`);

    if (result.queue.lastSyncAttempt) {
      const date = new Date(result.queue.lastSyncAttempt).toLocaleString();
      lines.push(`  Last sync attempt: ${date}`);
    }

    if (result.queue.lastSyncSuccess) {
      const date = new Date(result.queue.lastSyncSuccess).toLocaleString();
      lines.push(`  Last successful sync: ${date}`);
    }
  } else if (result.feedbackEnabled) {
    lines.push("");
    lines.push("Offline Queue: No pending signals");
  }

  return lines.join("\n");
}

/**
 * Register the feedback-stats command.
 */
export function registerFeedbackStatsCommand(cli: CAC): void {
  cli
    .command("feedback-stats", "Show feedback queue and processing statistics")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: FeedbackStatsOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      const queue = mind.getOfflineFeedbackQueue();
      const feedbackEnabled = queue !== null;

      const result: FeedbackStatsResult = {
        feedbackEnabled,
        degraded: mind.isDegraded,
        bankId: mind.getBankId(),
      };

      if (queue) {
        const stats = await queue.getStats();
        result.queue = stats;
      }

      if (!feedbackEnabled && !options.quiet && !options.json) {
        info("Feedback system is not enabled. Enable it in .claudemindrc:", options);
        info('  "feedback": { "enabled": true }', options);
        info("", options);
      }

      output(result, formatFeedbackStats, options);
    });
}
