# API Reference

Full API documentation for claude-cognitive with Hindsight integration.

---

## Quick Start

```typescript
import { Mind } from "claude-cognitive";

const mind = new Mind({
  projectPath: process.cwd(),
  disposition: { skepticism: 4, literalism: 4, empathy: 2 },
  background: "Developer assistant for a React Native app",
});

await mind.init();

// Session start - get context with relevant memories
const context = await mind.onSessionStart();

// During work - recall on context changes
const memories = await mind.onContextChange({
  currentFile: "src/auth/login.ts",
  userMessage: "fix the login redirect",
  entities: ["AuthProvider", "login"],
});

// Direct recall
const authMemories = await mind.recall("authentication flow", {
  factType: "experience",
  budget: "mid",
});

// Session end - reflect and store observations
const reflection = await mind.onSessionEnd(sessionTranscript);
```

---

## HindsightClient

Low-level client for Hindsight API.

### Constructor

```typescript
new HindsightClient(options: HindsightClientOptions)
```

**Options:**

| Property | Type   | Default       | Description               |
| -------- | ------ | ------------- | ------------------------- |
| `host`   | string | `'localhost'` | Hindsight server hostname |
| `port`   | number | `8888`        | Hindsight server port     |
| `apiKey` | string | -             | Optional API key          |

### Bank Management

#### `createBank(options)`

Create a new memory bank with disposition.

```typescript
await client.createBank({
  bankId: "my-project",
  disposition: {
    skepticism: 4, // 1-5: trusting → questions claims
    literalism: 4, // 1-5: flexible → precise interpretation
    empathy: 2, // 1-5: fact-focused → considers emotions
  },
  background: "I am a developer assistant for a React Native app...",
});
```

**BankOptions:**

| Property                 | Type   | Required | Description                            |
| ------------------------ | ------ | -------- | -------------------------------------- |
| `bankId`                 | string | Yes      | Unique identifier for the bank         |
| `disposition.skepticism` | 1-5    | Yes      | How much to question claims            |
| `disposition.literalism` | 1-5    | Yes      | How precisely to interpret             |
| `disposition.empathy`    | 1-5    | Yes      | How much to consider emotional context |
| `background`             | string | No       | Natural language identity/background   |

Returns: `Promise<void>`

---

#### `getBank(bankId)`

Get bank information.

```typescript
const bank = await client.getBank("my-project");
// { bankId, disposition, background, createdAt, memoryCount }
```

Returns: `Promise<Bank>`

---

#### `updateDisposition(bankId, disposition)`

Update bank disposition traits.

```typescript
await client.updateDisposition("my-project", {
  skepticism: 5,
  literalism: 3,
  empathy: 4,
});
```

Returns: `Promise<void>`

---

### Core Operations

#### `retain(bankId, content, context?)`

Store content with automatic 5-dimension extraction.

```typescript
const memoryIds = await client.retain(
  "my-project",
  "Fixed the auth redirect by moving AuthProvider to wrap the root layout in _layout.tsx",
  "User was experiencing infinite redirects after login",
);
```

Hindsight automatically extracts:

| Dimension | Description                           | Example                                      |
| --------- | ------------------------------------- | -------------------------------------------- |
| **what**  | Complete description of what happened | "Fixed auth redirect by moving AuthProvider" |
| **when**  | Temporal context                      | "January 2, 2025 afternoon session"          |
| **where** | File paths, locations                 | "src/app/\_layout.tsx at line 15"            |
| **who**   | Entities involved                     | "AuthProvider, React Context, Supabase"      |
| **why**   | Motivation and reasoning              | "User stuck on infinite redirect loop"       |

Additionally, retain() automatically:

- Classifies into fact_type (world, experience, opinion, observation)
- Extracts and resolves entities
- Identifies causal relationships (causes, enables, prevents)
- Creates temporal and semantic links to existing memories
- Tracks entity co-occurrences

Returns: `Promise<string[]>` - IDs of created memories

---

#### `recall(bankId, query, options?)`

4-way parallel retrieval with fusion and reranking.

```typescript
const memories = await client.recall("my-project", "How does auth work?", {
  budget: "mid",
  factType: "all",
  maxTokens: 4096,
  includeEntities: true,
});
```

**RecallOptions:**

| Property          | Type                                                             | Default | Description             |
| ----------------- | ---------------------------------------------------------------- | ------- | ----------------------- |
| `budget`          | `'low' \| 'mid' \| 'high'`                                       | `'mid'` | Search thoroughness     |
| `factType`        | `'world' \| 'experience' \| 'opinion' \| 'observation' \| 'all'` | `'all'` | Filter by memory type   |
| `maxTokens`       | number                                                           | -       | Max tokens in response  |
| `includeEntities` | boolean                                                          | `false` | Include entity metadata |

**Budget Levels:**

| Budget | Tokens | Graph Hops | Best For                       |
| ------ | ------ | ---------- | ------------------------------ |
| `low`  | ~2048  | 1          | Quick lookups, focused answers |
| `mid`  | ~4096  | 2          | Most queries (default)         |
| `high` | ~8192  | 3+         | Comprehensive research         |

**Retrieval Strategies (all run in parallel):**

| Strategy | Method                       | Best For               |
| -------- | ---------------------------- | ---------------------- |
| Semantic | Vector similarity (pgvector) | Conceptual matches     |
| BM25     | Full-text keyword search     | Exact names, terms     |
| Graph    | Entity traversal (MPFP/BFS)  | Indirect relationships |
| Temporal | Time-range + semantic        | Historical queries     |

Results are fused using Reciprocal Rank Fusion (RRF), then reranked with a neural cross-encoder.

Returns: `Promise<Memory[]>`

---

#### `reflect(bankId, query, context?)`

Reason about accumulated knowledge through disposition lens.

```typescript
const result = await client.reflect(
  "my-project",
  "What patterns have I noticed about auth changes in this codebase?",
);

console.log(result.text);
// "Based on my experience, auth changes in this codebase often require
//  corresponding navigation updates. I've seen this pattern multiple times..."

console.log(result.opinions);
// [{ opinion: "Auth changes require nav updates", confidence: 0.85 }]
```

**ReflectResult:**

```typescript
interface ReflectResult {
  text: string; // Natural language answer
  opinions: Opinion[]; // Extracted opinions with confidence
  basedOn: {
    world: Memory[]; // World facts used
    experience: Memory[]; // Experiences used
    opinion: Memory[]; // Prior opinions used
  };
}

interface Opinion {
  opinion: string; // First-person opinion statement
  confidence: number; // 0.0 to 1.0
}
```

Reflect process:

1. Recalls relevant memories (world, experience, opinion)
2. Loads bank disposition (skepticism, literalism, empathy)
3. LLM reasons through disposition lens
4. Extracts new opinions with confidence scores
5. Stores opinions asynchronously (influences future reflects)
6. Returns reasoned response with citations

Returns: `Promise<ReflectResult>`

---

### Utilities

#### `health()`

Check Hindsight connection.

```typescript
const status = await client.health();
// { healthy: true, database: 'connected' }
```

Returns: `Promise<HealthStatus>`

---

#### `recent(bankId, limit?)`

Get recent memories.

```typescript
const recent = await client.recent("my-project", 50);
```

Returns: `Promise<Memory[]>`

---

#### `forgetAll(bankId)`

Clear all memories from a bank.

```typescript
await client.forgetAll("my-project");
```

Returns: `Promise<void>`

> Note: The Hindsight API only supports clearing all memories at once, not individual memory deletion.

---

## Mind Class

High-level orchestrator for session lifecycle.

### Constructor

```typescript
new Mind(options: MindOptions)
```

**MindOptions:**

| Property         | Type        | Default         | Description               |
| ---------------- | ----------- | --------------- | ------------------------- |
| `projectPath`    | string      | `process.cwd()` | Project root directory    |
| `bankId`         | string      | Project name    | Memory bank identifier    |
| `hindsight.host` | string      | `'localhost'`   | Hindsight server          |
| `hindsight.port` | number      | `8888`          | Hindsight port            |
| `disposition`    | Disposition | `{3,3,3}`       | Bank personality traits   |
| `background`     | string      | -               | Natural language identity |

### Lifecycle Methods

#### `init()`

Initialize connection and create bank if needed.

```typescript
await mind.init();
```

- Connects to Hindsight server
- Creates bank with disposition if not exists
- Loads semantic memory from `.claude/memory.md`
- Emits `ready` event

Returns: `Promise<void>`

---

#### `onSessionStart()`

Called at session start. Returns context to inject.

```typescript
const context = await mind.onSessionStart();
// Returns formatted context combining:
// - Semantic memory (.claude/memory.md)
// - Recent experiences
// - Relevant opinions
```

Returns: `Promise<string>`

---

#### `onContextChange(context)`

Called when context changes. Returns triggered memories.

```typescript
const memories = await mind.onContextChange({
  currentFile: "src/auth/login.ts",
  userMessage: "the login is not redirecting",
  lastError: "Cannot read property of undefined",
  entities: ["AuthProvider", "useSession"],
});
```

**Context:**

| Property      | Type     | Description            |
| ------------- | -------- | ---------------------- |
| `currentFile` | string   | Current file path      |
| `userMessage` | string   | User's message         |
| `lastError`   | string   | Last error encountered |
| `entities`    | string[] | Mentioned entities     |

Returns: `Promise<Memory[]>`

---

#### `onSessionEnd(transcript?)`

Called at session end. Reflects on session and stores observations.

```typescript
const result = await mind.onSessionEnd(sessionTranscript);

console.log(result.text);
// Summary of session insights

console.log(result.opinions);
// [{ opinion: "...", confidence: 0.9 }]
```

Process:

1. Calls reflect() to form observations about the session
2. Stores new experiences (what Claude did)
3. Updates entity relationships
4. Flags high-confidence observations for promotion

Returns: `Promise<ReflectResult>`

---

#### `learn(options?)`

Bootstrap memory from an existing codebase. Solves the **cold start problem** when adopting claude-cognitive on a mature project.

```typescript
const result = await mind.learn({
  depth: "full",
  includeGitHistory: true,
});

console.log(result.summary);
// "Learned 47 world facts, formed 12 opinions with avg confidence 0.72"
```

**LearnOptions:**

| Property              | Type                              | Default      | Description                       |
| --------------------- | --------------------------------- | ------------ | --------------------------------- |
| `depth`               | `'quick' \| 'standard' \| 'full'` | `'standard'` | How thoroughly to analyze         |
| `includeGitHistory`   | boolean                           | `true`       | Extract insights from git log     |
| `maxCommits`          | number                            | `100`        | Max commits to analyze            |
| `includeDependencies` | boolean                           | `true`       | Analyze package.json/dependencies |

**Depth Levels:**

| Depth      | What It Analyzes                                           | Use Case                       |
| ---------- | ---------------------------------------------------------- | ------------------------------ |
| `quick`    | README, CLAUDE.md, package.json, file structure            | Fast bootstrap, small projects |
| `standard` | + Key source files, configs, git history (last 50 commits) | Most projects                  |
| `full`     | + All source files, full git history, dependency analysis  | Large/complex codebases        |

**What learn() Extracts:**

| Category      | Examples                                  | Stored As            |
| ------------- | ----------------------------------------- | -------------------- |
| **Structure** | Module boundaries, file organization      | `world` facts        |
| **Stack**     | Frameworks, libraries, tools              | `world` facts        |
| **Patterns**  | Naming conventions, architecture style    | `world` + `opinions` |
| **History**   | Key commits, major changes, contributors  | `world` facts        |
| **Decisions** | README notes, comments, CLAUDE.md content | `world` facts        |

**Process:**

```
learn()
  → Scan codebase structure (Glob patterns)
  → Read key files (README, configs, CLAUDE.md)
  → Analyze patterns (naming, imports, architecture)
  → Parse git history (if enabled)
  → retain() extracted facts as 'world' memories
  → reflect() on patterns → form initial 'opinions'
  → Return summary with confidence scores
```

**LearnResult:**

```typescript
interface LearnResult {
  summary: string; // Human-readable summary
  worldFacts: number; // Count of world facts stored
  opinions: Opinion[]; // Initial opinions formed
  entities: Entity[]; // Entities discovered
  filesAnalyzed: number; // Files processed
  duration: number; // Time taken (ms)
}
```

**Disposition Effects:**

The bank's disposition affects initial opinion confidence:

- High `skepticism` → Lower confidence scores until validated
- High `literalism` → More precise, narrow facts
- Low `empathy` → Focus on technical facts only

**Example Usage:**

```typescript
// First time setup on existing project
const mind = new Mind({ projectPath: "/path/to/project" });
await mind.init();

// Check if bank is empty
const bank = await mind.getBank();
if (bank.memoryCount === 0) {
  console.log("New project, learning codebase...");
  const result = await mind.learn({ depth: "full" });
  console.log(result.summary);
}

// Now Claude starts with knowledge
const context = await mind.onSessionStart();
```

Returns: `Promise<LearnResult>`

---

### Direct Access Methods

#### `recall(query, options?)`

Direct recall without context tracking.

```typescript
const memories = await mind.recall("authentication flow", {
  factType: "experience",
  budget: "high",
});
```

Returns: `Promise<Memory[]>`

---

#### `reflect(query)`

Direct reflect without session context.

```typescript
const result = await mind.reflect(
  "What do I know about this codebase patterns?",
);
```

Returns: `Promise<ReflectResult>`

---

#### `retain(content, context?)`

Direct retain for explicit memory storage.

```typescript
await mind.retain(
  "Discovered that AuthProvider must wrap root layout for redirects to work",
  "After debugging redirect loop for 30 minutes",
);
```

Returns: `Promise<void>`

---

## SemanticMemory Class

Manages local `.claude/memory.md` file.

### Constructor

```typescript
new SemanticMemory(projectPath: string)
```

### Methods

#### `load()`

Load and parse `.claude/memory.md`.

```typescript
const semantic = new SemanticMemory("/path/to/project");
await semantic.load();
```

Returns: `Promise<void>`

---

#### `save()`

Save changes to `.claude/memory.md`.

```typescript
await semantic.save();
```

Returns: `Promise<void>`

---

#### `get(section)`

Get content of a section.

```typescript
const stack = semantic.get("Tech Stack");
// "- React Native with Expo\n- Supabase for auth"
```

Returns: `string | undefined`

---

#### `set(section, content)`

Set entire section content.

```typescript
semantic.set("Tech Stack", "- React Native 0.73\n- Expo SDK 51");
```

---

#### `append(section, item)`

Append item to section.

```typescript
semantic.append("Key Decisions", "- Chose Zustand over Redux for simplicity");
```

---

#### `toContext()`

Format as context string for injection.

```typescript
const context = semantic.toContext();
// "## Tech Stack\n- React Native...\n\n## Key Decisions\n..."
```

Returns: `string`

---

#### `promoteObservation(observation)`

Promote a high-confidence observation to semantic memory.

```typescript
await semantic.promoteObservation({
  text: "Auth changes often require corresponding navigation updates",
  confidence: 0.92,
  source: "reflect-session-2025-01-02",
});
```

Adds to Observations section with promotion date.

Returns: `Promise<void>`

---

## Memory Types

### Memory

```typescript
interface Memory {
  id: string;
  text: string;
  factType: "world" | "experience" | "opinion" | "observation";
  context?: string;

  // 5-dimension extraction
  what?: string;
  when?: string;
  where?: string;
  who?: string[];
  why?: string;

  // Metadata
  createdAt: string;
  occurredStart?: string;
  occurredEnd?: string;

  // For opinions
  confidence?: number;

  // Entity links
  entities?: Entity[];

  // Causal links
  causes?: string[];
  causedBy?: string[];
  enables?: string[];
  prevents?: string[];
}
```

### Disposition

```typescript
interface Disposition {
  skepticism: 1 | 2 | 3 | 4 | 5; // trusting → questions claims
  literalism: 1 | 2 | 3 | 4 | 5; // flexible → precise
  empathy: 1 | 2 | 3 | 4 | 5; // fact-focused → emotional
}
```

### Entity

```typescript
interface Entity {
  id: string;
  name: string;
  aliases: string[];
  type: "person" | "component" | "file" | "concept";
  coOccurrences: { entityId: string; count: number }[];
}
```

---

## Events

```typescript
const mind = new Mind(options);

mind.on("ready", () => {
  console.log("Mind initialized");
});

mind.on("memory:recalled", (memories: Memory[]) => {
  console.log("Recalled:", memories.length, "memories");
});

mind.on("memory:retained", (content: string) => {
  console.log("Retained:", content);
});

mind.on("opinion:formed", (opinion: Opinion) => {
  console.log("Opinion:", opinion.opinion, `(${opinion.confidence})`);
});

mind.on("observation:promoted", (observation: Observation) => {
  console.log("Promoted to semantic:", observation.text);
});

mind.on("error", (error: Error) => {
  console.error("Error:", error.message);
});
```

---

## MCP Server

claude-cognitive runs as an MCP (Model Context Protocol) server, providing tools that Claude can use during sessions.

### Starting the Server

```bash
claude-cognitive serve --project /path/to/project
```

The server communicates via stdio and implements the MCP protocol.

### Available Tools

#### memory_recall

Search project memories for relevant context.

```typescript
{
  name: "memory_recall",
  description: "Search project memories for relevant context. Use when you want to remember something from previous sessions or find information about the project.",
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
        default: "all",
        description: "Type of memory to search"
      },
      budget: {
        type: "string",
        enum: ["low", "mid", "high"],
        default: "mid",
        description: "Search thoroughness (affects latency)"
      }
    },
    required: ["query"]
  }
}
```

**Example usage by Claude:**

```
I need to find how authentication was implemented before.
→ memory_recall({ query: "authentication implementation" })

What do I know about this component?
→ memory_recall({ query: "UserProfile component", type: "experience" })
```

**Response format:**

```typescript
{
  memories: Memory[],
  totalFound: number,
  queryTime: number
}
```

---

#### memory_reflect

Reason about accumulated knowledge and form opinions.

```typescript
{
  name: "memory_reflect",
  description: "Reason about what you know and form opinions based on accumulated experience. Use when you want to think about patterns, make judgments, or synthesize insights.",
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

**Example usage by Claude:**

```
What patterns have I noticed about error handling in this codebase?
→ memory_reflect({ query: "error handling patterns in this codebase" })

Based on my experience, what should I consider when modifying auth?
→ memory_reflect({ query: "considerations when modifying authentication" })
```

**Response format:**

```typescript
{
  text: string,                    // Reasoned response
  opinions: Opinion[],             // New opinions formed
  basedOn: {
    world: Memory[],
    experience: Memory[],
    opinion: Memory[]
  }
}
```

---

### Claude Code Configuration

To enable claude-cognitive as an MCP server in Claude Code:

```javascript
// .claude/settings.json
{
  "mcpServers": {
    "claude-cognitive": {
      "command": "claude-cognitive",
      "args": ["serve", "--project", "."]
    }
  }
}
```

### When Claude Uses These Tools

Claude will use these tools when beneficial:

| Situation                       | Tool             | Example                                    |
| ------------------------------- | ---------------- | ------------------------------------------ |
| Trying to remember past work    | `memory_recall`  | "How did we solve this before?"            |
| Looking for project conventions | `memory_recall`  | "What's the error handling pattern?"       |
| Synthesizing learnings          | `memory_reflect` | "What have I learned about this codebase?" |
| Making judgments                | `memory_reflect` | "Should I use approach A or B?"            |

Claude is **not required** to use these tools - they're available when helpful.

---

## Hook Commands

Commands designed to be called by Claude Code hooks.

### inject-context

Called at session start to inject memory context.

```bash
claude-cognitive inject-context [--project <path>]
```

**Output:** Formatted markdown context for injection

```markdown
## Project Memory

### Semantic Knowledge

- React Native with Expo SDK 51
- Auth uses Supabase magic links

### Recent Context

- Yesterday: Fixed auth redirect in \_layout.tsx
- Opinion: This codebase prefers explicit error handling (0.85)
```

---

### process-session

Called at session end to process the transcript.

```bash
claude-cognitive process-session --transcript <path>
```

**Process:**

1. Parses transcript JSON
2. Sends to Hindsight retain() for extraction
3. Calls reflect() for observations
4. Flags high-confidence opinions for promotion

**Output:** Summary of processing

```
Processed session transcript:
- Extracted 5 memories (3 experience, 2 world)
- Formed 2 observations
- 1 opinion flagged for promotion (confidence: 0.92)
```

---

## CLI Commands

```bash
claude-cognitive init               # Initialize for project
claude-cognitive serve              # Start MCP server
claude-cognitive status             # Show connection and bank stats
claude-cognitive learn              # Bootstrap memory from codebase (cold start)
claude-cognitive learn --depth full # Full analysis with all git history
claude-cognitive recall "query"     # Manual recall
claude-cognitive reflect "query"    # Manual reflect
claude-cognitive semantic           # Show semantic memory
claude-cognitive semantic --edit    # Edit semantic memory
claude-cognitive config             # Show/edit configuration
claude-cognitive bank               # Show bank disposition
```

---

## Configuration

Configuration via `.claudemindrc` or `package.json` "claudemind" key:

```javascript
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
  "background": "Developer assistant for React Native app using Expo and Supabase",
  "semantic": {
    "path": ".claude/memory.md"
  }
}
```

---

## Error Handling

```typescript
try {
  await mind.init();
} catch (error) {
  if (error.code === "HINDSIGHT_UNAVAILABLE") {
    // Falls back to semantic-only mode
    console.log("Running in local-only mode");
  }
}
```

**Error Codes:**

| Code                    | Description                                   |
| ----------------------- | --------------------------------------------- |
| `HINDSIGHT_UNAVAILABLE` | Cannot connect to Hindsight server            |
| `BANK_NOT_FOUND`        | Bank ID doesn't exist                         |
| `INVALID_DISPOSITION`   | Disposition values not 1-5                    |
| `SEMANTIC_FILE_MISSING` | .claude/memory.md not found (created on init) |
| `SEMANTIC_PARSE_ERROR`  | Cannot parse memory.md                        |

---

## Graceful Degradation

When Hindsight is unavailable:

| Operation           | Behavior                           |
| ------------------- | ---------------------------------- |
| `onSessionStart()`  | Returns semantic memory only       |
| `onContextChange()` | Returns empty array                |
| `recall()`          | Returns empty array                |
| `reflect()`         | Returns error (requires Hindsight) |
| `retain()`          | Queued for later (if enabled)      |
| `onSessionEnd()`    | Skips reflect, logs warning        |

Semantic memory always works (local file).
