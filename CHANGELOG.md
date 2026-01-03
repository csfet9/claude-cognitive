# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.7] - 2026-01-03

### Fixed

- **Stop hook now works correctly** - Claude Code passes `transcript_path` via stdin JSON, not as `$TRANSCRIPT_PATH` environment variable
  - Created wrapper script at `~/.local/bin/claude-cognitive-stop-hook.sh` that reads stdin and extracts the transcript path
  - `install` and `update` commands now create this wrapper script automatically
  - Old-style hooks using `$TRANSCRIPT_PATH` are migrated to the new wrapper script

- **Automatic cleanup after sync** - Session buffer files are now cleaned up after successful sync
  - Removes `.claude/.session-buffer.jsonl` after syncing to prevent re-syncing old data

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

- **MCP configuration path** - Now correctly uses `~/.claude/mcp.json` instead of `~/.claude.json`
- **Automatic hooks setup** - `install` command now configures session hooks in `~/.claude/settings.json`
- **Global configuration** - MCP server and hooks work for all projects with `.claudemindrc`
- **Transcript parsing** - `process-session` hook now properly parses JSONL transcripts:
  - Extracts only meaningful user/assistant messages
  - Filters out session metadata (session IDs, paths, permissions)
  - Skips system reminders and empty messages
  - Filters CLI commands (`/exit`, `/clear`, `/help`, `/compact`, `/config`) to reduce API costs
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
  - `SemanticMemory` - Local `.claude/memory.md` management with observation promotion
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

[0.2.0]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.2.0
[0.1.0]: https://github.com/csfet9/claude-cognitive/releases/tag/v0.1.0
