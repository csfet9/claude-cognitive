# claude-mind

Persistent memory for Claude Code, powered by [Hindsight](https://github.com/vectorize-io/hindsight).

**LLM thinks. Hindsight remembers. Together = mind.**

Claude's context clears after each session. claude-mind gives Claude persistent memory across sessions - it remembers what it learned, what it did, and forms opinions about your codebase over time.

---

## Quick Start

```bash
# Install
npm install -g claude-mind

# Initialize in your project
cd /path/to/your/project
claude-mind init

# Bootstrap memory from existing codebase
claude-mind learn

# Check status
claude-mind status
```

### Configure Claude Code

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "claude-mind inject-context"
          }
        ]
      }
    ]
  },
  "mcpServers": {
    "claude-mind": {
      "command": "claude-mind",
      "args": ["serve", "--project", "."]
    }
  }
}
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  SESSION LIFECYCLE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SESSION START                                               │
│  └── Semantic memory loaded (.claude/memory.md)              │
│  └── Recent context recalled from Hindsight                  │
│  └── Claude starts informed about the project                │
│                                                              │
│  DURING SESSION                                              │
│  └── Claude uses memory_recall when helpful                  │
│  └── Claude uses memory_reflect to reason                    │
│  └── All work captured in session transcript                 │
│                                                              │
│  SESSION END                                                 │
│  └── Transcript sent to Hindsight                            │
│  └── Memories extracted automatically                        │
│  └── Observations formed for next session                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Core Operations

| Operation | What It Does |
|-----------|--------------|
| **retain** | Store memories with automatic extraction (what, when, where, who, why) |
| **recall** | 4-way parallel search: semantic + keyword + graph + temporal |
| **reflect** | Reason through the bank's disposition, form opinions |
| **learn** | Bootstrap memory from existing codebase (solves cold start) |

### Memory Types

| Type | Purpose | Example |
|------|---------|---------|
| `world` | Facts about the codebase | "Auth uses Supabase magic links" |
| `experience` | What Claude did | "I fixed the redirect by moving AuthProvider" |
| `opinion` | Beliefs with confidence | "This codebase prefers explicit patterns" (0.85) |
| `observation` | Cross-session insights | "Auth changes require navigation updates" |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLAUDE-MIND                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 CLAUDE (ORCHESTRATOR)                   │ │
│  │  • Manages workflow, delegates to agents                │ │
│  │  • Owns all memory operations                           │ │
│  │  • Uses memory_recall and memory_reflect tools          │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                  │
│  ┌─────────────────────┐    ┌─────────────────────────────┐│
│  │     HINDSIGHT       │    │   SEMANTIC MEMORY           ││
│  │  PostgreSQL+pgvector│    │   .claude/memory.md         ││
│  │                     │    │                             ││
│  │  world | experience │    │   Human-curated knowledge   ││
│  │  opinion|observation│    │   Promoted observations     ││
│  │                     │    │   Always loaded at start    ││
│  │  retain | recall    │    │                             ││
│  │  reflect            │    │                             ││
│  └─────────────────────┘    └─────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Two Memory Layers

| Layer | Storage | Purpose |
|-------|---------|---------|
| **Hindsight** | PostgreSQL + pgvector | All memories, entity graphs, 4-way retrieval, opinions |
| **Semantic** | `.claude/memory.md` | Human-curated knowledge, promoted observations |

---

## MCP Tools

When running as an MCP server, Claude has access to:

### memory_recall

Search project memories for relevant context.

```
Claude: "I remember we had issues with auth redirects..."
→ memory_recall({ query: "auth redirect issues" })
```

### memory_reflect

Reason about accumulated knowledge, form opinions.

```
Claude: "What patterns have I noticed about error handling?"
→ memory_reflect({ query: "error handling patterns" })
```

---

## CLI Commands

```bash
claude-mind init                   # Initialize for project
claude-mind serve                  # Start MCP server
claude-mind status                 # Show connection status
claude-mind learn                  # Bootstrap from codebase
claude-mind learn --depth full     # Full analysis with git history
claude-mind recall "query"         # Search memories
claude-mind reflect "query"        # Reason about knowledge
claude-mind semantic               # Show semantic memory
claude-mind config                 # Show configuration
```

---

## Configuration

### .claudemindrc

```json
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
  "background": "Developer assistant for a React Native app",
  "semantic": {
    "path": ".claude/memory.md"
  }
}
```

### Disposition Traits

Each memory bank has personality traits that shape how `reflect()` reasons:

| Trait | Low (1) | High (5) |
|-------|---------|----------|
| skepticism | Trusting | Questions claims |
| literalism | Flexible interpretation | Precise, literal |
| empathy | Fact-focused | Considers emotional context |

---

## Semantic Memory

The `.claude/memory.md` file contains human-curated project knowledge:

```markdown
## Tech Stack
- React Native with Expo SDK 51
- Supabase for auth and database
- NativeWind for styling

## Key Decisions
- Magic link auth for better mobile UX
- Zustand for state management

## Critical Paths
- Auth: src/lib/supabase.ts → src/providers/AuthProvider.tsx

## Observations
<!-- Promoted from Hindsight when confidence > 0.9 -->
- Auth changes often require navigation updates
```

This file is always loaded at session start and takes precedence over Hindsight memories when there are conflicts.

---

## Graceful Degradation

When Hindsight is unavailable, claude-mind continues working with semantic memory only:

| Operation | With Hindsight | Without Hindsight |
|-----------|----------------|-------------------|
| Session start | Full context | Semantic only |
| recall | 4-way search | Empty results |
| reflect | LLM reasoning | Error (requires Hindsight) |
| retain | Stored | Skipped |

---

## API Usage

```typescript
import { Mind } from 'claude-mind';

const mind = new Mind({
  projectPath: process.cwd(),
  disposition: { skepticism: 4, literalism: 4, empathy: 2 },
});

await mind.init();

// Get context at session start
const context = await mind.onSessionStart();

// Recall relevant memories
const memories = await mind.recall('authentication flow');

// Reason about knowledge
const reflection = await mind.reflect('What patterns exist?');

// Store new memory
await mind.retain('Fixed auth by moving Provider to root');

// Bootstrap from codebase
const result = await mind.learn({ depth: 'full' });
```

---

## Requirements

- **Node.js 18+**
- **[Hindsight](https://github.com/vectorize-io/hindsight)** server running (for full functionality)

Without Hindsight, claude-mind works in degraded mode with semantic memory only.

---

## Documentation

- **[Getting Started](./docs/getting-started.md)** - Installation and setup guide
- **[Concepts](./docs/concepts.md)** - Memory networks, operations, architecture
- **[Configuration](./docs/configuration.md)** - Full configuration reference
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Performance](./docs/performance.md)** - Benchmarks and optimization

---

## Example

See the [todo-app example](./examples/todo-app/) for a complete integration.

---

## License

MIT
