/**
 * CLI update command - update claude-cognitive configuration without reinstall.
 * @module cli/commands/update
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
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
 * Register the update command.
 */
export function registerUpdateCommand(cli: CAC): void {
  cli
    .command("update", "Update claude-cognitive configuration")
    .option("--check", "Only check what needs updating (dry run)")
    .action(async (options: { check?: boolean }) => {
      const dryRun = options.check ?? false;

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

      // Helper to check if a hook command exists
      const hasHookCommand = (
        hooksArray: Array<{ matcher: string; hooks: unknown[] }>,
        commandSubstring: string,
      ): boolean => {
        return hooksArray.some((entry) =>
          entry.hooks?.some((h: unknown) => {
            const hook = h as { command?: string };
            return hook.command?.includes(commandSubstring);
          }),
        );
      };

      // Check/update Stop hook (process-session)
      const stopHooks =
        (hooks.Stop as Array<{ matcher: string; hooks: unknown[] }>) || [];

      if (!hasHookCommand(stopHooks, "claude-cognitive process-session")) {
        updatesNeeded++;
        if (dryRun) {
          printWarn("Stop hook not configured in ~/.claude/settings.json");
        } else {
          stopHooks.push({
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  'claude-cognitive process-session --transcript "$TRANSCRIPT_PATH"',
              },
            ],
          });
          hooks.Stop = stopHooks;
          printSuccess("Added Stop hook (process-session)");
          updatesApplied++;
        }
      } else {
        // Check if existing hook has transcript path
        const needsUpdate = stopHooks.some((entry) =>
          entry.hooks?.some((h: unknown) => {
            const hook = h as { command?: string };
            return (
              hook.command?.includes("claude-cognitive process-session") &&
              !hook.command?.includes("TRANSCRIPT")
            );
          }),
        );
        if (needsUpdate) {
          updatesNeeded++;
          if (dryRun) {
            printWarn("Stop hook missing transcript path");
          } else {
            // Update the hook command
            for (const entry of stopHooks) {
              for (const h of entry.hooks || []) {
                const hook = h as { command?: string };
                if (
                  hook.command?.includes("claude-cognitive process-session") &&
                  !hook.command?.includes("TRANSCRIPT")
                ) {
                  hook.command =
                    'claude-cognitive process-session --transcript "$TRANSCRIPT_PATH"';
                }
              }
            }
            hooks.Stop = stopHooks;
            printSuccess("Updated Stop hook with transcript path");
            updatesApplied++;
          }
        } else {
          printInfo("Stop hook already configured");
        }
      }

      // Note: PostToolUse buffer hook removed - was capturing agent activity
      // Session sync now relies on Stop hook with $TRANSCRIPT_PATH

      // Write settings if any hooks were updated
      if (!dryRun && updatesApplied > 0) {
        settings.hooks = hooks;
        await writeFile(
          settingsPath,
          JSON.stringify(settings, null, 2) + "\n",
        );
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
