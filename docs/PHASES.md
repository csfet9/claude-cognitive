# Implementation Phases

Phase-based implementation plan for claude-mind.

---

## Overview

| Phase | Focus | Outcome |
|-------|-------|---------|
| 0 | Setup | Project structure, Hindsight connection |
| 1 | Semantic Memory | Local file read/write (.claude/memory.md) |
| 2 | Episodic Memory | Hindsight store/search |
| 3 | Consolidation | Session-end processing |
| 4 | Retrieval | Context-triggered recall |
| 5 | Forgetting | Decay and cleanup |
| 6 | Integration | Claude Code hooks |

---

## Phase 0: Setup

**Goal:** Project foundation and Hindsight connection

### Tasks

- [x] Create project structure
- [x] Initialize package.json
- [x] Create documentation skeleton
- [ ] Set up Hindsight client
- [ ] Add basic tests
- [ ] Configure CI

### Files to Create

```
src/
├── index.js                  # Exports main API
├── hindsight-client.js       # Hindsight HTTP client
└── config.js                 # Configuration loading
tests/
└── hindsight-client.test.js
```

### Acceptance Criteria

- Can connect to Hindsight server
- Can store and retrieve a fact
- Tests pass

---

## Phase 1: Semantic Memory

**Goal:** Local file as stable project knowledge

### Concept

Semantic memory = `.claude/memory.md`

- Human-curated essentials
- Always loaded at session start
- Small (~100 lines max)
- Tech stack, decisions, critical paths

### Tasks

- [ ] Create SemanticMemory class
- [ ] Read .claude/memory.md
- [ ] Parse into structured format
- [ ] Validate content
- [ ] Write/update functionality

### Files to Create

```
src/memory/
├── semantic.js               # SemanticMemory class
└── semantic-parser.js        # Markdown parsing
tests/
└── semantic.test.js
```

### API

```javascript
class SemanticMemory {
  constructor(projectPath)

  async load()                    // Read and parse
  async save()                    // Write back

  get(section)                    // Get section content
  set(section, content)           // Update section
  append(section, item)           // Add to section

  toContext()                     // Format for Claude context
}
```

### Acceptance Criteria

- Can read .claude/memory.md
- Can parse sections (Tech Stack, Decisions, etc.)
- Can update and save
- Returns formatted context for session start

---

## Phase 2: Episodic Memory

**Goal:** Hindsight as searchable experience archive

### Concept

Episodic memory = Hindsight storage

- Recent experiences
- Decays over time
- Searched on-demand
- Three fact types only

### Tasks

- [ ] Create EpisodicMemory class
- [ ] Implement store() with type validation
- [ ] Implement search() with semantic matching
- [ ] Implement remove()
- [ ] Implement recent()
- [ ] Block meta-content at store time

### Files to Create

```
src/memory/
├── episodic.js               # EpisodicMemory class
└── meta-filter.js            # Block meta-content
tests/
├── episodic.test.js
└── meta-filter.test.js
```

### API

```javascript
class EpisodicMemory {
  constructor(hindsightClient, bankId)

  // Three types only: DECISION, DISCOVERY, LOCATION
  async store(fact, type)         // Store with validation
  async search(query, options)    // Semantic search
  async remove(factId)            // Delete fact
  async recent(days)              // Get recent facts
}
```

### Fact Types

```javascript
const FACT_TYPES = {
  DECISION: 'decision',    // Why we chose X over Y
  DISCOVERY: 'discovery',  // Found that X works because Y
  LOCATION: 'location'     // X is implemented at file:line
};
```

### Acceptance Criteria

- Can store facts with type validation
- Rejects invalid types
- Blocks meta-content (session state, commands)
- Can search semantically
- Can retrieve recent facts

---

## Phase 3: Consolidation

**Goal:** Session-end processing like sleep

### Concept

When session ends:
1. Extract significant moments
2. Score by importance
3. Abstract to essence
4. Connect to existing memories
5. Store in episodic memory

### Tasks

- [ ] Create SignificanceExtractor
- [ ] Create ImportanceScorer
- [ ] Create EssenceAbstractor
- [ ] Create Consolidator orchestrator
- [ ] Integrate with session-end hook

### Files to Create

```
src/consolidation/
├── extractor.js              # Extract significant moments
├── importance.js             # Score importance
├── abstractor.js             # Reduce to essence
└── index.js                  # Consolidator class
tests/
├── extractor.test.js
├── importance.test.js
├── abstractor.test.js
└── consolidation.test.js
```

### Importance Signals

```javascript
const HIGH_IMPORTANCE = [
  /chose .+ (because|over|instead of)/i,   // Decisions
  /fixed|solved|resolved|figured out/i,    // Solutions
  /found that|discovered|realized/i,        // Discoveries
  /finally|crucial|critical|important/i,    // Emotional weight
];

const LOW_IMPORTANCE = [
  /read the file|looked at|checked/i,      // Routine
  /then I|next I|after that/i,             // Process steps
  /user asked|session started/i,            // Meta
];
```

### Abstraction Rules

```
Before: "I read src/auth/login.ts and found that the useAuth hook
        was returning undefined because the AuthProvider wasn't
        wrapping the component tree properly. I fixed it by moving
        AuthProvider to _layout.tsx at the root level."

After:  "Auth context issue: Provider must wrap root layout (_layout.tsx)"
```

### Acceptance Criteria

- Extracts significant moments from transcript
- Scores importance correctly
- Abstracts to essence (removes narrative, keeps outcome)
- Stores consolidated memories

---

## Phase 4: Retrieval

**Goal:** Context-triggered recall

### Concept

Memories activate by context, not explicit search:
- Current file triggers location memories
- Task keywords trigger semantic associations
- Errors trigger problem-solving memories

### Tasks

- [ ] Create TriggerExtractor
- [ ] Create AssociationFinder
- [ ] Create RecallOrchestrator
- [ ] Integrate with context changes

### Files to Create

```
src/retrieval/
├── triggers.js               # Extract triggers from context
├── association.js            # Find associated memories
└── index.js                  # RecallOrchestrator
tests/
├── triggers.test.js
├── association.test.js
└── retrieval.test.js
```

### Trigger Types

```javascript
const TRIGGERS = {
  FILE: 'file',           // Working on src/auth/...
  KEYWORD: 'keyword',     // User mentioned "authentication"
  ERROR: 'error',         // Got "undefined is not a function"
  PATTERN: 'pattern'      // Similar to previous situation
};
```

### API

```javascript
class RecallOrchestrator {
  constructor(episodicMemory)

  // Extract triggers from current context
  extractTriggers(context)

  // Find memories associated with triggers
  async findAssociated(triggers)

  // Main entry: context change → relevant memories
  async onContextChange(context)
}
```

### Acceptance Criteria

- Extracts triggers from file, task, message
- Finds associated memories
- Ranks by association strength
- Returns relevant memories for context

---

## Phase 5: Forgetting

**Goal:** Automatic decay and cleanup

### Concept

Memories weaken if not accessed:
- Decay over time (exponential)
- Importance slows decay
- Access strengthens (rehearsal)
- Weak memories → abstract or forget

### Tasks

- [ ] Implement decay calculation
- [ ] Track access counts
- [ ] Create cleanup scheduler
- [ ] Implement promotion to semantic memory

### Files to Create

```
src/forgetting/
├── decay.js                  # Decay calculation
├── cleanup.js                # Periodic cleanup
└── promotion.js              # Episodic → Semantic
tests/
├── decay.test.js
├── cleanup.test.js
└── promotion.test.js
```

### Decay Formula

```javascript
function calculateStrength(memory) {
  const daysSinceAccess = daysBetween(memory.lastAccessedAt, now());

  // Exponential decay
  const decay = Math.exp(-0.1 * daysSinceAccess);

  // Importance slows decay
  const importanceBoost = memory.importance * 0.5;

  // Access count strengthens (rehearsal)
  const rehearsalBoost = Math.log(memory.accessCount + 1) * 0.1;

  return Math.min(1, decay + importanceBoost + rehearsalBoost);
}
```

### Cleanup Rules

| Strength | Action |
|----------|--------|
| < 0.2 | Forget entirely |
| 0.2 - 0.5 | Try to promote to semantic, then forget |
| > 0.5 | Keep |

### Acceptance Criteria

- Calculates decay correctly
- Access updates lastAccessedAt
- Cleanup removes weak memories
- Strong patterns get promoted to semantic

---

## Phase 6: Integration

**Goal:** Claude Code hooks and seamless usage

### Concept

Integrate with Claude Code:
- Session start: Load semantic memory
- Context change: Trigger retrieval
- Session end: Consolidate

### Tasks

- [ ] Create session-start hook
- [ ] Create context-change detector
- [ ] Create session-end hook
- [ ] CLI commands for manual ops
- [ ] Configuration options

### Files to Create

```
src/integration/
├── hooks.js                  # Claude Code hooks
├── detector.js               # Context change detection
└── cli.js                    # CLI commands
bin/
└── cli.js                    # Entry point
```

### CLI Commands

```bash
claude-mind status            # Check connection, show stats
claude-mind search "query"    # Manual search
claude-mind recent            # Show recent memories
claude-mind cleanup           # Run cleanup
claude-mind forget <id>       # Remove specific memory
```

### Hooks

```javascript
// Session Start
async function onSessionStart(projectPath) {
  const semantic = await semanticMemory.load();
  return semantic.toContext();  // Inject into context
}

// Context Change
async function onContextChange(context) {
  const memories = await recallOrchestrator.onContextChange(context);
  if (memories.length > 0) {
    return formatAsRecollection(memories);
  }
}

// Session End
async function onSessionEnd(transcript) {
  await consolidator.consolidate(transcript);
  await cleanup.run();
}
```

### Acceptance Criteria

- Session start loads semantic memory
- Context changes trigger relevant recalls
- Session end consolidates and cleans up
- CLI works for manual operations
- Memory is invisible during normal use

---

## Success Metrics

After all phases:

| Metric | Target |
|--------|--------|
| Session start context | < 100 lines |
| Active episodic memories | < 50 |
| Recall precision | > 80% relevant |
| User notices memory | Never |

---

## Timeline

No time estimates - work through phases sequentially.
Each phase is complete when acceptance criteria pass.
