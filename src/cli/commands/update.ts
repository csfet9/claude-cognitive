/**
 * CLI update command - update claude-cognitive configuration without reinstall.
 * @module cli/commands/update
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CAC } from "cac";
import {
  configureHooks,
  checkTmuxAvailable,
  getServeCommand,
  readMcpConfig,
  injectClaudeMdPolicies,
} from "./install.js";
import {
  getAllBuiltInTemplates,
  loadCustomAgents,
} from "../../agents/index.js";

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
  gemini: {
    model: "auto",
    timeout: 120000,
  },
  securityReview: {
    enabled: true,
  },
  modelRouting: {
    defaultModel: "sonnet",
    categories: {
      exploration: { model: "haiku", background: true },
      research: { model: "haiku", background: true },
      security: { model: "opus" },
      reasoning: { model: "opus" },
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

      let updatesNeeded = 0;
      let updatesApplied = 0;

      // ============================================
      // Clean up legacy global hooks (if any)
      // ============================================
      const globalSettingsPath = join(homedir(), ".claude", "settings.json");
      let globalSettings: Record<string, unknown> = {};
      try {
        const content = await readFile(globalSettingsPath, "utf-8");
        globalSettings = JSON.parse(content);
      } catch {
        // No global settings
      }

      const globalHooks =
        (globalSettings.hooks as Record<string, unknown[]>) || {};
      let globalHooksUpdated = false;

      for (const legacyKey of ["Stop", "SessionEnd", "UserPromptSubmit"]) {
        if (globalHooks[legacyKey]) {
          updatesNeeded++;
          if (dryRun) {
            printWarn(
              `Legacy ${legacyKey} hook in global settings (will be removed)`,
            );
          } else {
            delete globalHooks[legacyKey];
            printSuccess(
              `Removed legacy ${legacyKey} hook from global settings`,
            );
            globalHooksUpdated = true;
            updatesApplied++;
          }
        }
      }

      if (!dryRun && globalHooksUpdated) {
        globalSettings.hooks = globalHooks;
        await writeFile(
          globalSettingsPath,
          JSON.stringify(globalSettings, null, 2) + "\n",
        );
      }

      // ============================================
      // Check project .claudemindrc exists
      // ============================================
      const projectRcPath = join(projectPath, ".claudemindrc");
      let projectRcExists = false;
      try {
        await access(projectRcPath);
        projectRcExists = true;
      } catch {
        // No .claudemindrc in project
      }

      if (!projectRcExists) {
        printInfo(
          "No .claudemindrc in current directory (use --project to specify)",
        );
        console.log("");
        return;
      }

      // ============================================
      // Update project .claudemindrc
      // ============================================
      const projectConfig = await readJsonFile(projectRcPath);
      let rcUpdatesNeeded = 0;
      const rcUpdates: string[] = [];

      // Check for obsolete configs
      if ("semantic" in projectConfig) {
        rcUpdatesNeeded++;
        rcUpdates.push("Remove obsolete 'semantic' config");
      }
      if ("feedback" in projectConfig) {
        rcUpdatesNeeded++;
        rcUpdates.push("Remove obsolete 'feedback' config");
      }

      // Check for missing configs
      if (!("context" in projectConfig)) {
        rcUpdatesNeeded++;
        rcUpdates.push("Add 'context' config");
      }
      if (!("retain" in projectConfig)) {
        rcUpdatesNeeded++;
        rcUpdates.push("Add 'retain' config");
      }
      if (!("gemini" in projectConfig)) {
        rcUpdatesNeeded++;
        rcUpdates.push("Add 'gemini' config");
      }
      if (!("securityReview" in projectConfig)) {
        rcUpdatesNeeded++;
        rcUpdates.push("Add 'securityReview' config");
      }
      if (!("modelRouting" in projectConfig)) {
        rcUpdatesNeeded++;
        rcUpdates.push("Add 'modelRouting' config");
      }

      // Check for missing timeouts in hindsight config
      const hindsight = projectConfig.hindsight as
        | Record<string, unknown>
        | undefined;
      if (hindsight && !("timeouts" in hindsight)) {
        rcUpdatesNeeded++;
        rcUpdates.push("Add 'hindsight.timeouts' config");
      }

      if (rcUpdatesNeeded > 0) {
        updatesNeeded += rcUpdatesNeeded;
        if (dryRun) {
          printWarn(
            `Project .claudemindrc needs ${rcUpdatesNeeded} update(s):`,
          );
          for (const update of rcUpdates) {
            printInfo(`  - ${update}`);
          }
        } else {
          // Remove obsolete configs
          delete projectConfig.semantic;
          delete projectConfig.feedback;

          // Add missing configs with defaults
          if (!("context" in projectConfig)) {
            projectConfig.context = DEFAULT_CONFIG.context;
          }
          if (!("retain" in projectConfig)) {
            projectConfig.retain = DEFAULT_CONFIG.retain;
          }
          if (!("gemini" in projectConfig)) {
            projectConfig.gemini = DEFAULT_CONFIG.gemini;
          }
          if (!("securityReview" in projectConfig)) {
            projectConfig.securityReview = DEFAULT_CONFIG.securityReview;
          }
          if (!("modelRouting" in projectConfig)) {
            projectConfig.modelRouting = DEFAULT_CONFIG.modelRouting;
          }

          // Add timeouts to hindsight config if missing
          if (hindsight && !("timeouts" in hindsight)) {
            hindsight.timeouts = {
              recall: 120000,
              reflect: 180000,
              retain: 90000,
            };
          }

          await writeFile(
            projectRcPath,
            JSON.stringify(projectConfig, null, 2) + "\n",
          );
          printSuccess(
            `Updated project .claudemindrc (${rcUpdatesNeeded} changes)`,
          );
          for (const update of rcUpdates) {
            printInfo(`  - ${update}`);
          }
          updatesApplied += rcUpdatesNeeded;
        }
      } else {
        printInfo("Project .claudemindrc is up to date");
      }

      // ============================================
      // Configure hooks via shared helper
      // ============================================
      if (dryRun) {
        printInfo(
          "Hooks and scripts will be regenerated (SessionStart, SessionEnd, Agent Teams env)",
        );
      } else {
        const { settingsPath, legacyGlobalHookExists } =
          await configureHooks(projectPath);
        printSuccess("Configured hooks and Agent Teams env");
        printInfo(settingsPath);

        if (legacyGlobalHookExists) {
          printWarn("Legacy global hook detected at ~/.local/bin/");
          printInfo(
            "  To remove: rm ~/.local/bin/claude-cognitive-*-hook.sh",
          );
          printInfo(
            "  Also check ~/.config/claude/settings.json for global hooks.",
          );
        }
      }

      // ============================================
      // Project-local MCP config (.mcp.json)
      // ============================================
      const mcpConfigPath = join(projectPath, ".mcp.json");
      const mcpConfig = await readMcpConfig(mcpConfigPath);
      const mcpServers =
        (mcpConfig.mcpServers as Record<string, unknown>) || {};
      const hasMcpServer = "claude-cognitive" in mcpServers;

      if (!hasMcpServer) {
        updatesNeeded++;
        if (dryRun) {
          printWarn("MCP server not configured in project .mcp.json");
        } else {
          const serveCmd = await getServeCommand();
          mcpServers["claude-cognitive"] = {
            command: serveCmd.command,
            args: [...serveCmd.args],
          };
          const newConfig = { ...mcpConfig, mcpServers };
          await writeFile(
            mcpConfigPath,
            JSON.stringify(newConfig, null, 2) + "\n",
          );
          printSuccess("Added MCP server to project .mcp.json");
          updatesApplied++;
        }
      } else {
        printInfo("MCP server already configured in .mcp.json");
      }

      // ============================================
      // CLAUDE.md policy regeneration
      // ============================================
      const builtInAgents = getAllBuiltInTemplates();
      const customAgentsLoaded = await loadCustomAgents(projectPath);
      const allAgents = [...builtInAgents, ...customAgentsLoaded].map((a) => {
        const entry: {
          name: string;
          model?: string;
          categories?: string[];
        } = { name: a.name };
        if (a.model) entry.model = a.model;
        if (a.categories) entry.categories = a.categories;
        return entry;
      });

      const securityEnabled =
        ((projectConfig.securityReview as Record<string, unknown>) ?? {})
          .enabled === true ||
        DEFAULT_CONFIG.securityReview.enabled;

      if (dryRun) {
        printInfo("CLAUDE.md policies will be regenerated");
      } else {
        try {
          const { claudeMdPath, action } = await injectClaudeMdPolicies(
            projectPath,
            {
              securityReview: securityEnabled,
              agents: allAgents,
              enableTeams: true,
            },
          );
          printSuccess(
            `${action === "updated" ? "Updated" : action === "appended" ? "Added to" : "Created"} CLAUDE.md policies (${claudeMdPath})`,
          );
        } catch (error) {
          printWarn(
            `Could not update CLAUDE.md: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      // ============================================
      // tmux availability check
      // ============================================
      const tmuxAvailable = await checkTmuxAvailable();
      if (tmuxAvailable) {
        printSuccess("tmux detected - split-pane mode available");
        printInfo(
          "Run Claude inside tmux for split-pane Agent Teams: tmux new -s claude",
        );
      } else {
        printInfo("tmux not found - Agent Teams will use in-process mode");
        printInfo(
          "For split-pane mode: brew install tmux (macOS) or apt install tmux (Linux)",
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
