/**
 * Content filtering for session transcripts.
 * @module hooks/filters
 *
 * Provides pattern-based filtering to remove noise from transcripts
 * before they are retained as memories. Filters tool results, file
 * contents, base64 data, large JSON, and other non-meaningful content.
 */

import type { RetainFilterConfig } from "../types.js";

interface FilterPattern {
  pattern: RegExp;
  replacement: string;
}

const TOOL_RESULT_PATTERNS: FilterPattern[] = [
  {
    pattern: /<tool-result>[\s\S]*?<\/tool-result>/g,
    replacement: "[Tool result filtered]",
  },
  {
    pattern: /<read-file-result>[\s\S]*?<\/read-file-result>/g,
    replacement: "[File read filtered]",
  },
  {
    pattern: /<glob-result>[\s\S]*?<\/glob-result>/g,
    replacement: "[Glob result filtered]",
  },
  {
    pattern: /<grep-result>[\s\S]*?<\/grep-result>/g,
    replacement: "[Grep result filtered]",
  },
  {
    pattern: /<bash-stdout>[\s\S]*?<\/bash-stdout>/g,
    replacement: "[Command output filtered]",
  },
];

const FILE_CONTENT_PATTERNS: FilterPattern[] = [
  {
    pattern: /<file-contents[^>]*>[\s\S]*?<\/file-contents>/g,
    replacement: "[File contents filtered]",
  },
  {
    pattern: /<file-content[^>]*>[\s\S]*?<\/file-content>/g,
    replacement: "[File content filtered]",
  },
];

/**
 * Additional noise patterns to filter.
 */
const NOISE_PATTERNS: FilterPattern[] = [
  // System reminders injected by Claude Code
  {
    pattern: /<system-reminder>[\s\S]*?<\/system-reminder>/g,
    replacement: "",
  },
  // Base64 encoded content (images, binaries)
  {
    pattern: /data:[a-z]+\/[a-z+.-]+;base64,[A-Za-z0-9+/=]{100,}/g,
    replacement: "[Base64 data filtered]",
  },
  // Long JSON objects (more than 500 chars)
  {
    pattern: /\{(?:[^{}]|\{[^{}]*\}){500,}\}/g,
    replacement: "[Large JSON filtered]",
  },
  // Diff/patch content
  {
    pattern: /^[-+]{3} [ab]\/.*$[\s\S]*?(?=^[-+]{3} |$(?![\s\S]))/gm,
    replacement: "[Diff filtered]",
  },
  // Stack traces (keep first line, filter rest)
  {
    pattern:
      /((?:Error|Exception|TypeError|ReferenceError|SyntaxError)[^\n]*)\n(?:\s+at [^\n]+\n?)+/g,
    replacement: "$1 [stack trace filtered]",
  },
  // XML/HTML blocks (more than 500 chars)
  {
    pattern: /<[a-z][a-z0-9-]*(?:\s[^>]*)?>[\s\S]{500,}?<\/[a-z][a-z0-9-]*>/gi,
    replacement: "[Large XML/HTML filtered]",
  },
];

/**
 * Summarize long code blocks while preserving shorter ones.
 * Replaces code blocks exceeding maxLines with a placeholder showing language and line count.
 */
export function summarizeLongCodeBlocks(
  content: string,
  maxLines: number,
): string {
  return content.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const lines = code.split("\n").length;
    if (lines > maxLines) {
      const language = lang || "code";
      return `[Code block: ${lines} lines of ${language}]`;
    }
    return match;
  });
}

/**
 * Truncate lines that exceed the maximum length.
 */
export function truncateLongLines(
  content: string,
  maxLength: number,
): string {
  return content
    .split("\n")
    .map((line) => {
      if (line.length > maxLength) {
        return line.slice(0, maxLength) + "... [truncated]";
      }
      return line;
    })
    .join("\n");
}

/**
 * Apply content filters to transcript based on configuration.
 */
export function applyFilters(
  content: string,
  config: RetainFilterConfig,
): string {
  let filtered = content;

  // Filter tool results
  if (config.filterToolResults !== false) {
    for (const { pattern, replacement } of TOOL_RESULT_PATTERNS) {
      filtered = filtered.replace(pattern, replacement);
    }
  }

  // Filter file contents
  if (config.filterFileContents !== false) {
    for (const { pattern, replacement } of FILE_CONTENT_PATTERNS) {
      filtered = filtered.replace(pattern, replacement);
    }
  }

  // Filter noise patterns (system reminders, base64, large JSON, etc.)
  for (const { pattern, replacement } of NOISE_PATTERNS) {
    filtered = filtered.replace(pattern, replacement);
  }

  // Summarize long code blocks
  const maxCodeBlockLines = config.maxCodeBlockLines ?? 30;
  if (maxCodeBlockLines > 0) {
    filtered = summarizeLongCodeBlocks(filtered, maxCodeBlockLines);
  }

  // Truncate long lines
  const maxLineLength = config.maxLineLength ?? 1000;
  if (maxLineLength > 0) {
    filtered = truncateLongLines(filtered, maxLineLength);
  }

  // Clean up excessive whitespace
  filtered = filtered.replace(/\n{4,}/g, "\n\n\n");

  return filtered;
}

/**
 * Determine if a session should be skipped based on content analysis.
 * Skips sessions that are too short or mostly tool outputs.
 */
export function shouldSkipSession(
  transcript: string,
  config: RetainFilterConfig,
): { skip: boolean; reason?: string } {
  // Skip if too short
  const minLength = config.minSessionLength ?? 200;
  if (transcript.length < minLength) {
    return {
      skip: true,
      reason: `Session too short (${transcript.length} < ${minLength} chars)`,
    };
  }

  // Skip if mostly tool outputs (heuristic check)
  if (config.skipToolOnlySessions !== false) {
    const filterPlaceholders = [
      "[Tool result filtered]",
      "[File read filtered]",
      "[File contents filtered]",
      "[File content filtered]",
      "[Glob result filtered]",
      "[Grep result filtered]",
      "[Command output filtered]",
      "[Code block:",
    ];

    let placeholderCount = 0;
    for (const placeholder of filterPlaceholders) {
      const regex = new RegExp(placeholder.replace(/[[\]]/g, "\\$&"), "g");
      const matches = transcript.match(regex);
      placeholderCount += matches?.length ?? 0;
    }

    // If more than 80% of content is filtered placeholders, skip
    const estimatedFilteredChars = placeholderCount * 50;
    if (
      transcript.length > 0 &&
      estimatedFilteredChars / transcript.length > 0.8
    ) {
      return { skip: true, reason: "Session is mostly tool outputs" };
    }
  }

  // Apply custom skip patterns if configured
  if (config.customSkipPatterns) {
    for (const patternStr of config.customSkipPatterns) {
      try {
        const regex = new RegExp(patternStr);
        if (regex.test(transcript)) {
          return {
            skip: true,
            reason: `Matched custom skip pattern: ${patternStr}`,
          };
        }
      } catch {
        // Skip invalid regex patterns
        continue;
      }
    }
  }

  return { skip: false };
}
