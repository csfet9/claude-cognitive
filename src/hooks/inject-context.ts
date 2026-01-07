/**
 * Session start hook - inject context into Claude Code session.
 * @module hooks/inject-context
 */

import type { CAC } from "cac";
import { loadConfig } from "../config.js";
import { Mind } from "../mind.js";

interface InjectContextOptions {
  project?: string;
  timeout?: number;
}

/** Default initialization timeout in milliseconds */
const DEFAULT_TIMEOUT = 3000;

/**
 * Initialize Mind with a timeout to ensure fast execution.
 */
async function initWithTimeout(
  projectPath: string,
  timeout: number,
): Promise<Mind> {
  const mind = new Mind({ projectPath });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Mind initialization timed out")),
      timeout,
    );
  });

  await Promise.race([mind.init(), timeoutPromise]);
  return mind;
}

/**
 * Register the inject-context hook command.
 *
 * This command is called by Claude Code at session start.
 * It outputs context to stdout for injection into the session.
 *
 * IMPORTANT: This command must:
 * - Execute quickly (<500ms budget)
 * - Output context to stdout
 * - NEVER fail (always exit 0)
 */
export function registerInjectContextCommand(cli: CAC): void {
  cli
    .command("inject-context", "Inject context at session start (hook)")
    .option(
      "--project <path>",
      "Project directory (default: current directory)",
    )
    .option("--timeout <ms>", "Initialization timeout in ms (default: 3000)")
    .action(async (options: InjectContextOptions) => {
      const projectPath = options.project ?? process.cwd();
      const timeout = options.timeout ?? DEFAULT_TIMEOUT;

      try {
        // Load config to check for security review settings
        const config = await loadConfig(projectPath);
        const securityReviewEnabled = config.securityReview?.enabled === true;

        // Initialize Mind with timeout
        const mind = await initWithTimeout(projectPath, timeout);

        // Get session context
        const context = await mind.onSessionStart();

        // Build output with optional security review section at TOP
        const outputParts: string[] = [];

        if (securityReviewEnabled) {
          outputParts.push(`## Security Review Required

**MANDATORY**: Before ANY \`git commit\` command, you MUST:
1. Launch the \`security-code-reviewer\` agent to review all staged changes
2. Wait for the security review to complete
3. Address any critical/high issues found
4. Only then proceed with the commit

This policy is enforced for this project. Do not skip security review.`);
        }

        if (context.trim().length > 0) {
          outputParts.push(context);
        }

        // Output combined context to stdout
        if (outputParts.length > 0) {
          console.log(outputParts.join("\n\n"));
        }

        process.exit(0);
      } catch (error) {
        // Log error to stderr but exit successfully
        console.error(
          `inject-context warning: ${error instanceof Error ? error.message : error}`,
        );
        // Output empty string (session continues without context)
        process.exit(0);
      }
    });
}
