# Feedback Signals

Track which recalled facts are useful to improve future retrieval quality.

## Overview

Not all recalled memories are equally useful. By tracking which facts your agent actually uses versus ignores, Hindsight learns to prioritize high-value memories in future recalls.

The feedback signal system enables **query-context aware scoring** - the same fact can have different usefulness scores depending on the query context.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Recall    │────▶│   Detect    │────▶│   Score &   │────▶│   Signal    │
│  Memories   │     │   Usage     │     │   Verdict   │     │   Submit    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                    ┌─────────────┐                                │
                    │   Boosted   │◀───────────────────────────────┘
                    │   Recall    │
                    └─────────────┘
```

1. **Recall** returns memories relevant to a query
2. **Detect** which facts Claude used (4 detection strategies)
3. **Score & Verdict** aggregates signals and determines used/ignored
4. **Submit** signals to Hindsight (with query context)
5. **Future recalls** with similar queries boost frequently-used facts

---

## Signal Types

| Signal        | Weight | When to Use                                |
| ------------- | ------ | ------------------------------------------ |
| `used`        | +1.0   | Agent referenced this fact in its response |
| `ignored`     | -0.5   | Agent saw but didn't use this fact         |
| `helpful`     | +1.5   | User explicitly marked as helpful          |
| `not_helpful` | -1.0   | User explicitly marked as not helpful      |

### Implicit vs Explicit Signals

- **Implicit signals** (`used`, `ignored`) come from observing agent behavior
- **Explicit signals** (`helpful`, `not_helpful`) come from user feedback
- Explicit signals have stronger weights since they're direct user input

---

## Automatic Detection

claude-cognitive automatically detects which recalled facts were used during a session. Four detection strategies run in parallel:

### Strategy 1: Explicit Reference Detection (High Confidence: 0.9)

Detects when Claude explicitly references remembered context:

```
Triggers:
- "I remember..."
- "From what I recall..."
- "Based on previous context..."
- "As mentioned before..."
- "Thanks for remembering..."
```

When a trigger is found, the surrounding sentence is matched against recalled facts using text similarity.

### Strategy 2: Semantic Similarity Detection (Medium Confidence: 0.7)

Compares Claude's response chunks against recalled facts using Jaccard similarity (word overlap):

- Response is split into overlapping chunks (50 words, 10 word overlap)
- Each chunk is compared to each recalled fact
- Threshold: 25% word overlap = semantic match
- Confidence scales with similarity score

### Strategy 3: Behavioral Signal Detection (Low Confidence: 0.4-0.5)

Correlates Claude's actions with recalled facts:

**File Access Correlation (0.4):**

- If a fact mentions `src/auth.ts` and Claude edited that file → signal

**Task Topic Correlation (0.5):**

- If a fact about "authentication" was recalled and Claude completed an auth-related task → signal

### Strategy 4: Negative Signal Detection

Detects facts that were likely NOT used:

| Signal             | Weight | Description                                    |
| ------------------ | ------ | ---------------------------------------------- |
| Low Position       | 0.2    | Fact was at end of recall list (position > 5)  |
| Topic Mismatch     | 0.3    | Fact topics don't overlap with session summary |
| Files Not Accessed | 0.2    | Fact mentions files that weren't accessed      |

Negative signals combine additively (max 0.6 ignore confidence).

---

## Score Aggregation

After detection, signals are aggregated per fact:

```typescript
interface AggregatedScore {
  factId: string;
  positiveScore: number; // Sum of use signals (0.0 - 1.0)
  negativeScore: number; // Sum of ignore signals (0.0 - 1.0)
  verdict: "used" | "ignored" | "uncertain";
  confidence: number; // Confidence in verdict
}
```

### Verdict Calculation

```
netScore = positiveScore - negativeScore

if (netScore >= 0.3):
  verdict = "used"
  confidence = min(netScore, 1.0)
elif (netScore <= -0.2):
  verdict = "ignored"
  confidence = min(abs(netScore), 1.0)
else:
  verdict = "uncertain"
  confidence = 0.5
```

Only `used` and `ignored` verdicts are submitted to Hindsight. `uncertain` facts are skipped.

---

## Offline Queue

When Hindsight is unavailable (degraded mode), feedback signals are queued locally and synced when connection is restored.

### Storage Location

```
.claude/offline-feedback.json
```

### Queue Structure

```json
{
  "version": 1,
  "signals": [
    {
      "id": "signal-1704456789-abc123",
      "factId": "uuid-of-fact",
      "signalType": "used",
      "sessionId": "session-xyz",
      "confidence": 0.85,
      "queuedAt": "2026-01-05T12:00:00Z",
      "synced": false
    }
  ],
  "lastSyncAttempt": "2026-01-05T11:00:00Z",
  "lastSyncSuccess": "2026-01-05T10:00:00Z"
}
```

### Auto-Sync

When Hindsight becomes available:

1. `attemptRecovery()` is called
2. All unsynced signals are submitted in one batch
3. Synced signals are marked and cleared
4. `feedback:synced` event is emitted

---

## CLI Commands

### feedback-stats

Show feedback queue and processing statistics:

```bash
claude-cognitive feedback-stats
claude-cognitive feedback-stats --json
```

**Output:**

```
Feedback System Status
========================================
Bank: my-project
Feedback enabled: Yes
Mode: Online

Offline Queue:
  Total signals: 15
  Pending sync: 3
  Already synced: 12
  Last sync attempt: 1/5/2026, 12:00:00 PM
  Last successful sync: 1/5/2026, 11:55:00 AM
```

### feedback-sync

Manually sync pending offline feedback signals:

```bash
claude-cognitive feedback-sync
claude-cognitive feedback-sync --clear  # Clear synced signals after
```

---

## Configuration

Enable feedback in `.claudemindrc`:

```json
{
  "feedback": {
    "enabled": true,
    "detection": {
      "explicit": true,
      "semantic": true,
      "behavioral": true,
      "semanticThreshold": 0.25
    }
  }
}
```

### Configuration Options

| Option                        | Type    | Default | Description                           |
| ----------------------------- | ------- | ------- | ------------------------------------- |
| `enabled`                     | boolean | `false` | Enable feedback system                |
| `detection.explicit`          | boolean | `true`  | Enable explicit reference detection   |
| `detection.semantic`          | boolean | `true`  | Enable semantic similarity detection  |
| `detection.behavioral`        | boolean | `true`  | Enable behavioral signal detection    |
| `detection.semanticThreshold` | number  | `0.25`  | Minimum similarity for semantic match |

---

## Events

The Mind class emits feedback-related events:

```typescript
// Feedback processed and sent to Hindsight
mind.on("feedback:processed", (info) => {
  console.log(`Session ${info.sessionId}:`, info.summary);
  // { used: 5, ignored: 3, uncertain: 2 }
});

// Signals queued offline (degraded mode)
mind.on("feedback:queued", (info) => {
  console.log(`Queued ${info.count} signals for ${info.sessionId}`);
});

// Offline signals synced to Hindsight
mind.on("feedback:synced", (info) => {
  console.log(`Synced ${info.count} feedback signals`);
});
```

---

## TypeScript API

### FeedbackService

```typescript
import { createFeedbackService } from "claude-cognitive";

const service = createFeedbackService(
  {
    enabled: true,
    detection: { explicit: true, semantic: true, behavioral: true },
  },
  "/path/to/project",
);

// Track a recall operation
await service.trackRecall(sessionId, query, memories);

// Process feedback at session end
const result = await service.processFeedback(sessionId, {
  conversationText: transcript,
  sessionActivity: {
    filesAccessed: ["src/auth.ts"],
    tasksCompleted: [{ description: "Fixed auth bug" }],
    summary: "Implemented authentication fixes",
  },
});

console.log(result.feedback);
// [{ factId: "...", signalType: "used", confidence: 0.85, ... }]
```

### Mind Integration

Feedback is automatically processed when using Mind:

```typescript
const mind = new Mind({ projectPath: "/my/project" });
await mind.init();

// Start session
await mind.onSessionStart();

// Recall tracks facts automatically when feedback is enabled
const memories = await mind.recall("authentication");

// Session end processes feedback automatically
await mind.onSessionEnd(transcript);
// ^ This detects usage, calculates verdicts, and submits signals
```

---

## Query-Context Aware Scoring

Feedback signals are tied to query context, not just the fact globally:

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

When recalling with `boostByUsefulness: true`, the system:

1. Generates an embedding for the recall query
2. Finds matching query contexts (similarity >= 0.85)
3. Uses query-specific scores when available
4. Falls back to global scores otherwise

### Recall with Usefulness Boosting

```typescript
const results = await mind.recall("authentication", {
  boostByUsefulness: true,
  usefulnessWeight: 0.3, // 30% usefulness, 70% semantic
  minUsefulness: 0.0, // No minimum threshold
});
```

---

## Score Algorithm

### Initial Score

All facts start with a neutral score of **0.5**.

### Score Updates

Each signal adjusts the score:

```
delta = signal_weight × confidence × 0.1
new_score = clamp(old_score + delta, 0.0, 1.0)
```

| Signal        | Weight | Effect on Score  |
| ------------- | ------ | ---------------- |
| `used`        | +1.0   | +0.10 per signal |
| `ignored`     | -0.5   | -0.05 per signal |
| `helpful`     | +1.5   | +0.15 per signal |
| `not_helpful` | -1.0   | -0.10 per signal |

### Time Decay

Scores decay 5% per week toward the neutral 0.5:

```
decayed_score = 0.5 + (score - 0.5) × 0.95^(days_since_last_signal / 7)
```

---

## Best Practices

### Detection Tuning

| Scenario                        | Recommendation                              |
| ------------------------------- | ------------------------------------------- |
| Claude rarely says "I remember" | Lower explicit detection, increase semantic |
| High false positives            | Increase `semanticThreshold` to 0.35+       |
| Missing obvious usage           | Enable all detection strategies             |
| Short sessions                  | Disable behavioral detection                |

### Usefulness Weight Tuning

| Use Case                           | Recommended Weight |
| ---------------------------------- | ------------------ |
| New bank (little feedback)         | 0.0-0.1            |
| Balanced exploration               | 0.2-0.3            |
| Established patterns               | 0.4-0.5            |
| Strong preference for proven facts | 0.6+               |

> **Warning**: High usefulness weights can create filter bubbles where new facts never surface. Start low and increase gradually.

---

## Related

- [Concepts](./concepts.md) - Core memory concepts
- [API Reference](./api-reference.md) - Full API documentation
- [Configuration](./configuration.md) - Client configuration options
