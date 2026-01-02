/**
 * Performance benchmarks for Mind class operations.
 * @module tests/perf/mind.bench
 *
 * Target metrics from PHASES.md:
 * - Session start latency: < 500ms
 * - Recall latency: < 200ms
 * - Reflect latency: < 2s
 *
 * Run with: npx tsx tests/perf/mind.bench.ts
 */

import { runBenchmarkSuite, benchmark, formatResultsTable } from "./benchmark.js";
import { Mind } from "../../src/mind.js";
import { SemanticMemory } from "../../src/semantic.js";
import { HindsightClient } from "../../src/client.js";
import { loadConfig } from "../../src/config.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

// Test targets (in ms)
const TARGETS = {
  SESSION_START: 500,
  RECALL: 200,
  REFLECT: 2000,
  CONFIG_LOAD: 50,
  SEMANTIC_LOAD: 100,
  SEMANTIC_FORMAT: 10,
};

async function main() {
  console.log("=".repeat(80));
  console.log("CLAUDE-MIND PERFORMANCE BENCHMARKS");
  console.log("=".repeat(80));

  // Create temp directory for tests
  const suffix = randomBytes(8).toString("hex");
  const tempDir = join(tmpdir(), `claude-mind-bench-${suffix}`);
  await mkdir(tempDir, { recursive: true });
  await mkdir(join(tempDir, ".claude"), { recursive: true });

  // Create test files
  await writeFile(
    join(tempDir, ".claudemindrc"),
    JSON.stringify({
      hindsight: { host: "localhost", port: 8888 },
      bankId: "bench-test",
      disposition: { skepticism: 3, literalism: 3, empathy: 3 },
    }),
  );

  await writeFile(
    join(tempDir, ".claude", "memory.md"),
    `# Project Memory

## Tech Stack
- TypeScript with Node.js
- Vitest for testing
- PostgreSQL with pgvector

## Key Decisions
- Use Hindsight for memory backend
- Support both MCP and hooks integration
- Prioritize developer experience

## Critical Paths
- src/client.ts - Hindsight API client
- src/mind.ts - Mind orchestrator
- src/semantic.ts - Semantic memory layer

## Observations
- Performance is critical for user experience
- Memory operations should be invisible to users
`,
  );

  try {
    // Run benchmarks
    const results: Array<{ result: Awaited<ReturnType<typeof benchmark>>; target?: number }> = [];

    // 1. Config loading benchmark
    console.log("\n[1/6] Benchmarking config loading...");
    const configResult = await benchmark(
      "Config Load",
      async () => {
        await loadConfig(tempDir);
      },
      { iterations: 20 },
    );
    results.push({ result: configResult, target: TARGETS.CONFIG_LOAD });
    console.log(`  Mean: ${configResult.mean.toFixed(2)}ms (target: <${TARGETS.CONFIG_LOAD}ms)`);

    // 2. Semantic memory load benchmark
    console.log("\n[2/6] Benchmarking semantic memory loading...");
    const semanticLoadResult = await benchmark(
      "Semantic Load",
      async () => {
        const semantic = new SemanticMemory(tempDir);
        await semantic.load();
      },
      { iterations: 20 },
    );
    results.push({ result: semanticLoadResult, target: TARGETS.SEMANTIC_LOAD });
    console.log(`  Mean: ${semanticLoadResult.mean.toFixed(2)}ms (target: <${TARGETS.SEMANTIC_LOAD}ms)`);

    // 3. Semantic toContext benchmark
    console.log("\n[3/6] Benchmarking semantic context formatting...");
    const semantic = new SemanticMemory(tempDir);
    await semantic.load();
    const semanticFormatResult = await benchmark(
      "Semantic Format",
      async () => {
        semantic.toContext();
      },
      { iterations: 100 },
    );
    results.push({ result: semanticFormatResult, target: TARGETS.SEMANTIC_FORMAT });
    console.log(`  Mean: ${semanticFormatResult.mean.toFixed(2)}ms (target: <${TARGETS.SEMANTIC_FORMAT}ms)`);

    // 4. Mind initialization (without Hindsight)
    console.log("\n[4/6] Benchmarking Mind init (degraded mode)...");
    const mindInitResult = await benchmark(
      "Mind Init (degraded)",
      async () => {
        const mind = new Mind({ projectPath: tempDir });
        mind.on("error", () => {}); // Suppress error events in degraded mode
        await mind.init();
      },
      { iterations: 10 },
    );
    results.push({ result: mindInitResult, target: TARGETS.SESSION_START });
    console.log(`  Mean: ${mindInitResult.mean.toFixed(2)}ms (target: <${TARGETS.SESSION_START}ms)`);

    // 5. Session start (degraded mode - no Hindsight)
    console.log("\n[5/6] Benchmarking session start (degraded mode)...");
    const mind = new Mind({ projectPath: tempDir });
    mind.on("error", () => {}); // Suppress error events in degraded mode
    await mind.init();
    const sessionStartResult = await benchmark(
      "Session Start (degraded)",
      async () => {
        await mind.onSessionStart();
      },
      { iterations: 20 },
    );
    results.push({ result: sessionStartResult, target: TARGETS.SESSION_START });
    console.log(`  Mean: ${sessionStartResult.mean.toFixed(2)}ms (target: <${TARGETS.SESSION_START}ms)`);

    // 6. Recall (degraded mode)
    console.log("\n[6/6] Benchmarking recall (degraded mode)...");
    const recallResult = await benchmark(
      "Recall (degraded)",
      async () => {
        await mind.recall("test query");
      },
      { iterations: 20 },
    );
    results.push({ result: recallResult, target: TARGETS.RECALL });
    console.log(`  Mean: ${recallResult.mean.toFixed(2)}ms (target: <${TARGETS.RECALL}ms)`);

    // Print summary table
    console.log("\n" + "=".repeat(80));
    console.log("RESULTS SUMMARY");
    console.log("=".repeat(80));
    console.log(formatResultsTable(results));

    // Check if Hindsight is available for full benchmarks
    console.log("\n" + "=".repeat(80));
    console.log("HINDSIGHT CONNECTION TEST");
    console.log("=".repeat(80));

    try {
      const client = new HindsightClient({ host: "localhost", port: 8888 });
      const health = await client.health();
      console.log(`\nHindsight Status: ${health.status}`);
      console.log(`Version: ${health.version || "unknown"}`);

      if (health.status === "healthy") {
        console.log("\nRunning full benchmarks with Hindsight...\n");

        // Create a test bank
        const testBankId = `bench-${Date.now()}`;
        await client.createBank({
          bankId: testBankId,
          disposition: { skepticism: 3, literalism: 3, empathy: 3 },
          background: "Performance benchmark test bank",
        });

        // Retain some test data
        await client.retain(
          testBankId,
          "The project uses TypeScript for type safety",
          "benchmark test data",
        );
        await client.retain(
          testBankId,
          "Authentication is handled via Supabase magic links",
          "benchmark test data",
        );

        // Benchmark recall with Hindsight
        const recallHindsightResult = await benchmark(
          "Recall (Hindsight)",
          async () => {
            await client.recall(testBankId, "TypeScript");
          },
          { iterations: 10 },
        );
        console.log(`  Recall (Hindsight): ${recallHindsightResult.mean.toFixed(2)}ms (target: <${TARGETS.RECALL}ms) [${recallHindsightResult.mean <= TARGETS.RECALL ? "PASS" : "FAIL"}]`);

        // Benchmark reflect with Hindsight
        const reflectHindsightResult = await benchmark(
          "Reflect (Hindsight)",
          async () => {
            await client.reflect(testBankId, "What do I know about the tech stack?");
          },
          { iterations: 5, warmup: 1 },
        );
        console.log(`  Reflect (Hindsight): ${reflectHindsightResult.mean.toFixed(2)}ms (target: <${TARGETS.REFLECT}ms) [${reflectHindsightResult.mean <= TARGETS.REFLECT ? "PASS" : "FAIL"}]`);

        // Full session start with Hindsight
        const mindFull = new Mind({ projectPath: tempDir });
        await mindFull.init();
        const sessionFullResult = await benchmark(
          "Session Start (full)",
          async () => {
            await mindFull.onSessionStart();
          },
          { iterations: 10, warmup: 2 },
        );
        console.log(`  Session Start (full): ${sessionFullResult.mean.toFixed(2)}ms (target: <${TARGETS.SESSION_START}ms) [${sessionFullResult.mean <= TARGETS.SESSION_START ? "PASS" : "FAIL"}]`);

        // Clean up test bank
        try {
          await client.deleteBank(testBankId);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.log("\nHindsight not available - skipping full benchmarks");
      console.log("To run full benchmarks, start Hindsight server on localhost:8888");
    }

    // Final summary
    console.log("\n" + "=".repeat(80));
    console.log("BENCHMARK COMPLETE");
    console.log("=".repeat(80));

    const passed = results.filter(
      (r) => r.target === undefined || r.result.mean <= r.target,
    ).length;
    const total = results.length;
    console.log(`\nResults: ${passed}/${total} benchmarks passed`);

    if (passed === total) {
      console.log("All performance targets met!\n");
    } else {
      console.log("Some benchmarks exceeded targets. Review results above.\n");
    }
  } finally {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(console.error);
