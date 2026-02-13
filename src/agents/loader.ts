/**
 * Custom agent template loading from .claude/agents/ directory.
 * @module agents/loader
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentTemplate, ModelTier, TaskCategory } from "./types.js";

/** Valid model tier values */
const VALID_MODELS: ReadonlySet<string> = new Set(["opus", "sonnet", "haiku"]);

/** Valid task category values */
const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "exploration",
  "implementation",
  "review",
  "architecture",
  "research",
  "testing",
  "debugging",
  "security",
  "reasoning",
]);

/**
 * Parsed frontmatter from a markdown agent file.
 * @internal
 */
interface Frontmatter {
  name?: string;
  model?: ModelTier;
  categories?: TaskCategory[];
}

/**
 * Parse YAML-like frontmatter from markdown content.
 * Supports simple `key: value` pairs between `---` delimiters.
 * Does not require a full YAML parser.
 *
 * @param content - Full markdown content
 * @returns Parsed frontmatter and remaining content
 * @internal
 */
export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  // Find closing delimiter
  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const fmBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trimStart();
  const frontmatter: Frontmatter = {};

  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case "name":
        if (value) frontmatter.name = value;
        break;
      case "model":
        if (VALID_MODELS.has(value)) frontmatter.model = value as ModelTier;
        break;
      case "categories": {
        // Parse comma-separated or YAML-style list
        const cats = value
          .replace(/^\[|\]$/g, "") // strip [] if present
          .split(",")
          .map((c) => c.trim())
          .filter((c) => VALID_CATEGORIES.has(c)) as TaskCategory[];
        if (cats.length > 0) frontmatter.categories = cats;
        break;
      }
      // Ignore unknown keys (description, etc.)
    }
  }

  return { frontmatter, body };
}

/**
 * Parse a markdown agent template file.
 *
 * Supports two formats:
 * 1. With YAML frontmatter (model, cost, categories):
 * ```markdown
 * ---
 * name: agent-name
 * model: sonnet
 * cost: standard
 * categories: implementation, testing
 * ---
 * # Agent: agent-name
 * ## Mission
 * ...
 * ```
 *
 * 2. Without frontmatter (original format):
 * ```markdown
 * # Agent: name
 * ## Mission
 * ...
 * ```
 *
 * @param content - Markdown file content
 * @returns Parsed AgentTemplate, or null if parsing failed
 */
export function parseAgentMarkdown(content: string): AgentTemplate | null {
  // Extract frontmatter if present
  const { frontmatter, body } = parseFrontmatter(content);

  const lines = body.split("\n");

  // Extract name from # Agent: name (primary) or frontmatter (secondary)
  const nameLine = lines.find((l) => l.startsWith("# Agent:"));
  let name: string;

  if (nameLine) {
    const headerName = nameLine.replace("# Agent:", "").trim();
    if (!headerName && !frontmatter.name) return null;
    name = headerName || frontmatter.name || "";
  } else if (frontmatter.name) {
    name = frontmatter.name;
  } else {
    return null;
  }

  if (!name) return null;

  // Parse sections
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

  // Build template
  const template: AgentTemplate = {
    name,
    mission: sections["Mission"] || "",
    tools: parseList(sections["Tools Available"] || ""),
    outputFormat: sections["Output Format"] || "",
    constraints: parseList(sections["Constraints"] || ""),
  };

  // Apply frontmatter fields
  if (frontmatter.model) template.model = frontmatter.model;
  if (frontmatter.categories) template.categories = frontmatter.categories;

  return template;
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
 * Outputs frontmatter when model, cost, or categories are set.
 *
 * @param template - Agent template to convert
 * @returns Markdown string
 */
export function templateToMarkdown(template: AgentTemplate): string {
  const sections: string[] = [];

  // Output frontmatter if any routing fields are set
  if (template.model || template.categories) {
    sections.push("---");
    if (template.model) sections.push(`model: ${template.model}`);
    if (template.categories && template.categories.length > 0) {
      sections.push(`categories: ${template.categories.join(", ")}`);
    }
    sections.push("---");
    sections.push("");
  }

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
