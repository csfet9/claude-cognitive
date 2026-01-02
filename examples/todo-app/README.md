# Example: Todo App with claude-mind

This example demonstrates how to integrate claude-mind into a TypeScript project.

## Project Overview

A simple todo application that uses:
- TypeScript + Node.js
- SQLite for storage
- Express for API

## Setup

### 1. Install claude-mind

```bash
# Install globally
npm install -g claude-mind

# Or use npx
npx claude-mind --help
```

### 2. Initialize claude-mind

```bash
cd examples/todo-app
claude-mind init
```

This creates:
- `.claudemindrc` - Configuration file
- `.claude/memory.md` - Semantic memory (if not exists)

### 3. Bootstrap Memory (Optional)

Run the learn command to analyze the codebase:

```bash
claude-mind learn --depth standard
```

This extracts facts about:
- Tech stack (from package.json)
- Project structure
- Code patterns
- README content

### 4. Configure Claude Code

Add to your Claude Code settings:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "claude-mind inject-context --project ."
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
            "command": "claude-mind process-session --project . --transcript $TRANSCRIPT"
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

## Project Structure

```
todo-app/
├── .claudemindrc           # claude-mind configuration
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
   ```

5. **Next session**
   ```
   Claude remembers:
   - The due date feature
   - How it was implemented
   - Any issues encountered
   ```

## CLI Commands

```bash
# Show status
claude-mind status

# Search memories
claude-mind recall "database schema"

# Reason about patterns
claude-mind reflect "What patterns does this codebase use?"

# Show semantic memory
claude-mind semantic

# Show configuration
claude-mind config

# Start MCP server
claude-mind serve
```

## Configuration Options

See `.claudemindrc` for all options:

```json
{
  "hindsight": {
    "host": "localhost",
    "port": 8888
  },
  "bankId": "todo-app",
  "disposition": {
    "skepticism": 3,
    "literalism": 4,
    "empathy": 2
  },
  "background": "A simple todo application for task management"
}
```

### Disposition Traits

- **Skepticism** (1-5): How much to question claims
- **Literalism** (1-5): How precisely to interpret things
- **Empathy** (1-5): How much to consider emotional context

For code-focused projects, higher literalism and lower empathy work well.

## Tips

1. **Keep semantic memory curated**: Edit `.claude/memory.md` to add important decisions
2. **Run learn after major changes**: Re-bootstrap to update tech stack knowledge
3. **Check status periodically**: Verify Hindsight connection is healthy
4. **Review promoted observations**: Check what patterns Claude is learning
