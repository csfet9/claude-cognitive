/**
 * Performance benchmarking utilities.
 * @module tests/perf/benchmark
 */

export interface BenchmarkResult {
  name: string;
  samples: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  opsPerSecond: number;
}

export interface BenchmarkOptions {
  /** Number of warmup iterations (default: 3) */
  warmup?: number;
  /** Number of measured iterations (default: 10) */
  iterations?: number;
  /** Timeout per iteration in ms (default: 30000) */
  timeout?: number;
}

/**
 * Run a benchmark on an async function.
 */
export async function benchmark(
  name: string,
  fn: () => Promise<void>,
  options: BenchmarkOptions = {},
): Promise<BenchmarkResult> {
  const { warmup = 3, iterations = 10 } = options;

  // Warmup phase
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Measurement phase
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Calculate statistics
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = times[0] ?? 0;
  const max = times[times.length - 1] ?? 0;
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const p99 = percentile(times, 99);

  const variance =
    times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const opsPerSecond = 1000 / mean;

  return {
    name,
    samples: iterations,
    mean,
    min,
    max,
    p50,
    p95,
    p99,
    stdDev,
    opsPerSecond,
  };
}

/**
 * Calculate percentile from sorted array.
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Format benchmark result as a table row.
 */
export function formatResult(result: BenchmarkResult, target?: number): string {
  const status = target ? (result.mean <= target ? "PASS" : "FAIL") : "";
  const targetStr = target ? `${target}ms` : "-";

  return [
    result.name.padEnd(25),
    `${result.mean.toFixed(2)}ms`.padStart(12),
    `${result.min.toFixed(2)}ms`.padStart(12),
    `${result.max.toFixed(2)}ms`.padStart(12),
    `${result.p95.toFixed(2)}ms`.padStart(12),
    targetStr.padStart(10),
    status.padStart(6),
  ].join(" | ");
}

/**
 * Format benchmark results as a table.
 */
export function formatResultsTable(
  results: Array<{ result: BenchmarkResult; target?: number }>,
): string {
  const header = [
    "Benchmark".padEnd(25),
    "Mean".padStart(12),
    "Min".padStart(12),
    "Max".padStart(12),
    "P95".padStart(12),
    "Target".padStart(10),
    "Status".padStart(6),
  ].join(" | ");

  const separator = "-".repeat(header.length);

  const rows = results.map(({ result, target }) =>
    formatResult(result, target),
  );

  return [separator, header, separator, ...rows, separator].join("\n");
}

/**
 * Run a suite of benchmarks and return formatted results.
 */
export async function runBenchmarkSuite(
  suite: Array<{
    name: string;
    fn: () => Promise<void>;
    target?: number;
    options?: BenchmarkOptions;
  }>,
): Promise<string> {
  const results: Array<{ result: BenchmarkResult; target?: number }> = [];

  console.log("\nRunning benchmarks...\n");

  for (const { name, fn, target, options } of suite) {
    process.stdout.write(`  ${name}...`);
    const result = await benchmark(name, fn, options);
    const status = target ? (result.mean <= target ? "PASS" : "FAIL") : "OK";
    console.log(` ${result.mean.toFixed(2)}ms [${status}]`);
    results.push({ result, target });
  }

  console.log("\n");
  return formatResultsTable(results);
}
