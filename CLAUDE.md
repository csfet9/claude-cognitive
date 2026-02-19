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
npm run test:unit               # unit tests only
npm run test:integration        # integration tests only
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
claude-cognitive sync           # (deprecated) regenerate memory.md from Hindsight
```

## TypeScript & Module System

- **ESM-only** (`"type": "module"` in package.json). All internal imports use `.js` extensions (e.g., `import { Mind } from "./mind.js"`).
- **Strict TypeScript** — `tsconfig.json` enables aggressive checks: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. Expect compiler errors if you add unused variables or access arrays/objects without narrowing.
- Module resolution is `NodeNext`.

## Architecture

```
┌──────────────────────────────────────┐
│           Mind (orchestrator)        │
│  - Session lifecycle management      │
│  - Graceful degradation + offline    │
│  - Agent context preparation         │
│  - Observation promotion             │
├──────────────────────────────────────┤
│         HindsightClient              │
│  retain() | recall() | reflect()     │
│  4-way retrieval: semantic + BM25    │
│               + graph + temporal     │
├──────────────────────────────────────┤
│  SemanticMemory    OfflineMemoryStore │
│  .claude/memory.md  offline-memories │
│  Section-based      Local JSON when  │
│  persistent store   Hindsight down   │
└──────────────────────────────────────┘
```

### Key Classes

| Class              | File              | Purpose                                                                               |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------- |
| `Mind`             | `src/mind.ts`     | Orchestrator wrapping HindsightClient with session management and graceful degradation |
| `HindsightClient`  | `src/client.ts`   | HTTP client for Hindsight API (retain/recall/reflect/learn)                           |
| `OfflineMemoryStore` | `src/offline.ts` | Local JSON storage for offline mode, auto-syncs to Hindsight on reconnect            |
| `SemanticMemory`   | `src/semantic.ts` | Manages `.claude/memory.md` — section-based persistent store for promoted observations |
| `PromotionManager` | `src/promotion.ts` | Auto-promotes high-confidence observations (>=0.9) from Hindsight to semantic memory |
| `GeminiWrapper`    | `src/gemini/wrapper.ts` | TypeScript wrapper around Gemini CLI for code analysis during `learn`           |

### Memory Networks

| Type          | Purpose                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `world`       | Facts about external world ("Auth uses Supabase magic links")               |
| `experience`  | First-person experiences ("I fixed the redirect by...")                     |
| `opinion`     | Beliefs with confidence 0.0-1.0 ("This codebase prefers explicit patterns") |
| `observation` | Synthesized cross-session insights                                          |

### Data Flow: Observation Promotion

High-confidence opinions from `reflect()` become observations. `PromotionManager` listens for observation events on `Mind` and auto-appends them to `SemanticMemory` (`.claude/memory.md`) when confidence >= 0.9. This is how persistent knowledge accumulates without manual intervention.

### Prompt Templates

| Module                        | File                          | Purpose                                                              |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `formatTeamWorkflow()`        | `src/prompts/team-workflow.ts` | Always-injected team-first workflow instructions (teams, patterns, model routing) |
| `formatOrchestration(agents)` | `src/prompts/orchestration.ts` | Project-specific agent list (only when custom agents exist in `.claude/agents/`) |
| `formatRecentMemories()`      | `src/prompts/memories.ts`     | Formats recent memories for session context                          |
| `formatGeminiGuidance()`      | `src/prompts/gemini.ts`       | Gemini CLI usage guidance (when configured)                          |

**Team workflow** is always injected at session start via `Mind.onSessionStart()`, regardless of whether custom agents exist. This enables Claude to proactively create teams (TeamCreate + TaskCreate) for non-trivial tasks.

### MCP Tools (exposed to Claude)

- `memory_recall` — Search memories with 4-way retrieval
- `memory_reflect` — Reason about knowledge, form opinions
- `memory_retain` — Store important information in memory for future sessions

Defined in `src/mcp/tools.ts`, handled in `src/mcp/handlers.ts`.

### Hooks

- `src/hooks/inject-context.ts` — Session start: injects recalled memories as context
- `src/hooks/process-session.ts` — Session end: extracts and retains learnings
- `src/hooks/buffer-message.ts` — Buffers messages during session for manual sync via `sync-session` CLI command

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

| Trait      | Low (1)      | High (5)          |
| ---------- | ------------ | ----------------- |
| skepticism | Trusting     | Questions claims  |
| literalism | Flexible     | Precise/literal   |
| empathy    | Fact-focused | Considers emotion |

## Testing

Tests mirror source structure under `tests/`:

- `tests/unit/` — Unit tests
- `tests/integration/` — Integration tests (included in default run)
- `tests/e2e/` — E2E tests (excluded, run with `npm run test:e2e`)
- `tests/perf/` — Benchmarks (`npm run bench`)
- `tests/helpers/` — Mocks and fixtures

Vitest globals are enabled. Coverage thresholds: 80% statements/functions/lines, 75% branches. Coverage excludes `*.d.ts`, `types.ts`, and `index.ts` (re-export) files.

## Git Workflow

Keep git history clean by batching changes:

1. Make multiple related changes locally (commit each)
2. When ready to release: bump version and push together
3. Avoid pushing after every small change

```bash
# After multiple commits are ready
npm version patch -m "0.x.x"  # bumps version and creates tag
git push && git push --tags   # push everything together
```

## Graceful Degradation & Offline Mode

When Hindsight is unavailable, Mind enters offline mode:

- `recall()` searches offline storage (text-based)
- `retain()` stores to `.claude/offline-memories.json`
- `reflect()` throws (requires Hindsight)
- `attemptRecovery()` syncs offline memories and reconnects
- Session context still injected from offline store

Offline memories auto-sync to Hindsight when connection is restored.
