# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2] - 2026-01-13

### Added

- **Gemini code exploration guidance** - Session context now includes guidance
  for using Gemini MCP tools (`gemini_analyze_code`, `gemini_research`,
  `gemini_summarize`) when Gemini is configured. Includes tool usage examples,
  analysis types reference, and important verification warnings.

### Changed

- **Dynamic timeout for Gemini CLI** - Changed default timeout from 120 seconds
  to 0 (no timeout). The Gemini CLI now waits indefinitely for requests to
  complete, while still detecting actual errors (non-zero exit codes, stderr).
  Users can still set explicit timeouts in `.claudemindrc` if desired.

## [0.6.1] - 2026-01-12

### Changed

- **Gemini CLI model auto-selection** - Removed hardcoded model parameter from
  Gemini CLI calls. When model is set to `"auto"` (the default), the `-m` flag
  is now omitted, allowing Gemini CLI to auto-select the optimal model based on
  task complexity (e.g., `gemini-3-flash-preview` for simple tasks, thinking
  models for complex analysis).
  - Removed `AUTO_MODEL_RESOLUTION` constant
  - Updated `ExecuteOptions.model` and `GeminiResult.model` to allow `"auto"`
  - Explicit model overrides (e.g., `"gemini-2.5-pro"`) still work with `-m` flag
  - Users can override in `.claudemindrc` with `gemini.model` setting

## [0.4.11] - 2026-01-07

### Fixed

- **UUID validation in memory_signal handler** - Added early validation to check
  that fact IDs are valid UUIDs before sending to Hindsight. Invalid IDs now
  return a helpful error message explaining that IDs must be UUIDs from
  `memory_recall` responses, instead of causing a cryptic 500 server error.

## [0.4.10] - 2026-01-07

### Fixed

- **MCP server now works in offline/degraded mode** - Added error event listener
  in serve command to prevent crashes when Hindsight is unavailable. The server
  now starts successfully and operates in degraded mode with local offline storage.

## [0.4.9] - 2026-01-06

### Changed

- **Install command now creates complete config** - Fresh installations now include
  all modern configuration options that were previously only added by `update`
  - Added `context.recentMemoryLimit` for controlling recalled memory count
  - Added `retain` config (transcript filtering, length limits, code block limits)
  - Added `feedback` config (detection settings, Hindsight integration)
  - Added `hindsight.timeouts` (recall: 120s, reflect: 180s, retain: 90s)

### Removed

- **Obsolete semantic memory.md approach** - Removed from install command
  - No longer creates `.claude/memory.md` template file
  - No longer adds `semantic` config to `.claudemindrc`
  - No longer injects memory instructions into CLAUDE.md
  - The `update` command still migrates old installations by removing `semantic` config

## [0.4.8] - 2026-01-06

### Fixed

- **macOS compatibility** - Fixed `timeout` command not found error on macOS
  - Now checks for `timeout` (Linux), `gtimeout` (macOS with coreutils), or runs
    without timeout (macOS without coreutils)
  - Session end waits dynamically for Hindsight on systems without timeout

## [0.4.7] - 2026-01-06

### Changed

- **Migrated from Stop hook to SessionEnd hook** - Session processing now only
  triggers when the session truly ends, not after every assistant response
  - Eliminates 1-2 minute delays caused by Stop hook firing repeatedly
  - No longer needs `/exit` grep detection or marker file tracking
  - SessionEnd hook receives structured JSON with `reason` field

- **Shell script hardening** - Improved reliability and safety of hook scripts
  - Added 2-minute timeout to prevent hanging if Hindsight is slow
  - Added `|| true` to ensure hooks never block Claude Code
  - Added explicit `exit 0` at end of scripts
  - Fixed misleading message about `/exit` → now says "when session ends"

- **Improved migration detection in update command** - Better detection of
  existing Stop hooks during migration
  - Now detects both "claude-cognitive" and "stop-hook" patterns
  - Warns if old stop-hook.sh file doesn't exist during migration

- **MCP server session lifecycle** - Added proper session start/end calls
  - `serve` command now calls `mind.onSessionStart()` to enable feedback tracking
  - SIGINT/SIGTERM handlers call `mind.onSessionEnd()` for clean shutdown

### Fixed

- **Feedback tracking not working** - Fixed issue where feedback stats showed 0
  signals because MCP server wasn't calling `onSessionStart()` to set sessionId

## [0.4.0] - 2026-01-05

### Added

- **Feedback signals system** - Automatic tracking of which recalled facts are
  useful to improve future retrieval quality
  - 4 detection strategies: explicit reference, semantic similarity, file
    access correlation, task topic correlation
  - Score aggregation with used/ignored/uncertain verdicts
  - Query-context aware scoring in Hindsight
  - Full documentation in `docs/feedback-signals.md`

- **Offline feedback queue** - Feedback signals are queued locally when
  Hindsight is unavailable
  - New `OfflineFeedbackQueue` class (`src/feedback/offline-queue.ts`)
  - Signals stored in `.claude/offline-feedback.json`
  - Auto-sync when connection is restored via `attemptRecovery()`

- **New CLI commands**:
  - `feedback-stats` - Show feedback queue and processing statistics
  - `feedback-sync` - Manually sync pending offline feedback signals

- **New events** for feedback operations:
  - `feedback:processed` - Emitted when feedback is sent to Hindsight
  - `feedback:queued` - Emitted when signals are queued offline
  - `feedback:synced` - Emitted when offline signals are synced

- **Agent orchestration enforcement** - Main Claude instance now acts as
  orchestrator only, delegating ALL code writing to agents
  - Critical rule injected at session start via `formatAgentInstructions()`
  - Custom project agents listed from `.claude/agents/`
  - Exception only when no agents are available

### Changed

- **Mind.onSessionEnd()** - Now processes feedback automatically when enabled
- **Mind.attemptRecovery()** - Now syncs offline feedback alongside memories
- **Session context injection** - Includes agent orchestration enforcement rules

## [0.3.4] - 2026-01-05

### Added

- **Offline memory storage** - Memories are now stored locally when Hindsight is
  unavailable
  - New `OfflineMemoryStore` class (`src/offline.ts`) handles local JSON storage
  - Memories stored in `.claude/offline-memories.json`
  - Text-based search for recall in offline mode
  - Session context still injected from offline store
- **Auto-sync on reconnect** - Offline memories automatically sync to Hindsight
  when connection is restored
  - `attemptRecovery()` now syncs all unsynced memories
  - Synced memories are cleared from local storage to save space
- **New events** for offline operations:
  - `offline:stored` - Emitted when content is stored locally
  - `offline:synced` - Emitted when offline memories sync to Hindsight

### Changed

- **Graceful degradation improved** - Instead of skipping retain() when
  Hindsight is down, memories are now stored locally for later sync
- **Session end in offline mode** - Transcripts are stored locally instead of
  being lost

### Removed

- **Deprecated `semantic` command** - `.claude/memory.md` sync has been removed
- **Deprecated `sync` command** - Memory.md sync has been removed
- Context is now managed via `.claude/rules/session-context.md` at session start

## [0.3.2] - 2026-01-04

### Security

- **Fixed path traversal vulnerability** in source analyzer
  (`src/learn/analyzers/source.ts`) - Now validates all file paths are within
  project directory before reading

### Fixed

- **Mind initialization race condition** - Added `initializing` flag to prevent
  concurrent `init()` calls from corrupting state
- **Session lifecycle race condition** - `onSessionStart()` now throws if a
  session is already active instead of silently corrupting state
- **SemanticMemory write lock** - Fixed race condition where concurrent
  `save()` calls could interleave; now properly serializes writes
- **MCP server stop() resource leak** - Always cleans up HTTP server and state
  even when close fails, re-throws error after cleanup
- **Learn reflection error handling** - Now tracks and reports reflection query
  failures in `LearnResult.reflectionFailures` instead of silently ignoring
- **SemanticMemory creation warning** - Logs warning when file creation fails
  instead of silently using empty sections
- **MCP tool type safety** - Added Zod schema validation to tool handlers for
  proper input validation and error messages
- **CLI error handling** - Replaced `process.exit(1)` calls in `update-bank`
  command with proper `CLIError` throws

### Added

- **`Mind.dispose()` method** - Proper cleanup of event listeners and resources
  to prevent memory leaks when Mind instances are discarded
- **`NOT_FOUND` exit code** - Added to CLI error codes for consistency

### Changed

- **Stop hook buffer cleanup** - Now uses `flock` for atomic file operations to
  prevent race conditions between concurrent session ends
- **Timestamp precision** - Observation promotion now uses full ISO timestamps
  instead of date-only format for better ordering

## [0.3.1] - 2026-01-04

### Changed

- **Optimized transcript filtering defaults** - Reduced payload sizes by ~80%
  - `maxTranscriptLength`: 50,000 → 25,000 chars
  - `maxCodeBlockLines`: 500 → 30 lines
  - `maxLineLength`: 2,000 → 1,000 chars
  - `minSessionLength`: 200 → 500 chars (skip more trivial sessions)

### Removed

- **Removed Claude API summarization** - No longer spawns `claude --print` for
  long transcripts
  - Eliminates external API dependency on session end
  - Simplifies code by ~80 lines
  - Relies on improved filtering + Hindsight for memory extraction

### Added

- **New noise filter patterns** for better transcript cleaning:
  - `<system-reminder>` blocks (Claude Code injected content)
  - Base64 encoded data (images, binaries)
  - Large JSON objects (>500 chars)
  - Diff/patch content
  - Stack traces (keeps error message, filters trace)
  - Large XML/HTML blocks (>500 chars)
- **Whitespace cleanup** - Collapses excessive blank lines

### Fixed

- **Hook duplicate detection** - Fixed check that prevented reinstall from
  adding duplicate hooks (was checking wrong script name)

## [0.3.0] - 2026-01-04

### Changed

- **⚠️ BREAKING: Installation is now strictly project-local**
  - Stop hook script is now created at `PROJECT/.claude/hooks/stop-hook.sh`
    instead of `~/.local/bin/`
  - This prevents unintended API calls when using Claude in other directories
  - **Important**: If you previously installed globally, you should remove the
    legacy hook:
    ```bash
    rm ~/.local/bin/claude-cognitive-stop-hook.sh
    ```
  - Also check and clean `~/.config/claude/settings.json` or
    `~/.claude/settings.json` for global hooks

### Added

- **Legacy global hook detection** - `install` command now warns if a legacy
  global hook exists
- **`--clean-global` flag for `uninstall`** - Removes legacy global hooks from
  `~/.local/bin/`
- **Project-local hooks cleanup** - `uninstall` now removes
  `PROJECT/.claude/hooks/` directory

### Fixed

- **Version mismatch** - CLI version constant now matches package.json (was
  hardcoded at 0.2.7)

## [0.2.7] - 2026-01-03

### Fixed

- **Stop hook now works correctly** - Claude Code passes `transcript_path` via
  stdin JSON, not as `$TRANSCRIPT_PATH` environment variable
  - Created wrapper script at `~/.local/bin/claude-cognitive-stop-hook.sh` that
    reads stdin and extracts the transcript path
  - `install` and `update` commands now create this wrapper script automatically
  - Old-style hooks using `$TRANSCRIPT_PATH` are migrated to the new wrapper
    script

- **Automatic cleanup after sync** - Session buffer files are now cleaned up
  after successful sync
  - Removes `.claude/.session-buffer.jsonl` after syncing to prevent re-syncing
    old data

### Changed

- `update` command now:
  - Creates/updates the stop hook wrapper script
  - Removes old-style hooks that used `$TRANSCRIPT_PATH` env var
  - Properly detects and migrates outdated hook configurations

## [0.2.0] - 2026-01-03

### Added

- **`sync-session` command** - Sync session to Hindsight before `/clear`
  - `claude-cognitive sync-session` - Sync buffered session and clear buffer
  - `claude-cognitive sync-session --keep-buffer` - Sync but preserve buffer
  - Solves the issue where `/clear` doesn't trigger session end hooks
  - Session interactions are buffered via PostToolUse hook

- **`buffer-message` hook** - Captures tool interactions during session
  - Automatically buffers to `.claude/.session-buffer.jsonl`
  - Used by `sync-session` to save session before clearing

- **`update` command** - Update configuration without reinstall
  - `claude-cognitive update` - Apply missing configurations
  - `claude-cognitive update --check` - Dry run to see what needs updating
  - Automatically adds MCP server and session hooks if missing

- **Agent orchestration instructions** - Session context now includes:
  - Built-in agents: `code-explorer`, `code-architect`, `code-reviewer`
  - Project agents from `.claude/agents/`
  - Orchestration workflow (explore → clarify → design → implement → review)
  - Instructions for parallel agent execution

### Fixed

- **MCP configuration path** - Now correctly uses `~/.claude/mcp.json` instead
  of `~/.claude.json`
- **Automatic hooks setup** - `install` command now configures session hooks in
  `~/.claude/settings.json`
- **Global configuration** - MCP server and hooks work for all projects with
  `.claudemindrc`
- **Transcript parsing** - `process-session` hook now properly parses JSONL
  transcripts:
  - Extracts only meaningful user/assistant messages
  - Filters out session metadata (session IDs, paths, permissions)
  - Skips system reminders and empty messages
  - Filters CLI commands (`/exit`, `/clear`, `/help`, `/compact`, `/config`) to
    reduce API costs
  - Results in higher quality memories about actual project work

### Changed

- `install` command now automatically configures:
  - MCP server in `~/.claude/mcp.json`
  - Session hooks (`process-session`) in `~/.claude/settings.json`
- `uninstall` command now properly removes:
  - MCP server from `~/.claude/mcp.json`
  - Session hooks from `~/.claude/settings.json`
- CLAUDE.md injection now includes agent orchestration instructions

## [0.1.0] - 2025-01-02

### Added

- **Core**
  - `HindsightClient` - TypeScript client for Hindsight memory API
  - `Mind` - Orchestrator class for session lifecycle management
  - `SemanticMemory` - Local `.claude/memory.md` management with observation
    promotion
  - Graceful degradation when Hindsight is unavailable

- **Operations**
  - `retain()` - Store memories with automatic 5-dimension extraction
  - `recall()` - 4-way parallel search (semantic + BM25 + graph + temporal)
  - `reflect()` - Reason through disposition lens, form opinions
  - `learn()` - Bootstrap memory from existing codebase

- **CLI Commands**
  - `claude-cognitive init` - Initialize project configuration
  - `claude-cognitive install` - Interactive setup wizard
  - `claude-cognitive serve` - Start MCP server (STDIO transport)
  - `claude-cognitive status` - Show connection and bank status
  - `claude-cognitive learn` - Bootstrap from codebase (quick/standard/full)
  - `claude-cognitive recall` - Search memories
  - `claude-cognitive reflect` - Reason about knowledge
  - `claude-cognitive semantic` - View semantic memory
  - `claude-cognitive config` - Show configuration

- **MCP Server**
  - `memory_recall` tool - Search project memories
  - `memory_reflect` tool - Reason about accumulated knowledge
  - STDIO transport for Claude Code integration

- **Claude Code Integration**
  - Hook support for `inject-context` and `process-session`
  - MCP configuration for `.mcp.json` and `~/.claude.json`

- **Agent Templates**
  - `code-explorer` - Analyze codebase, discover patterns
  - `code-architect` - Design solutions, create blueprints
  - `code-reviewer` - Review quality, find issues
  - Custom agent loading from `.claude/agents/`

- **Documentation**
  - Getting Started guide
  - Core concepts documentation
  - Configuration reference
  - API reference
  - Performance benchmarks

- **Testing**
  - 478 tests with 82% coverage
  - Unit, integration, and E2E tests
  - Performance benchmarks

[0.4.0]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.4.0
[0.3.4]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.3.4
[0.3.2]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.3.2
[0.3.1]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.3.1
[0.3.0]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.3.0
[0.2.7]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.2.7
[0.2.0]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.2.0
[0.1.0]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.1.0
