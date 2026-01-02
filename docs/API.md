# API Reference

Public API for claude-mind.

---

## Quick Start

```javascript
import { Mind } from 'claude-mind';

const mind = new Mind({
  projectPath: process.cwd(),
  hindsight: { host: 'localhost', port: 8888 }
});

await mind.init();

// Session start - get context
const context = await mind.onSessionStart();

// During work - search memories
const memories = await mind.search('authentication flow');

// Context change - get triggered memories
const triggered = await mind.onContextChange({
  currentFile: 'src/auth/login.ts',
  userMessage: 'fix the login redirect'
});

// Session end - consolidate
await mind.onSessionEnd(sessionTranscript);
```

---

## Mind Class

Main entry point.

### Constructor

```javascript
new Mind(options)
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `projectPath` | string | `process.cwd()` | Project root |
| `hindsight.host` | string | `'localhost'` | Hindsight server |
| `hindsight.port` | number | `8888` | Hindsight port |
| `hindsight.bankId` | string | Project name | Memory bank ID |

### Methods

#### `init()`

Initialize connection to Hindsight and load semantic memory.

```javascript
await mind.init();
```

Returns: `Promise<void>`

Throws: `Error` if Hindsight unavailable (but continues with local-only mode)

---

#### `onSessionStart()`

Called at session start. Returns semantic memory as context.

```javascript
const context = await mind.onSessionStart();
console.log(context);
// "Project: my-app\nStack: React Native, Expo, Supabase\n..."
```

Returns: `Promise<string>` - Context to inject

---

#### `onContextChange(context)`

Called when context changes. Returns triggered memories.

```javascript
const memories = await mind.onContextChange({
  currentFile: 'src/auth/login.ts',
  userMessage: 'the login is not redirecting',
  lastError: 'undefined is not a function'
});
```

**Context Object:**

| Property | Type | Description |
|----------|------|-------------|
| `currentFile` | string | Current file path |
| `userMessage` | string | User's last message |
| `lastError` | string | Last error message |

Returns: `Promise<Memory[]>` - Relevant memories

---

#### `onSessionEnd(transcript)`

Called at session end. Consolidates and cleans up.

```javascript
await mind.onSessionEnd(sessionTranscript);
```

Returns: `Promise<{ consolidated: number, forgotten: number }>`

---

#### `store(fact, type)`

Explicitly store a fact (usually called internally by consolidation).

```javascript
await mind.store(
  'Auth tokens refresh automatically via Supabase client',
  'DISCOVERY'
);
```

**Types:** `'DECISION'` | `'DISCOVERY'` | `'LOCATION'`

Returns: `Promise<{ id: string, stored: boolean }>`

---

#### `search(query, options?)`

Search episodic memory.

```javascript
const results = await mind.search('token refresh', {
  type: 'DISCOVERY',
  limit: 5
});
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | - | Filter by fact type |
| `limit` | number | `10` | Max results |

Returns: `Promise<Memory[]>`

---

#### `recent(days?)`

Get recent memories.

```javascript
const recent = await mind.recent(7);
```

Returns: `Promise<Memory[]>`

---

#### `remove(id)`

Remove a specific memory.

```javascript
await mind.remove('abc123');
```

Returns: `Promise<void>`

---

#### `cleanup()`

Run cleanup (decay and forget weak memories).

```javascript
const result = await mind.cleanup();
// { forgotten: 5, promoted: 2 }
```

Returns: `Promise<{ forgotten: number, promoted: number }>`

---

## Memory Object

```typescript
interface Memory {
  id: string;
  content: string;
  type: 'DECISION' | 'DISCOVERY' | 'LOCATION';
  importance: number;           // 0.0 - 1.0
  strength: number;             // 0.0 - 1.0 (current)
  createdAt: string;            // ISO date
  lastAccessedAt: string;       // ISO date
  accessCount: number;
  associations: string[];       // Keywords
}
```

---

## SemanticMemory Class

Manages `.claude/memory.md`.

```javascript
import { SemanticMemory } from 'claude-mind';

const semantic = new SemanticMemory('.claude/memory.md');
await semantic.load();

// Get section
const stack = semantic.get('Tech Stack');

// Update section
semantic.set('Tech Stack', '- React Native 0.73\n- Expo SDK 50');

// Append to section
semantic.append('Key Decisions', '- Chose Zustand over Redux');

// Save changes
await semantic.save();

// Get as context string
const context = semantic.toContext();
```

---

## EpisodicMemory Class

Manages Hindsight storage.

```javascript
import { EpisodicMemory, HindsightClient } from 'claude-mind';

const client = new HindsightClient({ host: 'localhost', port: 8888 });
const episodic = new EpisodicMemory(client, 'my-project');

// Store (validates type, blocks meta-content)
await episodic.store('Chose X because Y', 'DECISION');

// Search
const results = await episodic.search('authentication');

// Recent
const recent = await episodic.recent(7);

// Remove
await episodic.remove('abc123');
```

---

## Consolidator Class

Session-end processing.

```javascript
import { Consolidator } from 'claude-mind';

const consolidator = new Consolidator(episodicMemory);

// Process session transcript
const result = await consolidator.consolidate(transcript);
// { extracted: 10, stored: 3 }
```

---

## CLI

```bash
# Check status
claude-mind status

# Search memories
claude-mind search "authentication"

# Recent memories
claude-mind recent --days 7

# Manual cleanup
claude-mind cleanup

# Remove specific memory
claude-mind forget <id>

# Show semantic memory
claude-mind semantic

# Edit semantic memory
claude-mind semantic --edit
```

---

## Events

```javascript
const mind = new Mind(options);

mind.on('memory:stored', (memory) => {
  console.log('Stored:', memory.content);
});

mind.on('memory:triggered', (memories) => {
  console.log('Triggered:', memories.length);
});

mind.on('memory:forgotten', (ids) => {
  console.log('Forgotten:', ids.length);
});

mind.on('error', (error) => {
  console.error('Error:', error.message);
});
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `HINDSIGHT_UNAVAILABLE` | Cannot connect to Hindsight |
| `INVALID_FACT_TYPE` | Type not DECISION/DISCOVERY/LOCATION |
| `META_CONTENT_BLOCKED` | Fact contains meta-content |
| `SEMANTIC_FILE_MISSING` | .claude/memory.md not found |
| `SEMANTIC_PARSE_ERROR` | Cannot parse memory.md |
