/**
 * CLI uninstall command - remove claude-cognitive from a project.
 * @module cli/commands/uninstall
 */

import { readFile, writeFile, unlink, access } from "node:fs/promises";
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
    .option("--project <path>", "Project directory (default: current directory)")
    .option("--keep-config", "Keep .claudemindrc file")
    .option("--keep-memory", "Keep .claude/memory.md file")
    .option("--keep-claude-md", "Don't remove memory section from CLAUDE.md")
    .option("--delete-bank", "Delete the memory bank from Hindsight")
    .action(
      async (options: {
        project?: string;
        keepConfig?: boolean;
        keepMemory?: boolean;
        keepClaudeMd?: boolean;
        deleteBank?: boolean;
      }) => {
        const projectPath = options.project ?? process.cwd();

        console.log("");
        console.log(color("Uninstalling claude-cognitive...", "dim"));
        console.log("");

        // Read config first (before we delete it) for --delete-bank
        let bankId: string | undefined;
        let hindsightConfig: { host?: string; port?: number; apiKey?: string } | undefined;
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
                await writeFile(projectMcpPath, JSON.stringify(config, null, 2) + "\n");
                printSuccess("Removed from .mcp.json");
              }
            } else {
              printInfo(".mcp.json: claude-cognitive not found");
            }
          } catch {
            printWarn("Could not update .mcp.json");
          }
        }

        // 2. Remove from global ~/.claude.json
        const globalConfigPath = join(homedir(), ".claude.json");
        if (await fileExists(globalConfigPath)) {
          try {
            const content = await readFile(globalConfigPath, "utf-8");
            const config = JSON.parse(content);
            let modified = false;

            // Check projects section
            if (config.projects?.[projectPath]?.mcpServers?.["claude-cognitive"]) {
              delete config.projects[projectPath].mcpServers["claude-cognitive"];

              // Clean up empty objects
              if (Object.keys(config.projects[projectPath].mcpServers).length === 0) {
                delete config.projects[projectPath].mcpServers;
              }

              modified = true;
            }

            if (modified) {
              await writeFile(globalConfigPath, JSON.stringify(config, null, 2) + "\n");
              printSuccess("Removed from ~/.claude.json");
            }
          } catch {
            printWarn("Could not update ~/.claude.json");
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

              // Remove the memory section
              const memoryRegex = /\n?## 🧠 MEMORY SYSTEM[\s\S]*?(?=\n## |\n---\n|$)/;
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
              const clientOptions: { host: string; port: number; apiKey?: string } = {
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
              printWarn(`Could not delete bank: ${error instanceof Error ? error.message : error}`);
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
