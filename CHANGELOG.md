# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - `claude-mind init` - Initialize project configuration
  - `claude-mind install` - Interactive setup wizard
  - `claude-mind serve` - Start MCP server (STDIO transport)
  - `claude-mind status` - Show connection and bank status
  - `claude-mind learn` - Bootstrap from codebase (quick/standard/full)
  - `claude-mind recall` - Search memories
  - `claude-mind reflect` - Reason about knowledge
  - `claude-mind semantic` - View semantic memory
  - `claude-mind config` - Show configuration

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

[0.1.0]: https://github.com/csfet9/claude-mind/releases/tag/v0.1.0
