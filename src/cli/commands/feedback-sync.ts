/**
 * CLI feedback-sync command - sync pending offline feedback signals to Hindsight.
 * @module cli/commands/feedback-sync
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import { output, info } from "../utils/index.js";

interface FeedbackSyncOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
  clear?: boolean;
}

interface FeedbackSyncResult {
  success: boolean;
  signalsSynced: number;
  signalsCleared: number;
  error?: string;
  degraded: boolean;
}

/**
 * Format feedback sync result for human-readable output.
 */
function formatFeedbackSyncResult(result: FeedbackSyncResult): string {
  const lines: string[] = [];

  if (result.success) {
    if (result.signalsSynced > 0) {
      lines.push(
        `Successfully synced ${result.signalsSynced} feedback signal(s) to Hindsight.`,
      );
    } else {
      lines.push("No pending feedback signals to sync.");
    }

    if (result.signalsCleared > 0) {
      lines.push(
        `Cleared ${result.signalsCleared} synced signal(s) from queue.`,
      );
    }
  } else {
    lines.push(
      `Failed to sync feedback signals: ${result.error ?? "Unknown error"}`,
    );
    if (result.degraded) {
      lines.push(
        "Hindsight is unavailable. Signals will be synced when connection is restored.",
      );
    }
  }

  return lines.join("\n");
}

/**
 * Register the feedback-sync command.
 */
export function registerFeedbackSyncCommand(cli: CAC): void {
  cli
    .command(
      "feedback-sync",
      "Sync pending offline feedback signals to Hindsight",
    )
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .option("--clear", "Clear synced signals after successful sync")
    .action(async (options: FeedbackSyncOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      const queue = mind.getOfflineFeedbackQueue();

      if (!queue) {
        const result: FeedbackSyncResult = {
          success: false,
          signalsSynced: 0,
          signalsCleared: 0,
          error: "Feedback system is not enabled",
          degraded: mind.isDegraded,
        };
        output(result, formatFeedbackSyncResult, options);
        return;
      }

      // Check if we're in degraded mode
      if (mind.isDegraded) {
        // Attempt recovery first
        info("Hindsight unavailable, attempting recovery...", options);
        const recovered = await mind.attemptRecovery();

        if (!recovered) {
          const result: FeedbackSyncResult = {
            success: false,
            signalsSynced: 0,
            signalsCleared: 0,
            error: "Hindsight is unavailable",
            degraded: true,
          };
          output(result, formatFeedbackSyncResult, options);
          return;
        }
        info("Connection restored!", options);
      }

      // Get pending count before sync
      const statsBefore = await queue.getStats();
      if (statsBefore.pending === 0) {
        const result: FeedbackSyncResult = {
          success: true,
          signalsSynced: 0,
          signalsCleared: 0,
          degraded: false,
        };
        output(result, formatFeedbackSyncResult, options);
        return;
      }

      info(
        `Found ${statsBefore.pending} pending signal(s) to sync...`,
        options,
      );

      // Sync signals
      let signalsSynced = 0;
      let signalsCleared = 0;

      try {
        signalsSynced = await mind.syncOfflineFeedback();

        // Clear synced signals if requested
        if (options.clear && signalsSynced > 0) {
          signalsCleared = await queue.clearSynced();
        }

        const result: FeedbackSyncResult = {
          success: true,
          signalsSynced,
          signalsCleared,
          degraded: false,
        };
        output(result, formatFeedbackSyncResult, options);
      } catch (error) {
        const result: FeedbackSyncResult = {
          success: false,
          signalsSynced: 0,
          signalsCleared: 0,
          error: error instanceof Error ? error.message : String(error),
          degraded: mind.isDegraded,
        };
        output(result, formatFeedbackSyncResult, options);
      }
    });
}
