# Implementation Phases

Phase-based implementation plan for claude-mind with full Hindsight integration.

---

## Overview

| Phase | Focus | Outcome |
|-------|-------|---------|
| 0 | Documentation | Architecture defined, scaffolding removed |
| 1 | Hindsight Client | Full client with retain/recall/reflect |
| 2 | Orchestrator & Agents | Session lifecycle + agent templates |
| 3 | Semantic Layer | Local file management + promotion |
| 4 | Claude Code Integration | Hooks, MCP server, context injection |
| 5 | Testing & Polish | Integration tests, refinement |

---

## Phase 0: Documentation (CURRENT)

**Goal:** Establish architecture before implementation

### Tasks

- [x] Research Hindsight capabilities
- [x] Identify underutilized features
- [x] Define new architecture
- [x] Remove old scaffolding code
- [x] Rewrite CLAUDE.md
- [x] Rewrite README.md
- [x] Rewrite ARCHITECTURE.md
- [x] Rewrite PHASES.md
- [x] Rewrite API.md
- [x] Update package.json

### Decisions Made

| Decision | Rationale |
|----------|-----------|
| Fresh start | Old code reimplemented what Hindsight provides |
| 4 memory networks | world, experience, opinion, observation (not custom types) |
| 3 operations | retain, recall, reflect (Hindsight's primitives) |
| No custom decay | Hindsight handles memory management |
| Keep semantic file | Human-curated .claude/memory.md as ground truth |
| Hybrid integration | Automatic transcript capture + optional MCP tools |
| Orchestrator pattern | Claude as project manager, delegates to agents |
| Centralized memory | Only orchestrator accesses memory, agents stay focused |
| Both agent types | Support built-in Task agents + custom `.claude/agents/` |

### Acceptance Criteria

- Documentation reflects full Hindsight integration
- Old scaffolding removed
- Ready for implementation

---

## Phase 1: Hindsight Client

**Goal:** Full-featured client wrapper for Hindsight API

### Concept

Create a thin wrapper around Hindsight that exposes all needed operations:
- Bank management (create with disposition + background)
- retain() for storing experiences
- recall() for 4-way retrieval
- reflect() for opinion formation

### Tasks

- [ ] Create TypeScript/JavaScript client
- [ ] Bank creation with disposition traits
- [ ] retain() with full content + context
- [ ] recall() with all options (budget, fact_type, entities)
- [ ] reflect() for opinion formation
- [ ] Health check and connection management
- [ ] Error handling and graceful degradation

### Files to Create

```
src/
├── index.ts                   # Main exports
├── client.ts                  # HindsightClient class
├── types.ts                   # TypeScript types
└── config.ts                  # Configuration loading
```

### API Design

```typescript
interface HindsightClient {
  // Bank management
  createBank(options: BankOptions): Promise<void>
  getBank(bankId: string): Promise<Bank>
  updateDisposition(bankId: string, disposition: Disposition): Promise<void>

  // Core operations
  retain(bankId: string, content: string, context?: string): Promise<string[]>
  recall(bankId: string, query: string, options?: RecallOptions): Promise<Memory[]>
  reflect(bankId: string, query: string): Promise<ReflectResult>

  // Utilities
  health(): Promise<HealthStatus>
  recent(bankId: string, days?: number): Promise<Memory[]>
  forget(bankId: string, memoryId: string): Promise<void>
}

interface BankOptions {
  bankId: string
  disposition: {
    skepticism: 1 | 2 | 3 | 4 | 5
    literalism: 1 | 2 | 3 | 4 | 5
    empathy: 1 | 2 | 3 | 4 | 5
  }
  background: string
}

interface RecallOptions {
  budget?: 'low' | 'mid' | 'high'
  factType?: 'world' | 'experience' | 'opinion' | 'observation' | 'all'
  maxTokens?: number
  includeEntities?: boolean
}

interface ReflectResult {
  text: string
  basedOn: {
    world: Memory[]
    experience: Memory[]
    opinion: Memory[]
  }
}
```

### Acceptance Criteria

- Can create bank with disposition
- Can retain content (Hindsight extracts 5 dimensions)
- Can recall with 4-way search
- Can reflect and receive opinions
- Handles Hindsight unavailability gracefully

---

## Phase 2: Orchestrator & Agents

**Goal:** Session lifecycle management with orchestrator pattern and agent support

### Concept

Claude operates as a **project manager** (orchestrator) that:
1. Manages session workflow and delegates to specialized agents
2. Owns all memory operations (agents don't access memory)
3. Synthesizes findings from multiple agents

The Mind class supports this pattern:
1. **Start**: Load context, recall relevant memories → Claude starts informed
2. **During**: Claude orchestrates agents, uses recall when helpful
3. **End**: Full transcript processed, memories extracted from all

### Tasks

- [ ] Create Mind class with orchestrator support
- [ ] onSessionStart() implementation
- [ ] onSessionEnd() with transcript processing
- [ ] Create base agent templates
- [ ] Agent template structure (`.claude/agents/`)
- [ ] Event emission for hooks

### Files to Create

```
src/
├── mind.ts                    # Mind orchestrator class
├── events.ts                  # Event types and emitter
└── agents/
    └── templates.ts           # Base agent template definitions
templates/
└── .claude/
    └── agents/
        ├── code-explorer.md   # Explorer agent template
        ├── code-architect.md  # Architect agent template
        └── code-reviewer.md   # Reviewer agent template
```

### Orchestrator Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Session starts → Context injected                               │
│     └── Claude knows project history immediately                    │
│                                                                     │
│  2. User request arrives                                            │
│     └── Claude uses memory_recall(topic) if helpful                 │
│     └── Claude includes context in agent prompt                     │
│                                                                     │
│  3. Claude delegates to agent                                       │
│     └── Agent executes task (no memory access)                      │
│     └── Agent returns findings                                      │
│                                                                     │
│  4. Claude continues or delegates more                              │
│     └── Synthesizes findings across agents                          │
│                                                                     │
│  5. Session ends → Transcript processed automatically               │
│     └── Hindsight extracts memories from full transcript            │
│     └── reflect() forms observations                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Template Structure

```markdown
# Agent: code-explorer

## Mission
[What this agent specializes in]

## Tools Available
[Which tools the agent can use]

## Output Format
[How the agent should structure its response]

## Constraints
- Read-only (no file modifications)
- No memory operations (orchestrator handles)
- Focus on assigned task
```

### API Design

```typescript
class Mind extends EventEmitter {
  constructor(options: MindOptions)

  // Lifecycle hooks
  async init(): Promise<void>
  async onSessionStart(): Promise<string>           // Returns context to inject
  async onSessionEnd(transcript?: string): Promise<ReflectResult>

  // Memory operations (for orchestrator use)
  async recall(query: string, options?: RecallOptions): Promise<Memory[]>
  async reflect(query: string): Promise<ReflectResult>

  // Agent support
  getAgentTemplates(): AgentTemplate[]
  getAgentContext(agentType: string, task: string): Promise<string>
}

interface MindOptions {
  projectPath: string
  bankId?: string
  hindsight?: {
    host: string
    port: number
  }
  disposition?: Disposition
  background?: string
}

interface AgentTemplate {
  name: string
  mission: string
  tools: string[]
  outputFormat: string
  constraints: string[]
}
```

### Events

```typescript
mind.on('memory:recalled', (memories: Memory[]) => {})
mind.on('opinion:formed', (opinion: Opinion) => {})
mind.on('session:processed', (result: ProcessResult) => {})
mind.on('error', (error: Error) => {})
```

### Acceptance Criteria

- Session start returns formatted context with semantic + recalled memories
- Session end processes transcript and extracts memories
- Agent templates available for explorer, architect, reviewer
- Custom agents supported via `.claude/agents/`
- Memory operations only available to orchestrator (not agents)
- Events emitted correctly

---

## Phase 3: Semantic Layer

**Goal:** Local file management with Hindsight integration

### Concept

The `.claude/memory.md` file serves as:
- Human-curated ground truth
- Target for promoted observations
- Always loaded at session start

### Tasks

- [ ] Create SemanticMemory class
- [ ] Read/parse .claude/memory.md
- [ ] Format as context string
- [ ] Write/update functionality
- [ ] Promotion logic (high-confidence → semantic)

### Files to Create

```
src/
├── semantic.ts                # SemanticMemory class
└── promotion.ts               # Observation promotion logic
```

### API Design

```typescript
class SemanticMemory {
  constructor(projectPath: string)

  async load(): Promise<void>
  async save(): Promise<void>

  get(section: string): string | undefined
  set(section: string, content: string): void
  append(section: string, item: string): void

  toContext(): string  // Format for injection

  async promoteObservation(observation: Observation): Promise<void>
}
```

### File Structure

```markdown
## Tech Stack
- React Native with Expo
- Supabase for auth and database

## Key Decisions
- Magic link auth for better mobile UX
- Zustand for state management

## Critical Paths
- Auth flow: src/lib/supabase.ts → src/providers/AuthProvider.tsx

## Observations
<!-- Promoted from Hindsight -->
- Auth changes often require navigation updates (promoted: 2025-01-02)
```

### Acceptance Criteria

- Reads and parses .claude/memory.md
- Creates default file if missing
- Formats as context string
- Can promote observations from Hindsight

---

## Phase 4: Claude Code Integration

**Goal:** Seamless integration with Claude Code via hybrid approach

### Concept

Hybrid integration combining automatic capture with active tools:

| Component | Mechanism | Purpose |
|-----------|-----------|---------|
| **Session Start Hook** | Shell command | Inject context before Claude sees conversation |
| **MCP Server** | Tool provider | Give Claude optional recall/reflect tools |
| **Session End Hook** | Shell command | Automatically process transcript |

### Tasks

- [ ] Research Claude Code hook system and MCP integration
- [ ] Implement MCP server with memory_recall and memory_reflect tools
- [ ] Implement session start hook (inject-context command)
- [ ] Implement session end hook (process-session command)
- [ ] Create CLI for manual operations
- [ ] Configuration via .claudemindrc
- [ ] Write setup instructions for Claude Code integration

### Files to Create

```
src/
├── mcp/
│   ├── server.ts              # MCP server implementation
│   ├── tools.ts               # Tool definitions (recall, reflect)
│   └── handlers.ts            # Tool execution handlers
├── hooks/
│   ├── inject-context.ts      # Session start hook
│   └── process-session.ts     # Session end hook
└── cli.ts                     # CLI commands
bin/
└── claude-mind.js             # CLI entry point
```

### MCP Server Tools

```typescript
// memory_recall - Search project memories
{
  name: "memory_recall",
  description: "Search project memories for relevant context. Use when you want to remember something from previous sessions.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to search for in memory"
      },
      type: {
        type: "string",
        enum: ["world", "experience", "opinion", "all"],
        description: "Type of memory to search (optional, defaults to all)"
      }
    },
    required: ["query"]
  }
}

// memory_reflect - Reason about accumulated knowledge
{
  name: "memory_reflect",
  description: "Reason about what you know and form opinions. Use when you want to think about patterns or make judgments based on experience.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to think about or reason through"
      }
    },
    required: ["query"]
  }
}
```

### Hook Commands

```bash
# Session start - inject context
claude-mind inject-context --project /path/to/project
# Output: Formatted context string for injection

# Session end - process transcript
claude-mind process-session --transcript /path/to/transcript.json
# Output: Summary of memories extracted and observations formed
```

### CLI Commands

```bash
claude-mind init               # Initialize for project (creates bank, .claudemindrc)
claude-mind serve              # Start MCP server
claude-mind status             # Show connection and stats
claude-mind recall "query"     # Manual recall
claude-mind reflect "query"    # Manual reflect
claude-mind semantic           # Show semantic memory
claude-mind config             # Show/edit configuration
```

### Claude Code Configuration

```javascript
// .claude/settings.json
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

### Project Configuration

```javascript
// .claudemindrc
{
  "hindsight": {
    "host": "localhost",
    "port": 8888
  },
  "bankId": "my-project",
  "disposition": {
    "skepticism": 4,
    "literalism": 4,
    "empathy": 2
  },
  "background": "Developer assistant for React Native app",
  "semantic": {
    "path": ".claude/memory.md"
  }
}
```

### Acceptance Criteria

- MCP server provides memory_recall and memory_reflect tools
- Session start hook injects formatted context
- Session end hook processes transcript automatically
- Claude can use tools mid-session when helpful
- Memories stored even if Claude doesn't explicitly save
- CLI works for manual operations
- Configuration properly loaded

---

## Phase 5: Testing & Polish

**Goal:** Production readiness

### Tasks

- [ ] Unit tests for all modules
- [ ] Integration tests with Hindsight
- [ ] End-to-end session tests
- [ ] Error scenario testing
- [ ] Performance profiling
- [ ] Documentation review
- [ ] Example project

### Test Categories

```
tests/
├── unit/
│   ├── client.test.ts
│   ├── mind.test.ts
│   └── semantic.test.ts
├── integration/
│   ├── hindsight.test.ts
│   └── session.test.ts
└── e2e/
    └── full-session.test.ts
```

### Test Scenarios

| Scenario | Test |
|----------|------|
| Basic recall | Query returns relevant memories |
| Reflect forms opinions | Opinion with confidence returned |
| Session lifecycle | Start → changes → end works |
| Hindsight down | Graceful degradation to semantic-only |
| Entity traversal | Graph search finds indirect relations |

### Acceptance Criteria

- All tests pass
- Coverage > 80%
- No critical errors in week-long usage
- Documentation accurate and complete

---

## Success Metrics

After all phases:

| Metric | Target |
|--------|--------|
| Session start latency | < 500ms |
| Recall latency | < 200ms |
| Reflect latency | < 2s |
| Relevant recall rate | > 80% |
| User notices memory | Never |

---

## Non-Goals

Things we explicitly don't implement:

| Feature | Reason |
|---------|--------|
| Custom decay formulas | Hindsight handles this |
| Custom importance scoring | Hindsight extracts significance |
| Manual entity extraction | Hindsight does this automatically |
| Custom retrieval algorithms | Hindsight's 4-way search is superior |
| Memory deduplication | Hindsight handles this |

---

## Dependencies

| Dependency | Purpose |
|------------|---------|
| Hindsight server | Memory storage and operations |
| Node.js 18+ | Runtime |
| TypeScript | Type safety |

---

## Timeline

No time estimates. Work through phases sequentially.
Each phase is complete when acceptance criteria pass.
