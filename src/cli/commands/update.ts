/**
 * CLI update command - update claude-cognitive configuration without reinstall.
 * @module cli/commands/update
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CAC } from "cac";
import {
  createStartHookScript,
  createSessionEndHookScript,
  createPreCommitReviewScript,
  createSecurityReviewerAgent,
} from "./install.js";

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
            "Legacy Stop hook found in global settings (will be removed - use SessionEnd instead)",
          );
        } else {
          delete hooks.Stop;
          printSuccess(
            "Removed legacy Stop hook from global settings (migrated to SessionEnd)",
          );
          updatesApplied++;
        }
      } else {
        printInfo("No legacy Stop hooks in global settings");
      }

      // ============================================
      // Remove legacy SessionEnd hooks from global settings
      // SessionEnd hooks should be project-local, not global
      // ============================================
      const sessionEndHooks =
        (hooks.SessionEnd as Array<{ matcher: string; hooks: unknown[] }>) ||
        [];
      const hasSessionEndHook = sessionEndHooks.length > 0;

      if (hasSessionEndHook) {
        updatesNeeded++;
        if (dryRun) {
          printWarn(
            "SessionEnd hook found in global settings (will be removed - use project-local hooks instead)",
          );
        } else {
          delete hooks.SessionEnd;
          printSuccess(
            "Removed SessionEnd hook from global settings (use project-local hooks instead)",
          );
          updatesApplied++;
        }
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
      // Migrate project-local Stop hooks to SessionEnd
      // ============================================
      const projectSettingsPath = join(projectPath, ".claude", "settings.json");
      let projectSettingsExists = false;
      try {
        await access(projectSettingsPath);
        projectSettingsExists = true;
      } catch {
        // No project settings
      }

      if (projectSettingsExists) {
        const projectSettings = await readJsonFile(projectSettingsPath);
        const projectHooks =
          (projectSettings.hooks as Record<string, unknown[]>) || {};
        let projectHooksUpdated = false;

        // Check for Stop hooks that need migration
        const projectStopHooks =
          (projectHooks.Stop as Array<{
            matcher: string;
            hooks: Array<{ type: string; command?: string }>;
          }>) || [];
        // Better detection - check for both claude-cognitive AND stop-hook patterns
        const hasProjectStopHook = projectStopHooks.some((entry) =>
          entry.hooks?.some((h) => {
            const cmd = h.command || "";
            return (
              cmd.includes("claude-cognitive") || cmd.includes("stop-hook")
            );
          }),
        );

        if (hasProjectStopHook) {
          updatesNeeded++;
          if (dryRun) {
            printWarn(
              "Project-local Stop hook found (will be migrated to SessionEnd)",
            );
          } else {
            // Check if old hook script exists before trying to remove it
            const oldHookPath = join(
              projectPath,
              ".claude",
              "hooks",
              "stop-hook.sh",
            );
            let oldHookExists = false;
            try {
              await access(oldHookPath);
              oldHookExists = true;
            } catch {
              // Old hook doesn't exist
            }

            if (!oldHookExists) {
              printWarn(
                "Old stop-hook.sh not found - creating SessionEnd hook anyway",
              );
            }

            // Remove Stop hooks
            delete projectHooks.Stop;

            // Get or create SessionEnd hooks array
            let projectSessionEndHooks =
              (projectHooks.SessionEnd as Array<{
                matcher: string;
                hooks: unknown[];
              }>) || [];

            // Check if SessionEnd hook already exists
            const hasSessionEndHook = projectSessionEndHooks.some((entry) =>
              entry.hooks?.some((h: unknown) => {
                const hook = h as { command?: string };
                return hook.command?.includes("session-end-hook.sh");
              }),
            );

            if (!hasSessionEndHook) {
              // Create new session-end-hook.sh path
              const sessionEndScriptPath = join(
                projectPath,
                ".claude",
                "hooks",
                "session-end-hook.sh",
              );

              projectSessionEndHooks.push({
                matcher: "",
                hooks: [
                  {
                    type: "command",
                    command: sessionEndScriptPath,
                  },
                ],
              });
              projectHooks.SessionEnd = projectSessionEndHooks;
            }

            projectHooksUpdated = true;
            printSuccess("Migrated project-local Stop hook to SessionEnd");
            updatesApplied++;
          }
        }

        // Check for old stop-hook.sh script that needs renaming
        const oldStopHookPath = join(
          projectPath,
          ".claude",
          "hooks",
          "stop-hook.sh",
        );
        const newSessionEndHookPath = join(
          projectPath,
          ".claude",
          "hooks",
          "session-end-hook.sh",
        );
        let oldStopHookExists = false;
        let newSessionEndHookExists = false;

        try {
          await access(oldStopHookPath);
          oldStopHookExists = true;
        } catch {
          // Old hook doesn't exist
        }

        try {
          await access(newSessionEndHookPath);
          newSessionEndHookExists = true;
        } catch {
          // New hook doesn't exist
        }

        if (oldStopHookExists && !newSessionEndHookExists) {
          updatesNeeded++;
          if (dryRun) {
            printWarn(
              "Old stop-hook.sh found (will be replaced with session-end-hook.sh)",
            );
          } else {
            // Create new simplified session-end-hook.sh
            const {
              mkdir: mkdirAsync,
              writeFile: writeFileAsync,
              unlink: unlinkAsync,
            } = await import("node:fs/promises");
            const scriptDir = join(projectPath, ".claude", "hooks");
            await mkdirAsync(scriptDir, { recursive: true });

            const scriptContent = `#!/bin/bash
# Claude Code SessionEnd hook wrapper for claude-cognitive (project-local)
# Only processes MAIN sessions in projects with .claudemindrc
# Skips agent sessions and unconfigured projects
#
# NOTE: SessionEnd hook only fires when session truly ends, so we don't need
# the /exit grep and marker file logic from the old Stop hook.

# Read stdin
INPUT=$(cat)

# Extract fields using jq (or fallback to grep/sed)
if command -v jq &> /dev/null; then
  TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
  PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
  REASON=$(echo "$INPUT" | jq -r '.reason // empty')
else
  TRANSCRIPT_PATH=$(echo "$INPUT" | grep -o '"transcript_path":"[^"]*"' | cut -d'"' -f4)
  PROJECT_DIR=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
  REASON=$(echo "$INPUT" | grep -o '"reason":"[^"]*"' | cut -d'"' -f4)
fi

# Exit early if no transcript path
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# FILTER 1: Skip agent sessions (filename starts with "agent-")
FILENAME=$(basename "$TRANSCRIPT_PATH")
if [[ "$FILENAME" == agent-* ]]; then
  exit 0
fi

# FILTER 2: Skip projects without .claudemindrc
if [ -z "$PROJECT_DIR" ] || [ ! -f "$PROJECT_DIR/.claudemindrc" ]; then
  exit 0
fi

# Process main session (pass project dir to ensure correct context)
# Use timeout to prevent hanging if Hindsight is slow (2 minute limit on Linux)
# Note: timeout may not be available on macOS - script continues without timeout
if command -v timeout &> /dev/null; then
  timeout 120 claude-cognitive process-session --project "$PROJECT_DIR" --transcript "$TRANSCRIPT_PATH" || true
elif command -v gtimeout &> /dev/null; then
  gtimeout 120 claude-cognitive process-session --project "$PROJECT_DIR" --transcript "$TRANSCRIPT_PATH" || true
else
  claude-cognitive process-session --project "$PROJECT_DIR" --transcript "$TRANSCRIPT_PATH" || true
fi

# Clean up ONLY this session's entries from buffer (not other ongoing sessions)
# Use flock to prevent race conditions when multiple sessions end simultaneously
if [ -n "$SESSION_ID" ]; then
  BUFFER_FILE="$PROJECT_DIR/.claude/.session-buffer.jsonl"
  LOCK_FILE="$BUFFER_FILE.lock"
  if [ -f "$BUFFER_FILE" ]; then
    # Wrap cleanup in flock to ensure atomic read-filter-write
    (
      flock -x 200 2>/dev/null || true  # Acquire exclusive lock, continue if flock unavailable
      if command -v jq &> /dev/null; then
        # Filter out entries matching this session_id
        TEMP_FILE=$(mktemp)
        jq -c "select(.session_id != \\"$SESSION_ID\\")" "$BUFFER_FILE" > "$TEMP_FILE" 2>/dev/null || true
        if [ -s "$TEMP_FILE" ]; then
          mv "$TEMP_FILE" "$BUFFER_FILE"
        else
          rm -f "$BUFFER_FILE" "$TEMP_FILE"
        fi
      else
        # Without jq, use grep to filter (less reliable but works)
        TEMP_FILE=$(mktemp)
        grep -v "\\"session_id\\":\\"$SESSION_ID\\"" "$BUFFER_FILE" > "$TEMP_FILE" 2>/dev/null || true
        if [ -s "$TEMP_FILE" ]; then
          mv "$TEMP_FILE" "$BUFFER_FILE"
        else
          rm -f "$BUFFER_FILE" "$TEMP_FILE"
        fi
      fi
    ) 200>"$LOCK_FILE"
    rm -f "$LOCK_FILE" 2>/dev/null || true
  fi
fi
`;

            await writeFileAsync(newSessionEndHookPath, scriptContent, {
              mode: 0o755,
            });

            // Remove old stop-hook.sh
            try {
              await unlinkAsync(oldStopHookPath);
            } catch {
              // Ignore if deletion fails
            }

            printSuccess("Replaced stop-hook.sh with session-end-hook.sh");
            updatesApplied++;
          }
        }

        // Write project settings if hooks were updated
        if (!dryRun && projectHooksUpdated) {
          projectSettings.hooks = projectHooks;
          await writeFile(
            projectSettingsPath,
            JSON.stringify(projectSettings, null, 2) + "\n",
          );
        }
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
        const hindsight = projectConfig.hindsight as
          | Record<string, unknown>
          | undefined;
        if (hindsight && !("timeouts" in hindsight)) {
          projectUpdatesNeeded++;
          projectUpdates.push("Add 'hindsight.timeouts' config");
        }

        if (projectUpdatesNeeded > 0) {
          updatesNeeded += projectUpdatesNeeded;
          if (dryRun) {
            printWarn(
              `Project .claudemindrc needs ${projectUpdatesNeeded} update(s):`,
            );
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
            await writeFile(
              projectRcPath,
              JSON.stringify(projectConfig, null, 2) + "\n",
            );
            printSuccess(
              `Updated project .claudemindrc (${projectUpdatesNeeded} changes)`,
            );
            for (const update of projectUpdates) {
              printInfo(`  - ${update}`);
            }
            updatesApplied += projectUpdatesNeeded;
          }
        } else {
          printInfo("Project .claudemindrc is up to date");
        }

        // ============================================
        // Always regenerate hook scripts with latest security fixes
        // ============================================
        if (!dryRun) {
          const hooksDir = join(projectPath, ".claude", "hooks");
          await mkdir(hooksDir, { recursive: true });

          await createStartHookScript(projectPath);
          await createSessionEndHookScript(projectPath);
          await createPreCommitReviewScript(projectPath);
          await createSecurityReviewerAgent(projectPath);

          printSuccess("Regenerated hook scripts with latest security fixes");
          printInfo(`  ${hooksDir}/start-hook.sh`);
          printInfo(`  ${hooksDir}/session-end-hook.sh`);
          printInfo(`  ${hooksDir}/pre-commit-review.sh`);
          printSuccess("Created security-code-reviewer agent");
          printInfo(
            `  ${join(projectPath, ".claude", "agents", "security-code-reviewer.md")}`,
          );
        } else {
          printInfo(
            "Hook scripts will be regenerated (with latest security fixes)",
          );
        }
      } else {
        printInfo(
          "No .claudemindrc in current directory (use --project to specify)",
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
