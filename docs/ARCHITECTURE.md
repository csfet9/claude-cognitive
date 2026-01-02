# Architecture

Technical design for claude-mind's integration with Hindsight.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLAUDE-MIND                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                 CLAUDE (ORCHESTRATOR)                          │ │
│  │                                                                │ │
│  │  • Manages session workflow                                    │ │
│  │  • Delegates to specialized agents                             │ │
│  │  • Owns all memory operations                                  │ │
│  │  • Synthesizes agent findings                                  │ │
│  │                                                                │ │
│  │     ┌──────────┐   ┌──────────┐   ┌──────────┐               │ │
│  │     │ Explorer │   │ Architect│   │ Reviewer │  ... agents   │ │
│  │     └──────────┘   └──────────┘   └──────────┘               │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                         HINDSIGHT                              │ │
│  │                                                                │ │
│  │  Memory Networks                                               │ │
│  │  ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌───────────┐         │ │
│  │  │  world  │ │experience │ │ opinion │ │observation│         │ │
│  │  │ (facts) │ │  ("I")    │ │(beliefs)│ │ (insights)│         │ │
│  │  └────┬────┘ └─────┬─────┘ └────┬────┘ └─────┬─────┘         │ │
│  │       └────────────┴────────────┴────────────┘                │ │
│  │                         │                                      │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │                    Entity Graph                          │  │ │
│  │  │  Entities: people, components, files, concepts           │  │ │
│  │  │  Links: temporal, semantic, causal, entity-based         │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                         │                                      │ │
│  │       ┌─────────────────┼─────────────────┐                   │ │
│  │       ▼                 ▼                 ▼                   │ │
│  │  ┌─────────┐       ┌─────────┐       ┌─────────┐             │ │
│  │  │ retain  │       │ recall  │       │ reflect │             │ │
│  │  └─────────┘       └─────────┘       └─────────┘             │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                 SEMANTIC MEMORY                                │ │
│  │                 .claude/memory.md                              │ │
│  │                 Human-curated + promoted observations          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Memory Networks

Hindsight organizes memories into four distinct networks, each serving a different cognitive purpose:

### world

External facts about the project and its environment.

| Attribute | Description |
|-----------|-------------|
| Purpose | Store objective knowledge |
| Perspective | Third-person, factual |
| Confidence | Not applicable |
| Example | "Auth uses Supabase magic links for passwordless login" |

### experience

Claude's first-person experiences working in the project.

| Attribute | Description |
|-----------|-------------|
| Purpose | Remember what Claude did |
| Perspective | First-person ("I...") |
| Confidence | Not applicable |
| Example | "I fixed the redirect issue by moving AuthProvider to root layout" |

### opinion

Beliefs and judgments with explicit confidence scores.

| Attribute | Description |
|-----------|-------------|
| Purpose | Track evolving beliefs |
| Perspective | First-person with reasoning |
| Confidence | Required (0.0 to 1.0) |
| Example | "This codebase prefers explicit error handling over try-catch" (0.85) |

Opinions evolve over time:
- New evidence can strengthen or weaken confidence
- Contradicting evidence creates tension, resolved through reflect()
- High-confidence opinions may be promoted to semantic memory

### observation

Synthesized insights from reflect() that span multiple experiences.

| Attribute | Description |
|-----------|-------------|
| Purpose | Cross-session learning |
| Perspective | Meta-level insight |
| Confidence | Implicit in creation |
| Example | "Auth changes often require corresponding navigation updates" |

---

## Core Operations

### retain() - Store with 5 Dimensions

When content is stored, Hindsight's LLM extracts five dimensions:

| Dimension | Description | Example |
|-----------|-------------|---------|
| **what** | Complete, detailed description of what happened | "Fixed auth redirect by moving AuthProvider to wrap root layout in _layout.tsx" |
| **when** | Temporal context (dates, times, durations) | "January 2, 2025 during afternoon session" |
| **where** | Location (files, paths, lines) | "src/app/_layout.tsx at line 15" |
| **who** | Entities involved (people, components, concepts) | "AuthProvider, React Context, Supabase" |
| **why** | Motivation, emotional context, reasoning | "User was stuck on infinite redirect loop, needed auth state before navigation" |

Additionally, retain() automatically:
- Extracts and resolves entities (deduplicating "AuthProvider" vs "the auth provider")
- Identifies causal relationships (causes, enables, prevents)
- Creates temporal and semantic links to existing memories
- Tracks entity co-occurrences

### recall() - 4-Way Parallel Retrieval

Recall uses four search strategies in parallel:

```
Query: "Why was AuthProvider moved?"
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼         ▼
Semantic    BM25      Graph    Temporal
 Search    Search   Traversal   Search
    │         │         │         │
    └─────────┴─────────┴─────────┘
              │
              ▼
        RRF Fusion
              │
              ▼
      Cross-Encoder
        Reranking
              │
              ▼
         Results
```

| Strategy | Method | Best For |
|----------|--------|----------|
| **Semantic** | Vector similarity (pgvector) | Conceptual matches, paraphrasing |
| **BM25** | Full-text keyword search | Exact names, technical terms |
| **Graph** | Entity traversal (MPFP/BFS) | Indirect relationships |
| **Temporal** | Time-range + semantic | Historical queries |

Results are fused using Reciprocal Rank Fusion (RRF), then reranked with a neural cross-encoder for final ordering.

### reflect() - Opinion Formation

Reflect reasons about accumulated knowledge through the bank's disposition:

```
┌──────────────────────────────────────────────────────────────────┐
│                        reflect(query)                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Recall relevant memories (world, experience, opinion)        │
│                           │                                      │
│                           ▼                                      │
│  2. Load bank disposition                                        │
│     • skepticism: how much to question claims                    │
│     • literalism: how precisely to interpret                     │
│     • empathy: how much to consider emotional context            │
│                           │                                      │
│                           ▼                                      │
│  3. LLM reasons through disposition lens                         │
│     "Based on what I know and who I am..."                       │
│                           │                                      │
│                           ▼                                      │
│  4. Extract new opinions with confidence                         │
│     "I believe X because Y" (confidence: 0.8)                    │
│                           │                                      │
│                           ▼                                      │
│  5. Store opinions asynchronously                                │
│     (influences future reflects)                                 │
│                           │                                      │
│                           ▼                                      │
│  6. Return reasoned response                                     │
│     Text + citations to memories used                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

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

Connections between memory units:

| Link Type | Description |
|-----------|-------------|
| `temporal` | Memories close in time |
| `semantic` | Memories with similar meaning |
| `entity` | Memories sharing an entity |
| `causes` | This memory caused another |
| `caused_by` | This memory was caused by another |
| `enables` | This memory enables another |
| `prevents` | This memory prevents another |

### Co-occurrences

Track which entities appear together:
- "AuthProvider" often appears with "React Context" → related concepts
- "login.tsx" often appears with "supabase.ts" → related files
- Enables implicit relationship discovery

---

## Bank Configuration

Each project gets a memory bank with identity:

```javascript
{
  bankId: "my-project",

  // Disposition traits (1-5 each)
  disposition: {
    skepticism: 4,   // High: questions claims, looks for issues
    literalism: 4,   // High: precise interpretation, exact wording
    empathy: 2       // Low: focuses on facts over emotional context
  },

  // Natural language identity
  background: `I am a developer assistant for a React Native app
    using Expo and Supabase. I prefer explicit patterns over magic,
    and I always verify assumptions before making changes.`
}
```

### Disposition Effects

| Trait | Low (1) | High (5) |
|-------|---------|----------|
| **Skepticism** | Trusts information at face value | Questions claims, looks for inconsistencies |
| **Literalism** | Flexible interpretation, reads between lines | Precise, exact interpretation |
| **Empathy** | Focuses on facts and data | Considers emotional context and circumstances |

### Recommended Configurations

| Use Case | Skepticism | Literalism | Empathy |
|----------|------------|------------|---------|
| Code Review | 4 | 5 | 2 |
| Bug Investigation | 4 | 4 | 2 |
| Documentation | 3 | 3 | 3 |
| User Support | 2 | 2 | 5 |

---

## Semantic Memory

Local file `.claude/memory.md` for persistent, human-curated knowledge.

### Purpose

1. **Human curation**: Developers can edit directly
2. **Promoted observations**: High-confidence insights from Hindsight
3. **Always loaded**: Injected at every session start
4. **Ground truth**: Takes precedence over conflicting Hindsight memories

### Structure

```markdown
## Tech Stack
- React Native with Expo (SDK 51)
- Supabase for auth and database
- NativeWind for styling

## Key Decisions
- Magic link auth chosen over passwords for better mobile UX
- Zustand for state management (simpler than Redux for this scale)
- File-based routing via expo-router

## Critical Paths
- Auth flow: src/lib/supabase.ts → src/providers/AuthProvider.tsx
- Navigation: src/app/_layout.tsx (root layout)

## Patterns
- All API calls go through src/lib/api.ts
- Errors handled with custom ErrorBoundary component
- Feature flags via environment variables
```

### Promotion Flow

```
High-confidence opinion (>0.9)
        │
        ▼
  reflect() generates observation
        │
        ▼
  Observation persists across sessions
        │
        ▼
  Human reviews and promotes to semantic
        │
        ▼
  Added to .claude/memory.md
```

---

## Session Lifecycle

### onSessionStart()

1. Load `.claude/memory.md` as base context
2. Recall recent experiences and relevant opinions
3. Format as context injection for Claude

### onContextChange(context)

Triggered when:
- File is opened/changed
- Entity is mentioned in conversation
- Error occurs
- User asks about something

Process:
1. Extract triggers from context (file, entities, keywords, errors)
2. Recall relevant memories with entity-awareness
3. Return triggered memories for context enrichment

### onSessionEnd(transcript)

1. Call `reflect()` to form observations about the session
2. Store new experiences (what Claude did)
3. Update entity relationships based on session
4. Optionally flag high-confidence observations for promotion

---

## Orchestrator Pattern

Claude operates as a **project manager**, not a developer writing code directly. This pattern centralizes memory management and enables effective delegation.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Claude orchestrates** | Manages workflow, doesn't implement directly |
| **Agents specialize** | Each agent has domain expertise |
| **Memory is centralized** | Only orchestrator accesses memory |
| **Transcript captures all** | Agent outputs stored via session processing |

### Orchestrator Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. UNDERSTAND                                                      │
│     └── Clarify requirements with user                              │
│     └── Create task breakdown (todo list)                           │
│                                                                     │
│  2. RECALL (before delegating)                                      │
│     └── memory_recall(task topic)                                   │
│     └── Get relevant context from past sessions                     │
│                                                                     │
│  3. EXPLORE                                                         │
│     └── Delegate to code-explorer agent                             │
│     └── Agent analyzes codebase, returns findings                   │
│                                                                     │
│  4. PLAN                                                            │
│     └── Delegate to code-architect agent                            │
│     └── Agent designs solution, returns blueprint                   │
│     └── Get user approval                                           │
│                                                                     │
│  5. IMPLEMENT                                                       │
│     └── Implement directly OR delegate to implementation agent      │
│     └── Depends on complexity and project preferences               │
│                                                                     │
│  6. REVIEW                                                          │
│     └── Delegate to code-reviewer agent                             │
│     └── Agent reviews quality, returns issues                       │
│                                                                     │
│  7. CONFIRM                                                         │
│     └── Summarize what was done                                     │
│     └── Get user confirmation                                       │
│                                                                     │
│  (Session end: transcript processed automatically)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Types

Projects can use both built-in and custom agents:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **code-explorer** | Analyze codebase, discover patterns, trace features | Before implementing, to understand existing code |
| **code-architect** | Design solutions, create implementation blueprints | Before major changes, for system design |
| **code-reviewer** | Review quality, find issues, assess implementation | After changes, for quality assurance |
| **custom agents** | Domain-specific specialists | Project-specific needs |

### Memory Flow in Orchestration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MEMORY FLOW                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ORCHESTRATOR (Claude)                                              │
│  ════════════════════                                               │
│                                                                     │
│  Before delegating:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  memory_recall("dark mode theming")                          │   │
│  │  → "Last month attempted NativeWind dark mode, had issues    │   │
│  │     with status bar. Solution was to use colorScheme prop."  │   │
│  │                                                               │   │
│  │  Include context in agent prompt:                             │   │
│  │  "Note: We previously had issues with status bar in dark     │   │
│  │   mode. The solution involved colorScheme prop."             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  AGENT (code-explorer)                                              │
│  ═════════════════════                                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Agent executes task                                         │   │
│  │  Agent has NO memory access                                  │   │
│  │  Agent returns findings in response                          │   │
│  │  (captured in session transcript)                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ORCHESTRATOR (Claude)                                              │
│  ════════════════════                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Receives agent findings                                     │   │
│  │  No explicit memory action needed                            │   │
│  │  Continues workflow or delegates next task                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  SESSION END (automatic)                                            │
│  ═══════════════════════                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Hook processes full transcript                              │   │
│  │  Includes: orchestrator decisions + all agent outputs        │   │
│  │  Hindsight extracts memories from everything                 │   │
│  │  reflect() forms cross-agent observations                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Agents Don't Access Memory

| Reason | Benefit |
|--------|---------|
| **Simplicity** | Agent templates stay focused on expertise |
| **Consistency** | Memory patterns controlled in one place |
| **Context efficiency** | Agents don't carry memory overhead |
| **Quality control** | Orchestrator decides what's worth remembering |
| **Transcript capture** | Everything agents output is captured anyway |

### Agent Definition

Agents are defined in `.claude/agents/` with a simple structure:

```markdown
# Agent: code-explorer

## Mission
Deeply analyze existing codebase features by tracing execution paths,
mapping architecture layers, and documenting dependencies.

## Tools Available
- Glob, Grep, Read (file analysis)
- LSP (go to definition, find references)
- WebFetch (documentation lookup)

## Output Format
Return findings in structured format:
- Key files discovered
- Architecture patterns identified
- Dependencies mapped
- Recommendations for next steps

## Constraints
- Read-only (no file modifications)
- No memory operations (orchestrator handles)
- Focus on assigned exploration task
```

---

## Data Flow

### Storing an Experience

```
User: "I fixed the auth redirect by moving AuthProvider to root"
                            │
                            ▼
                    retain(content)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Extract        Extract       Classify
       5 dimensions    entities     fact_type
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                    Generate embedding
                            │
                            ▼
                    Create memory links
                    (temporal, semantic, entity)
                            │
                            ▼
                    Store in PostgreSQL
```

### Retrieving Memories

```
Query: "How does auth work in this project?"
                            │
                            ▼
                    Parse query intent
                            │
              ┌─────────────┼─────────────┬─────────────┐
              ▼             ▼             ▼             ▼
          Semantic        BM25         Graph       Temporal
           search        search      traversal      search
              │             │             │             │
              └─────────────┼─────────────┴─────────────┘
                            │
                            ▼
                     RRF Fusion
                            │
                            ▼
                 Cross-encoder rerank
                            │
                            ▼
                   Return top-k results
                   with relevance scores
```

---

## Error Handling

### Hindsight Unavailable

- Semantic memory still works (local file)
- Operations gracefully degrade
- Errors logged, session continues
- Memories queued for later (if implemented)

### Entity Resolution Conflicts

- Hindsight deduplicates automatically
- Canonical names resolved from aliases
- Co-occurrence patterns inform resolution

### Opinion Conflicts

- New evidence updates confidence
- Contradictions trigger re-evaluation in reflect()
- Low-confidence opinions may be forgotten

---

## Performance Considerations

### Token Budget

Hindsight manages context budget in tokens, not result count:

| Budget | Tokens | Best For |
|--------|--------|----------|
| `low` | ~2048 | Quick lookups, focused answers |
| `mid` | ~4096 | Most queries (default) |
| `high` | ~8192 | Comprehensive research |

### Retrieval Depth

The `budget` parameter controls search thoroughness:

| Budget | Graph Hops | Candidate Pool | Latency |
|--------|------------|----------------|---------|
| `low` | 1 | Small | Fast |
| `mid` | 2 | Medium | Moderate |
| `high` | 3+ | Large | Slower |

---

## Security

- Bank isolation is strict (no cross-bank data access)
- API key authentication (when configured)
- Sensitive content should use meta-filtering before storage
- No PII in default configurations

---

## Claude Code Integration (Hybrid Approach)

claude-mind integrates with Claude Code through a hybrid architecture combining automatic capture with active tools.

### Design Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Storage should be automatic** | Claude shouldn't remember to remember |
| **Recall should be available** | Claude can actively query when helpful |
| **Context should be injected** | Claude starts sessions informed |
| **Memory should be invisible** | User shouldn't notice it working |

### Integration Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE SESSION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────────────────────────────┐│
│  │  Session Start  │───▶│  Hook: claude-mind inject-context       ││
│  │     Hook        │    │  → Loads semantic memory                ││
│  └─────────────────┘    │  → Recalls recent experiences           ││
│                         │  → Injects into system prompt           ││
│                         └─────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────────────────────────────┐│
│  │   MCP Server    │───▶│  Tools available to Claude:             ││
│  │  (claude-mind)  │    │  • memory_recall(query) - search        ││
│  └─────────────────┘    │  • memory_reflect(query) - reason       ││
│                         │  (Claude uses when helpful, not required)││
│                         └─────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────────────────────────────┐│
│  │   Session End   │───▶│  Hook: claude-mind process-session      ││
│  │     Hook        │    │  → Processes full transcript            ││
│  └─────────────────┘    │  → Hindsight extracts memories          ││
│                         │  → Calls reflect() for observations     ││
│                         │  → Flags promotable insights            ││
│                         └─────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Session Start Hook

Runs before Claude sees the conversation:

```bash
claude-mind inject-context --project /path/to/project
```

Output (injected into Claude's context):
```
## Project Memory

### Semantic Knowledge
- React Native with Expo SDK 51
- Auth uses Supabase magic links
- State management via Zustand

### Recent Context
- Yesterday: Fixed auth redirect in _layout.tsx
- Opinion: This codebase prefers explicit error handling (0.85)

### Relevant to Current Files
- AuthProvider must wrap root layout for redirects to work
```

#### 2. MCP Server

Provides optional tools Claude can use during the session:

```typescript
// Tool: memory_recall
{
  name: "memory_recall",
  description: "Search project memories for relevant context",
  parameters: {
    query: "string - what to search for",
    type: "world | experience | opinion | all (optional)"
  }
}

// Tool: memory_reflect
{
  name: "memory_reflect",
  description: "Reason about what I know and form opinions",
  parameters: {
    query: "string - what to think about"
  }
}
```

Claude uses these when beneficial:
- "I remember we tried something similar..." → `memory_recall`
- "What patterns have I noticed about..." → `memory_reflect`

#### 3. Session End Hook

Runs after session completes:

```bash
claude-mind process-session --transcript ~/.claude/sessions/latest.json
```

Process:
1. Parse transcript into conversation turns
2. Send to Hindsight `retain()` for automatic extraction
3. Hindsight extracts 5 dimensions (what/when/where/who/why)
4. Hindsight classifies into memory types (experience, world, etc.)
5. Call `reflect()` to form session observations
6. Flag high-confidence opinions for promotion review

### Configuration

```javascript
// .claude/settings.json (Claude Code config)
{
  "hooks": {
    "session:start": {
      "command": "claude-mind inject-context",
      "timeout": 5000
    },
    "session:end": {
      "command": "claude-mind process-session --transcript $TRANSCRIPT_PATH",
      "timeout": 30000
    }
  },
  "mcpServers": {
    "claude-mind": {
      "command": "claude-mind",
      "args": ["serve", "--project", "."]
    }
  }
}
```

### Data Flow

```
Session Start:
  .claude/memory.md ──────┐
  Hindsight recall() ─────┼──▶ Format ──▶ Inject into context
  Recent experiences ─────┘

During Session:
  Claude working... ──────────────────────────────────────────▶ (no automatic action)
        │
        └──▶ Claude decides to use memory_recall() ──▶ Hindsight ──▶ Results
        └──▶ Claude decides to use memory_reflect() ──▶ Hindsight ──▶ Opinion

Session End:
  Full transcript ──▶ Hindsight retain() ──▶ 5-dim extraction ──▶ Stored
                                │
                                ▼
                          reflect() ──▶ Observations ──▶ Maybe promote
```

### Why Hybrid?

| Approach | Pros | Cons |
|----------|------|------|
| **Automatic only** | No effort from Claude | Can't query mid-session |
| **Manual only** | Full control | Claude forgets to save |
| **Hybrid** | Best of both | Slightly more complex |

The hybrid approach ensures:
- Important moments are captured even if Claude doesn't explicitly save them
- Claude can actively leverage memory when it would help
- The user experience is seamless (memory is invisible)
