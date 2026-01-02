# Getting Started

Complete guide to installing and configuring claude-cognitive with Claude Code.

---

## Prerequisites

### Required

- **Node.js 18+**
- **npm** or **yarn**
- **Claude Code** CLI installed

### For Full Functionality

- **[Hindsight](https://github.com/vectorize-io/hindsight)** server running
  - Default: `localhost:8888`

### Optional

- **Git repository** (for git history analysis in `learn` command)

---

## Installation

### Global (Recommended)

```bash
npm install -g claude-cognitive
```

### Local

```bash
npm install claude-cognitive
```

### From Source

```bash
git clone https://github.com/sfetanclaudiu/claude-cognitive
cd claude-cognitive
npm install
npm run build
npm link
```

### Verify

```bash
claude-cognitive --version
claude-cognitive --help
```

---

## Project Setup

### 1. Initialize

```bash
cd /path/to/your/project
claude-cognitive init
```

This creates:
- `.claudemindrc` - Project configuration
- `.claude/memory.md` - Semantic memory file
- Memory bank in Hindsight (if connected)

Options:
```bash
claude-cognitive init --bank-id my-custom-bank
claude-cognitive init --force  # Overwrite existing config
```

### 2. Bootstrap Memory (Recommended)

For existing projects, bootstrap memory from your codebase:

```bash
# Quick (README, package.json, structure)
claude-cognitive learn

# Standard (+ source code patterns)
claude-cognitive learn --depth standard

# Full (all source files, git history)
claude-cognitive learn --depth full
```

### 3. Configure Claude Code

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
            "command": "claude-cognitive inject-context"
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

For global configuration, use `~/.claude/settings.json`.

---

## Verification

### Check Status

```bash
claude-cognitive status
```

Expected output:
```
Hindsight: Connected (localhost:8888)
Bank: my-project
  - Memories: 47
Semantic: .claude/memory.md (loaded)
Degraded: No
```

### Test MCP Server

```bash
# Start server
claude-cognitive serve

# Test commands
claude-cognitive recall "test query"
claude-cognitive reflect "what patterns exist"
```

### Verify in Claude Code

1. Start Claude Code in your project directory
2. Check that MCP tools are available
3. Ask Claude to use `memory_recall` to verify connection

---

## Troubleshooting

### Hindsight Connection Issues

**Symptom**: "Hindsight unavailable" warnings

**Solutions**:
1. Verify Hindsight is running:
   ```bash
   curl http://localhost:8888/health
   ```
2. Check host/port in `.claudemindrc`
3. Run `claude-cognitive status` for diagnostics

**Note**: claude-cognitive continues working in degraded mode using only semantic memory.

### MCP Server Not Found

**Symptom**: Claude Code doesn't show memory tools

**Solutions**:
1. Verify installation: `which claude-cognitive`
2. Check `.claude/settings.json` syntax
3. Restart Claude Code after configuration changes

### Configuration Not Loading

**Symptom**: Default values used despite config file

**Solutions**:
1. Validate JSON syntax in `.claudemindrc`
2. Check file permissions
3. Run `claude-cognitive config` to see loaded configuration
4. Environment variables override file config

---

## Quick Reference

### CLI Commands

```bash
claude-cognitive init               # Initialize project
claude-cognitive serve              # Start MCP server
claude-cognitive status             # Show connection status
claude-cognitive learn              # Bootstrap from codebase
claude-cognitive recall "query"     # Search memories
claude-cognitive reflect "query"    # Reason about knowledge
claude-cognitive semantic           # Show semantic memory
claude-cognitive config             # Show configuration
```

### Key Files

| File | Purpose |
|------|---------|
| `.claudemindrc` | Project configuration |
| `.claude/memory.md` | Semantic memory |
| `.claude/settings.json` | Claude Code settings |

### MCP Tools

| Tool | Purpose |
|------|---------|
| `memory_recall` | Search project memories |
| `memory_reflect` | Reason about knowledge |
