/**
 * Directory structure analyzer.
 * @module learn/analyzers/structure
 */

import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

/**
 * Analysis result from directory structure.
 */
export interface StructureAnalysis {
  /** Identified source directories */
  sourceDirectories: string[];
  /** Identified test directories */
  testDirectories: string[];
  /** Configuration files found */
  configFiles: string[];
  /** Likely entry points */
  entryPoints: string[];
  /** Total files analyzed */
  totalFiles: number;
  /** File types distribution (extension -> count) */
  fileTypes: Record<string, number>;
  /** Top-level directories */
  topLevelDirs: string[];
}

/** Directories to skip during analysis */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "out",
  "coverage",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
]);

/** Known source directory names */
const SOURCE_DIRS = new Set([
  "src",
  "lib",
  "app",
  "source",
  "packages",
  "modules",
]);

/** Known test directory names */
const TEST_DIRS = new Set([
  "test",
  "tests",
  "__tests__",
  "spec",
  "specs",
  "e2e",
  "integration",
]);

/** Known config file patterns */
const CONFIG_PATTERNS = [
  /^tsconfig.*\.json$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
  /^vite\.config\./,
  /^webpack\.config\./,
  /^next\.config\./,
  /^tailwind\.config\./,
  /^jest\.config\./,
  /^vitest\.config\./,
  /^\.env/,
  /^docker-compose/,
  /^Dockerfile/,
];

/** Known entry point patterns */
const ENTRY_PATTERNS = [
  /^index\.[jt]sx?$/,
  /^main\.[jt]sx?$/,
  /^app\.[jt]sx?$/,
  /^server\.[jt]sx?$/,
  /^cli\.[jt]sx?$/,
];

/**
 * Analyze directory structure of a project.
 *
 * @param projectPath - Project root directory
 * @param maxDepth - Maximum depth to scan (default: 4)
 * @returns Structure analysis
 */
export async function analyzeStructure(
  projectPath: string,
  maxDepth: number = 4,
): Promise<StructureAnalysis> {
  const result: StructureAnalysis = {
    sourceDirectories: [],
    testDirectories: [],
    configFiles: [],
    entryPoints: [],
    totalFiles: 0,
    fileTypes: {},
    topLevelDirs: [],
  };

  await scanDirectory(projectPath, result, 0, maxDepth, "");

  return result;
}

/**
 * Recursively scan a directory.
 * @internal
 */
async function scanDirectory(
  dir: string,
  result: StructureAnalysis,
  depth: number,
  maxDepth: number,
  relativePath: string,
): Promise<void> {
  if (depth > maxDepth) return;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return; // Can't read directory
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const relPath = relativePath ? `${relativePath}/${entry}` : entry;

    let entryStat;
    try {
      entryStat = await stat(fullPath);
    } catch {
      continue; // Can't stat entry
    }

    if (entryStat.isDirectory()) {
      // Track top-level directories
      if (depth === 0) {
        result.topLevelDirs.push(entry);
      }

      // Identify source/test directories
      if (SOURCE_DIRS.has(entry.toLowerCase())) {
        result.sourceDirectories.push(relPath);
      }
      if (TEST_DIRS.has(entry.toLowerCase())) {
        result.testDirectories.push(relPath);
      }

      // Recurse
      await scanDirectory(fullPath, result, depth + 1, maxDepth, relPath);
    } else {
      // Track file
      result.totalFiles++;

      // Track file types
      const ext = extname(entry).toLowerCase() || "(no ext)";
      result.fileTypes[ext] = (result.fileTypes[ext] || 0) + 1;

      // Check for config files (only at root or config dirs)
      if (depth <= 1 && CONFIG_PATTERNS.some((p) => p.test(entry))) {
        result.configFiles.push(relPath);
      }

      // Check for entry points
      if (ENTRY_PATTERNS.some((p) => p.test(entry))) {
        // Prioritize entry points in source directories
        const inSource = result.sourceDirectories.some(
          (sd) => relPath.startsWith(sd + "/") || relativePath === sd,
        );
        if (inSource || depth <= 1) {
          result.entryPoints.push(relPath);
        }
      }
    }
  }
}

/**
 * Get a summary of the project structure.
 *
 * @param analysis - Structure analysis result
 * @returns Human-readable structure summary
 */
export function getStructureSummary(analysis: StructureAnalysis): string {
  const parts: string[] = [];

  if (analysis.sourceDirectories.length > 0) {
    parts.push(`Source: ${analysis.sourceDirectories.join(", ")}`);
  }

  if (analysis.testDirectories.length > 0) {
    parts.push(`Tests: ${analysis.testDirectories.join(", ")}`);
  }

  // Top file types
  const topTypes = Object.entries(analysis.fileTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `${ext}(${count})`)
    .join(", ");
  if (topTypes) {
    parts.push(`Files: ${topTypes}`);
  }

  parts.push(`Total: ${analysis.totalFiles} files`);

  return parts.join("; ");
}
