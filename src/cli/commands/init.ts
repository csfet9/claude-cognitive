/**
 * CLI init command - initialize claude-cognitive for a project.
 * @module cli/commands/init
 */

import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import { CLIError, ExitCode, info, output } from "../utils/index.js";

interface InitOptions {
  project?: string;
  bankId?: string;
  force?: boolean;
  json?: boolean;
  quiet?: boolean;
}

interface InitResult {
  rcPath: string;
  bankId: string;
  created: {
    rc: boolean;
    bank: boolean;
  };
}

/**
 * Register the init command.
 */
export function registerInitCommand(cli: CAC): void {
  cli
    .command("init", "Initialize claude-cognitive for the current project")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option(
      "--bank-id <id>",
      "Memory bank ID (default: derived from project name)",
    )
    .option("--force", "Overwrite existing configuration")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: InitOptions) => {
      const projectPath = options.project ?? process.cwd();
      const rcPath = join(projectPath, ".claudemindrc");

      const result: InitResult = {
        rcPath,
        bankId: "",
        created: {
          rc: false,
          bank: false,
        },
      };

      // Check if .claudemindrc exists
      const rcExists = await access(rcPath)
        .then(() => true)
        .catch(() => false);

      if (rcExists && !options.force) {
        throw new CLIError(
          "Configuration already exists. Use --force to overwrite.",
          ExitCode.CONFIG_ERROR,
          `Existing file: ${rcPath}`,
        );
      }

      // Create default configuration with all options
      const defaultConfig = {
        hindsight: {
          host: "localhost",
          port: 8888,
          timeouts: {
            recall: 120000,
            reflect: 180000,
            retain: 90000,
          },
        },
        bankId: options.bankId,
        disposition: {
          skepticism: 3,
          literalism: 3,
          empathy: 3,
        },
        background: "",
        context: {
          recentMemoryLimit: 3,
        },
        retain: {
          maxTranscriptLength: 25000,
          filterToolResults: true,
          filterFileContents: true,
          maxCodeBlockLines: 30,
          minSessionLength: 500,
        },
      };

      // Write .claudemindrc
      await writeFile(rcPath, JSON.stringify(defaultConfig, null, 2) + "\n");
      result.created.rc = true;
      info(`Created ${rcPath}`, options);

      // Initialize Mind to create bank
      try {
        const mind = new Mind({ projectPath });
        await mind.init();
        result.bankId = mind.getBankId();
        result.created.bank = !mind.isDegraded;

        if (mind.isDegraded) {
          info("Warning: Hindsight unavailable. Bank not created.", options);
        } else {
          info(`Bank '${result.bankId}' ready`, options);
        }
      } catch (error) {
        info(
          `Warning: Could not connect to Hindsight: ${error instanceof Error ? error.message : error}`,
          options,
        );
      }

      output(
        result,
        (r) =>
          `Initialized claude-cognitive:\n  Config: ${r.rcPath}\n  Bank: ${r.bankId || "(not created)"}\n\nContext is managed via .claude/rules/session-context.md at session start.`,
        options,
      );
    });
}
