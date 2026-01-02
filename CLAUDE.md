# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

claude-mind is a memory integration layer between Claude Code and [Hindsight](https://github.com/vectorize-io/hindsight).

**LLM thinks. Hindsight remembers. Together = mind.**

- Claude (LLM) = thoughts, ephemeral, reasoning
- Hindsight = memory, persistent, cognitive
- Together = mind with continuity across sessions

## Hindsight Concepts

### Memory Networks

Hindsight organizes memories into four networks:

| Type | Purpose | Example |
|------|---------|---------|
| `world` | Facts about the external world | "Auth uses Supabase magic links" |
| `experience` | Claude's first-person experiences | "I fixed the redirect by moving Provider to root" |
| `opinion` | Beliefs with confidence (0.0-1.0) | "This codebase prefers explicit patterns" (0.85) |
| `observation` | Synthesized insights | "Auth changes often require navigation updates" |

### Core Operations

| Operation | What It Does |
|-----------|--------------|
| `retain()` | Stores content, extracting 5 dimensions: what, when, where, who, why |
| `recall()` | 4-way retrieval: semantic + BM25 + graph + temporal, fused with RRF |
| `reflect()` | Reasons through disposition lens, forms opinions with confidence |

### Entity & Relationship Graph

Hindsight automatically extracts:
- **Entities**: People, components, files, concepts
- **Relationships**: Temporal, semantic, causal (causes, enables, prevents)
- **Co-occurrences**: Which entities appear together

### Disposition Traits

Each memory bank has personality traits that influence `reflect()`:

| Trait | Scale | Low (1) | High (5) |
|-------|-------|---------|----------|
| Skepticism | 1-5 | Trusting | Questions claims |
| Literalism | 1-5 | Flexible interpretation | Precise/literal |
| Empathy | 1-5 | Fact-focused | Considers emotional context |

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

```
BEFORE delegating to agent:
  → Use memory_recall(task topic) to get relevant context
  → Include relevant context in the agent prompt

AFTER agent returns:
  → No explicit memory action needed
  → Transcript captures everything automatically

SESSION END:
  → Full transcript processed by Hindsight
  → Memories extracted from orchestrator + all agents
```

### Agent Types

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **code-explorer** | Analyze codebase, discover patterns | Before implementing, to understand code |
| **code-architect** | Design solutions, create blueprints | Before major changes, for system design |
| **code-reviewer** | Review quality, find issues | After changes, for quality assurance |
| **custom agents** | Project-specific needs | Defined in `.claude/agents/` |

### Key Principles

1. **Agents have NO memory access** - They stay focused on expertise
2. **Pass context explicitly** - Include recalled memories in agent prompts
3. **Transcript captures all** - Agent outputs are stored automatically
4. **Synthesize findings** - Connect insights from multiple agents

---

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

| Layer | Storage | Lifetime | Purpose |
|-------|---------|----------|---------|
| Hindsight | PostgreSQL + pgvector | Persistent | All memories with entity graphs |
| Semantic | `.claude/memory.md` | Persistent | Human-curated knowledge, promoted observations |

### Session Lifecycle

1. **Start**: Load semantic memory + recall session context → Claude starts informed
2. **During**: Orchestrate agents, use `memory_recall` when helpful
3. **End**: Full transcript processed → Hindsight extracts memories automatically

### Bank Configuration

Each project gets a memory bank with:

```javascript
{
  bankId: "project-name",
  disposition: {
    skepticism: 4,   // Question unverified claims
    literalism: 4,   // Focus on exact behavior
    empathy: 2       // Prioritize technical facts
  },
  background: "I am a developer assistant for this project..."
}
```

## Design Principles

1. **Hindsight handles memory** - No custom decay, scoring, or retrieval algorithms
2. **4 memory networks** - world, experience, opinion, observation
3. **3 operations** - retain, recall, reflect
4. **Disposition shapes reasoning** - Consistent personality across sessions
5. **Entity-aware** - Graph traversal, not just keyword matching
6. **Semantic layer** - Human-curated truth + promoted observations

## Implementation Status

Currently in Phase 0: Documentation. See `docs/PHASES.md` for roadmap.
