/**
 * CLI uninstall command - remove claude-cognitive from a project.
 * @module cli/commands/uninstall
 */

import { readFile, writeFile, unlink, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CAC } from "cac";
import { loadConfig } from "../../config.js";
import { HindsightClient } from "../../client.js";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Register the uninstall command.
 */
export function registerUninstallCommand(cli: CAC): void {
  cli
    .command("uninstall", "Remove claude-cognitive from a project")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--keep-config", "Keep .claudemindrc file")
    .option("--keep-memory", "Keep .claude/memory.md file")
    .option("--keep-claude-md", "Don't remove memory section from CLAUDE.md")
    .option("--delete-bank", "Delete the memory bank from Hindsight")
    .option(
      "--clean-global",
      "Remove legacy global hooks from ~/.local/bin and ~/.claude/",
    )
    .action(
      async (options: {
        project?: string;
        keepConfig?: boolean;
        keepMemory?: boolean;
        keepClaudeMd?: boolean;
        deleteBank?: boolean;
        cleanGlobal?: boolean;
      }) => {
        const projectPath = options.project ?? process.cwd();

        console.log("");
        console.log(color("Uninstalling claude-cognitive...", "dim"));
        console.log("");

        // Read config first (before we delete it) for --delete-bank
        let bankId: string | undefined;
        let hindsightConfig:
          | { host?: string; port?: number; apiKey?: string }
          | undefined;
        if (options.deleteBank) {
          try {
            const config = await loadConfig(projectPath);
            bankId = config.bankId;
            hindsightConfig = config.hindsight;
          } catch {
            // Config might not exist
          }
        }

        // 1. Remove from project .mcp.json
        const projectMcpPath = join(projectPath, ".mcp.json");
        if (await fileExists(projectMcpPath)) {
          try {
            const content = await readFile(projectMcpPath, "utf-8");
            const config = JSON.parse(content);

            if (config.mcpServers?.["claude-cognitive"]) {
              delete config.mcpServers["claude-cognitive"];

              // If no more servers, remove mcpServers key
              if (Object.keys(config.mcpServers).length === 0) {
                delete config.mcpServers;
              }

              // If config is empty, delete the file
              if (Object.keys(config).length === 0) {
                await unlink(projectMcpPath);
                printSuccess("Removed .mcp.json (was empty)");
              } else {
                await writeFile(
                  projectMcpPath,
                  JSON.stringify(config, null, 2) + "\n",
                );
                printSuccess("Removed from .mcp.json");
              }
            } else {
              printInfo(".mcp.json: claude-cognitive not found");
            }
          } catch {
            printWarn("Could not update .mcp.json");
          }
        }

        // 2. Remove from global ~/.claude/mcp.json
        const globalMcpPath = join(homedir(), ".claude", "mcp.json");
        if (await fileExists(globalMcpPath)) {
          try {
            const content = await readFile(globalMcpPath, "utf-8");
            const config = JSON.parse(content);

            if (config.mcpServers?.["claude-cognitive"]) {
              delete config.mcpServers["claude-cognitive"];

              // If no more servers, remove mcpServers key
              if (Object.keys(config.mcpServers).length === 0) {
                delete config.mcpServers;
              }

              await writeFile(
                globalMcpPath,
                JSON.stringify(config, null, 2) + "\n",
              );
              printSuccess("Removed from ~/.claude/mcp.json");
            }
          } catch {
            printWarn("Could not update ~/.claude/mcp.json");
          }
        }

        // 2b. Remove hooks from ~/.claude/settings.json
        const settingsPath = join(homedir(), ".claude", "settings.json");
        if (await fileExists(settingsPath)) {
          try {
            const content = await readFile(settingsPath, "utf-8");
            const settings = JSON.parse(content);
            let modified = false;

            // Remove claude-cognitive from Stop hooks
            if (settings.hooks?.Stop) {
              const stopHooks = settings.hooks.Stop as Array<{
                matcher: string;
                hooks: Array<{ type: string; command?: string }>;
              }>;

              settings.hooks.Stop = stopHooks.filter((entry) => {
                const hasCognitive = entry.hooks?.some((h) =>
                  h.command?.includes("claude-cognitive"),
                );
                return !hasCognitive;
              });

              // Clean up empty Stop array
              if (settings.hooks.Stop.length === 0) {
                delete settings.hooks.Stop;
              }

              // Clean up empty hooks object
              if (Object.keys(settings.hooks).length === 0) {
                delete settings.hooks;
              }

              modified = true;
            }

            if (modified) {
              await writeFile(
                settingsPath,
                JSON.stringify(settings, null, 2) + "\n",
              );
              printSuccess("Removed hooks from ~/.claude/settings.json");
            }
          } catch {
            printWarn("Could not update ~/.claude/settings.json");
          }
        }

        // 2c. Remove project-local hooks from PROJECT/.claude/settings.json
        const projectSettingsPath = join(
          projectPath,
          ".claude",
          "settings.json",
        );
        if (await fileExists(projectSettingsPath)) {
          try {
            const content = await readFile(projectSettingsPath, "utf-8");
            const settings = JSON.parse(content);
            let modified = false;

            // Remove claude-cognitive from Stop hooks
            if (settings.hooks?.Stop) {
              const stopHooks = settings.hooks.Stop as Array<{
                matcher: string;
                hooks: Array<{ type: string; command?: string }>;
              }>;

              settings.hooks.Stop = stopHooks.filter((entry) => {
                const hasCognitive = entry.hooks?.some((h) =>
                  h.command?.includes("claude-cognitive"),
                );
                return !hasCognitive;
              });

              // Clean up empty Stop array
              if (settings.hooks.Stop.length === 0) {
                delete settings.hooks.Stop;
              }

              // Clean up empty hooks object
              if (Object.keys(settings.hooks).length === 0) {
                delete settings.hooks;
              }

              modified = true;
            }

            if (modified) {
              // If settings is now empty (or just has empty objects), delete file
              if (Object.keys(settings).length === 0) {
                await unlink(projectSettingsPath);
                printSuccess(
                  "Removed PROJECT/.claude/settings.json (was empty)",
                );
              } else {
                await writeFile(
                  projectSettingsPath,
                  JSON.stringify(settings, null, 2) + "\n",
                );
                printSuccess(
                  "Removed hooks from PROJECT/.claude/settings.json",
                );
              }
            }
          } catch {
            printWarn("Could not update PROJECT/.claude/settings.json");
          }
        }

        // 2d. Remove project-local hook script directory
        const projectHooksDir = join(projectPath, ".claude", "hooks");
        if (await fileExists(projectHooksDir)) {
          try {
            await rm(projectHooksDir, { recursive: true });
            printSuccess("Removed PROJECT/.claude/hooks/ directory");
          } catch {
            printWarn("Could not remove PROJECT/.claude/hooks/");
          }
        }

        // 2e. Clean up legacy global hook (if --clean-global or always warn)
        const legacyGlobalHookPath = join(
          homedir(),
          ".local",
          "bin",
          "claude-cognitive-stop-hook.sh",
        );
        if (await fileExists(legacyGlobalHookPath)) {
          if (options.cleanGlobal) {
            try {
              await unlink(legacyGlobalHookPath);
              printSuccess(
                "Removed legacy global hook ~/.local/bin/claude-cognitive-stop-hook.sh",
              );
            } catch {
              printWarn(
                "Could not remove legacy global hook. Remove manually: rm ~/.local/bin/claude-cognitive-stop-hook.sh",
              );
            }
          } else {
            printWarn(
              "Legacy global hook exists at ~/.local/bin/claude-cognitive-stop-hook.sh",
            );
            printInfo(
              "Use --clean-global to remove, or: rm ~/.local/bin/claude-cognitive-stop-hook.sh",
            );
          }
        }

        // 3. Remove .claudemindrc
        if (!options.keepConfig) {
          const rcPath = join(projectPath, ".claudemindrc");
          if (await fileExists(rcPath)) {
            await unlink(rcPath);
            printSuccess("Removed .claudemindrc");
          }
        } else {
          printInfo("Keeping .claudemindrc (--keep-config)");
        }

        // 4. Remove memory section from CLAUDE.md
        if (!options.keepClaudeMd) {
          const claudeMdPath = join(projectPath, "CLAUDE.md");
          if (await fileExists(claudeMdPath)) {
            try {
              let content = await readFile(claudeMdPath, "utf-8");

              // Remove the memory section (handles both old and new titles)
              const memoryRegex =
                /\n?## 🧠 MEMORY[^\n]*[\s\S]*?(?=\n## |\n---\n|$)/;
              if (memoryRegex.test(content)) {
                content = content.replace(memoryRegex, "");
                // Clean up double newlines
                content = content.replace(/\n{3,}/g, "\n\n");
                await writeFile(claudeMdPath, content);
                printSuccess("Removed memory section from CLAUDE.md");
              } else {
                printInfo("CLAUDE.md: no memory section found");
              }
            } catch {
              printWarn("Could not update CLAUDE.md");
            }
          }
        } else {
          printInfo("Keeping CLAUDE.md memory section (--keep-claude-md)");
        }

        // 5. Optionally remove .claude/memory.md
        if (!options.keepMemory) {
          const memoryPath = join(projectPath, ".claude", "memory.md");
          if (await fileExists(memoryPath)) {
            await unlink(memoryPath);
            printSuccess("Removed .claude/memory.md");
          }
        } else {
          printInfo("Keeping .claude/memory.md (--keep-memory)");
        }

        // 6. Delete memory bank from Hindsight
        if (options.deleteBank) {
          if (bankId) {
            try {
              const clientOptions: {
                host: string;
                port: number;
                apiKey?: string;
              } = {
                host: hindsightConfig?.host ?? "localhost",
                port: hindsightConfig?.port ?? 8888,
              };
              if (hindsightConfig?.apiKey) {
                clientOptions.apiKey = hindsightConfig.apiKey;
              }

              const client = new HindsightClient(clientOptions);
              const health = await client.health();

              if (health.healthy) {
                await client.deleteBank(bankId);
                printSuccess(`Deleted memory bank '${bankId}' from Hindsight`);
              } else {
                printWarn("Hindsight not available - could not delete bank");
              }
            } catch (error) {
              printWarn(
                `Could not delete bank: ${error instanceof Error ? error.message : error}`,
              );
            }
          } else {
            printInfo("No bankId configured - nothing to delete");
          }
        }

        console.log("");
        printSuccess("Uninstall complete");
        console.log(color("  Restart Claude Code to apply changes", "dim"));
        console.log("");
      },
    );
}
