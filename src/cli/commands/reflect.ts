/**
 * CLI reflect command - reason about accumulated knowledge.
 * @module cli/commands/reflect
 */

import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import { CLIError, ExitCode, output, formatOpinions } from "../utils/index.js";
import type { ReflectResult } from "../../types.js";

interface ReflectOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Format reflection result for human-readable output.
 */
function formatReflection(result: ReflectResult): string {
  const lines: string[] = [];

  lines.push(result.text);
  lines.push("");

  if (result.opinions.length > 0) {
    lines.push("Opinions formed:");
    lines.push(formatOpinions(result.opinions));
    lines.push("");
  }

  const worldCount = result.basedOn.world.length;
  const expCount = result.basedOn.experience.length;
  const opinionCount = result.basedOn.opinion.length;
  const total = worldCount + expCount + opinionCount;

  if (total > 0) {
    lines.push(
      `Based on ${total} memories: ${worldCount} world facts, ${expCount} experiences, ${opinionCount} prior opinions.`,
    );
  }

  return lines.join("\n").trim();
}

/**
 * Register the reflect command.
 */
export function registerReflectCommand(cli: CAC): void {
  cli
    .command("reflect <query>", "Reason about accumulated knowledge")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (query: string, options: ReflectOptions) => {
      const projectPath = options.project ?? process.cwd();

      const mind = new Mind({ projectPath });
      await mind.init();

      if (mind.isDegraded) {
        throw new CLIError(
          "Cannot reflect: Hindsight is unavailable.",
          ExitCode.CONNECTION_ERROR,
          "Make sure Hindsight is running and accessible.",
        );
      }

      const result = await mind.reflect(query);

      output(result, formatReflection, options);
    });
}
