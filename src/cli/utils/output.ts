/**
 * CLI output utilities.
 * @module cli/utils/output
 */

import type { Memory, Opinion } from "../../types.js";

// ============================================
// Output Options
// ============================================

/**
 * Output formatting options.
 */
export interface OutputOptions {
  /** Output as JSON */
  json?: boolean;
  /** Suppress output */
  quiet?: boolean;
}

// ============================================
// Output Function
// ============================================

/**
 * Output data in the appropriate format.
 *
 * @param data - Data to output
 * @param formatter - Function to format data for human-readable output
 * @param options - Output options
 */
export function output<T>(
  data: T,
  formatter: (data: T) => string,
  options: OutputOptions = {},
): void {
  if (options.quiet) return;

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatter(data));
  }
}

/**
 * Output to stderr (for messages that shouldn't interfere with piping).
 *
 * @param message - Message to output
 * @param options - Output options
 */
export function info(message: string, options: OutputOptions = {}): void {
  if (options.quiet) return;
  if (options.json) return; // Suppress info messages in JSON mode
  console.error(message);
}

/**
 * Output a warning to stderr.
 *
 * @param message - Warning message
 * @param options - Output options
 */
export function warn(message: string, options: OutputOptions = {}): void {
  if (options.quiet) return;
  if (options.json) return;
  console.error(`Warning: ${message}`);
}

// ============================================
// Formatters
// ============================================

/**
 * Format memories for human-readable output.
 */
export function formatMemories(memories: Memory[]): string {
  if (memories.length === 0) {
    return "No memories found.";
  }

  const lines: string[] = [];
  for (const memory of memories) {
    const date = new Date(memory.createdAt).toLocaleDateString();
    const type = memory.factType.toUpperCase();
    const confidence =
      memory.confidence !== undefined
        ? ` (${(memory.confidence * 100).toFixed(0)}%)`
        : "";

    lines.push(`[${type}] ${date}${confidence}`);
    lines.push(`  ${memory.text}`);
    if (memory.context) {
      lines.push(`  Context: ${memory.context}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Format opinions for human-readable output.
 */
export function formatOpinions(opinions: Opinion[]): string {
  if (opinions.length === 0) {
    return "No opinions formed.";
  }

  return opinions
    .map((op) => {
      const confidence = (op.confidence * 100).toFixed(0);
      return `- ${op.opinion} (${confidence}% confidence)`;
    })
    .join("\n");
}

/**
 * Format a status object for human-readable output.
 */
export function formatStatus(status: {
  hindsight: { healthy: boolean; version?: string; error?: string };
  bankId: string;
  memoryCount?: number;
  semanticPath: string;
  semanticLoaded: boolean;
  degraded: boolean;
}): string {
  const lines: string[] = [];

  // Hindsight status
  if (status.hindsight.healthy) {
    lines.push(
      `Hindsight: Connected${status.hindsight.version ? ` (v${status.hindsight.version})` : ""}`,
    );
  } else {
    lines.push(
      `Hindsight: Disconnected${status.hindsight.error ? ` - ${status.hindsight.error}` : ""}`,
    );
  }

  // Bank info
  lines.push(`Bank: ${status.bankId}`);
  if (status.memoryCount !== undefined) {
    lines.push(`Memories: ${status.memoryCount}`);
  }

  // Semantic memory
  lines.push(
    `Semantic: ${status.semanticPath} (${status.semanticLoaded ? "loaded" : "not loaded"})`,
  );

  // Degraded mode
  if (status.degraded) {
    lines.push("\n*** Running in DEGRADED mode (Hindsight unavailable) ***");
  }

  return lines.join("\n");
}

/**
 * Format learn result for human-readable output.
 */
export function formatLearnResult(result: {
  summary: string;
  worldFacts: number;
  opinions: Opinion[];
  filesAnalyzed: number;
  duration: number;
}): string {
  const lines: string[] = [];

  lines.push(result.summary);
  lines.push("");
  lines.push(`Stats:`);
  lines.push(`  Files analyzed: ${result.filesAnalyzed}`);
  lines.push(`  World facts stored: ${result.worldFacts}`);
  lines.push(`  Opinions formed: ${result.opinions.length}`);
  lines.push(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);

  if (result.opinions.length > 0) {
    lines.push("");
    lines.push("Opinions:");
    for (const op of result.opinions) {
      const confidence = (op.confidence * 100).toFixed(0);
      lines.push(`  - ${op.opinion} (${confidence}%)`);
    }
  }

  return lines.join("\n");
}

/**
 * Format configuration for human-readable output.
 */
export function formatConfig(config: {
  hindsight: { host: string; port: number; apiKey?: string };
  bankId?: string;
  disposition?: { skepticism: number; literalism: number; empathy: number };
  background?: string;
  semantic?: { path: string };
}): string {
  const lines: string[] = [];

  lines.push("Hindsight:");
  lines.push(`  Host: ${config.hindsight.host}`);
  lines.push(`  Port: ${config.hindsight.port}`);
  lines.push(`  API Key: ${config.hindsight.apiKey ? "***" : "(not set)"}`);

  if (config.bankId) {
    lines.push(`\nBank ID: ${config.bankId}`);
  }

  if (config.disposition) {
    lines.push("\nDisposition:");
    lines.push(`  Skepticism: ${config.disposition.skepticism}/5`);
    lines.push(`  Literalism: ${config.disposition.literalism}/5`);
    lines.push(`  Empathy: ${config.disposition.empathy}/5`);
  }

  if (config.background) {
    lines.push(`\nBackground: ${config.background}`);
  }

  if (config.semantic) {
    lines.push(`\nSemantic Memory: ${config.semantic.path}`);
  }

  return lines.join("\n");
}
