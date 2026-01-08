/**
 * CLI retain command - store content in memory.
 * @module cli/commands/retain
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type { FactType } from "../../types.js";
import { CLIError, ExitCode, info, output } from "../utils/index.js";

interface RetainCliOptions {
  project?: string;
  context?: string;
  type?: string;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}

interface RetainResult {
  stored: boolean;
  content: string;
  contentLength: number;
  factType: FactType;
  context?: string;
  destination: "hindsight" | "offline";
  dryRun: boolean;
}

/**
 * Truncate string to max length with ellipsis.
 */
function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}

/**
 * Format retain result for human-readable output.
 */
function formatRetainResult(result: RetainResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push("=== DRY RUN - Nothing was stored ===");
    lines.push("");
  }

  lines.push(`Content: "${truncate(result.content, 100)}"`);
  lines.push(`Length: ${result.contentLength} characters`);
  lines.push(`Type: ${result.factType}`);
  if (result.context) {
    lines.push(`Context: ${result.context}`);
  }
  lines.push(`Destination: ${result.destination}`);

  if (!result.dryRun) {
    lines.push("");
    lines.push("Memory stored successfully.");
  }

  return lines.join("\n");
}

/**
 * Register the retain command.
 */
export function registerRetainCommand(cli: CAC): void {
  cli
    .command("retain <content>", "Store content in memory")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--context <ctx>", "Additional context for the memory")
    .option(
      "--type <type>",
      "Memory type: world, experience, opinion (default: experience)",
    )
    .option("--dry-run", "Preview what would be stored without storing")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (content: string, options: RetainCliOptions) => {
      const projectPath = options.project ?? process.cwd();

      // Validate type
      const validTypes: FactType[] = [
        "world",
        "experience",
        "opinion",
        "observation",
      ];
      const factType: FactType = (options.type as FactType) ?? "experience";
      if (options.type && !validTypes.includes(factType)) {
        throw new CLIError(
          `Invalid type: ${options.type}. Use one of: ${validTypes.join(", ")}`,
          ExitCode.CONFIG_ERROR,
        );
      }

      const mind = new Mind({ projectPath });
      await mind.init();

      const destination = mind.isDegraded ? "offline" : "hindsight";

      const result: RetainResult = {
        stored: false,
        content,
        contentLength: content.length,
        factType,
        destination,
        dryRun: options.dryRun ?? false,
      };
      if (options.context) {
        result.context = options.context;
      }

      if (!options.dryRun) {
        info(`Storing to ${destination}...`, options);
        await mind.retain(content, options.context, factType);
        result.stored = true;
      }

      output(result, formatRetainResult, options);
    });
}
