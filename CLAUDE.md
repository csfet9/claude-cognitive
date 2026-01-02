# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

claude-mind is a human-inspired memory system for Claude. It implements the insight that **LLM thinks, Hindsight remembers, together = mind**.

## Core Concept

- Claude (LLM) = thoughts, ephemeral, reasoning
- Hindsight = memory, persistent, storage
- Together = mind with continuity across sessions

## Commands

```bash
npm test                 # Run tests
npm run test:watch       # Watch mode
node bin/cli.js status   # Check status
node bin/cli.js search   # Search memories
```

## Architecture

### Three Memory Layers

1. **Semantic** (`.claude/memory.md`) - Stable project knowledge, human-curated
2. **Episodic** (Hindsight) - Recent experiences, decays over time
3. **Working** (context window) - Current session, managed by Claude

### Key Modules

```
src/
├── mind.js              # Main orchestrator
├── memory/
│   ├── semantic.js      # Local file management
│   ├── episodic.js      # Hindsight integration
│   └── meta-filter.js   # Block meta-content
├── consolidation/
│   ├── extractor.js     # Extract significant moments
│   ├── importance.js    # Score importance
│   └── abstractor.js    # Reduce to essence
└── retrieval/
    ├── triggers.js      # Extract context triggers
    └── association.js   # Find related memories
```

### Key Principles

1. **Forgetting is essential** - Most things should be forgotten
2. **Three fact types only** - DECISION, DISCOVERY, LOCATION
3. **Context triggers recall** - Not keyword search
4. **Essence over verbatim** - Store meaning, not transcripts
5. **Memory should be invisible** - User shouldn't notice it

## Implementation Status

See `docs/PHASES.md` for current progress.

## Testing

```bash
npm test                    # All tests
npx vitest run src/         # Specific directory
npx vitest run -t "pattern" # By name pattern
```
