# Example: Todo App with claude-cognitive

This example demonstrates how to integrate claude-cognitive into a TypeScript project.

## Project Overview

A simple todo application that uses:

- TypeScript + Node.js
- SQLite for storage
- Express for API

## Setup

### 1. Install claude-cognitive

```bash
# Install globally
npm install -g claude-cognitive

# Or use npx
npx claude-cognitive --help
```

### 2. Initialize claude-cognitive

```bash
cd examples/todo-app
claude-cognitive init
```

This creates:

- `.claudemindrc` - Configuration file
- `.claude/memory.md` - Semantic memory (if not exists)

### 3. Bootstrap Memory (Optional)

Run the learn command to analyze the codebase:

```bash
claude-cognitive learn --depth standard
```

This extracts facts about:

- Tech stack (from package.json)
- Project structure
- Code patterns
- README content

### 4. Configure Claude Code

Add to your Claude Code settings (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "claude-cognitive inject-context --project ."
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "claude-cognitive process-session --project . --transcript $TRANSCRIPT"
          }
        ]
      }
    ]
  },
  "mcpServers": {
    "claude-cognitive": {
      "command": "claude-cognitive",
      "args": ["serve", "--project", "."]
    }
  }
}
```

## Project Structure

```
todo-app/
├── .claudemindrc           # claude-cognitive configuration
├── .claude/
│   ├── memory.md           # Semantic memory
│   └── settings.json       # Claude Code settings
├── src/
│   ├── index.ts            # Entry point
│   ├── db.ts               # Database layer
│   ├── routes.ts           # API routes
│   └── types.ts            # TypeScript types
├── package.json
└── README.md
```

## How It Works

### Session Start

When you start a Claude Code session, the inject-context hook:

1. Loads `.claude/memory.md`
2. Recalls relevant memories from Hindsight
3. Injects context into Claude's system prompt

### During Session

Claude can use MCP tools:

- `memory_recall` - Search for relevant memories
- `memory_reflect` - Reason about patterns

### Session End

When you close the session, the process-session hook:

1. Processes the full transcript
2. Extracts memories via Hindsight
3. Forms observations about patterns
4. Promotes high-confidence observations to semantic memory
5. **Sends feedback signals** about which recalled facts were actually used

### Feedback Loop (New in v0.4.0)

The feedback system tracks which memories Claude actually uses:

1. **Detection** - Identifies when Claude references recalled facts
2. **Scoring** - Calculates usefulness based on explicit references, semantic similarity, and behavioral signals
3. **Signaling** - Sends `used`/`ignored`/`helpful`/`not_helpful` signals to Hindsight
4. **Boosting** - Future recalls prioritize memories that proved useful

## Example Workflow

1. **Start coding session**

   ```
   Claude receives context about your project:
   - Tech stack: TypeScript, Express, SQLite
   - Key decisions: REST API design
   - Past experiences from previous sessions
   ```

2. **Ask Claude to add a feature**

   ```
   You: "Add a due date field to todos"

   Claude recalls:
   - Previous schema changes
   - Patterns used for dates
   - Related past experiences
   ```

3. **Claude implements with context**

   ```
   Claude uses recalled knowledge to:
   - Follow existing patterns
   - Avoid past mistakes
   - Make informed decisions
   ```

4. **Session ends**

   ```
   Hindsight captures:
   - What was changed
   - Decisions made
   - Problems solved
   - Which memories were helpful (feedback signals)
   ```

5. **Next session**
   ```
   Claude remembers:
   - The due date feature
   - How it was implemented
   - Any issues encountered
   - (Useful memories are boosted in recall)
   ```

## CLI Commands

```bash
# Show status
claude-cognitive status

# Search memories
claude-cognitive recall "database schema"

# Search with usefulness boosting
claude-cognitive recall "database schema" --boost

# Reason about patterns
claude-cognitive reflect "What patterns does this codebase use?"

# Show semantic memory
claude-cognitive semantic

# Show configuration
claude-cognitive config

# Start MCP server
claude-cognitive serve
```

## Configuration Options

See `.claudemindrc` for all options:

```json
{
  "hindsight": {
    "host": "localhost",
    "port": 8888,
    "timeouts": {
      "recall": 120000,
      "reflect": 180000,
      "retain": 90000
    }
  },
  "bankId": "todo-app",
  "disposition": {
    "skepticism": 3,
    "literalism": 4,
    "empathy": 2
  },
  "background": "A simple todo application for task management",
  "semantic": {
    "path": ".claude/memory.md"
  },
  "context": {
    "recentMemoryLimit": 3
  },
  "retain": {
    "maxTranscriptLength": 25000,
    "filterToolResults": true,
    "filterFileContents": true,
    "maxCodeBlockLines": 30,
    "minSessionLength": 500
  },
  "feedback": {
    "enabled": true,
    "detection": {
      "explicit": true,
      "semantic": true,
      "behavioral": true,
      "semanticThreshold": 0.5
    },
    "hindsight": {
      "sendFeedback": true,
      "boostByUsefulness": true,
      "boostWeight": 0.3
    }
  }
}
```

### Disposition Traits

- **Skepticism** (1-5): How much to question claims
- **Literalism** (1-5): How precisely to interpret things
- **Empathy** (1-5): How much to consider emotional context

For code-focused projects, higher literalism and lower empathy work well.

### Retain Configuration

Controls how session transcripts are processed before storing:

- **maxTranscriptLength**: Maximum transcript length before truncation (default: 25000)
- **filterToolResults**: Filter verbose tool outputs (default: true)
- **filterFileContents**: Filter file content blocks (default: true)
- **maxCodeBlockLines**: Summarize code blocks exceeding this (default: 30)
- **minSessionLength**: Skip sessions shorter than this (default: 500)

### Feedback Configuration

- **enabled**: Turn feedback loop on/off
- **detection.explicit**: Detect phrases like "based on the context"
- **detection.semantic**: Detect paraphrased usage via similarity
- **detection.behavioral**: Detect usage from file edits, commands
- **detection.semanticThreshold**: Similarity threshold for matching (default: 0.5)
- **hindsight.sendFeedback**: Send signals to Hindsight API
- **hindsight.boostByUsefulness**: Prioritize useful memories in recalls
- **hindsight.boostWeight**: How much to weight usefulness (0.0-1.0)

## Tips

1. **Keep semantic memory curated**: Edit `.claude/memory.md` to add important decisions
2. **Run learn after major changes**: Re-bootstrap to update tech stack knowledge
3. **Check status periodically**: Verify Hindsight connection is healthy
4. **Review promoted observations**: Check what patterns Claude is learning
5. **Enable feedback loop**: Helps Claude learn which memories are actually useful
