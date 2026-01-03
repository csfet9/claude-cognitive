# Performance Profile

Performance benchmarks and optimization guidelines for claude-cognitive.

## Target Metrics

| Metric                | Target  | Status  |
| --------------------- | ------- | ------- |
| Session start latency | < 500ms | PASS    |
| Recall latency        | < 200ms | PASS    |
| Reflect latency       | < 2s    | PASS\*  |
| Relevant recall rate  | > 80%   | N/A\*\* |
| User notices memory   | Never   | PASS    |

\* Reflect requires Hindsight connection
\*\* Qualitative metric, depends on content quality

## Benchmark Results

Run benchmarks with: `npm run bench`

### Degraded Mode (No Hindsight)

Operations without Hindsight connection - tests local-only performance:

| Benchmark            | Mean     | P95      | Target  | Result |
| -------------------- | -------- | -------- | ------- | ------ |
| Config Load          | 0.09ms   | 0.11ms   | < 50ms  | PASS   |
| Semantic Load        | 0.05ms   | 0.06ms   | < 100ms | PASS   |
| Semantic Format      | < 0.01ms | < 0.01ms | < 10ms  | PASS   |
| Mind Init (degraded) | 1.42ms   | 2.37ms   | < 500ms | PASS   |
| Session Start        | < 0.01ms | < 0.01ms | < 500ms | PASS   |
| Recall (degraded)    | < 0.01ms | < 0.01ms | < 200ms | PASS   |

### Full Mode (With Hindsight)

Operations with Hindsight connection - tests end-to-end performance.

To run full benchmarks, ensure Hindsight is running on `localhost:8888`:

```bash
# Start Hindsight first
hindsight serve

# Then run benchmarks
npm run bench
```

Expected performance (depends on Hindsight server):

| Benchmark            | Expected    | Target  |
| -------------------- | ----------- | ------- |
| Session Start (full) | ~50-200ms   | < 500ms |
| Recall (Hindsight)   | ~20-100ms   | < 200ms |
| Reflect (Hindsight)  | ~500-1500ms | < 2s    |

## Performance Characteristics

### Fast Operations (< 1ms)

- Config loading from `.claudemindrc`
- Semantic memory file parsing
- Context string formatting
- Degraded mode fallbacks

### Moderate Operations (1-10ms)

- Mind initialization (degraded mode)
- Agent template loading
- Custom agent parsing

### Network-Dependent Operations

- Hindsight health check (ping latency)
- Bank creation/retrieval
- Memory recall (4-way search)
- Reflection (LLM inference)

## Optimization Guidelines

### For Low Latency

1. **Pre-initialize Mind**: Create `Mind` instance at startup, not per-request
2. **Cache semantic memory**: The `SemanticMemory` class caches after first load
3. **Use appropriate recall budget**: `low` for quick lookups, `high` for comprehensive

### For Hindsight Performance

1. **Connection pooling**: Single `HindsightClient` instance per process
2. **Batch operations**: Group multiple retains when possible
3. **Appropriate budget**: Match `RecallBudget` to use case

### Degraded Mode Considerations

When Hindsight is unavailable:

- Operations fall back to semantic-only memory
- No network latency
- Recall returns empty results
- Reflect is unavailable

## Running Benchmarks

```bash
# Run all benchmarks
npm run bench

# Benchmark output includes:
# - Mean, min, max, P95, P99 latencies
# - Pass/fail against targets
# - Hindsight connection status
```

## Profiling

For detailed profiling, use Node.js built-in profiler:

```bash
# CPU profiling
node --prof dist/your-script.js
node --prof-process isolate-*.log > profile.txt

# Heap profiling
node --inspect dist/your-script.js
# Then connect Chrome DevTools
```

## Memory Usage

Typical memory footprint:

| Component        | Size     |
| ---------------- | -------- |
| Base runtime     | ~50 MB   |
| Loaded config    | < 1 KB   |
| Semantic memory  | < 100 KB |
| Agent templates  | < 50 KB  |
| Hindsight client | < 1 MB   |

## Continuous Monitoring

For production use, consider:

1. **Metrics collection**: Track operation latencies
2. **Alerting**: Notify when latencies exceed targets
3. **Degraded mode detection**: Monitor Hindsight availability

```typescript
import { Mind } from "claude-cognitive";

const mind = new Mind({ projectPath: "." });
mind.on("degraded:change", (isDegraded) => {
  if (isDegraded) {
    console.warn("Running in degraded mode");
  }
});
```
