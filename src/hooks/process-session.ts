/**
 * Session end hook - process transcript and extract memories.
 * @module hooks/process-session
 *
 * Safety filters:
 * - Only processes projects with .claudemindrc
 * - The stop hook script also filters agent sessions by filename
 * - Content filtering removes noise (tool results, file contents, long code blocks)
 * - Session skip logic filters low-value sessions
 */

import { access } from "node:fs/promises";
import { join } from "node:path";
import type { CAC } from "cac";
import { Mind } from "../mind.js";
import { loadConfig, DEFAULT_RETAIN_FILTER } from "../config.js";
import { applyFilters, shouldSkipSession } from "./filters.js";
import { readTranscript } from "./transcript.js";

interface ProcessSessionOptions {
  project?: string;
  transcript?: string;
  json?: boolean;
}

interface ProcessResult {
  processed: boolean;
  transcriptLength: number;
  opinionsFormed: number;
  error?: string;
}

/**
 * Check if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Register the process-session hook command.
 *
 * This command is called by Claude Code at session end.
 * It processes the session transcript and extracts memories.
 *
 * IMPORTANT: This command must:
 * - Accept transcript from file or stdin
 * - Log to stderr only
 * - NEVER fail (always exit 0)
 */
export function registerProcessSessionCommand(cli: CAC): void {
  cli
    .command("process-session", "Process session transcript (hook)")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--transcript <path>", "Path to transcript file")
    .option("--json", "Output result as JSON")
    .action(async (options: ProcessSessionOptions) => {
      const projectPath = options.project ?? process.cwd();

      const result: ProcessResult = {
        processed: false,
        transcriptLength: 0,
        opinionsFormed: 0,
      };

      try {
        // Safety check: Only process if .claudemindrc exists in project
        const configPath = join(projectPath, ".claudemindrc");
        if (!(await fileExists(configPath))) {
          result.error = "No .claudemindrc found (skipping)";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Load configuration
        const config = await loadConfig(projectPath);
        const filterConfig = config.retainFilter ?? DEFAULT_RETAIN_FILTER;

        // Read transcript
        const { transcript: rawTranscript } = await readTranscript(
          options.transcript,
        );
        let transcript = rawTranscript;

        if (!transcript || transcript.trim().length === 0) {
          result.error = "No transcript provided";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Step 1: Apply content filters
        transcript = applyFilters(transcript, filterConfig);

        // Step 2: Check if session should be skipped
        const skipResult = shouldSkipSession(transcript, filterConfig);
        if (skipResult.skip) {
          result.error = `Session skipped: ${skipResult.reason}`;
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Step 3: Truncate if too long
        const maxLength = filterConfig.maxTranscriptLength ?? 25000;
        if (transcript.length > maxLength) {
          transcript = transcript.slice(0, maxLength) + "\n[Truncated]";
        }

        result.transcriptLength = transcript.length;

        // Initialize Mind
        const mind = new Mind({ projectPath });
        await mind.init();

        // Process session end (works in both online and offline mode)
        const reflectResult = await mind.onSessionEnd(transcript);

        result.processed = true;
        result.opinionsFormed = reflectResult?.opinions.length ?? 0;

        if (mind.isDegraded) {
          result.error = "Stored offline (Hindsight unavailable)";
        }

        outputResult(result, options.json);
        process.exit(0);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        outputResult(result, options.json);
        // Always exit 0 to not break Claude Code
        process.exit(0);
      }
    });
}

/**
 * Output result to stderr (or stdout for JSON mode).
 */
function outputResult(result: ProcessResult, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.error) {
      console.error(`process-session: ${result.error}`);
    } else if (result.processed) {
      const message = `process-session: Processed ${result.transcriptLength} chars, formed ${result.opinionsFormed} opinions`;
      console.error(message);
    }
  }
}

// Re-export filtering functions for backward compatibility with tests
export {
  summarizeLongCodeBlocks as _summarizeLongCodeBlocks,
  truncateLongLines as _truncateLongLines,
  applyFilters as _applyFilters,
  shouldSkipSession as _shouldSkipSession,
} from "./filters.js";
