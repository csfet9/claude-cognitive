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
│  - Graceful degradation + offline    │
│  - Agent context preparation         │
├──────────────────────────────────────┤
│         HindsightClient              │
│  retain() | recall() | reflect()     │
│  4-way retrieval: semantic + BM25    │
│               + graph + temporal     │
├──────────────────────────────────────┤
│       OfflineMemoryStore             │
│  .claude/offline-memories.json       │
│  Local storage when Hindsight down   │
└──────────────────────────────────────┘
```

### Key Classes

| Class                | File             | Purpose                                                                                |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `Mind`               | `src/mind.ts`    | Orchestrator wrapping HindsightClient with session management and graceful degradation |
| `HindsightClient`    | `src/client.ts`  | HTTP client for Hindsight API (retain/recall/reflect/learn)                            |
| `OfflineMemoryStore` | `src/offline.ts` | Local JSON storage for offline mode, auto-syncs to Hindsight on reconnect              |

### Memory Networks

| Type          | Purpose                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `world`       | Facts about external world ("Auth uses Supabase magic links")               |
| `experience`  | First-person experiences ("I fixed the redirect by...")                     |
| `opinion`     | Beliefs with confidence 0.0-1.0 ("This codebase prefers explicit patterns") |
| `observation` | Synthesized cross-session insights                                          |

### MCP Tools (exposed to Claude)

- `memory_recall` - Search memories with 4-way retrieval
- `memory_reflect` - Reason about knowledge, form opinions

Defined in `src/mcp/tools.ts`, handled in `src/mcp/handlers.ts`.

## Project Structure

```
src/
├── mind.ts              # Mind orchestrator
├── client.ts            # HindsightClient HTTP client
├── offline.ts           # OfflineMemoryStore (local JSON storage)
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
│   ├── templates.ts     # Built-in: orchestrator, deep-worker, plan-executor, + 8 more
│   ├── agent-files.ts   # Generates .claude/agents/*.md from built-in templates
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

| Trait      | Low (1)      | High (5)          |
| ---------- | ------------ | ----------------- |
| skepticism | Trusting     | Questions claims  |
| literalism | Flexible     | Precise/literal   |
| empathy    | Fact-focused | Considers emotion |

## Testing

Tests mirror source structure under `tests/`:

- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests (not excluded from default run)
- `tests/e2e/` - E2E tests (excluded, run with `npm run test:e2e`)
- `tests/perf/` - Benchmarks (`npm run bench`)
- `tests/helpers/` - Mocks and fixtures

Vitest globals are enabled. Coverage thresholds: 80% statements/functions/lines, 75% branches.

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

<!-- claude-cognitive:start -->
## Claude Cognitive

### Pre-Commit Security Review

Before ANY `git commit`, you MUST launch the `security-code-reviewer` agent to review all staged changes. Wait for completion. Address critical/high issues before committing. Do not skip.

### Agent Orchestration

You are the **orchestrator**. Delegate ALL coding to agents — never write code directly.

| Role | Agents |
|------|--------|
| Explore | `explorer`, `researcher` |
| Plan | `strategic-planner`, `pre-analyzer` |
| Implement | `task-executor`, `deep-worker`, or domain agents in `.claude/agents/` |
| Review | `plan-validator`, `advisor`, security-code-reviewer |

Workflow: Explore → Clarify → Plan → Implement → Review. Launch multiple agents in parallel when possible. Only YOU access memory — agents get context from you.

### Model Routing

When delegating to agents, use these model assignments for cost-effective execution:

| Agent | Model | Cost | Categories |
|-------|-------|------|------------|
| `orchestrator` | **opus** | expensive | reasoning, architecture |
| `deep-worker` | **opus** | expensive | implementation, reasoning |
| `plan-executor` | **sonnet** | standard | implementation |
| `strategic-planner` | **opus** | expensive | architecture |
| `advisor` | **opus** | expensive | reasoning, architecture |
| `researcher` | **haiku** | cheap | research, exploration |
| `explorer` | **haiku** | cheap | exploration |
| `pre-analyzer` | **opus** | expensive | reasoning, architecture |
| `plan-validator` | **sonnet** | standard | review |
| `task-executor` | **sonnet** | standard | implementation |
| `vision-analyzer` | **haiku** | cheap | exploration |
| `advisor` | **opus** | expensive | reasoning, architecture |
| `deep-worker` | **opus** | expensive | implementation, reasoning |
| `explorer` | **haiku** | cheap | exploration |
| `graceful-degradation-reviewer` | **sonnet** | standard | review, debugging |
| `hooks-integrator` | **sonnet** | standard | implementation |
| `mcp-tool-developer` | **sonnet** | standard | implementation |
| `memory-system-expert` | **opus** | expensive | reasoning, architecture |
| `orchestrator` | **opus** | expensive | reasoning, architecture |
| `plan-executor` | **sonnet** | standard | implementation |
| `plan-validator` | **sonnet** | standard | review |
| `pre-analyzer` | **opus** | expensive | reasoning, architecture |
| `researcher` | **haiku** | cheap | research, exploration |
| `security-code-reviewer` | **opus** | expensive | - |
| `strategic-planner` | **opus** | expensive | architecture |
| `task-executor` | **sonnet** | standard | implementation |
| `test-coverage-specialist` | **sonnet** | standard | testing |
| `vision-analyzer` | **haiku** | cheap | exploration |

### Task Category Routing

Classify the task, then route to the right model:

| Category | Model | Use For |
|----------|-------|---------|
| exploration | **haiku** | File search, pattern matching, codebase scanning |
| research | **haiku** | Doc lookup, web search, quick questions |
| implementation | **sonnet** | Write code, tests, standard features |
| review | **sonnet** | Code review, quality checks |
| testing | **sonnet** | Write and run tests |
| debugging | **sonnet** | Trace bugs, fix issues |
| architecture | **sonnet** | Design, planning (escalate to opus for novel problems) |
| security | **opus** | Security review, vulnerability analysis |
| reasoning | **opus** | Deep system reasoning, complex memory operations |

**Cost optimization**: Fire cheap (haiku) exploration agents in parallel FIRST to gather context, then delegate to the appropriate model for execution.

### Agent Teams

For complex multi-agent work, use Agent Teams (Shift+Tab for delegate mode):

**When to use teams vs subagents:**
- **Subagents**: Focused tasks where only the result matters (exploration, single-file review)
- **Agent Teams**: Complex work requiring discussion between teammates (cross-layer refactoring, competing hypotheses, parallel feature development)

**Team composition pattern:**
1. Lead (you): Coordinates, never writes code. Use delegate mode (Shift+Tab)
2. Explorers (haiku): 1-3 teammates for parallel codebase discovery
3. Implementers (sonnet): Teammates that own specific files/features
4. Reviewer (sonnet/opus): Validates work before completion

**Model selection for teammates:**
- Specify model when spawning: "Create a teammate using Sonnet to implement the auth module"
- Use haiku for research-only teammates
- Use opus only for security review or novel architecture teammates

<!-- claude-cognitive:end -->
