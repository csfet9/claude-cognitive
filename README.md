# claude-mind

Human-inspired memory system for Claude.

**LLM thinks. Hindsight remembers. Together = mind.**

---

## The Vision

```
┌─────────────────────────────────────────────────────────────┐
│                       CLAUDE + HINDSIGHT                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Claude (LLM)               Hindsight                      │
│   ────────────               ─────────                      │
│   - Context clears           - Persists                     │
│   - Thinks, reasons          - Stores, retrieves            │
│   - Current session          - Across sessions              │
│   - Reconstructs meaning     - Provides fragments           │
│                                                             │
│              └──────── work together ────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The LLM doesn't need to "remember" - it **thinks**.
Hindsight doesn't need to "think" - it **remembers**.

This separation mirrors human cognition:
- Thoughts are ephemeral
- Memories persist
- Recall reconstructs from fragments

---

## Core Principles

1. **Forgetting is essential** - Most things should be forgotten. Only important persists.
2. **Context triggers recall** - Memories activated by similarity, not keyword search.
3. **Essence over verbatim** - Store meaning, not transcripts.
4. **Automatic consolidation** - Session end = sleep. Process and strengthen.
5. **Invisible to user** - Memory should just work. No commands needed.

---

## Architecture

### Three Memory Layers

| Layer | Analogy | Storage | Lifetime |
|-------|---------|---------|----------|
| Working | Conscious thought | Context window | Session |
| Episodic | Recent experiences | Hindsight | Days/weeks |
| Semantic | Project knowledge | Local file | Long-term |

### Four Operations

```javascript
store(fact, type)    // Explicit store after consolidation
search(query)        // Context-triggered search
remove(factId)       // Manual cleanup
recent(days)         // Review recent memories
```

---

## Project Structure

```
claude-mind/
├── src/
│   ├── index.js              # Main API
│   ├── memory/
│   │   ├── working.js        # Context window management
│   │   ├── episodic.js       # Hindsight integration
│   │   └── semantic.js       # Local file (.claude/memory.md)
│   ├── consolidation/
│   │   ├── extractor.js      # Extract significant moments
│   │   ├── importance.js     # Score importance
│   │   ├── abstractor.js     # Essence extraction
│   │   └── index.js          # Session-end processing
│   └── retrieval/
│       ├── triggers.js       # Context-based triggers
│       ├── association.js    # Semantic similarity
│       └── index.js          # Recall orchestration
├── tests/
├── docs/
│   ├── ARCHITECTURE.md       # Technical design
│   ├── PHASES.md             # Implementation phases
│   └── API.md                # API reference
└── bin/
    └── cli.js                # CLI entry point
```

---

## Status

**Phase 0: Setup** - In progress

See [docs/PHASES.md](./docs/PHASES.md) for implementation roadmap.

---

## License

MIT
