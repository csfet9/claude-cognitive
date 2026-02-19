# Core Concepts

Understanding claude-cognitive's memory architecture and how it integrates with Hindsight.

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

## Memory Networks

Hindsight organizes memories into four distinct networks:

### world

External facts about the project and its environment.

| Attribute   | Description                                             |
| ----------- | ------------------------------------------------------- |
| Purpose     | Store objective knowledge                               |
| Perspective | Third-person, factual                                   |
| Example     | "Auth uses Supabase magic links for passwordless login" |

### experience

Claude's first-person experiences working in the project.

| Attribute   | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| Purpose     | Remember what Claude did                                           |
| Perspective | First-person ("I...")                                              |
| Example     | "I fixed the redirect issue by moving AuthProvider to root layout" |

### opinion

Beliefs and judgments with explicit confidence scores.

| Attribute   | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| Purpose     | Track evolving beliefs                                                |
| Perspective | First-person with reasoning                                           |
| Confidence  | Required (0.0 to 1.0)                                                 |
| Example     | "This codebase prefers explicit error handling over try-catch" (0.85) |

Opinions evolve over time:

- New evidence can strengthen or weaken confidence
- Contradicting evidence creates tension, resolved through reflect()
- High-confidence opinions may be promoted to semantic memory

### observation

Synthesized insights from reflect() that span multiple experiences.

| Attribute   | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| Purpose     | Cross-session learning                                        |
| Perspective | Meta-level insight                                            |
| Example     | "Auth changes often require corresponding navigation updates" |

---

## Core Operations

### retain() - Store with 5 Dimensions

When content is stored, Hindsight's LLM extracts five dimensions:

| Dimension | Description             | Example                                      |
| --------- | ----------------------- | -------------------------------------------- |
| **what**  | Complete description    | "Fixed auth redirect by moving AuthProvider" |
| **when**  | Temporal context        | "January 2, 2025 during afternoon session"   |
| **where** | Location (files, paths) | "src/app/\_layout.tsx at line 15"            |
| **who**   | Entities involved       | "AuthProvider, React Context, Supabase"      |
| **why**   | Motivation, reasoning   | "User stuck on infinite redirect loop"       |

Additionally, retain() automatically:

- Extracts and resolves entities
- Identifies causal relationships (causes, enables, prevents)
- Creates temporal and semantic links to existing memories
- Tracks entity co-occurrences

### recall() - 4-Way Parallel Retrieval

```
Query: "Why was AuthProvider moved?"
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼
 Semantic   BM25      Graph    Temporal
  Search   Search   Traversal   Search
    │         │         │         │
    └─────────┴─────────┴─────────┘
              │
              ▼
        RRF Fusion
              │
              ▼
      Cross-Encoder Reranking
              │
              ▼
         Results
```

| Strategy     | Method                       | Best For                         |
| ------------ | ---------------------------- | -------------------------------- |
| **Semantic** | Vector similarity (pgvector) | Conceptual matches, paraphrasing |
| **BM25**     | Full-text keyword search     | Exact names, technical terms     |
| **Graph**    | Entity traversal (MPFP/BFS)  | Indirect relationships           |
| **Temporal** | Time-range + semantic        | Historical queries               |

Results are fused using Reciprocal Rank Fusion (RRF), then reranked with a neural cross-encoder.

### reflect() - Opinion Formation

Process:

1. Recall relevant memories (world, experience, opinion)
2. Load bank disposition (skepticism, literalism, empathy)
3. LLM reasons through disposition lens
4. Extract new opinions with confidence
5. Store opinions (influences future reflects)
6. Return reasoned response with citations

---

## Entity Graph

Hindsight automatically builds a knowledge graph:

### Entities

Extracted from memory content:

- **People**: Names, roles, relationships
- **Components**: React components, classes, modules
- **Files**: Source files, paths
- **Concepts**: Abstract ideas, patterns, decisions

### Links

| Link Type   | Description                       |
| ----------- | --------------------------------- |
| `temporal`  | Memories close in time            |
| `semantic`  | Memories with similar meaning     |
| `entity`    | Memories sharing an entity        |
| `causes`    | This memory caused another        |
| `caused_by` | This memory was caused by another |
| `enables`   | This memory enables another       |
| `prevents`  | This memory prevents another      |

### Co-occurrences

Track which entities appear together:

- "AuthProvider" often appears with "React Context" → related concepts
- "login.tsx" often appears with "supabase.ts" → related files

---

## Bank Disposition

Each project gets a memory bank with personality traits:

```javascript
{
  bankId: "my-project",
  disposition: {
    skepticism: 4,   // How much to question claims
    literalism: 4,   // How precisely to interpret
    empathy: 2       // How much to consider emotional context
  },
  background: "I am a developer assistant for a React Native app..."
}
```

### Trait Effects

| Trait          | Low (1)                 | High (5)                                    |
| -------------- | ----------------------- | ------------------------------------------- |
| **Skepticism** | Trusts information      | Questions claims, looks for inconsistencies |
| **Literalism** | Flexible interpretation | Precise, exact interpretation               |
| **Empathy**    | Focuses on facts        | Considers emotional context                 |

### Recommended Configurations

| Use Case          | Skepticism | Literalism | Empathy |
| ----------------- | ---------- | ---------- | ------- |
| Code Review       | 4          | 5          | 2       |
| Bug Investigation | 4          | 4          | 2       |
| Documentation     | 3          | 3          | 3       |
| User Support      | 2          | 2          | 5       |

---

## Memory Layers

### Hindsight (PostgreSQL + pgvector)

- All memories with entity graphs
- 4-way retrieval with RRF fusion
- Opinion formation and evolution
- Cross-encoder reranking

### Offline Storage (.claude/offline-memories.json)

- Local JSON storage when Hindsight unavailable
- Text-based search for recall
- Auto-syncs to Hindsight on reconnect
- Cleared after successful sync

---

## Session Lifecycle

### Session Start

1. Inject team-first workflow instructions (always)
2. Inject agent orchestration (when custom agents exist)
3. Recall recent experiences from Hindsight (or offline store)
4. Write context to `.claude/rules/session-context.md`

### During Session

- Claude uses `memory_recall` when helpful
- Claude uses `memory_reflect` to reason
- All work captured in session transcript

### Session End

1. Process full transcript with retain()
2. Call reflect() to form observations
3. Store to offline if Hindsight unavailable

---

## Team-First Workflow

Claude operates as a **team lead**, proactively creating teams for non-trivial tasks. Team workflow instructions are always injected at session start — no custom agents required.

### When to Create a Team

**Create a team** when the task involves:
- Multi-file changes touching 3+ files
- Parallel workstreams (e.g., frontend + backend)
- Deep exploration of unfamiliar subsystems
- Tasks that risk losing context during compaction

**Handle directly** (no team needed):
- Single-file edits under ~50 lines
- Small bug fixes, typos, config changes
- Quick refactors where context is already understood

### Standard Team Patterns

| Pattern      | Steps                                    |
| ------------ | ---------------------------------------- |
| **Feature**  | explore → plan → implement → test        |
| **Bugfix**   | explore → fix → verify                   |
| **Refactor** | map → plan → execute → verify            |

### Model Routing

| Model      | Use For                                                       |
| ---------- | ------------------------------------------------------------- |
| **haiku**  | Exploration, file search, simple lookups — fast and cheap     |
| **sonnet** | Implementation, code review, test writing — best balance      |
| **opus**   | Complex architecture, subtle bugs — use when quality critical |

### Context Preservation

The main session's context can be lost during compaction. Teams mitigate this:
- **Delegate early** — spawn agents before context grows too large
- **TaskList as shared state** — tasks persist across compaction
- **Capture decisions in tasks** — include context in task descriptions

### Why Agents Don't Access Memory

| Reason                 | Benefit                                       |
| ---------------------- | --------------------------------------------- |
| **Simplicity**         | Agent templates stay focused                  |
| **Consistency**        | Memory patterns controlled in one place       |
| **Context efficiency** | Agents don't carry memory overhead            |
| **Quality control**    | Orchestrator decides what's worth remembering |
| **Transcript capture** | Everything agents output is captured anyway   |

---

## Performance Considerations

### Budget Levels

| Budget | Tokens | Graph Hops | Best For               |
| ------ | ------ | ---------- | ---------------------- |
| `low`  | ~2048  | 1          | Quick lookups          |
| `mid`  | ~4096  | 2          | Most queries (default) |
| `high` | ~8192  | 3+         | Comprehensive research |

### Graceful Degradation & Offline Mode

When Hindsight is unavailable:

- recall() searches offline storage (text-based)
- retain() stores to `.claude/offline-memories.json`
- reflect() throws error (requires Hindsight)
- attemptRecovery() syncs offline memories on reconnect

Offline memories auto-sync when Hindsight becomes available.
