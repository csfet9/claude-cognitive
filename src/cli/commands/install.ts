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

  const confirm = (question: string, defaultValue = true): Promise<boolean> => {
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
 * Get the Claude Code MCP config path (always project-local).
 */
function getMcpConfigPath(projectPath: string): string {
  return join(projectPath, ".mcp.json");
}

/**
 * Get the project-local Claude Code settings path.
 */
function getProjectSettingsPath(projectPath: string): string {
  return join(projectPath, ".claude", "settings.json");
}

/**
 * Read existing settings or return empty object.
 */
async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Check if a hook command exists in a hooks array.
 */
function hasHookCommand(
  hooksArray: Array<{ matcher: string; hooks: unknown[] }>,
  commandSubstring: string,
): boolean {
  return hooksArray.some((entry) =>
    entry.hooks?.some((h: unknown) => {
      const hook = h as { command?: string };
      return hook.command?.includes(commandSubstring);
    }),
  );
}

/**
 * Get the path to the session end hook wrapper script (project-local).
 * This ensures the hook only exists within configured projects.
 */
function getSessionEndHookScriptPath(projectPath: string): string {
  return join(projectPath, ".claude", "hooks", "session-end-hook.sh");
}

/**
 * Get the path to the start hook wrapper script (project-local).
 */
function getStartHookScriptPath(projectPath: string): string {
  return join(projectPath, ".claude", "hooks", "start-hook.sh");
}

/**
 * Get the path to the pre-commit review hook script (project-local).
 */
function getPreCommitReviewScriptPath(projectPath: string): string {
  return join(projectPath, ".claude", "hooks", "pre-commit-review.sh");
}

/**
 * Get the path to the legacy global stop hook script.
 * Used for cleanup of old installations.
 */
function getLegacyGlobalStopHookPath(): string {
  return join(homedir(), ".local", "bin", "claude-cognitive-stop-hook.sh");
}

/**
 * Get the path to the legacy global session-end hook script.
 * Used for cleanup of old installations.
 */
function getLegacyGlobalSessionEndHookPath(): string {
  return join(
    homedir(),
    ".local",
    "bin",
    "claude-cognitive-session-end-hook.sh",
  );
}

/**
 * Check if a legacy global hook exists and warn the user.
 */
async function checkAndWarnLegacyGlobalHook(): Promise<boolean> {
  const legacyStopPath = getLegacyGlobalStopHookPath();
  const legacySessionEndPath = getLegacyGlobalSessionEndHookPath();
  try {
    await access(legacyStopPath);
    return true;
  } catch {
    try {
      await access(legacySessionEndPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create the start hook wrapper script (project-local).
 * Claude Code passes context via stdin JSON including cwd.
 *
 * This script:
 * - Reads cwd from stdin JSON
 * - Skips projects without .claudemindrc
 * - Writes context to .claude/rules/ which Claude Code auto-loads
 */
async function createStartHookScript(projectPath: string): Promise<string> {
  const scriptPath = getStartHookScriptPath(projectPath);
  const scriptDir = join(projectPath, ".claude", "hooks");

  // Ensure directory exists
  await mkdir(scriptDir, { recursive: true });

  const scriptContent = `#!/bin/bash
# Claude Code SessionStart hook wrapper for claude-cognitive (project-local)
# Injects context from Hindsight at session start
# Writes to .claude/rules/ which Claude Code auto-loads
# Skips projects without .claudemindrc

# Read stdin
INPUT=$(cat)

# Extract fields using jq (or fallback to grep/sed)
if command -v jq &> /dev/null; then
  PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
else
  PROJECT_DIR=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
fi

# Sanitize SESSION_ID - allow only alphanumeric, dash, underscore
SESSION_ID=$(echo "$SESSION_ID" | tr -cd 'a-zA-Z0-9_-')

# Validate PROJECT_DIR - allow alphanumeric, slash, dot, dash, underscore, reject ..
if [[ ! "$PROJECT_DIR" =~ ^[a-zA-Z0-9/./_-]+$ ]] || [[ "$PROJECT_DIR" == *".."* ]]; then
  echo "{}"
  exit 0
fi

# Skip if no project dir or no .claudemindrc
if [ -z "$PROJECT_DIR" ] || [ ! -f "$PROJECT_DIR/.claudemindrc" ]; then
  exit 0
fi

# Ensure .claude/rules directory exists
mkdir -p "$PROJECT_DIR/.claude/rules" 2>/dev/null || true

# Context file that Claude Code auto-loads
CONTEXT_FILE="$PROJECT_DIR/.claude/rules/session-context.md"

# Run inject-context and capture output
CONTEXT_OUTPUT=$(claude-cognitive inject-context --project "$PROJECT_DIR" 2>/dev/null)

# Write context to rules file
if [ -n "$CONTEXT_OUTPUT" ]; then
  cat > "$CONTEXT_FILE" << CONTEXT_EOF
# Session Context (Auto-Recalled)

This context was automatically recalled from memory at session start.
Use this background to inform your work on this project.

---

$CONTEXT_OUTPUT

---

*Auto-recalled at $(date -Iseconds)*
CONTEXT_EOF
else
  # No memories - create minimal placeholder
  cat > "$CONTEXT_FILE" << CONTEXT_EOF
# Session Context

No prior memories found for this project yet.
Memory will be stored automatically when the session ends.

*Generated at $(date -Iseconds)*
CONTEXT_EOF
fi

exit 0
`;

  await writeFile(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Create the session end hook wrapper script (project-local).
 * Claude Code passes transcript_path via stdin JSON, not as env var.
 *
 * This script filters out:
 * - Agent sessions (filename starts with "agent-")
 * - Projects without .claudemindrc
 *
 * IMPORTANT: The script is now stored in PROJECT/.claude/hooks/ to ensure
 * it only affects this specific project, preventing unintended API calls
 * when using Claude in other directories.
 *
 * NOTE: SessionEnd hook only fires when session truly ends (not after every response),
 * so we no longer need the /exit grep and marker file logic from the old Stop hook.
 */
async function createSessionEndHookScript(
  projectPath: string,
): Promise<string> {
  const scriptPath = getSessionEndHookScriptPath(projectPath);
  const scriptDir = join(projectPath, ".claude", "hooks");

  // Ensure directory exists
  await mkdir(scriptDir, { recursive: true });

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

# Sanitize SESSION_ID to prevent shell injection (allow alphanumeric, dash, underscore only)
SESSION_ID=$(echo "$SESSION_ID" | tr -cd 'a-zA-Z0-9_-')

# Validate PROJECT_DIR - allow alphanumeric, slash, dot, dash, underscore, reject ..
if [[ ! "$PROJECT_DIR" =~ ^[a-zA-Z0-9/./_-]+$ ]] || [[ "$PROJECT_DIR" == *".."* ]]; then
  exit 0
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

exit 0
`;

  await writeFile(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Create the pre-commit review hook script (project-local).
 * Triggers security review before git commit commands.
 * Only activates when securityReview.enabled is true in .claudemindrc.
 */
async function createPreCommitReviewScript(projectPath: string): Promise<string> {
  const scriptPath = getPreCommitReviewScriptPath(projectPath);
  const scriptDir = join(projectPath, ".claude", "hooks");

  // Ensure directory exists
  await mkdir(scriptDir, { recursive: true });

  const scriptContent = `#!/bin/bash
# Claude Code PreToolUse hook for pre-commit security review
# Triggers security review before git commit commands
# Only activates when securityReview.enabled is true in .claudemindrc

# Read stdin
INPUT=$(cat)

# Extract fields using jq (or fallback to grep/sed)
if command -v jq &> /dev/null; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
else
  TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | cut -d'"' -f4)
  COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | sed 's/\\\\"//g' | cut -d'"' -f4)
  PROJECT_DIR=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
fi

# Validate PROJECT_DIR to prevent path traversal/injection
# Allow alphanumeric, slash, dot, dash, underscore only, reject path traversal
if [[ ! "$PROJECT_DIR" =~ ^[a-zA-Z0-9/./_-]+$ ]] || [[ "$PROJECT_DIR" == *".."* ]]; then
  echo "{}"
  exit 0
fi

# Only intercept Bash tool with git commit commands
if [ "$TOOL_NAME" != "Bash" ] || [[ ! "$COMMAND" =~ ^git[[:space:]]+commit ]]; then
  echo "{}"
  exit 0
fi

# Skip if no project dir or no .claudemindrc
if [ -z "$PROJECT_DIR" ] || [ ! -f "$PROJECT_DIR/.claudemindrc" ]; then
  echo "{}"
  exit 0
fi

# Check if security review is enabled
SECURITY_ENABLED="false"
if command -v jq &> /dev/null; then
  SECURITY_ENABLED=$(jq -r '.securityReview.enabled // false' "$PROJECT_DIR/.claudemindrc" 2>/dev/null)
else
  if grep -q '"securityReview"' "$PROJECT_DIR/.claudemindrc" 2>/dev/null; then
    if grep -A5 '"securityReview"' "$PROJECT_DIR/.claudemindrc" | grep -q '"enabled"[[:space:]]*:[[:space:]]*true'; then
      SECURITY_ENABLED="true"
    fi
  fi
fi

# Exit if security review is not enabled
if [ "$SECURITY_ENABLED" != "true" ]; then
  echo "{}"
  exit 0
fi

# Get staged files (need to be in project dir for git commands)
cd "$PROJECT_DIR" 2>/dev/null || {
  echo "{}"
  exit 0
}

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

# Exit if no staged files
if [ -z "$STAGED_FILES" ]; then
  echo "{}"
  exit 0
fi

# Filter to code files only
CODE_EXTENSIONS="\\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|rb|php|cs|swift|kt)$"
CODE_FILES=$(echo "$STAGED_FILES" | grep -E "$CODE_EXTENSIONS")

# Exit if no code files staged
if [ -z "$CODE_FILES" ]; then
  echo "{}"
  exit 0
fi

# Get diff summary for context
DIFF_SUMMARY=$(git diff --cached --stat 2>/dev/null | head -20)

# Count code files
FILE_COUNT=$(echo "$CODE_FILES" | wc -l | tr -d ' ')

# Build file list (limit to 20 for readability)
if [ "$FILE_COUNT" -gt 20 ]; then
  FILE_LIST=$(echo "$CODE_FILES" | head -20 | sed 's/^/  - /')
  FILE_LIST="$FILE_LIST"$'\\n'"  - ... and $((FILE_COUNT - 20)) more files"
else
  FILE_LIST=$(echo "$CODE_FILES" | sed 's/^/  - /')
fi

# Build additional context message
CONTEXT="## Pre-Commit Security Review Required

**Security review is enabled for this project.**

Before committing, launch the \\\`security-code-reviewer\\\` agent to analyze staged changes.

**Staged Code Files ($FILE_COUNT):**
$FILE_LIST

**Diff Summary:**
\\\`\\\`\\\`
$DIFF_SUMMARY
\\\`\\\`\\\`

**Action Required:**
Use the Task tool to launch the security-code-reviewer agent with model: opus

Review focus:
- Input validation and sanitization
- Authentication and authorization checks
- Injection vulnerabilities (SQL, XSS, command)
- Hardcoded secrets and sensitive data
- Error handling and information leakage

Only proceed with commit after security review is complete."

# Output JSON with additionalContext
if command -v jq &> /dev/null; then
  jq -n --arg context "$CONTEXT" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: $context
    }
  }'
else
  # Manual JSON construction
  ESCAPED_CONTEXT=$(echo "$CONTEXT" | sed 's/\\\\/\\\\\\\\/g' | sed 's/"/\\\\"/g' | awk '{printf "%s\\\\n", $0}' | sed 's/\\\\n$//')
  echo "{\\\"hookSpecificOutput\\\":{\\\"hookEventName\\\":\\\"PreToolUse\\\",\\\"additionalContext\\\":\\\"$ESCAPED_CONTEXT\\\"}}"
fi

exit 0
`;

  await writeFile(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Configure hooks in project-local Claude Code settings.
 * Hooks are stored in PROJECT/.claude/settings.json to keep them project-specific.
 *
 * Configures three hooks:
 * - SessionEnd: Processes session transcript at session end (calls process-session)
 * - SessionStart: Injects context at session start (calls inject-context)
 * - PreToolUse: Security review before git commit (calls pre-commit-review)
 */
async function configureHooks(
  projectPath: string,
): Promise<{ settingsPath: string; legacyGlobalHookExists: boolean }> {
  const settingsPath = getProjectSettingsPath(projectPath);
  const settings = await readSettings(settingsPath);

  // Check for legacy global hook
  const legacyGlobalHookExists = await checkAndWarnLegacyGlobalHook();

  // Create the hook wrapper scripts (project-local)
  const sessionEndScriptPath = await createSessionEndHookScript(projectPath);
  const startScriptPath = await createStartHookScript(projectPath);
  const preCommitScriptPath = await createPreCommitReviewScript(projectPath);

  // Get or create hooks object
  const hooks = (settings.hooks as Record<string, unknown[]>) || {};

  // ============================================
  // Remove legacy Stop hooks (migrate to SessionEnd)
  // ============================================
  delete hooks.Stop;

  // ============================================
  // Configure SessionEnd hook (session end)
  // ============================================
  let sessionEndHooks =
    (hooks.SessionEnd as Array<{ matcher: string; hooks: unknown[] }>) || [];

  // Remove old-style hooks that use $TRANSCRIPT_PATH env var (doesn't work)
  // Also remove old stop-hook.sh references
  sessionEndHooks = sessionEndHooks.filter(
    (entry) =>
      !entry.hooks?.some((h: unknown) => {
        const hook = h as { command?: string };
        return (
          hook.command?.includes('$TRANSCRIPT_PATH"') ||
          hook.command?.includes("stop-hook.sh")
        );
      }),
  );

  // Add wrapper script hook on SessionEnd
  if (!hasHookCommand(sessionEndHooks, "session-end-hook.sh")) {
    sessionEndHooks.push({
      matcher: "",
      hooks: [
        {
          type: "command",
          command: sessionEndScriptPath,
        },
      ],
    });
  }

  hooks.SessionEnd = sessionEndHooks;

  // ============================================
  // Configure SessionStart hook (context injection)
  // ============================================
  let sessionStartHooks =
    (hooks.SessionStart as Array<{ matcher: string; hooks: unknown[] }>) || [];

  // Remove old-style hooks that use $CWD env var (doesn't work)
  sessionStartHooks = sessionStartHooks.filter(
    (entry) =>
      !entry.hooks?.some((h: unknown) => {
        const hook = h as { command?: string };
        return hook.command?.includes("$CWD");
      }),
  );

  // Add start hook script if not already present
  if (!hasHookCommand(sessionStartHooks, "start-hook.sh")) {
    sessionStartHooks.push({
      matcher: "",
      hooks: [
        {
          type: "command",
          command: startScriptPath,
        },
      ],
    });
  }

  hooks.SessionStart = sessionStartHooks;

  // ============================================
  // Configure PreToolUse hook (pre-commit security review)
  // ============================================
  let preToolUseHooks =
    (hooks.PreToolUse as Array<{ matcher: string; hooks: unknown[] }>) || [];

  // Add pre-commit review hook if not already present
  if (!hasHookCommand(preToolUseHooks, "pre-commit-review.sh")) {
    preToolUseHooks.push({
      matcher: "Bash(git commit:*)",
      hooks: [
        {
          type: "command",
          command: preCommitScriptPath,
          timeout: 60000,
        },
      ],
    });
  }

  hooks.PreToolUse = preToolUseHooks;

  // Remove legacy UserPromptSubmit hooks (we now use SessionStart)
  delete hooks.UserPromptSubmit;

  settings.hooks = hooks;

  // Ensure project .claude directory exists
  await mkdir(join(projectPath, ".claude"), { recursive: true });

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return { settingsPath, legacyGlobalHookExists };
}

/**
 * Read existing MCP config or return empty object.
 */
async function readMcpConfig(path: string): Promise<Record<string, unknown>> {
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
          runLearn: false,
          learnDepth: "standard",
        };

        // Step 1: Project path
        printStep(1, 5, "Project Configuration");

        if (!options.project) {
          answers.projectPath = await prompt.ask("Project path", process.cwd());
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
        print(
          color(
            "  MCP server and hooks will be configured for this project only.",
            "dim",
          ),
        );

        answers.configureClaudeCode = await prompt.confirm(
          "Configure Claude Code integration?",
          true,
        );

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
              {
                label: "Quick - README, package.json, structure",
                value: "quick" as const,
              },
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
            timeouts: {
              recall: 120000,
              reflect: 180000,
              retain: 90000,
            },
          },
          bankId: answers.bankId,
          disposition: answers.disposition,
          ...(answers.background ? { background: answers.background } : {}),
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

        await writeFile(rcPath, JSON.stringify(config, null, 2) + "\n");
        printSuccess(`Created ${rcPath}`);

        // Configure Claude Code MCP (always project-local)
        if (answers.configureClaudeCode) {
          const mcpConfigPath = getMcpConfigPath(answers.projectPath);

          const existing = await readMcpConfig(mcpConfigPath);
          const serveCmd = await getServeCommand();

          const mcpServers =
            (existing.mcpServers as Record<string, unknown>) || {};

          mcpServers["claude-cognitive"] = {
            command: serveCmd.command,
            args: [...serveCmd.args],
          };

          const newConfig = {
            ...existing,
            mcpServers,
          };

          await writeFile(
            mcpConfigPath,
            JSON.stringify(newConfig, null, 2) + "\n",
          );

          printSuccess("Configured MCP server: project (.mcp.json)");
          printInfo(mcpConfigPath);

          // Configure hooks for session-to-session memory (project-local)
          const { settingsPath: hooksPath, legacyGlobalHookExists } =
            await configureHooks(answers.projectPath);
          printSuccess(
            "Configured session hooks: project (.claude/settings.json)",
          );
          printInfo(hooksPath);

          // Warn about legacy global hook if it exists
          if (legacyGlobalHookExists) {
            print("");
            print(
              color(
                "  WARNING: Legacy global hook detected at ~/.local/bin/",
                "yellow",
              ),
            );
            print(
              color(
                "  This may cause unintended API calls for ALL Claude sessions.",
                "yellow",
              ),
            );
            print(
              color(
                "  To remove: rm ~/.local/bin/claude-cognitive-*-hook.sh",
                "yellow",
              ),
            );
            print(
              color(
                "  Also check ~/.config/claude/settings.json for global hooks.",
                "yellow",
              ),
            );
          }
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
              print(
                color(
                  `Learning from codebase (${answers.learnDepth})...`,
                  "dim",
                ),
              );
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
        print(color("  2. Ask Claude to use memory_recall to verify", "dim"));
        if (!hindsightConnected) {
          print(
            color(
              "  3. Start Hindsight and run: claude-cognitive learn",
              "dim",
            ),
          );
        }
        print("");
        print(
          color(
            "Tip: Session memory syncs automatically when session ends.",
            "dim",
          ),
        );
        print("");
      } finally {
        prompt.close();
      }
    });
}
