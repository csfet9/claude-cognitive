# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-cognitive is a memory integration layer between Claude Code and [Hindsight](https://github.com/vectorize-io/hindsight). It gives Claude persistent memory across sessions.

**LLM thinks. Hindsight remembers. Together = mind.**

## Development Commands

```bash
# Build
npm run build

# Test
npm test                        # watch mode
npm run test:run                # run once
npm run test:coverage           # with coverage
vitest run tests/unit/core/client.test.ts  # single file

# Format
npm run format                  # prettier --write .
npm run format:check            # prettier --check .

# Type check
npm run type-check              # tsc --noEmit

# CLI (after build)
claude-cognitive serve          # start MCP server
claude-cognitive status         # check connection
claude-cognitive learn          # bootstrap from codebase
claude-cognitive sync           # regenerate memory.md from Hindsight
```

## Architecture

```
┌──────────────────────────────────────┐
│           Mind (orchestrator)        │
│  - Session lifecycle management      │
│  - Graceful degradation              │
│  - Agent context preparation         │
├──────────────────────────────────────┤
│         HindsightClient              │
│  retain() | recall() | reflect()     │
│  4-way retrieval: semantic + BM25    │
│               + graph + temporal     │
├──────────────────────────────────────┤
│         SemanticMemory               │
│  .claude/memory.md (human-curated)   │
└──────────────────────────────────────┘
```

### Key Classes

| Class | File | Purpose |
|-------|------|---------|
| `Mind` | `src/mind.ts` | Orchestrator wrapping HindsightClient with session management and graceful degradation |
| `HindsightClient` | `src/client.ts` | HTTP client for Hindsight API (retain/recall/reflect/learn) |
| `SemanticMemory` | `src/semantic.ts` | Section-based markdown parser for `.claude/memory.md` |
| `PromotionManager` | `src/promotion.ts` | Promotes high-confidence opinions to semantic memory |

### Memory Networks

| Type | Purpose |
|------|---------|
| `world` | Facts about external world ("Auth uses Supabase magic links") |
| `experience` | First-person experiences ("I fixed the redirect by...") |
| `opinion` | Beliefs with confidence 0.0-1.0 ("This codebase prefers explicit patterns") |
| `observation` | Synthesized cross-session insights |

### MCP Tools (exposed to Claude)

- `memory_recall` - Search memories with 4-way retrieval
- `memory_reflect` - Reason about knowledge, form opinions

Defined in `src/mcp/tools.ts`, handled in `src/mcp/handlers.ts`.

## Project Structure

```
src/
├── mind.ts              # Mind orchestrator
├── client.ts            # HindsightClient HTTP client
├── semantic.ts          # SemanticMemory (.claude/memory.md)
├── promotion.ts         # Opinion promotion to semantic memory
├── events.ts            # TypedEventEmitter for Mind events
├── config.ts            # Config loading (.claudemindrc)
├── types.ts             # All TypeScript types
├── errors.ts            # HindsightError class
├── retry.ts             # Retry utilities with exponential backoff
├── mcp/                 # MCP server implementation
│   ├── server.ts        # ClaudeMindMcpServer class
│   ├── tools.ts         # Tool definitions with Zod schemas
│   └── handlers.ts      # Tool execution handlers
├── cli/                 # CLI commands
│   └── commands/        # Individual command implementations
├── learn/               # Learn operation (cold start)
│   ├── index.ts         # Main learn() function
│   ├── extractor.ts     # Fact extraction from analysis
│   └── analyzers/       # Codebase analyzers (git, package, readme, source, structure)
├── agents/              # Agent templates
│   ├── templates.ts     # Built-in: code-explorer, code-architect, code-reviewer
│   ├── loader.ts        # Custom agent loading from .claude/agents/
│   └── context.ts       # Agent context preparation with memory
└── hooks/               # Claude Code hooks
    ├── inject-context.ts   # Session start hook
    └── process-session.ts  # Session end hook
```

## Configuration

`.claudemindrc` in project root:

```json
{
  "hindsight": { "host": "localhost", "port": 8888 },
  "bankId": "my-project",
  "disposition": { "skepticism": 4, "literalism": 4, "empathy": 2 },
  "background": "Developer assistant for a React app",
  "semantic": { "path": ".claude/memory.md" }
}
```

### Disposition Traits (1-5)

| Trait | Low (1) | High (5) |
|-------|---------|----------|
| skepticism | Trusting | Questions claims |
| literalism | Flexible | Precise/literal |
| empathy | Fact-focused | Considers emotion |

## Testing

Tests mirror source structure under `tests/`:
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests (not excluded from default run)
- `tests/e2e/` - E2E tests (excluded, run with `npm run test:e2e`)
- `tests/perf/` - Benchmarks (`npm run bench`)
- `tests/helpers/` - Mocks and fixtures

Vitest globals are enabled. Coverage thresholds: 80% statements/functions/lines, 75% branches.

## Graceful Degradation

When Hindsight is unavailable, Mind enters degraded mode:
- `recall()` returns empty array
- `retain()` silently skips
- `reflect()` throws (requires Hindsight)
- Semantic memory still works
- `attemptRecovery()` tries to reconnect
