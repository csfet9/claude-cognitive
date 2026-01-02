# Setup Guide

Complete guide to integrating claude-mind with Claude Code.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Project Initialization](#3-project-initialization)
4. [Configuration](#4-configuration)
5. [Claude Code Integration](#5-claude-code-integration)
6. [Verification](#6-verification)
7. [Troubleshooting](#7-troubleshooting)
8. [Quick Reference](#8-quick-reference)

---

## 1. Prerequisites

### Required

- **Node.js 18.0.0** or higher
- **npm** or **yarn** package manager
- **Claude Code** CLI installed and authenticated

### Required for Full Functionality

- **Hindsight server** running (for memory operations)
  - See [Hindsight documentation](https://github.com/vectorize-io/hindsight)
  - Default: `localhost:8888`

### Optional

- **Git repository** (for git history analysis in `learn` command)

---

## 2. Installation

### Global Installation (Recommended)

```bash
npm install -g claude-mind
```

### Local Installation

```bash
npm install claude-mind
```

### From Source

```bash
git clone https://github.com/sfetanclaudiu/claude-mind
cd claude-mind
npm install
npm run build
npm link
```

### Verify Installation

```bash
claude-mind --version
claude-mind --help
```

---

## 3. Project Initialization

### Basic Initialization

```bash
cd /path/to/your/project
claude-mind init
```

This creates:
- `.claudemindrc` - Project configuration file
- `.claude/memory.md` - Semantic memory file (if not exists)
- Memory bank in Hindsight (if connected)

### Initialization Options

```bash
claude-mind init --bank-id my-custom-bank
claude-mind init --force  # Overwrite existing config
```

### What Gets Created

**.claudemindrc** (project configuration):
```json
{
  "hindsight": {
    "host": "localhost",
    "port": 8888
  },
  "bankId": "your-project-name",
  "disposition": {
    "skepticism": 3,
    "literalism": 3,
    "empathy": 3
  },
  "semantic": {
    "path": ".claude/memory.md"
  }
}
```

**.claude/memory.md** (semantic memory):
```markdown
# Project Memory

## Tech Stack
<!-- Add your tech stack here -->

## Key Decisions
<!-- Document important architectural decisions -->

## Critical Paths
<!-- List important code paths -->

## Observations
<!-- Promoted insights from Hindsight -->
```

---

## 4. Configuration

### Configuration Sources (Priority Order)

1. Environment variables (highest)
2. `.claudemindrc` file
3. `package.json` "claudemind" key
4. Defaults (lowest)

### .claudemindrc Reference

```json
{
  "hindsight": {
    "host": "localhost",
    "port": 8888,
    "apiKey": "optional-api-key",
    "timeout": 10000
  },
  "bankId": "my-project",
  "disposition": {
    "skepticism": 4,
    "literalism": 4,
    "empathy": 2
  },
  "background": "Developer assistant for a React Native app with Expo and Supabase",
  "semantic": {
    "path": ".claude/memory.md"
  }
}
```

### Environment Variables

```bash
export HINDSIGHT_HOST=localhost
export HINDSIGHT_PORT=8888
export HINDSIGHT_API_KEY=your-api-key
export CLAUDEMIND_BANK_ID=my-project
```

### Disposition Configuration

| Trait | 1 (Low) | 5 (High) | Recommended |
|-------|---------|----------|-------------|
| skepticism | Trusting | Questions claims | 4 for code review |
| literalism | Flexible interpretation | Precise/literal | 4 for technical work |
| empathy | Fact-focused | Considers emotional context | 2 for development |

---

## 5. Claude Code Integration

claude-mind integrates with Claude Code through two mechanisms:
1. **MCP Server** - Provides `memory_recall` and `memory_reflect` tools
2. **Session Hooks** - Automatic context injection and transcript processing

### Step 5.1: Configure MCP Server

Create or update `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "claude-mind": {
      "command": "claude-mind",
      "args": ["serve", "--project", "."]
    }
  }
}
```

Or for global Claude Code configuration (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "claude-mind": {
      "command": "claude-mind",
      "args": ["serve"]
    }
  }
}
```

### Step 5.2: Configure Session Hooks

Add hooks to `.claude/settings.json`:

```json
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

### Step 5.3: Bootstrap Memory (Recommended)

For existing projects, bootstrap memory from your codebase:

```bash
# Quick analysis (README, package.json, structure)
claude-mind learn

# Standard analysis (+ source code patterns)
claude-mind learn --depth standard

# Full analysis (all source files, git history)
claude-mind learn --depth full
```

---

## 6. Verification

### Check Status

```bash
claude-mind status
```

Expected output:
```
claude-mind status

Hindsight: Connected (localhost:8888)
Bank: my-project
  - Memories: 47
  - Last activity: 2 minutes ago
Semantic: .claude/memory.md (1.2 KB)
Degraded: No
```

### Test MCP Server

```bash
# Start server in terminal
claude-mind serve

# In another terminal, test commands
claude-mind recall "test query"
claude-mind reflect "what patterns exist"
```

### Test Hooks

```bash
# Test inject-context (should output context or empty)
claude-mind inject-context

# Test process-session
echo "test transcript" | claude-mind process-session
```

### Verify in Claude Code

1. Start Claude Code in your project directory
2. Check that MCP tools are available (mention `memory_recall`)
3. Ask Claude to use `memory_recall` to verify connection

---

## 7. Troubleshooting

### Hindsight Connection Issues

**Symptom**: "Hindsight unavailable" warnings

**Solutions**:
1. Verify Hindsight is running:
   ```bash
   curl http://localhost:8888/api/v1/health
   ```
2. Check host/port in `.claudemindrc`
3. Check firewall settings
4. Run `claude-mind status` for diagnostics

**Degraded Mode**: claude-mind continues working without Hindsight using only semantic memory.

### MCP Server Not Found

**Symptom**: Claude Code doesn't show memory tools

**Solutions**:
1. Verify global installation: `which claude-mind`
2. Check `.claude/settings.json` syntax (valid JSON?)
3. Restart Claude Code after configuration changes
4. Check Claude Code logs for MCP errors

### Hook Failures

**Symptom**: Hooks timeout or don't run

**Solutions**:
1. Test hooks manually in terminal
2. Increase timeout values in settings.json
3. Check stderr output for error messages
4. Hooks always exit 0 (won't break sessions)

### Configuration Not Loading

**Symptom**: Default values used despite config file

**Solutions**:
1. Validate JSON syntax in `.claudemindrc`
2. Check file permissions
3. Run `claude-mind config` to see loaded configuration
4. Environment variables override file config

### Memory Not Persisting

**Symptom**: Claude doesn't remember previous sessions

**Solutions**:
1. Verify Hindsight connection with `claude-mind status`
2. Check if `process-session` hook is configured
3. Manually process: `claude-mind process-session --transcript <path>`
4. Verify bank exists: `claude-mind status`

---

## 8. Quick Reference

### CLI Commands

```bash
claude-mind init               # Initialize for project
claude-mind serve              # Start MCP server
claude-mind status             # Show connection and stats
claude-mind learn              # Bootstrap memory from codebase
claude-mind learn --depth full # Full analysis with git history
claude-mind recall "query"     # Search memories
claude-mind reflect "query"    # Reason about knowledge
claude-mind semantic           # Show semantic memory
claude-mind config             # Show configuration
```

### MCP Tools (available to Claude)

| Tool | Purpose |
|------|---------|
| `memory_recall` | Search project memories for relevant context |
| `memory_reflect` | Reason about accumulated knowledge, form opinions |

### Key Files

| File | Purpose |
|------|---------|
| `.claudemindrc` | Project configuration |
| `.claude/memory.md` | Semantic memory (human-curated) |
| `.claude/settings.json` | Claude Code settings (hooks, MCP) |
| `.claude/agents/*.md` | Custom agent templates |

### Complete `.claude/settings.json` Example

```json
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

### Links

- [Architecture](./ARCHITECTURE.md) - Technical design deep-dive
- [API Reference](./API.md) - Full API documentation
- [Phases & Roadmap](./PHASES.md) - Implementation status
- [Hindsight](https://github.com/vectorize-io/hindsight) - Memory backend
