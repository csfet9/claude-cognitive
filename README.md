# claude-mind

Human-inspired memory system for Claude Code, powered by [Hindsight](https://github.com/vectorize-io/hindsight).

**LLM thinks. Hindsight remembers. Together = mind.**

---

## The Vision

```
┌─────────────────────────────────────────────────────────────┐
│                  CLAUDE CODE + HINDSIGHT                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Claude (LLM)               Hindsight                      │
│   ────────────               ─────────                      │
│   - Context clears           - Persists forever             │
│   - Thinks, reasons          - Stores, retrieves, reflects  │
│   - Current session          - Across all sessions          │
│   - Reconstructs meaning     - Provides rich context        │
│                                                             │
│              └──────── work together ────────┘              │
│                          = MIND                             │
└─────────────────────────────────────────────────────────────┘
```

The LLM doesn't need to "remember" - it **thinks**.
Hindsight doesn't need to "think" - it **remembers**.
Together, they form a **mind** with continuity across sessions.

---

## How It Works

### Three Core Operations

| Operation | What Hindsight Does |
|-----------|---------------------|
| **Retain** | Stores experiences, extracting 5 dimensions: what, when, where, who, why. Builds entity graphs and causal relationships automatically. |
| **Recall** | 4-way parallel retrieval: semantic similarity + keyword matching + graph traversal + temporal filtering. Results fused and reranked. |
| **Reflect** | Reasons about accumulated knowledge through the bank's disposition. Forms opinions with confidence scores. Generates observations. |

### Four Memory Networks

| Type | Purpose | Example |
|------|---------|---------|
| `world` | Facts about the codebase and external world | "Auth uses Supabase magic links" |
| `experience` | What Claude did (first-person) | "I fixed the redirect by moving AuthProvider to root" |
| `opinion` | Beliefs with confidence scores (0.0-1.0) | "This codebase prefers explicit error handling" (0.85) |
| `observation` | Synthesized cross-session insights | "Auth changes often require corresponding navigation updates" |

### Bank Disposition

Each project gets a memory bank with personality traits that shape how `reflect()` reasons:

```javascript
{
  bankId: "my-project",
  disposition: {
    skepticism: 4,   // 1-5: trusting → questions claims
    literalism: 4,   // 1-5: flexible → precise interpretation
    empathy: 2       // 1-5: fact-focused → considers emotional context
  },
  background: "I am a developer assistant for a React Native app..."
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLAUDE-MIND                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              CLAUDE (ORCHESTRATOR)                     │ │
│  │                                                        │ │
│  │  • Manages workflow, delegates to agents               │ │
│  │  • Owns all memory operations                          │ │
│  │  • Synthesizes agent findings                          │ │
│  │                                                        │ │
│  │    ┌──────────┐  ┌──────────┐  ┌──────────┐          │ │
│  │    │ Explorer │  │ Architect│  │ Reviewer │ + custom │ │
│  │    └──────────┘  └──────────┘  └──────────┘          │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                     HINDSIGHT                          │ │
│  │  ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │  │  world  │ │experience │ │ opinion │ │observation│  │ │
│  │  └─────────┘ └───────────┘ └─────────┘ └───────────┘  │ │
│  │                    │                                   │ │
│  │     ┌──────────────┼──────────────┐                   │ │
│  │     ▼              ▼              ▼                   │ │
│  │  retain()      recall()      reflect()                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              SEMANTIC (.claude/memory.md)              │ │
│  │           Human-curated + promoted observations        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Two Memory Layers

| Layer | Storage | Purpose |
|-------|---------|---------|
| **Hindsight** | PostgreSQL + pgvector | All memories with entity graphs, 4-way retrieval, opinion formation |
| **Semantic** | `.claude/memory.md` | Human-curated project knowledge, promoted observations |

---

## Claude as Orchestrator

Claude operates as a **project manager**, delegating to specialized agents rather than implementing everything directly.

### Workflow

```
1. UNDERSTAND  → Clarify requirements, create task breakdown
2. RECALL      → memory_recall(topic) before delegating
3. EXPLORE     → Delegate to code-explorer agent
4. PLAN        → Delegate to code-architect agent
5. IMPLEMENT   → Implement directly OR delegate
6. REVIEW      → Delegate to code-reviewer agent
7. CONFIRM     → Summarize and get user approval
```

### Why This Pattern?

| Aspect | Benefit |
|--------|---------|
| **Centralized memory** | Only orchestrator accesses memory, agents stay focused |
| **Automatic capture** | Session transcript captures all agent outputs |
| **Context efficiency** | Agents don't carry memory overhead |
| **Quality control** | Orchestrator decides what context agents need |

### Agent Types

| Agent | Purpose |
|-------|---------|
| **code-explorer** | Analyze codebase, discover patterns, trace features |
| **code-architect** | Design solutions, create implementation blueprints |
| **code-reviewer** | Review quality, find issues, assess implementation |
| **custom agents** | Project-specific specialists (defined in `.claude/agents/`) |

---

## Session Lifecycle

1. **Start**: Load semantic memory + recall relevant context → Claude starts informed
2. **During**: Claude orchestrates agents, uses `memory_recall` when helpful
3. **End**: Full transcript processed → Hindsight extracts memories automatically

---

## Semantic Memory

The `.claude/memory.md` file serves as:
- **Human-curated truth**: Project-specific knowledge maintained by developers
- **Promoted observations**: High-confidence insights from Hindsight's reflect operation
- **Always loaded**: Injected into Claude's context at every session start

```markdown
## Tech Stack
- React Native with Expo
- Supabase for auth and database
- NativeWind for styling

## Key Decisions
- Magic link auth chosen over passwords for better mobile UX
- Zustand for state management (simpler than Redux for this scale)

## Critical Paths
- Auth flow: src/lib/supabase.ts → src/providers/AuthProvider.tsx
```

---

## Design Principles

1. **Hindsight handles memory** - No custom decay formulas, scoring algorithms, or retrieval logic
2. **4 memory networks** - world, experience, opinion, observation (not arbitrary categories)
3. **3 operations** - retain, recall, reflect (the cognitive primitives)
4. **Disposition shapes reasoning** - Consistent personality across sessions via traits
5. **Entity-aware** - Graph traversal finds indirect connections, not just keywords
6. **Local semantic truth** - Human-curated `.claude/memory.md` as ground truth

---

## Project Structure

```
claude-mind/
├── CLAUDE.md                    # Project instructions for Claude Code
├── README.md                    # This file
├── package.json                 # Project configuration
└── docs/
    ├── ARCHITECTURE.md          # Technical design deep-dive
    ├── PHASES.md                # Implementation roadmap
    └── API.md                   # API reference
```

---

## Status

**Phase 0: Documentation** - Establishing architecture before implementation.

See [docs/PHASES.md](./docs/PHASES.md) for the implementation roadmap.

---

## Requirements

- [Hindsight](https://github.com/vectorize-io/hindsight) server running
- Node.js 18+

---

## License

MIT
