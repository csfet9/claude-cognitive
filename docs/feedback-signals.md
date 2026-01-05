# Feedback Signals

Track which recalled facts are useful to improve future retrieval quality.

## Overview

Not all recalled memories are equally useful. By tracking which facts your agent actually uses versus ignores, Hindsight learns to prioritize high-value memories in future recalls.

The feedback signal system enables **query-context aware scoring** - the same fact can have different usefulness scores depending on the query context.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Recall    │────▶│ Agent Uses  │────▶│   Signal    │
│  Memories   │     │ Some Facts  │     │  Feedback   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐             │
                    │   Boosted   │◀────────────┘
                    │   Recall    │
                    └─────────────┘
```

1. **Recall** returns memories relevant to a query
2. **Agent uses** some facts in its response, ignores others
3. **Submit signals** indicating which facts were useful (with query context)
4. **Future recalls** with similar queries boost frequently-used facts

## Signal Types

| Signal | Weight | When to Use |
|--------|--------|-------------|
| `used` | +1.0 | Agent referenced this fact in its response |
| `ignored` | -0.5 | Agent saw but didn't use this fact |
| `helpful` | +1.5 | User explicitly marked as helpful |
| `not_helpful` | -1.0 | User explicitly marked as not helpful |

### Implicit vs Explicit Signals

- **Implicit signals** (`used`, `ignored`) come from observing agent behavior
- **Explicit signals** (`helpful`, `not_helpful`) come from user feedback
- Explicit signals have stronger weights since they're direct user input

## Query-Context Aware Scoring

Feedback signals are tied to query context, not just the fact globally. This means:

- **Same fact, different queries = different scores**: A fact about "database pooling" might score high for queries about "connection management" but low for "authentication" queries.
- **Semantic matching**: Similar queries share scores. "Who is the CEO?" and "Who is the chief executive?" are considered the same context (cosine similarity >= 0.85).
- **Global fallback**: If no query-specific score exists, the global fact score is used.

```
┌─────────────────────────────────────────────────────────────┐
│                    Fact: "Use connection pooling"           │
├─────────────────────────────────────────────────────────────┤
│  Query Context              │  Usefulness Score             │
│─────────────────────────────│───────────────────────────────│
│  "database performance"     │  0.85 (frequently used)       │
│  "authentication methods"   │  0.35 (often ignored)         │
│  "API rate limiting"        │  0.50 (global fallback)       │
└─────────────────────────────────────────────────────────────┘
```

When recalling with `boost_by_usefulness: true`, the system:

1. Generates an embedding for the recall query
2. Finds matching query contexts (similarity >= 0.85)
3. Uses query-specific scores when available
4. Falls back to global scores otherwise

## TypeScript API

### SignalItem Interface

```typescript
interface SignalItem {
  /** UUID of the fact to signal */
  factId: string;
  /** Type of signal */
  signalType: "used" | "ignored" | "helpful" | "not_helpful";
  /** Confidence in the signal (0.0-1.0), default 1.0 */
  confidence?: number;
  /** The query that triggered the recall (REQUIRED) */
  query: string;
  /** Optional context about the signal */
  context?: string;
}
```

> **Important**: The `query` field is required to enable query-context aware scoring.

### Submitting Signals

```typescript
import { HindsightClient } from "claude-cognitive";

const client = new HindsightClient({
  bankId: "my-agent"
});

// Submit feedback after agent uses recalled facts
const query = "How do I implement authentication?";
const recalled = await client.recall({ query });

// Agent uses some facts...
const usedFactIds = ["fact-1", "fact-3"];
const ignoredFactIds = ["fact-2", "fact-4"];

// Submit signals with query context
await client.signal({
  signals: [
    ...usedFactIds.map(factId => ({
      factId,
      signalType: "used" as const,
      query,
      confidence: 1.0
    })),
    ...ignoredFactIds.map(factId => ({
      factId,
      signalType: "ignored" as const,
      query,
      confidence: 0.5
    }))
  ]
});
```

### Recall with Usefulness Boosting

```typescript
// Enable usefulness boosting for recall
const results = await client.recall({
  query: "How do I implement authentication?",
  boost_by_usefulness: true,
  usefulness_weight: 0.3,  // 30% usefulness, 70% semantic
  min_usefulness: 0.0      // No minimum threshold
});
```

## Score Algorithm

### Initial Score
All facts start with a neutral score of **0.5**.

### Score Updates

Each signal adjusts the score:

```
delta = signal_weight × confidence × 0.1
new_score = clamp(old_score + delta, 0.0, 1.0)
```

| Signal | Weight | Effect on Score |
|--------|--------|--------------------|
| `used` | +1.0 | +0.10 per signal |
| `ignored` | -0.5 | -0.05 per signal |
| `helpful` | +1.5 | +0.15 per signal |
| `not_helpful` | -1.0 | -0.10 per signal |

### Time Decay

Scores decay 5% per week toward the neutral 0.5:

```
decayed_score = 0.5 + (score - 0.5) × 0.95^(days_since_last_signal / 7)
```

This ensures recent signals matter more than old ones.

## Complete Feedback Loop Example

```typescript
import { HindsightClient } from "claude-cognitive";

async function agentWithFeedback(userQuery: string) {
  const client = new HindsightClient({ bankId: "my-agent" });

  // 1. Recall memories with usefulness boosting
  const memories = await client.recall({
    query: userQuery,
    boost_by_usefulness: true,
    usefulness_weight: 0.3
  });

  // 2. Agent generates response using some facts
  const response = await generateResponse(userQuery, memories);

  // 3. Determine which facts were used (via detection or tracking)
  const usedFactIds = detectUsedFacts(response, memories);
  const allFactIds = memories.map(m => m.id);
  const ignoredFactIds = allFactIds.filter(id => !usedFactIds.includes(id));

  // 4. Submit feedback signals with query context
  await client.signal({
    signals: [
      ...usedFactIds.map(factId => ({
        factId,
        signalType: "used" as const,
        query: userQuery,
        confidence: 1.0
      })),
      ...ignoredFactIds.map(factId => ({
        factId,
        signalType: "ignored" as const,
        query: userQuery,
        confidence: 0.5
      }))
    ]
  });

  return response;
}
```

## Best Practices

### When to Submit Signals

- **After each agent response** - Track used vs ignored facts
- **After user feedback** - Submit explicit helpful/not_helpful
- **Batch at session end** - Collect signals throughout, submit once

### Confidence Values

| Confidence | When to Use |
|------------|-------------|
| 1.0 | Certain the fact was used/ignored |
| 0.7-0.9 | High confidence from detection heuristics |
| 0.5-0.7 | Moderate confidence |
| < 0.5 | Consider not submitting |

### Usefulness Weight Tuning

| Use Case | Recommended Weight |
|----------|-------------------|
| New bank (little feedback) | 0.0-0.1 |
| Balanced exploration | 0.2-0.3 |
| Established patterns | 0.4-0.5 |
| Strong preference for proven facts | 0.6+ |

> **Warning**: High usefulness weights can create filter bubbles where new facts never surface. Start low and increase gradually.

## How Boosting Works

The final score combines semantic relevance with usefulness:

```
final_score = (1 - weight) × semantic_score + weight × usefulness_score
```

**Example with `usefulness_weight: 0.3`:**

| Fact | Semantic | Usefulness | Final Score |
|------|----------|------------|-------------|
| A | 0.80 | 0.90 | 0.7×0.80 + 0.3×0.90 = **0.83** |
| B | 0.90 | 0.30 | 0.7×0.90 + 0.3×0.30 = **0.72** |

Fact A ranks higher despite lower semantic score because it's frequently used.

## Related

- [Concepts](./concepts.md) - Core memory concepts
- [API Reference](./api-reference.md) - Full API documentation
- [Configuration](./configuration.md) - Client configuration options
