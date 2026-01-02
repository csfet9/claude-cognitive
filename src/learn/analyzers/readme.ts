/**
 * README file analyzer.
 * @module learn/analyzers/readme
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Analysis result from README file.
 */
export interface ReadmeAnalysis {
  /** Project description from README */
  projectDescription: string;
  /** Setup/installation instructions found */
  setupInstructions: string[];
  /** Features or capabilities listed */
  features: string[];
  /** Links to additional documentation */
  documentation: string[];
  /** The raw README content */
  rawContent: string;
}

/** Possible README filenames to check */
const README_NAMES = [
  "README.md",
  "README",
  "readme.md",
  "readme",
  "Readme.md",
];

/**
 * Analyze README file in a project.
 *
 * @param projectPath - Project root directory
 * @returns README analysis, or null if no README found
 */
export async function analyzeReadme(
  projectPath: string,
): Promise<ReadmeAnalysis | null> {
  // Find README file
  let content: string | null = null;

  for (const name of README_NAMES) {
    try {
      content = await readFile(join(projectPath, name), "utf-8");
      break;
    } catch {
      // Try next name
    }
  }

  if (!content) return null;

  return {
    projectDescription: extractDescription(content),
    setupInstructions: extractSetupInstructions(content),
    features: extractFeatures(content),
    documentation: extractDocumentationLinks(content),
    rawContent: content,
  };
}

/**
 * Extract project description from README.
 * Usually the first paragraph after the title.
 * @internal
 */
function extractDescription(content: string): string {
  const lines = content.split("\n");
  let foundTitle = false;
  const descriptionLines: string[] = [];

  for (const line of lines) {
    // Skip title line
    if (line.startsWith("# ") && !foundTitle) {
      foundTitle = true;
      continue;
    }

    // Skip badges (common after title)
    if (line.includes("![") || line.includes("[![")) {
      continue;
    }

    // Empty line after description ends it
    if (foundTitle && descriptionLines.length > 0 && line.trim() === "") {
      break;
    }

    // Skip empty lines before description
    if (foundTitle && line.trim() === "") {
      continue;
    }

    // Next heading ends description
    if (foundTitle && line.startsWith("#")) {
      break;
    }

    // Collect description lines
    if (foundTitle && line.trim()) {
      descriptionLines.push(line.trim());
    }
  }

  return descriptionLines.join(" ");
}

/**
 * Extract setup/installation instructions.
 * @internal
 */
function extractSetupInstructions(content: string): string[] {
  const instructions: string[] = [];

  // Look for Installation, Setup, Getting Started sections
  const sectionPatterns = [
    /## (?:Installation|Setup|Getting Started|Quick Start)/i,
  ];

  const lines = content.split("\n");
  let inSection = false;

  for (const line of lines) {
    // Check if entering a relevant section
    if (sectionPatterns.some((p) => p.test(line))) {
      inSection = true;
      continue;
    }

    // Exit section on next heading
    if (inSection && line.startsWith("##")) {
      break;
    }

    // Collect code blocks and list items in section
    if (inSection) {
      if (line.includes("npm ") || line.includes("yarn ") || line.includes("npx ")) {
        instructions.push(line.trim().replace(/^[\s$]+/, ""));
      } else if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
        instructions.push(line.trim().replace(/^[-*]\s*/, ""));
      }
    }
  }

  return instructions.slice(0, 10); // Limit to 10 instructions
}

/**
 * Extract features list.
 * @internal
 */
function extractFeatures(content: string): string[] {
  const features: string[] = [];

  // Look for Features section
  const lines = content.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (/## (?:Features|Capabilities|What it does)/i.test(line)) {
      inSection = true;
      continue;
    }

    if (inSection && line.startsWith("##")) {
      break;
    }

    if (inSection && (line.trim().startsWith("-") || line.trim().startsWith("*"))) {
      features.push(line.trim().replace(/^[-*]\s*/, ""));
    }
  }

  return features.slice(0, 15); // Limit to 15 features
}

/**
 * Extract documentation links.
 * @internal
 */
function extractDocumentationLinks(content: string): string[] {
  const links: string[] = [];

  // Find markdown links
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    // Filter for documentation-like links
    if (text && url) {
      if (
        url.includes("docs") ||
        url.includes("wiki") ||
        url.includes("guide") ||
        text.toLowerCase().includes("doc") ||
        text.toLowerCase().includes("api")
      ) {
        links.push(`${text}: ${url}`);
      }
    }
  }

  return links.slice(0, 10);
}
