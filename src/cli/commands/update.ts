/**
 * CLI update command - update claude-cognitive configuration without reinstall.
 * @module cli/commands/update
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CAC } from "cac";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function printSuccess(text: string): void {
  console.log(color(`✓ ${text}`, "green"));
}

function printInfo(text: string): void {
  console.log(color(`  ${text}`, "dim"));
}

function printWarn(text: string): void {
  console.log(color(`⚠ ${text}`, "yellow"));
}

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Check if claude-cognitive is globally installed.
 */
async function isGloballyInstalled(): Promise<boolean> {
  try {
    const { execSync } = await import("node:child_process");
    execSync("which claude-cognitive", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Default configuration values for new options.
 */
const DEFAULT_CONFIG = {
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
  feedback: {
    enabled: true,
    detection: {
      explicit: true,
      semantic: true,
      behavioral: true,
      semanticThreshold: 0.5,
    },
    hindsight: {
      sendFeedback: true,
      boostByUsefulness: true,
      boostWeight: 0.3,
    },
  },
};

/**
 * Register the update command.
 */
export function registerUpdateCommand(cli: CAC): void {
  cli
    .command("update", "Update claude-cognitive configuration")
    .option("--check", "Only check what needs updating (dry run)")
    .option("--project <path>", "Project directory to update .claudemindrc")
    .action(async (options: { check?: boolean; project?: string }) => {
      const dryRun = options.check ?? false;
      const projectPath = options.project ?? process.cwd();

      console.log("");
      console.log(
        color(
          dryRun
            ? "Checking claude-cognitive configuration..."
            : "Updating claude-cognitive configuration...",
          "cyan",
        ),
      );
      console.log("");

      const claudeDir = join(homedir(), ".claude");
      const mcpPath = join(claudeDir, "mcp.json");
      const settingsPath = join(claudeDir, "settings.json");

      let updatesNeeded = 0;
      let updatesApplied = 0;

      // Ensure ~/.claude directory exists
      if (!dryRun) {
        await mkdir(claudeDir, { recursive: true });
      }

      // Note: ~/.claude.json is Claude Code's internal state file.
      // Per-project MCP configs there are separate from global config.
      // We only manage ~/.claude/mcp.json (global) and project .mcp.json files.

      // 2. Check/update MCP configuration
      const mcpConfig = await readJsonFile(mcpPath);
      const mcpServers =
        (mcpConfig.mcpServers as Record<string, unknown>) || {};
      const hasMcpServer = "claude-cognitive" in mcpServers;

      if (!hasMcpServer) {
        updatesNeeded++;
        if (dryRun) {
          printWarn("MCP server not configured in ~/.claude/mcp.json");
        } else {
          const isGlobal = await isGloballyInstalled();
          mcpServers["claude-cognitive"] = {
            command: isGlobal ? "claude-cognitive" : "npx",
            args: isGlobal ? ["serve"] : ["claude-cognitive", "serve"],
          };
          mcpConfig.mcpServers = mcpServers;
          await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2) + "\n");
          printSuccess("Added MCP server to ~/.claude/mcp.json");
          updatesApplied++;
        }
      } else {
        printInfo("MCP server already configured");
      }

      // 3. Check/update hooks configuration
      const settings = await readJsonFile(settingsPath);
      const hooks = (settings.hooks as Record<string, unknown[]>) || {};

      // ============================================
      // Remove legacy Stop hooks from global settings
      // Stop hooks should NOT be in global settings - they cause the hook to run
      // on EVERY session end, not just /exit. Project-local hooks handle this.
      // ============================================
      const stopHooks =
        (hooks.Stop as Array<{ matcher: string; hooks: unknown[] }>) || [];
      const hasStopHook = stopHooks.length > 0;

      if (hasStopHook) {
        updatesNeeded++;
        if (dryRun) {
          printWarn(
            "Legacy Stop hook found in global settings (will be removed - causes hooks on every response)",
          );
        } else {
          delete hooks.Stop;
          printSuccess(
            "Removed legacy Stop hook from global settings (use project-local hooks instead)",
          );
          updatesApplied++;
        }
      } else {
        printInfo("No legacy Stop hooks in global settings");
      }

      // ============================================
      // Remove legacy UserPromptSubmit hooks (context now injected via SessionStart)
      // ============================================
      if (hooks.UserPromptSubmit) {
        updatesNeeded++;
        if (dryRun) {
          printWarn(
            "Legacy UserPromptSubmit hook found (will be removed - now using SessionStart)",
          );
        } else {
          delete hooks.UserPromptSubmit;
          printSuccess(
            "Removed legacy UserPromptSubmit hook (context now injected via SessionStart)",
          );
          updatesApplied++;
        }
      }

      // Write settings if any hooks were updated
      if (!dryRun && updatesApplied > 0) {
        settings.hooks = hooks;
        await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      }

      // ============================================
      // Check/update project .claudemindrc
      // ============================================
      const projectRcPath = join(projectPath, ".claudemindrc");
      let projectRcExists = false;
      try {
        await access(projectRcPath);
        projectRcExists = true;
      } catch {
        // No .claudemindrc in project
      }

      if (projectRcExists) {
        const projectConfig = await readJsonFile(projectRcPath);
        let projectUpdatesNeeded = 0;
        const projectUpdates: string[] = [];

        // Check for obsolete semantic config
        if ("semantic" in projectConfig) {
          projectUpdatesNeeded++;
          projectUpdates.push("Remove obsolete 'semantic' config");
        }

        // Check for missing context config
        if (!("context" in projectConfig)) {
          projectUpdatesNeeded++;
          projectUpdates.push("Add 'context' config");
        }

        // Check for missing retain config
        if (!("retain" in projectConfig)) {
          projectUpdatesNeeded++;
          projectUpdates.push("Add 'retain' config");
        }

        // Check for missing feedback config
        if (!("feedback" in projectConfig)) {
          projectUpdatesNeeded++;
          projectUpdates.push("Add 'feedback' config");
        }

        // Check for missing timeouts in hindsight config
        const hindsight = projectConfig.hindsight as Record<string, unknown> | undefined;
        if (hindsight && !("timeouts" in hindsight)) {
          projectUpdatesNeeded++;
          projectUpdates.push("Add 'hindsight.timeouts' config");
        }

        if (projectUpdatesNeeded > 0) {
          updatesNeeded += projectUpdatesNeeded;
          if (dryRun) {
            printWarn(`Project .claudemindrc needs ${projectUpdatesNeeded} update(s):`);
            for (const update of projectUpdates) {
              printInfo(`  - ${update}`);
            }
          } else {
            // Remove obsolete semantic config
            if ("semantic" in projectConfig) {
              delete projectConfig.semantic;
            }

            // Add missing configs with defaults
            if (!("context" in projectConfig)) {
              projectConfig.context = DEFAULT_CONFIG.context;
            }

            if (!("retain" in projectConfig)) {
              projectConfig.retain = DEFAULT_CONFIG.retain;
            }

            if (!("feedback" in projectConfig)) {
              projectConfig.feedback = DEFAULT_CONFIG.feedback;
            }

            // Add timeouts to hindsight config if missing
            if (hindsight && !("timeouts" in hindsight)) {
              hindsight.timeouts = {
                recall: 120000,
                reflect: 180000,
                retain: 90000,
              };
            }

            // Write updated config
            await writeFile(projectRcPath, JSON.stringify(projectConfig, null, 2) + "\n");
            printSuccess(`Updated project .claudemindrc (${projectUpdatesNeeded} changes)`);
            for (const update of projectUpdates) {
              printInfo(`  - ${update}`);
            }
            updatesApplied += projectUpdatesNeeded;
          }
        } else {
          printInfo("Project .claudemindrc is up to date");
        }
      } else {
        printInfo("No .claudemindrc in current directory (use --project to specify)");
      }

      // Summary
      console.log("");
      if (dryRun) {
        if (updatesNeeded === 0) {
          printSuccess("Configuration is up to date!");
        } else {
          console.log(
            color(
              `${updatesNeeded} update(s) needed. Run without --check to apply.`,
              "yellow",
            ),
          );
        }
      } else {
        if (updatesApplied > 0) {
          printSuccess(`Applied ${updatesApplied} update(s)`);
          console.log(color("  Restart Claude Code to apply changes", "dim"));
        } else if (updatesNeeded === 0) {
          printSuccess("Configuration is already up to date!");
        }
      }
      console.log("");
    });
}
