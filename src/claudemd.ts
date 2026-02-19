/**
 * CLAUDE.md managed section writer.
 *
 * Manages a delimited section in the project's CLAUDE.md file for
 * static instructions (team workflow, orchestration, gemini guidance,
 * security review, changelog). These persist across plan mode and
 * context compaction, unlike session-injected content.
 *
 * @module claudemd
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCustomAgents } from "./agents/index.js";
import {
  formatOrchestration,
  formatTeamWorkflow,
  formatGeminiGuidance,
} from "./prompts/index.js";
import type { ClaudeMindConfig } from "./types.js";

/** Start marker for the managed section */
const SECTION_START = "<!-- claude-cognitive:start -->";
/** End marker for the managed section */
const SECTION_END = "<!-- claude-cognitive:end -->";

/**
 * Generate the static instructions block for CLAUDE.md.
 *
 * Assembles content from prompt templates and config-driven sections
 * (security review, changelog) into a single markdown block wrapped
 * in HTML comment markers.
 *
 * @param projectPath - Path to the project root
 * @param config - Loaded ClaudeMindConfig
 * @returns The complete managed section string
 */
export async function generateClaudeMdSection(
  projectPath: string,
  config: ClaudeMindConfig,
): Promise<string> {
  const parts: string[] = [];

  // Security review instructions
  if (config.securityReview?.enabled === true) {
    parts.push(`## Security Review Required

**MANDATORY**: Before ANY \`git commit\` command, you MUST:
1. Launch the \`security-code-reviewer\` agent to review all staged changes
2. Wait for the security review to complete
3. Address any critical/high issues found
4. Only then proceed with the commit

This policy is enforced for this project. Do not skip security review.`);
  }

  // Changelog instructions
  if (config.changelog?.enabled === true) {
    const changelogPath = config.changelog.path ?? "CHANGELOG.md";
    parts.push(`## Changelog Required

**MANDATORY**: Before ANY \`git commit\` command, you MUST:
1. Update \`${changelogPath}\` with a summary of the changes being committed
2. Check if a section for today's date already exists under \`[Unreleased]\` and append to it instead of creating a duplicate
3. Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format (Added, Changed, Fixed, Removed, etc.)
4. Stage the changelog update together with your other changes

This policy is enforced for this project. Do not skip the changelog update.`);
  }

  // Team-first workflow (always present)
  parts.push(formatTeamWorkflow());

  // Agent orchestration (only when custom agents exist)
  const customAgents = await loadCustomAgents(projectPath);
  const agentInstructions = formatOrchestration(customAgents);
  if (agentInstructions.trim().length > 0) {
    parts.push(agentInstructions);
  }

  // Gemini guidance (when configured)
  const geminiGuidance = formatGeminiGuidance(config.gemini);
  if (geminiGuidance.trim().length > 0) {
    parts.push(geminiGuidance);
  }

  const body = parts.join("\n\n");
  return `${SECTION_START}\n${body}\n${SECTION_END}`;
}

/**
 * Update the managed section in a project's CLAUDE.md.
 *
 * Reads CLAUDE.md, replaces the existing managed section (if present)
 * or appends it. Creates CLAUDE.md if it doesn't exist.
 *
 * @param projectPath - Path to the project root
 * @param config - Loaded ClaudeMindConfig
 */
export async function updateClaudeMd(
  projectPath: string,
  config: ClaudeMindConfig,
): Promise<void> {
  const claudeMdPath = join(projectPath, "CLAUDE.md");
  const section = await generateClaudeMdSection(projectPath, config);

  let content: string;
  try {
    content = await readFile(claudeMdPath, "utf-8");
  } catch {
    // CLAUDE.md doesn't exist — create with just our section
    await writeFile(claudeMdPath, section + "\n");
    return;
  }

  // Replace existing managed section or append
  const sectionRegex = new RegExp(
    `${escapeRegExp(SECTION_START)}[\\s\\S]*?${escapeRegExp(SECTION_END)}`,
  );

  if (sectionRegex.test(content)) {
    content = content.replace(sectionRegex, section);
  } else {
    // Append with a blank line separator
    content = content.trimEnd() + "\n\n" + section + "\n";
  }

  await writeFile(claudeMdPath, content);
}

/**
 * Remove the managed section from a project's CLAUDE.md.
 *
 * @param projectPath - Path to the project root
 * @returns True if a section was found and removed
 */
export async function removeClaudeMdSection(
  projectPath: string,
): Promise<boolean> {
  const claudeMdPath = join(projectPath, "CLAUDE.md");

  let content: string;
  try {
    content = await readFile(claudeMdPath, "utf-8");
  } catch {
    return false;
  }

  const sectionRegex = new RegExp(
    `\\n?${escapeRegExp(SECTION_START)}[\\s\\S]*?${escapeRegExp(SECTION_END)}\\n?`,
  );

  if (!sectionRegex.test(content)) {
    return false;
  }

  content = content.replace(sectionRegex, "\n");
  // Clean up excessive newlines
  content = content.replace(/\n{3,}/g, "\n\n");
  await writeFile(claudeMdPath, content);
  return true;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
