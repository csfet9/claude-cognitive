/**
 * CLI update command - update claude-cognitive configuration without reinstall.
 * @module cli/commands/update
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CAC } from "cac";

/**
 * Get the path to the stop hook wrapper script.
 */
function getStopHookScriptPath(): string {
  return join(homedir(), ".local", "bin", "claude-cognitive-stop-hook.sh");
}

/**
 * Get the path to the start hook wrapper script.
 */
function getStartHookScriptPath(): string {
  return join(homedir(), ".local", "bin", "claude-cognitive-start-hook.sh");
}

/**
 * Create the stop hook wrapper script.
 * Claude Code passes transcript_path via stdin JSON, not as env var.
 */
async function createStopHookScript(): Promise<string> {
  const scriptPath = getStopHookScriptPath();
  const scriptDir = join(homedir(), ".local", "bin");

  // Ensure directory exists
  await mkdir(scriptDir, { recursive: true });

  const scriptContent = `#!/bin/bash
# Claude Code Stop hook wrapper for claude-cognitive
# Only processes MAIN sessions in projects with .claudemindrc
# Skips agent sessions and unconfigured projects

# Read stdin
INPUT=$(cat)

# Extract fields using jq (or fallback to grep/sed)
if command -v jq &> /dev/null; then
  TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
  PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
else
  TRANSCRIPT_PATH=$(echo "$INPUT" | grep -o '"transcript_path":"[^"]*"' | cut -d'"' -f4)
  PROJECT_DIR=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
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
claude-cognitive process-session --project "$PROJECT_DIR" --transcript "$TRANSCRIPT_PATH"

# Clean up ONLY this session's entries from buffer (not other ongoing sessions)
if [ -n "$SESSION_ID" ]; then
  BUFFER_FILE="$PROJECT_DIR/.claude/.session-buffer.jsonl"
  if [ -f "$BUFFER_FILE" ]; then
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
  fi
fi
`;

  await writeFile(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Create the start hook wrapper script.
 * Claude Code passes cwd via stdin JSON.
 */
async function createStartHookScript(): Promise<string> {
  const scriptPath = getStartHookScriptPath();
  const scriptDir = join(homedir(), ".local", "bin");

  // Ensure directory exists
  await mkdir(scriptDir, { recursive: true });

  const scriptContent = `#!/bin/bash
# Claude Code UserPromptSubmit hook wrapper for claude-cognitive
# Injects context from Hindsight at session start
# Skips projects without .claudemindrc

# Read stdin
INPUT=$(cat)

# Extract cwd using jq (or fallback to grep/sed)
if command -v jq &> /dev/null; then
  PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
else
  PROJECT_DIR=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
fi

# Skip if no project dir or no .claudemindrc
if [ -z "$PROJECT_DIR" ] || [ ! -f "$PROJECT_DIR/.claudemindrc" ]; then
  exit 0
fi

# Inject context (outputs to stdout which Claude Code injects)
claude-cognitive inject-context --project "$PROJECT_DIR"
`;

  await writeFile(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Check if the stop hook script exists.
 */
async function stopHookScriptExists(): Promise<boolean> {
  try {
    await access(getStopHookScriptPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the start hook script exists.
 */
async function startHookScriptExists(): Promise<boolean> {
  try {
    await access(getStartHookScriptPath());
    return true;
  } catch {
    return false;
  }
}

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
      const scriptPath = getStopHookScriptPath();

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

      // ============================================
      // Check/update Stop hook (session end)
      // ============================================
      const scriptExists = await stopHookScriptExists();
      const stopHooks =
        (hooks.Stop as Array<{ matcher: string; hooks: unknown[] }>) || [];
      const hasWrapperHook = hasHookCommand(
        stopHooks,
        "claude-cognitive-stop-hook.sh",
      );
      const hasOldStyleHook = hasHookCommand(stopHooks, '$TRANSCRIPT_PATH"');

      if (!scriptExists || !hasWrapperHook || hasOldStyleHook) {
        updatesNeeded++;
        if (dryRun) {
          if (!scriptExists) {
            printWarn("Stop hook wrapper script not found");
          }
          if (!hasWrapperHook) {
            printWarn("Stop hook not using wrapper script");
          }
          if (hasOldStyleHook) {
            printWarn(
              "Old-style Stop hook needs migration (uses $TRANSCRIPT_PATH env var which doesn't work)",
            );
          }
        } else {
          // Create/update the wrapper script
          await createStopHookScript();
          printSuccess("Created/updated stop hook wrapper script");

          // Remove old-style hooks that use $TRANSCRIPT_PATH env var
          const filteredStopHooks = stopHooks.filter(
            (entry) =>
              !entry.hooks?.some((h: unknown) => {
                const hook = h as { command?: string };
                return hook.command?.includes('$TRANSCRIPT_PATH"');
              }),
          );

          // Add wrapper script hook if not present
          if (
            !hasHookCommand(filteredStopHooks, "claude-cognitive-stop-hook.sh")
          ) {
            filteredStopHooks.push({
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: scriptPath,
                },
              ],
            });
          }

          hooks.Stop = filteredStopHooks;
          printSuccess("Updated Stop hook to use wrapper script");
          updatesApplied++;
        }
      } else {
        printInfo("Stop hook already configured correctly");
      }

      // ============================================
      // Check/update UserPromptSubmit hook (context injection)
      // ============================================
      const startScriptExists = await startHookScriptExists();
      const startScriptPath = getStartHookScriptPath();
      let userPromptHooks =
        (hooks.UserPromptSubmit as Array<{
          matcher: string;
          hooks: unknown[];
        }>) || [];
      const hasStartHookScript = hasHookCommand(
        userPromptHooks,
        "claude-cognitive-start-hook.sh",
      );
      const hasOldStyleInjectHook = hasHookCommand(userPromptHooks, "$CWD");

      if (!startScriptExists || !hasStartHookScript || hasOldStyleInjectHook) {
        updatesNeeded++;
        if (dryRun) {
          if (!startScriptExists) {
            printWarn("Start hook wrapper script not found");
          }
          if (!hasStartHookScript) {
            printWarn("UserPromptSubmit hook not using wrapper script");
          }
          if (hasOldStyleInjectHook) {
            printWarn(
              "Old-style UserPromptSubmit hook needs migration (uses $CWD env var which doesn't work)",
            );
          }
        } else {
          // Create/update the wrapper script
          await createStartHookScript();
          printSuccess("Created/updated start hook wrapper script");

          // Remove old-style hooks that use $CWD env var
          userPromptHooks = userPromptHooks.filter(
            (entry) =>
              !entry.hooks?.some((h: unknown) => {
                const hook = h as { command?: string };
                return hook.command?.includes("$CWD");
              }),
          );

          // Add wrapper script hook if not present
          if (
            !hasHookCommand(userPromptHooks, "claude-cognitive-start-hook.sh")
          ) {
            userPromptHooks.push({
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: startScriptPath,
                },
              ],
            });
          }

          hooks.UserPromptSubmit = userPromptHooks;
          printSuccess("Updated UserPromptSubmit hook to use wrapper script");
          updatesApplied++;
        }
      } else {
        printInfo("UserPromptSubmit hook already configured correctly");
      }

      // Note: Claude Code passes transcript_path via stdin JSON, not as env var
      // The wrapper script reads stdin and extracts the path

      // Write settings if any hooks were updated
      if (!dryRun && updatesApplied > 0) {
        settings.hooks = hooks;
        await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
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
