/**
 * CLI config command - show configuration.
 * @module cli/commands/config
 */

import type { CAC } from "cac";
import { loadConfig } from "../../config.js";
import { output, formatConfig } from "../utils/index.js";

interface ConfigOptions {
  project?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Register the config command.
 */
export function registerConfigCommand(cli: CAC): void {
  cli
    .command("config", "Show current configuration")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: ConfigOptions) => {
      const projectPath = options.project ?? process.cwd();

      const config = await loadConfig(projectPath);

      output(config, formatConfig, options);
    });
}
