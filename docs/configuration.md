# Configuration Reference

Complete configuration options for claude-mind.

---

## Configuration Sources

Configuration is loaded from these sources (highest priority first):

1. **Environment variables**
2. **`.claudemindrc`** file in project root
3. **`package.json`** "claudemind" key
4. **Defaults**

---

## .claudemindrc

Full configuration reference:

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

### hindsight

Hindsight server connection settings.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `host` | string | `"localhost"` | Hindsight server hostname |
| `port` | number | `8888` | Hindsight server port |
| `apiKey` | string | - | Optional API key for authentication |
| `timeout` | number | `10000` | Request timeout in milliseconds |

### bankId

| Type | Default | Description |
|------|---------|-------------|
| string | Project directory name | Unique identifier for the memory bank |

### disposition

Personality traits that shape how `reflect()` reasons.

| Property | Type | Range | Default | Description |
|----------|------|-------|---------|-------------|
| `skepticism` | number | 1-5 | 3 | How much to question claims |
| `literalism` | number | 1-5 | 3 | How precisely to interpret |
| `empathy` | number | 1-5 | 3 | How much to consider emotional context |

### background

| Type | Default | Description |
|------|---------|-------------|
| string | - | Natural language identity/background for the bank |

Example:
```json
{
  "background": "I am a developer assistant for a React Native mobile app. The project uses Expo SDK 51 with Supabase for backend. I prefer explicit patterns over magic."
}
```

### semantic

Semantic memory file settings.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `path` | string | `".claude/memory.md"` | Path to semantic memory file |

---

## Environment Variables

Environment variables override file configuration.

| Variable | Maps To | Example |
|----------|---------|---------|
| `HINDSIGHT_HOST` | `hindsight.host` | `localhost` |
| `HINDSIGHT_PORT` | `hindsight.port` | `8888` |
| `HINDSIGHT_API_KEY` | `hindsight.apiKey` | `your-api-key` |
| `CLAUDEMIND_BANK_ID` | `bankId` | `my-project` |

Example:
```bash
export HINDSIGHT_HOST=localhost
export HINDSIGHT_PORT=8888
export HINDSIGHT_API_KEY=your-api-key
export CLAUDEMIND_BANK_ID=my-project
```

---

## package.json Configuration

Alternative to `.claudemindrc`:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "claudemind": {
    "bankId": "my-project",
    "disposition": {
      "skepticism": 4,
      "literalism": 4,
      "empathy": 2
    }
  }
}
```

---

## Claude Code Integration

### .claude/settings.json

Full integration configuration:

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

### MCP Server Options

```bash
claude-mind serve [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--project <path>` | `.` | Project directory path |
| `--port <port>` | - | HTTP port (enables HTTP transport) |

---

## Disposition Guidelines

### Trait Descriptions

| Trait | 1 (Low) | 5 (High) |
|-------|---------|----------|
| **Skepticism** | Trusts information at face value | Questions claims, looks for inconsistencies |
| **Literalism** | Flexible, reads between lines | Precise, exact interpretation |
| **Empathy** | Focuses on facts and data | Considers emotional context |

### Recommended Configurations

| Use Case | Skepticism | Literalism | Empathy |
|----------|------------|------------|---------|
| Code Review | 4 | 5 | 2 |
| Bug Investigation | 4 | 4 | 2 |
| Documentation | 3 | 3 | 3 |
| User Support | 2 | 2 | 5 |
| Security Audit | 5 | 5 | 1 |

---

## Semantic Memory File

### Default Structure

The `.claude/memory.md` file is created with this structure:

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

### Recommended Sections

| Section | Purpose | Example Content |
|---------|---------|-----------------|
| Tech Stack | Frameworks, libraries | "React Native with Expo SDK 51" |
| Key Decisions | Architectural choices | "Chose Zustand over Redux for simplicity" |
| Critical Paths | Important code flows | "Auth: src/lib/supabase.ts → AuthProvider" |
| Patterns | Coding conventions | "All API calls go through src/lib/api.ts" |
| Observations | Promoted insights | "Auth changes require navigation updates" |

---

## Timeout Configuration

Custom timeouts for different operations:

```json
{
  "hindsight": {
    "timeout": 10000,
    "timeouts": {
      "health": 3000,
      "recall": 15000,
      "reflect": 30000,
      "retain": 10000
    }
  }
}
```

| Operation | Default | Description |
|-----------|---------|-------------|
| `health` | 3000ms | Health check timeout |
| `recall` | 15000ms | Memory search timeout |
| `reflect` | 30000ms | LLM reasoning timeout |
| `retain` | 10000ms | Memory storage timeout |

---

## Viewing Configuration

Check loaded configuration:

```bash
claude-mind config
```

Output:
```
Configuration:
  Bank ID: my-project
  Hindsight: localhost:8888
  Disposition: { skepticism: 4, literalism: 4, empathy: 2 }
  Semantic: .claude/memory.md

Sources:
  - .claudemindrc (primary)
  - package.json claudemind key
  - Environment variables: HINDSIGHT_HOST
```
