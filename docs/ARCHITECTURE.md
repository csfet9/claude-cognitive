# Architecture

Technical design for claude-mind.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLAUDE-MIND                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Semantic  │    │  Episodic   │    │  Working    │             │
│  │   Memory    │    │  Memory     │    │  Memory     │             │
│  │             │    │             │    │             │             │
│  │ .claude/    │    │ Hindsight   │    │ Context     │             │
│  │ memory.md   │    │ API         │    │ Window      │             │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │
│         │                  │                  │                     │
│         └────────────┬─────┴──────────────────┘                     │
│                      │                                              │
│              ┌───────▼───────┐                                      │
│              │    Memory     │                                      │
│              │   Manager     │                                      │
│              └───────┬───────┘                                      │
│                      │                                              │
│         ┌────────────┼────────────┐                                 │
│         │            │            │                                 │
│  ┌──────▼──────┐ ┌───▼───┐ ┌─────▼─────┐                           │
│  │Consolidation│ │Recall │ │ Forgetting│                           │
│  └─────────────┘ └───────┘ └───────────┘                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Memory Layers

### 1. Semantic Memory

**What:** Stable project knowledge
**Where:** `.claude/memory.md`
**Lifetime:** Long-term (human-curated)

```markdown
# Project Memory

## Tech Stack
- React Native 0.73, Expo SDK 50
- Supabase for backend

## Key Decisions
- Magic link auth (better UX than passwords)
- Zustand over Redux (simpler for this scale)

## Critical Paths
- Auth: src/features/auth/
- API: src/lib/api.ts
```

**Characteristics:**
- Always loaded at session start
- Human maintains quality
- Small and focused
- Provides project context

### 2. Episodic Memory

**What:** Recent experiences and discoveries
**Where:** Hindsight API
**Lifetime:** Days to weeks (decays)

```javascript
{
  id: "abc123",
  content: "Auth context issue: Provider must wrap root layout",
  type: "DISCOVERY",
  importance: 0.8,
  createdAt: "2024-01-15T10:30:00Z",
  lastAccessedAt: "2024-01-16T14:20:00Z",
  accessCount: 3,
  associations: ["auth", "context", "provider"]
}
```

**Characteristics:**
- Auto-stored during consolidation
- Searched by semantic similarity
- Decays if not accessed
- Can be promoted to semantic

### 3. Working Memory

**What:** Current session context
**Where:** LLM context window
**Lifetime:** Session only

This is Claude's context window. We don't manage it directly - we provide input to it:
- Semantic memory at session start
- Triggered episodic memories during work

---

## Data Flow

### Session Start

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Session   │────▶│   Load      │────▶│   Inject    │
│   Starts    │     │   Semantic  │     │   Context   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    .claude/memory.md
                           │
                           ▼
                    "Project uses React Native,
                     Expo, Supabase..."
```

### During Work

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Context   │────▶│   Extract   │────▶│   Search    │
│   Changes   │     │   Triggers  │     │   Episodic  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │                                       ▼
       │                              ┌─────────────┐
       │                              │   Surface   │
       │                              │   Memory    │
       │                              └─────────────┘
       │                                       │
       ▼                                       ▼
"Working on                           "I remember: Auth context
 src/auth/..."                         needs Provider at root"
```

### Session End

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Session   │────▶│   Extract   │────▶│   Score     │
│   Ends      │     │   Moments   │     │   Importance│
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Abstract  │
                                        │   Essence   │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Store in  │
                                        │   Episodic  │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Cleanup   │
                                        │   Weak      │
                                        └─────────────┘
```

---

## Fact Types

Only three types allowed in episodic memory:

### DECISION

Why we chose X over Y.

```javascript
{
  type: "DECISION",
  content: "Chose Zustand over Redux because simpler API and less boilerplate",
  associations: ["state", "zustand", "redux"]
}
```

### DISCOVERY

Found that X works because Y.

```javascript
{
  type: "DISCOVERY",
  content: "Auth tokens auto-refresh via Supabase client, no manual handling needed",
  associations: ["auth", "tokens", "supabase"]
}
```

### LOCATION

X is implemented at file:line.

```javascript
{
  type: "LOCATION",
  content: "Deep link handling in src/navigation/linking.ts:24-45",
  associations: ["deeplink", "navigation", "linking"]
}
```

---

## Importance Scoring

### High Importance (> 0.7)

```javascript
const HIGH_PATTERNS = [
  // Decisions with rationale
  /chose .+ (because|over|instead of)/i,
  /decided to .+ (because|since|as)/i,

  // Problem resolution
  /fixed|solved|resolved|figured out/i,
  /the (issue|problem|bug) was/i,

  // Discoveries
  /found that|discovered|realized|learned/i,
  /turns out|actually|it works by/i,

  // Emotional weight (user cared)
  /finally|crucial|critical|important|breaking/i,
];
```

### Low Importance (< 0.3)

```javascript
const LOW_PATTERNS = [
  // Routine operations
  /read the file|looked at|checked|opened/i,
  /ran the (command|build|test)/i,

  // Process narrative
  /then I|next I|after that|first I/i,
  /started by|began with/i,

  // Meta-operations
  /user asked|user said|session started/i,
  /memory synced|context loaded/i,

  // Hedging
  /maybe|might|not sure|probably|possibly/i,
];
```

---

## Abstraction

Convert verbose experiences to essence.

### Rules

1. **Remove narrative** - "I did X, then Y" → Outcome only
2. **Remove process** - "Read file, found bug" → Discovery only
3. **Keep location** - If specific file:line, keep it
4. **Keep rationale** - "because X" is valuable
5. **Keep resolution** - What fixed/solved it

### Example

**Before:**
```
I was debugging the login flow and noticed that after the user
signs in, they weren't being redirected. I checked the AuthProvider
component and found that the onAuthStateChange listener wasn't
firing. After some investigation, I discovered that the Supabase
client wasn't being initialized before the listener was set up.
I fixed it by adding an await before createClient() in the
supabase.ts file at line 15.
```

**After:**
```
Auth redirect fixed: await createClient() before setting
onAuthStateChange listener (src/lib/supabase.ts:15)
```

---

## Decay and Forgetting

### Strength Calculation

```javascript
function calculateStrength(memory) {
  const daysSinceAccess = daysBetween(memory.lastAccessedAt, now());

  // Base: exponential decay (half-life ~7 days)
  const decay = Math.exp(-0.1 * daysSinceAccess);

  // Modifier: importance slows decay
  const importanceBoost = memory.importance * 0.5;

  // Modifier: access count (rehearsal effect)
  const rehearsalBoost = Math.log(memory.accessCount + 1) * 0.1;

  return Math.min(1, decay + importanceBoost + rehearsalBoost);
}
```

### Decay Curve

```
Strength
  1.0 │ ●
      │   ●
  0.8 │     ●
      │       ●
  0.6 │         ●
      │           ●
  0.4 │             ●
      │               ●
  0.2 │                 ● ─ ─ ─  (forget threshold)
      │                   ● ● ● ●
  0.0 └────────────────────────────
      0   7   14   21   28   35  days
```

### Cleanup Actions

| Strength | Action |
|----------|--------|
| ≥ 0.5 | Keep as-is |
| 0.2 - 0.5 | Try promote to semantic, then forget |
| < 0.2 | Forget |

---

## Association & Retrieval

### Trigger Extraction

```javascript
function extractTriggers(context) {
  return {
    // File path → location memories
    file: context.currentFile,

    // Keywords from task/message
    keywords: extractKeywords(context.userMessage),

    // Error patterns
    error: context.lastError,

    // Entities (component names, etc.)
    entities: extractEntities(context.userMessage)
  };
}
```

### Association Matching

```javascript
async function findAssociated(triggers) {
  const results = [];

  // File triggers location memories
  if (triggers.file) {
    const byPath = await episodic.search(triggers.file, {
      type: 'LOCATION'
    });
    results.push(...byPath);
  }

  // Keywords trigger semantic search
  if (triggers.keywords.length > 0) {
    const byKeyword = await episodic.search(
      triggers.keywords.join(' ')
    );
    results.push(...byKeyword);
  }

  // Errors trigger discoveries
  if (triggers.error) {
    const byError = await episodic.search(triggers.error, {
      type: 'DISCOVERY'
    });
    results.push(...byError);
  }

  return rankByRelevance(results);
}
```

---

## Configuration

```javascript
// .claudemindrc or package.json "claudemind" key
{
  "hindsight": {
    "host": "localhost",
    "port": 8888,
    "bankId": "project-name"
  },
  "semantic": {
    "path": ".claude/memory.md",
    "maxLines": 100
  },
  "episodic": {
    "maxActive": 50,
    "decayRate": 0.1
  },
  "consolidation": {
    "minImportance": 0.5,
    "abstractionLevel": "essence"
  },
  "cleanup": {
    "forgetThreshold": 0.2,
    "promoteThreshold": 0.5,
    "runAfterSession": true
  }
}
```

---

## Error Handling

### Hindsight Unavailable

If Hindsight is down:
- Semantic memory still works (local file)
- Episodic operations queue locally
- Sync when connection restored

### Graceful Degradation

| Component | If Fails | Fallback |
|-----------|----------|----------|
| Hindsight | Network error | Local queue, retry |
| Semantic | File missing | Create default |
| Consolidation | Parse error | Skip item, log |
| Retrieval | No matches | Empty result |

Memory should never break the session. Log errors, continue working.

---

## Testing Strategy

### Unit Tests

- Each module in isolation
- Mock Hindsight client
- Test scoring algorithms
- Test abstraction rules

### Integration Tests

- Full flow: store → search → retrieve
- Session lifecycle
- Cleanup operations

### Manual Tests

- Real sessions with Claude
- Verify invisibility (user doesn't notice)
- Check recall relevance
