/**
 * Gemini-powered codebase analyzer.
 * Uses Gemini CLI for enhanced analysis when available.
 * @module learn/analyzers/gemini
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GeminiWrapper, GeminiError } from "../../gemini/index.js";
import type { GeminiConfig } from "../../gemini/types.js";

/**
 * Analysis result from Gemini-powered analysis.
 */
export interface GeminiAnalysis {
  /** Whether Gemini analysis was performed */
  performed: boolean;
  /** Architecture insights from Gemini */
  architectureInsights: string[];
  /** Code patterns detected by Gemini */
  codePatterns: string[];
  /** Best practices identified */
  bestPractices: string[];
  /** Potential improvements suggested */
  improvements: string[];
  /** Key technologies and frameworks detected */
  technologies: string[];
  /** Documentation quality notes */
  documentationNotes: string[];
  /** Raw analysis response (for debugging) */
  rawResponse?: string;
  /** Error message if analysis failed */
  error?: string;
}

/** Files to prioritize for Gemini analysis */
const PRIORITY_FILES = [
  "README.md",
  "package.json",
  "tsconfig.json",
  "src/index.ts",
  "src/main.ts",
  "src/app.ts",
  "lib/index.ts",
  "index.ts",
];

/** Maximum files to send to Gemini for analysis */
const MAX_FILES_FOR_ANALYSIS = 5;

/** Maximum total content size to send (chars) */
const MAX_CONTENT_SIZE = 50000;

/**
 * Check if Gemini CLI is available for analysis.
 *
 * @returns true if Gemini CLI is installed and accessible
 */
export async function isGeminiAvailable(): Promise<boolean> {
  const wrapper = new GeminiWrapper({}, process.cwd());
  return wrapper.isAvailable();
}

/**
 * Analyze codebase using Gemini for enhanced insights.
 *
 * This analyzer uses the Gemini CLI to get deeper understanding of:
 * - Code architecture and patterns
 * - Best practices and conventions
 * - Documentation quality
 * - Improvement opportunities
 *
 * @param projectPath - Project root directory
 * @param config - Optional Gemini configuration
 * @returns Gemini analysis result
 *
 * @example
 * ```typescript
 * if (await isGeminiAvailable()) {
 *   const analysis = await analyzeWithGemini('/path/to/project');
 *   console.log(analysis.architectureInsights);
 * }
 * ```
 */
export async function analyzeWithGemini(
  projectPath: string,
  config?: Partial<GeminiConfig>,
): Promise<GeminiAnalysis> {
  const result: GeminiAnalysis = {
    performed: false,
    architectureInsights: [],
    codePatterns: [],
    bestPractices: [],
    improvements: [],
    technologies: [],
    documentationNotes: [],
  };

  const wrapper = new GeminiWrapper(config ?? {}, projectPath);

  // Check availability
  if (!(await wrapper.isAvailable())) {
    result.error = "Gemini CLI not available";
    return result;
  }

  // Gather key files for analysis
  const filesToAnalyze = await gatherFilesForAnalysis(projectPath);
  if (filesToAnalyze.length === 0) {
    result.error = "No suitable files found for analysis";
    return result;
  }

  // Build context from files
  const fileContents = await buildFileContext(projectPath, filesToAnalyze);

  // Perform analysis
  try {
    const analysisPrompt = buildAnalysisPrompt(fileContents);
    const geminiResult = await wrapper.prompt({
      prompt: analysisPrompt,
      timeout: config?.timeout ?? 0,
    });

    result.performed = true;
    result.rawResponse = geminiResult.response;

    // Parse the structured response
    parseAnalysisResponse(geminiResult.response, result);
  } catch (error) {
    if (error instanceof GeminiError) {
      result.error = `Gemini analysis failed: ${error.message}`;
    } else {
      result.error = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return result;
}

/**
 * Gather priority files for Gemini analysis.
 * @internal
 */
async function gatherFilesForAnalysis(projectPath: string): Promise<string[]> {
  const files: string[] = [];

  for (const file of PRIORITY_FILES) {
    if (files.length >= MAX_FILES_FOR_ANALYSIS) break;

    try {
      const fullPath = join(projectPath, file);
      await readFile(fullPath, "utf-8");
      files.push(file);
    } catch {
      // File doesn't exist, skip it
    }
  }

  return files;
}

/**
 * Build file context string for analysis.
 * @internal
 */
async function buildFileContext(
  projectPath: string,
  files: string[],
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  let totalSize = 0;

  for (const file of files) {
    if (totalSize >= MAX_CONTENT_SIZE) break;

    try {
      const fullPath = join(projectPath, file);
      let content = await readFile(fullPath, "utf-8");

      // Truncate if necessary
      const remainingSpace = MAX_CONTENT_SIZE - totalSize;
      if (content.length > remainingSpace) {
        content = content.substring(0, remainingSpace) + "\n... (truncated)";
      }

      contents.set(file, content);
      totalSize += content.length;
    } catch {
      // Skip files that can't be read
    }
  }

  return contents;
}

/**
 * Build the analysis prompt for Gemini.
 * @internal
 */
function buildAnalysisPrompt(fileContents: Map<string, string>): string {
  let prompt = `Analyze this codebase and provide insights in a structured format.

For each section, provide a JSON array of strings. Use exactly these section headers:

## ARCHITECTURE_INSIGHTS
[List key architectural decisions, patterns, and design choices]

## CODE_PATTERNS
[List coding patterns, conventions, and common practices observed]

## BEST_PRACTICES
[List best practices being followed or that should be followed]

## IMPROVEMENTS
[List potential improvements and recommendations]

## TECHNOLOGIES
[List key technologies, frameworks, and libraries]

## DOCUMENTATION_NOTES
[Notes about documentation quality and coverage]

Here are the key files from the project:

`;

  for (const [path, content] of fileContents) {
    prompt += `--- ${path} ---\n${content}\n\n`;
  }

  prompt += `
Please analyze these files and provide insights in the structured format above.
Be concise but thorough. Focus on actionable insights.`;

  return prompt;
}

/**
 * Parse the structured analysis response from Gemini.
 * @internal
 */
function parseAnalysisResponse(response: string, result: GeminiAnalysis): void {
  // Parse each section
  result.architectureInsights = parseSection(response, "ARCHITECTURE_INSIGHTS");
  result.codePatterns = parseSection(response, "CODE_PATTERNS");
  result.bestPractices = parseSection(response, "BEST_PRACTICES");
  result.improvements = parseSection(response, "IMPROVEMENTS");
  result.technologies = parseSection(response, "TECHNOLOGIES");
  result.documentationNotes = parseSection(response, "DOCUMENTATION_NOTES");
}

/**
 * Parse a section from the response.
 * @internal
 */
function parseSection(response: string, sectionName: string): string[] {
  const items: string[] = [];

  // Look for section header
  const sectionPattern = new RegExp(
    `## ${sectionName}\\s*\\n([\\s\\S]*?)(?=## |$)`,
    "i",
  );
  const match = sectionPattern.exec(response);

  if (!match?.[1]) {
    return items;
  }

  const sectionContent = match[1].trim();

  // Try to parse as JSON array first
  try {
    const jsonMatch = /\[[\s\S]*\]/.exec(sectionContent);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string" && item.trim()) {
            items.push(item.trim());
          }
        }
        return items;
      }
    }
  } catch {
    // Not valid JSON, try line-by-line parsing
  }

  // Parse as bullet points or numbered list
  const lines = sectionContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Remove bullet points, numbers, dashes
    const cleaned = trimmed
      .replace(/^[-*\u2022]\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .trim();

    if (cleaned && cleaned.length > 3) {
      items.push(cleaned);
    }
  }

  return items.slice(0, 10); // Limit to 10 items per section
}

/**
 * Get a summary of the Gemini analysis.
 *
 * @param analysis - Gemini analysis result
 * @returns Human-readable summary
 */
export function getGeminiSummary(analysis: GeminiAnalysis): string {
  if (!analysis.performed) {
    return analysis.error ?? "Gemini analysis not performed";
  }

  const counts = [
    analysis.architectureInsights.length > 0
      ? `${analysis.architectureInsights.length} architecture insights`
      : null,
    analysis.codePatterns.length > 0
      ? `${analysis.codePatterns.length} code patterns`
      : null,
    analysis.technologies.length > 0
      ? `${analysis.technologies.length} technologies`
      : null,
    analysis.improvements.length > 0
      ? `${analysis.improvements.length} improvement suggestions`
      : null,
  ].filter(Boolean);

  if (counts.length === 0) {
    return "Gemini analysis completed but no insights extracted";
  }

  return `Gemini found: ${counts.join(", ")}`;
}
