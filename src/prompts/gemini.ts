/**
 * Gemini code exploration guidance prompt template.
 * @module prompts/gemini
 */

import type { GeminiConfig } from "../gemini/types.js";

/**
 * Format Gemini code exploration guidance.
 * Only returns content when Gemini is configured.
 *
 * @param config - Gemini configuration, or undefined if not configured
 * @returns Formatted markdown string, or empty string if not configured
 */
export function formatGeminiGuidance(
  config: GeminiConfig | undefined,
): string {
  if (!config) {
    return "";
  }

  return `## Gemini CLI for Code Exploration

The Gemini CLI is configured for this project. Use it directly via Bash for deep code analysis. Large context window = cost-effective for scanning many files.

### CLI Usage Patterns

\`\`\`bash
# Quick summary
echo "Summarize this file in 3 bullets: $(cat path/to/file.py)" | gemini -y

# Architecture analysis (let Gemini read files directly)
echo "Analyze the architecture in src/core/. Explain patterns and data flow." | gemini -y

# Code review
echo "Review this code for bugs and security issues: $(cat path/to/file.ts)" | gemini -y

# Multi-file research
echo "Read the files in src/auth/ and explain the authentication flow" | gemini -y
\`\`\`

### Guidelines

- Use \`-y\` flag to auto-approve Gemini's tool calls
- Let Gemini read files directly for multi-file analysis (more reliable)
- Pipe file content for single-file analysis (faster)
- If Gemini fails, fall back to direct file reading with Glob/Grep/Read

### IMPORTANT: Gemini findings require verification

- Gemini is for **exploration and initial analysis**, not final authority
- Always **verify critical findings** by reading the actual code
- May produce false positives or miss context-specific patterns
- Use as a **starting point**, then confirm with targeted code review
`;
}
