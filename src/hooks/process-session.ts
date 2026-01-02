/**
 * Session end hook - process transcript and extract memories.
 * @module hooks/process-session
 */

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { CAC } from "cac";
import { Mind } from "../mind.js";

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
 * Read transcript from file or stdin.
 */
async function readTranscript(
  filePath: string | undefined,
): Promise<string | null> {
  // If file path provided, read from file
  if (filePath) {
    try {
      return await readFile(filePath, "utf-8");
    } catch (error) {
      console.error(
        `Warning: Could not read transcript file: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  // Otherwise, try to read from stdin if it's not a TTY
  if (process.stdin.isTTY) {
    return null;
  }

  return new Promise<string>((resolve) => {
    const chunks: string[] = [];
    const rl = createInterface({
      input: process.stdin,
      terminal: false,
    });

    rl.on("line", (line) => {
      chunks.push(line);
    });

    rl.on("close", () => {
      resolve(chunks.join("\n"));
    });

    // Timeout after 5 seconds if no input
    setTimeout(() => {
      rl.close();
      resolve(chunks.join("\n"));
    }, 5000);
  });
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
        // Read transcript
        const transcript = await readTranscript(options.transcript);

        if (!transcript || transcript.trim().length === 0) {
          result.error = "No transcript provided";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        result.transcriptLength = transcript.length;

        // Initialize Mind
        const mind = new Mind({ projectPath });
        await mind.init();

        if (mind.isDegraded) {
          result.error = "Hindsight unavailable (degraded mode)";
          outputResult(result, options.json);
          process.exit(0);
          return;
        }

        // Process session end
        const reflectResult = await mind.onSessionEnd(transcript);

        result.processed = true;
        result.opinionsFormed = reflectResult?.opinions.length ?? 0;

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
      console.error(
        `process-session: Processed ${result.transcriptLength} chars, formed ${result.opinionsFormed} opinions`,
      );
    }
  }
}
