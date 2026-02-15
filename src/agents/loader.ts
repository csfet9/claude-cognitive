/**
 * Custom agent template loading from .claude/agents/ directory.
 * @module agents/loader
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentTemplate } from "./types.js";

/**
 * Parse a markdown agent template file.
 *
 * Expected format:
 * ```markdown
 * # Agent: name
 *
 * ## Mission
 * ...
 *
 * ## Tools Available
 * - Tool 1
 * - Tool 2
 *
 * ## Output Format
 * ...
 *
 * ## Constraints
 * - Constraint 1
 * - Constraint 2
 * ```
 *
 * @param content - Markdown file content
 * @returns Parsed AgentTemplate, or null if parsing failed
 */
export function parseAgentMarkdown(content: string): AgentTemplate | null {
  // Try YAML frontmatter format first
  const frontmatterResult = parseFrontmatter(content);
  if (frontmatterResult) return frontmatterResult;

  const lines = content.split("\n");

  // Extract name from # Agent: name
  const nameLine = lines.find((l) => l.startsWith("# Agent:"));
  if (!nameLine) return null;
  const name = nameLine.replace("# Agent:", "").trim();
  if (!name) return null;

  // Parse sections
  const sections = parseSections(lines);

  // Build template
  return {
    name,
    mission: sections["Mission"] || "",
    tools: parseList(sections["Tools Available"] || ""),
    outputFormat: sections["Output Format"] || "",
    constraints: parseList(sections["Constraints"] || ""),
  };
}

/**
 * Parse YAML frontmatter format (--- delimited).
 * @internal
 */
function parseFrontmatter(content: string): AgentTemplate | null {
  if (!content.startsWith("---")) return null;

  const endIndex = content.indexOf("---", 3);
  if (endIndex === -1) return null;

  const yamlBlock = content.slice(3, endIndex).trim();
  const body = content.slice(endIndex + 3).trim();

  // Parse simple key: value pairs from YAML block
  const fields: Record<string, string> = {};
  for (const line of yamlBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      fields[key] = value;
    }
  }

  const name = fields["name"];
  if (!name) return null;

  // Parse sections from body
  const sections = parseSections(body.split("\n"));

  const template: AgentTemplate = {
    name,
    mission: sections["Mission"] || extractBodyPreamble(body),
    tools: parseList(sections["Tools Available"] || ""),
    outputFormat: sections["Output Format"] || "",
    constraints: parseList(sections["Constraints"] || ""),
  };

  if (fields["description"]) {
    template.systemPromptAdditions = fields["description"];
  }

  return template;
}

/**
 * Extract body text before any ## sections.
 * @internal
 */
function extractBodyPreamble(body: string): string {
  const firstSectionIndex = body.indexOf("\n## ");
  if (firstSectionIndex === -1) return body;
  return body.slice(0, firstSectionIndex).trim();
}

/**
 * Parse ## sections from lines.
 * @internal
 */
function parseSections(lines: string[]): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        sections[currentSection] = currentContent.join("\n").trim();
      }
      currentSection = line.replace("## ", "").trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  // Don't forget the last section
  if (currentSection) {
    sections[currentSection] = currentContent.join("\n").trim();
  }

  return sections;
}

/**
 * Parse a markdown list into an array of strings.
 * @internal
 */
function parseList(content: string): string[] {
  return content
    .split("\n")
    .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"))
    .map((l) => {
      // Remove list marker and leading whitespace
      let text = l.replace(/^[\s\-\*]+/, "").trim();
      // Remove bold markers if present
      text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
      return text;
    })
    .filter(Boolean);
}

/**
 * Load custom agents from .claude/agents/ directory.
 *
 * @param projectPath - Project root directory
 * @returns Array of custom agent templates
 */
export async function loadCustomAgents(
  projectPath: string,
): Promise<AgentTemplate[]> {
  const agentsDir = join(projectPath, ".claude", "agents");

  // Check if directory exists
  try {
    const dirStat = await stat(agentsDir);
    if (!dirStat.isDirectory()) return [];
  } catch {
    return []; // Directory doesn't exist
  }

  // Read all .md files
  const files = await readdir(agentsDir);
  const templates: AgentTemplate[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    try {
      const content = await readFile(join(agentsDir, file), "utf-8");
      const template = parseAgentMarkdown(content);
      if (template) {
        templates.push(template);
      }
    } catch {
      // Skip invalid files
    }
  }

  return templates;
}

/**
 * Generate markdown content from an agent template.
 *
 * Useful for creating template files programmatically.
 *
 * @param template - Agent template to convert
 * @returns Markdown string
 */
export function templateToMarkdown(template: AgentTemplate): string {
  const sections: string[] = [];

  sections.push(`# Agent: ${template.name}`);
  sections.push("");

  sections.push("## Mission");
  sections.push("");
  sections.push(template.mission);
  sections.push("");

  sections.push("## Tools Available");
  sections.push("");
  for (const tool of template.tools) {
    sections.push(`- ${tool}`);
  }
  sections.push("");

  sections.push("## Output Format");
  sections.push("");
  sections.push(template.outputFormat);
  sections.push("");

  sections.push("## Constraints");
  sections.push("");
  for (const constraint of template.constraints) {
    sections.push(`- ${constraint}`);
  }
  sections.push("");

  return sections.join("\n");
}
