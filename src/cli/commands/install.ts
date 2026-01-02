/**
 * CLI install command - interactive installer for claude-cognitive.
 * @module cli/commands/install
 */

import { createInterface } from "node:readline";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { CAC } from "cac";
import { Mind } from "../../mind.js";
import type { Disposition, TraitValue } from "../../types.js";

interface InstallAnswers {
  projectPath: string;
  bankId: string;
  disposition: Disposition;
  background: string;
  configureClaudeCode: boolean;
  globalInstall: boolean;
  runLearn: boolean;
  learnDepth: "quick" | "standard" | "full";
}

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function print(text: string): void {
  console.log(text);
}

function printHeader(): void {
  print("");
  print(color("╔═══════════════════════════════════════════╗", "cyan"));
  print(color("║        claude-cognitive interactive setup      ║", "cyan"));
  print(color("╚═══════════════════════════════════════════╝", "cyan"));
  print("");
  print(color("LLM thinks. Hindsight remembers. Together = mind.", "dim"));
  print("");
}

function printStep(step: number, total: number, title: string): void {
  print("");
  print(color(`[${step}/${total}] ${title}`, "bright"));
  print(color("─".repeat(45), "dim"));
}

function printSuccess(text: string): void {
  print(color(`✓ ${text}`, "green"));
}

function printInfo(text: string): void {
  print(color(`  ${text}`, "dim"));
}

/**
 * Create a readline interface for prompts.
 */
function createPrompt(): {
  ask: (question: string, defaultValue?: string) => Promise<string>;
  confirm: (question: string, defaultValue?: boolean) => Promise<boolean>;
  select: <T extends string>(
    question: string,
    options: { label: string; value: T }[],
    defaultIndex?: number,
  ) => Promise<T>;
  close: () => void;
} {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string, defaultValue?: string): Promise<string> => {
    const defaultHint = defaultValue ? color(` (${defaultValue})`, "dim") : "";
    return new Promise((resolve) => {
      rl.question(`  ${question}${defaultHint}: `, (answer) => {
        resolve(answer.trim() || defaultValue || "");
      });
    });
  };

  const confirm = (
    question: string,
    defaultValue = true,
  ): Promise<boolean> => {
    const hint = defaultValue ? "[Y/n]" : "[y/N]";
    return new Promise((resolve) => {
      rl.question(`  ${question} ${color(hint, "dim")}: `, (answer) => {
        if (!answer.trim()) {
          resolve(defaultValue);
        } else {
          resolve(answer.toLowerCase().startsWith("y"));
        }
      });
    });
  };

  const select = <T extends string>(
    question: string,
    options: { label: string; value: T }[],
    defaultIndex = 0,
  ): Promise<T> => {
    print(`  ${question}`);
    options.forEach((opt, i) => {
      const marker = i === defaultIndex ? color("→", "cyan") : " ";
      const num = color(`${i + 1}`, "cyan");
      print(`  ${marker} ${num}. ${opt.label}`);
    });
    return new Promise((resolve) => {
      rl.question(
        `  ${color(`Enter choice (1-${options.length})`, "dim")}: `,
        (answer) => {
          const idx = parseInt(answer.trim(), 10) - 1;
          const selected = options[idx];
          const defaultOpt = options[defaultIndex];
          if (selected) {
            resolve(selected.value);
          } else if (defaultOpt) {
            resolve(defaultOpt.value);
          } else {
            // This should never happen since we require minItems: 2
            const firstOpt = options[0];
            resolve(firstOpt ? firstOpt.value : ("" as T));
          }
        },
      );
    });
  };

  const close = (): void => {
    rl.close();
  };

  return { ask, confirm, select, close };
}

/**
 * Check if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Claude Code MCP config path.
 * - Global: ~/.claude.json
 * - Project: .mcp.json in project root
 */
function getMcpConfigPath(global: boolean, projectPath: string): string {
  if (global) {
    return join(homedir(), ".claude.json");
  }
  return join(projectPath, ".mcp.json");
}

/**
 * Read existing MCP config or return empty object.
 */
async function readMcpConfig(
  path: string,
): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Get the command to run claude-cognitive serve.
 * Detects if globally installed or uses local path.
 */
async function getServeCommand(): Promise<{ command: string; args: string[] }> {
  // Check if claude-cognitive is globally installed
  try {
    const { execSync } = await import("node:child_process");
    execSync("which claude-cognitive", { stdio: "ignore" });
    return {
      command: "claude-cognitive",
      args: ["serve"],
    };
  } catch {
    // Use npx as fallback, or direct node path
    return {
      command: "npx",
      args: ["claude-cognitive", "serve"],
    };
  }
}

/**
 * Register the install command.
 */
export function registerInstallCommand(cli: CAC): void {
  cli
    .command("install", "Interactive installer for claude-cognitive")
    .option("--project <path>", "Project directory (skips prompt)")
    .action(async (options: { project?: string }) => {
      const prompt = createPrompt();

      try {
        printHeader();

        const answers: InstallAnswers = {
          projectPath: options.project || process.cwd(),
          bankId: "",
          disposition: { skepticism: 3, literalism: 3, empathy: 3 },
          background: "",
          configureClaudeCode: true,
          globalInstall: false,
          runLearn: false,
          learnDepth: "standard",
        };

        // Step 1: Project path
        printStep(1, 5, "Project Configuration");

        if (!options.project) {
          answers.projectPath = await prompt.ask(
            "Project path",
            process.cwd(),
          );
        }
        printInfo(`Using: ${answers.projectPath}`);

        // Derive default bank ID from project name
        const defaultBankId = basename(answers.projectPath)
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-");

        answers.bankId = await prompt.ask("Memory bank ID", defaultBankId);

        answers.background = await prompt.ask(
          "Project description (optional)",
          "",
        );

        // Step 2: Disposition
        printStep(2, 5, "Disposition (personality traits)");
        print(
          color(
            "  These traits shape how claude-cognitive reasons about your project.",
            "dim",
          ),
        );
        print("");

        const dispositionPreset = await prompt.select(
          "Choose a preset or customize:",
          [
            {
              label: "Balanced (3/3/3) - Good for general use",
              value: "balanced",
            },
            {
              label: "Code Review (4/5/2) - Precise, questioning",
              value: "review",
            },
            {
              label: "Documentation (3/3/3) - Balanced interpretation",
              value: "docs",
            },
            { label: "Custom - Set each trait individually", value: "custom" },
          ],
        );

        if (dispositionPreset === "review") {
          answers.disposition = { skepticism: 4, literalism: 5, empathy: 2 };
        } else if (dispositionPreset === "custom") {
          print("");
          print(color("  Rate each trait from 1 (low) to 5 (high):", "dim"));
          const skepticism = await prompt.ask("  Skepticism (1-5)", "3");
          const literalism = await prompt.ask("  Literalism (1-5)", "3");
          const empathy = await prompt.ask("  Empathy (1-5)", "3");

          const parseTraitValue = (val: string): TraitValue => {
            const num = Math.min(5, Math.max(1, parseInt(val, 10) || 3));
            return num as TraitValue;
          };

          answers.disposition = {
            skepticism: parseTraitValue(skepticism),
            literalism: parseTraitValue(literalism),
            empathy: parseTraitValue(empathy),
          };
        }

        printInfo(
          `Disposition: skepticism=${answers.disposition.skepticism}, literalism=${answers.disposition.literalism}, empathy=${answers.disposition.empathy}`,
        );

        // Step 3: Claude Code integration
        printStep(3, 5, "Claude Code Integration");

        answers.configureClaudeCode = await prompt.confirm(
          "Configure Claude Code MCP server?",
          true,
        );

        if (answers.configureClaudeCode) {
          answers.globalInstall = await prompt.confirm(
            "Install globally (for all projects)?",
            true,
          );
        }

        // Step 4: Learn
        printStep(4, 5, "Bootstrap Memory");

        answers.runLearn = await prompt.confirm(
          "Run 'learn' to bootstrap from codebase?",
          true,
        );

        if (answers.runLearn) {
          answers.learnDepth = await prompt.select(
            "Analysis depth:",
            [
              { label: "Quick - README, package.json, structure", value: "quick" as const },
              {
                label: "Standard - + source patterns, recent git",
                value: "standard" as const,
              },
              {
                label: "Full - all source files, full git history",
                value: "full" as const,
              },
            ],
            1,
          );
        }

        // Step 5: Install
        printStep(5, 5, "Installing");

        // Create .claudemindrc
        const rcPath = join(answers.projectPath, ".claudemindrc");
        const config = {
          hindsight: {
            host: "localhost",
            port: 8888,
          },
          bankId: answers.bankId,
          disposition: answers.disposition,
          ...(answers.background ? { background: answers.background } : {}),
          semantic: {
            path: ".claude/memory.md",
          },
        };

        await writeFile(rcPath, JSON.stringify(config, null, 2) + "\n");
        printSuccess(`Created ${rcPath}`);

        // Create .claude/memory.md
        const semanticDir = join(answers.projectPath, ".claude");
        const semanticPath = join(semanticDir, "memory.md");

        if (!(await fileExists(semanticPath))) {
          await mkdir(semanticDir, { recursive: true });
          const semanticContent = `# Project Memory

## Tech Stack

<!-- Add your tech stack here -->

## Key Decisions

<!-- Document important architectural decisions -->

## Critical Paths

<!-- List important code paths -->

## Observations

<!-- Promoted insights from Hindsight -->
`;
          await writeFile(semanticPath, semanticContent);
          printSuccess(`Created ${semanticPath}`);
        } else {
          printInfo(`${semanticPath} already exists, skipping`);
        }

        // Configure Claude Code MCP
        if (answers.configureClaudeCode) {
          const mcpConfigPath = getMcpConfigPath(
            answers.globalInstall,
            answers.projectPath,
          );

          const existing = await readMcpConfig(mcpConfigPath);
          const serveCmd = await getServeCommand();

          if (answers.globalInstall) {
            // Global config: ~/.claude.json with projects key
            const projects = (existing.projects as Record<string, unknown>) || {};
            const projectConfig = (projects[answers.projectPath] as Record<string, unknown>) || {};
            const mcpServers = (projectConfig.mcpServers as Record<string, unknown>) || {};

            mcpServers["claude-cognitive"] = {
              command: serveCmd.command,
              args: [...serveCmd.args, "--project", answers.projectPath],
            };

            projects[answers.projectPath] = {
              ...projectConfig,
              mcpServers,
            };

            const newConfig = {
              ...existing,
              projects,
            };

            await writeFile(
              mcpConfigPath,
              JSON.stringify(newConfig, null, 2) + "\n",
            );
          } else {
            // Project config: .mcp.json in project root
            const mcpServers = (existing.mcpServers as Record<string, unknown>) || {};

            mcpServers["claude-cognitive"] = {
              command: serveCmd.command,
              args: serveCmd.args,
            };

            const newConfig = {
              ...existing,
              mcpServers,
            };

            await writeFile(
              mcpConfigPath,
              JSON.stringify(newConfig, null, 2) + "\n",
            );
          }

          printSuccess(
            `Configured MCP server: ${answers.globalInstall ? "global (~/.claude.json)" : "project (.mcp.json)"}`,
          );
          printInfo(mcpConfigPath);
        }

        // Initialize Mind
        print("");
        print(color("Connecting to Hindsight...", "dim"));

        let hindsightConnected = false;
        try {
          const mind = new Mind({
            projectPath: answers.projectPath,
            bankId: answers.bankId,
            disposition: answers.disposition,
            background: answers.background,
          });
          await mind.init();
          hindsightConnected = !mind.isDegraded;

          if (hindsightConnected) {
            printSuccess(`Bank '${answers.bankId}' ready`);

            // Run learn if requested
            if (answers.runLearn) {
              print("");
              print(color(`Learning from codebase (${answers.learnDepth})...`, "dim"));
              const result = await mind.learn({ depth: answers.learnDepth });
              printSuccess(
                `Learned ${result.worldFacts} facts from ${result.filesAnalyzed} files`,
              );
            }
          } else {
            print(
              color(
                "  ⚠ Hindsight unavailable - running in degraded mode",
                "yellow",
              ),
            );
            printInfo("Start Hindsight and run 'claude-cognitive learn' later");
          }
        } catch (error) {
          print(
            color(
              `  ⚠ Could not connect to Hindsight: ${error instanceof Error ? error.message : error}`,
              "yellow",
            ),
          );
        }

        // Done!
        print("");
        print(color("═".repeat(45), "green"));
        print(color("  Installation complete!", "green"));
        print(color("═".repeat(45), "green"));
        print("");
        print("Next steps:");
        print(color("  1. Restart Claude Code to load the MCP server", "dim"));
        print(
          color("  2. Ask Claude to use memory_recall to verify", "dim"),
        );
        if (!hindsightConnected) {
          print(
            color(
              "  3. Start Hindsight and run: claude-cognitive learn",
              "dim",
            ),
          );
        }
        print("");
      } finally {
        prompt.close();
      }
    });
}
