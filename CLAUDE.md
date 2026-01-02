# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-mind is a memory integration layer between Claude Code and [Hindsight](https://github.com/vectorize-io/hindsight).

**LLM thinks. Hindsight remembers. Together = mind.**

- Claude (LLM) = thoughts, ephemeral, reasoning
- Hindsight = memory, persistent, cognitive
- Together = mind with continuity across sessions

## Development Commands

```bash
# Build (when implemented)
npx tsc

# Test
npx vitest           # run all tests
npx vitest run       # run once without watch
npx vitest <file>    # run single test file

# Format
npx prettier --write .
npx prettier --check .

# CLI (when implemented)
npm run serve        # start MCP server
```

## Architecture

```
┌─────────────────────────────────────────┐
│            CLAUDE-MIND                  │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │   CLAUDE (ORCHESTRATOR)         │   │
│  │   Delegates to agents           │   │
│  │   Owns all memory operations    │   │
│  │   ┌────────┐ ┌────────┐        │   │
│  │   │Explorer│ │Reviewer│ + more │   │
│  │   └────────┘ └────────┘        │   │
│  └─────────────────────────────────┘   │
│                 │                       │
│                 ▼                       │
│  ┌─────────────────────────────────┐   │
│  │         HINDSIGHT                │   │
│  │  world | experience | opinion   │   │
│  │  observation | entity graph     │   │
│  │  retain() | recall() | reflect()│   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  SEMANTIC (.claude/memory.md)   │   │
│  │  Human-curated + promoted obs   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Two Memory Layers

| Layer     | Storage               | Purpose                                          |
| --------- | --------------------- | ------------------------------------------------ |
| Hindsight | PostgreSQL + pgvector | All memories with entity graphs, 4-way retrieval |
| Semantic  | `.claude/memory.md`   | Human-curated knowledge, promoted observations   |

## Hindsight Concepts

### Memory Networks

| Type          | Purpose                           | Example                                           |
| ------------- | --------------------------------- | ------------------------------------------------- |
| `world`       | Facts about external world        | "Auth uses Supabase magic links"                  |
| `experience`  | Claude's first-person experiences | "I fixed the redirect by moving Provider to root" |
| `opinion`     | Beliefs with confidence (0.0-1.0) | "This codebase prefers explicit patterns" (0.85)  |
| `observation` | Synthesized insights              | "Auth changes often require navigation updates"   |

### Core Operations

| Operation   | What It Does                                                         |
| ----------- | -------------------------------------------------------------------- |
| `retain()`  | Stores content, extracting 5 dimensions: what, when, where, who, why |
| `recall()`  | 4-way retrieval: semantic + BM25 + graph + temporal, fused with RRF  |
| `reflect()` | Reasons through disposition lens, forms opinions with confidence     |
| `learn()`   | Bootstrap memory from existing codebase (solves cold start problem)  |

### Disposition Traits

Each memory bank has personality traits that influence `reflect()`:

| Trait      | Low (1)                 | High (5)                    |
| ---------- | ----------------------- | --------------------------- |
| Skepticism | Trusting                | Questions claims            |
| Literalism | Flexible interpretation | Precise/literal             |
| Empathy    | Fact-focused            | Considers emotional context |

## Orchestrator Role

Claude operates as a **project manager**, not a developer writing code directly.

### Workflow

```
1. UNDERSTAND  → Clarify requirements, create todo list
2. RECALL      → memory_recall(topic) before delegating
3. EXPLORE     → Delegate to code-explorer agent
4. PLAN        → Delegate to code-architect agent
5. IMPLEMENT   → Implement directly OR delegate
6. REVIEW      → Delegate to code-reviewer agent
7. CONFIRM     → Summarize, get user approval
```

### Memory Ownership

**Only the orchestrator accesses memory.** Agents focus on their specialty.

- BEFORE delegating: Use `memory_recall(task topic)` to get relevant context, include in agent prompt
- AFTER agent returns: No explicit memory action needed, transcript captures everything
- SESSION END: Full transcript processed by Hindsight, memories extracted automatically

### Agent Types

| Agent              | Purpose                             | When to Use                             |
| ------------------ | ----------------------------------- | --------------------------------------- |
| **code-explorer**  | Analyze codebase, discover patterns | Before implementing, to understand code |
| **code-architect** | Design solutions, create blueprints | Before major changes, for system design |
| **code-reviewer**  | Review quality, find issues         | After changes, for quality assurance    |
| **custom agents**  | Project-specific needs              | Defined in `.claude/agents/`            |

## Design Principles

1. **Hindsight handles memory** - No custom decay, scoring, or retrieval algorithms
2. **4 memory networks** - world, experience, opinion, observation
3. **3 operations** - retain, recall, reflect
4. **Disposition shapes reasoning** - Consistent personality across sessions
5. **Entity-aware** - Graph traversal, not just keyword matching
6. **Semantic layer** - Human-curated truth + promoted observations

## Implementation Status

Currently in Phase 0: Documentation. See [docs/PHASES.md](docs/PHASES.md) for roadmap.

Planned file structure:

```
src/
├── index.ts           # Main exports
├── client.ts          # HindsightClient class
├── mind.ts            # Mind orchestrator class
├── semantic.ts        # SemanticMemory class
├── types.ts           # TypeScript types
└── mcp/
    └── server.ts      # MCP server implementation
```
