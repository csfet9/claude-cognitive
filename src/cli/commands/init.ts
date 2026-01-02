/**
 * CLI init command - initialize claude-mind for a project.
 * @module cli/commands/init
 */

import { mkdir, writeFile, access } from "node:fs/promises";
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
  semanticPath: string;
  bankId: string;
  created: {
    rc: boolean;
    semantic: boolean;
    bank: boolean;
  };
}

/**
 * Register the init command.
 */
export function registerInitCommand(cli: CAC): void {
  cli
    .command("init", "Initialize claude-mind for the current project")
    .option("--project <path>", "Project directory (default: current directory)")
    .option("--bank-id <id>", "Memory bank ID (default: derived from project name)")
    .option("--force", "Overwrite existing configuration")
    .option("--json", "Output as JSON")
    .option("--quiet", "Suppress output")
    .action(async (options: InitOptions) => {
      const projectPath = options.project ?? process.cwd();
      const rcPath = join(projectPath, ".claudemindrc");
      const semanticDir = join(projectPath, ".claude");
      const semanticPath = join(semanticDir, "memory.md");

      const result: InitResult = {
        rcPath,
        semanticPath,
        bankId: "",
        created: {
          rc: false,
          semantic: false,
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

      // Create default configuration
      const defaultConfig = {
        hindsight: {
          host: "localhost",
          port: 8888,
        },
        bankId: options.bankId,
        disposition: {
          skepticism: 3,
          literalism: 3,
          empathy: 3,
        },
        semantic: {
          path: ".claude/memory.md",
        },
      };

      // Write .claudemindrc
      await writeFile(rcPath, JSON.stringify(defaultConfig, null, 2) + "\n");
      result.created.rc = true;
      info(`Created ${rcPath}`, options);

      // Create .claude directory and memory.md if they don't exist
      const semanticExists = await access(semanticPath)
        .then(() => true)
        .catch(() => false);

      if (!semanticExists) {
        await mkdir(semanticDir, { recursive: true });
        const defaultSemantic = `# Project Memory

## Tech Stack

<!-- Add your tech stack here -->

## Key Decisions

<!-- Document important architectural decisions -->

## Critical Paths

<!-- List important code paths -->

## Observations

<!-- Promoted insights from Hindsight -->
`;
        await writeFile(semanticPath, defaultSemantic);
        result.created.semantic = true;
        info(`Created ${semanticPath}`, options);
      }

      // Initialize Mind to create bank
      try {
        const mind = new Mind({ projectPath });
        await mind.init();
        result.bankId = mind.getBankId();
        result.created.bank = !mind.isDegraded;

        if (mind.isDegraded) {
          info(
            "Warning: Hindsight unavailable. Bank not created.",
            options,
          );
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
          `Initialized claude-mind:\n  Config: ${r.rcPath}\n  Semantic: ${r.semanticPath}\n  Bank: ${r.bankId || "(not created)"}`,
        options,
      );
    });
}
