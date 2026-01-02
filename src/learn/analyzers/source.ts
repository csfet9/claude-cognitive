/**
 * Source code analyzer for full depth learning.
 * @module learn/analyzers/source
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";

/**
 * Code pattern detected in source.
 */
export interface CodePattern {
  /** Pattern type identifier */
  type: string;
  /** Human-readable description */
  description: string;
  /** Example file paths where pattern was found */
  examples: string[];
}

/**
 * Module information.
 */
export interface ModuleInfo {
  /** Module name (typically filename without extension) */
  name: string;
  /** File path */
  path: string;
  /** Exported identifiers */
  exports: string[];
  /** Imported modules */
  imports: string[];
}

/**
 * Detected coding conventions.
 */
export interface CodingConventions {
  /** Naming style for variables/functions */
  namingStyle: "camelCase" | "snake_case" | "PascalCase" | "mixed";
  /** Import style preference */
  importStyle: "named" | "default" | "mixed";
  /** Error handling approach */
  errorHandling: string;
  /** Whether async/await is preferred */
  prefersAsync: boolean;
}

/**
 * Analysis result from source code.
 */
export interface SourceAnalysis {
  /** Detected code patterns */
  patterns: CodePattern[];
  /** Module information */
  modules: ModuleInfo[];
  /** Coding conventions */
  conventions: CodingConventions;
  /** Files analyzed */
  filesAnalyzed: number;
}

/**
 * Convention statistics structure.
 * @internal
 */
interface ConventionStats {
  camelCase: number;
  snake_case: number;
  PascalCase: number;
  namedImports: number;
  defaultImports: number;
  tryCatch: number;
  errorCallbacks: number;
  asyncAwait: number;
  promiseCount: number;
}

/**
 * Analyze source files in a project.
 *
 * @param projectPath - Project root directory
 * @param filePaths - Paths to analyze (relative to project)
 * @returns Source analysis
 */
export async function analyzeSource(
  projectPath: string,
  filePaths: string[],
): Promise<SourceAnalysis> {
  const patterns: CodePattern[] = [];
  const modules: ModuleInfo[] = [];
  const conventionStats: ConventionStats = {
    camelCase: 0,
    snake_case: 0,
    PascalCase: 0,
    namedImports: 0,
    defaultImports: 0,
    tryCatch: 0,
    errorCallbacks: 0,
    asyncAwait: 0,
    promiseCount: 0,
  };

  let filesAnalyzed = 0;

  for (const filePath of filePaths) {
    try {
      const fullPath = `${projectPath}/${filePath}`;
      const content = await readFile(fullPath, "utf-8");
      const ext = extname(filePath).toLowerCase();

      // Only analyze JS/TS files
      if (![".js", ".ts", ".jsx", ".tsx", ".mjs", ".mts"].includes(ext)) {
        continue;
      }

      filesAnalyzed++;

      // Analyze the file
      const analysis = analyzeFile(content, filePath);

      // Collect module info
      modules.push({
        name: filePath.replace(/\.[^/.]+$/, ""),
        path: filePath,
        exports: analysis.exports,
        imports: analysis.imports,
      });

      // Update convention stats
      conventionStats.camelCase += analysis.camelCaseCount;
      conventionStats.snake_case += analysis.snakeCaseCount;
      conventionStats.PascalCase += analysis.pascalCaseCount;
      conventionStats.namedImports += analysis.namedImportCount;
      conventionStats.defaultImports += analysis.defaultImportCount;
      conventionStats.tryCatch += analysis.tryCatchCount;
      conventionStats.errorCallbacks += analysis.errorCallbackCount;
      conventionStats.asyncAwait += analysis.asyncAwaitCount;
      conventionStats.promiseCount += analysis.promiseCount;
    } catch {
      // Skip files that can't be read
    }
  }

  // Detect patterns from aggregated analysis
  patterns.push(...detectPatterns(modules));

  // Determine conventions
  const conventions = determineConventions(conventionStats);

  return {
    patterns,
    modules,
    conventions,
    filesAnalyzed,
  };
}

/**
 * File analysis result.
 * @internal
 */
interface FileAnalysis {
  exports: string[];
  imports: string[];
  camelCaseCount: number;
  snakeCaseCount: number;
  pascalCaseCount: number;
  namedImportCount: number;
  defaultImportCount: number;
  tryCatchCount: number;
  errorCallbackCount: number;
  asyncAwaitCount: number;
  promiseCount: number;
}

/**
 * Analyze a single file.
 * @internal
 */
function analyzeFile(content: string, _filePath: string): FileAnalysis {
  const result: FileAnalysis = {
    exports: [],
    imports: [],
    camelCaseCount: 0,
    snakeCaseCount: 0,
    pascalCaseCount: 0,
    namedImportCount: 0,
    defaultImportCount: 0,
    tryCatchCount: 0,
    errorCallbackCount: 0,
    asyncAwaitCount: 0,
    promiseCount: 0,
  };

  // Extract exports
  const exportMatches = content.matchAll(
    /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g,
  );
  for (const match of exportMatches) {
    if (match[1]) {
      result.exports.push(match[1]);
    }
  }

  // Extract export { ... }
  const namedExportMatches = content.matchAll(/export\s*\{([^}]+)\}/g);
  for (const match of namedExportMatches) {
    if (match[1]) {
      const names = match[1].split(",").map((n) => {
        const parts = n.trim().split(" as ");
        return parts[0]?.trim() ?? "";
      });
      result.exports.push(...names.filter(Boolean));
    }
  }

  // Extract imports
  const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    if (match[1]) {
      result.imports.push(match[1]);
    }
  }

  // Count naming conventions
  const identifierMatches = content.matchAll(/\b([a-z][a-zA-Z0-9]*)\b/g);
  for (const match of identifierMatches) {
    const name = match[1];
    if (name && name.length > 0) {
      const firstChar = name[0];
      if (name.includes("_")) {
        result.snakeCaseCount++;
      } else if (firstChar && firstChar === firstChar.toUpperCase()) {
        result.pascalCaseCount++;
      } else {
        result.camelCaseCount++;
      }
    }
  }

  // Count import styles
  result.namedImportCount = (content.match(/import\s*\{/g) || []).length;
  result.defaultImportCount = (content.match(/import\s+\w+\s+from/g) || []).length;

  // Count error handling
  result.tryCatchCount = (content.match(/try\s*\{/g) || []).length;
  result.errorCallbackCount = (content.match(/\.catch\s*\(/g) || []).length;

  // Count async patterns
  result.asyncAwaitCount = (content.match(/\basync\b/g) || []).length;
  result.promiseCount = (content.match(/new\s+Promise/g) || []).length;

  return result;
}

/**
 * Detect patterns from module analysis.
 * @internal
 */
function detectPatterns(modules: ModuleInfo[]): CodePattern[] {
  const patterns: CodePattern[] = [];

  // Detect barrel exports (index.ts that re-exports)
  const barrelModules = modules.filter(
    (m) => m.name.endsWith("index") && m.exports.length > 3,
  );
  if (barrelModules.length > 0) {
    patterns.push({
      type: "barrel-exports",
      description: "Uses barrel exports (index files that re-export)",
      examples: barrelModules.slice(0, 3).map((m) => m.path),
    });
  }

  // Detect modular architecture
  const hasMultipleModules = modules.length > 10;
  const avgExports = modules.reduce((sum, m) => sum + m.exports.length, 0) / modules.length;
  if (hasMultipleModules && avgExports < 10) {
    patterns.push({
      type: "modular-architecture",
      description: "Follows modular architecture with small, focused modules",
      examples: modules.slice(0, 3).map((m) => m.path),
    });
  }

  return patterns;
}

/**
 * Determine coding conventions from stats.
 * @internal
 */
function determineConventions(stats: ConventionStats): CodingConventions {
  // Determine naming style
  let namingStyle: CodingConventions["namingStyle"] = "mixed";
  const totalNaming = stats.camelCase + stats.snake_case + stats.PascalCase;
  if (stats.camelCase > totalNaming * 0.6) {
    namingStyle = "camelCase";
  } else if (stats.snake_case > totalNaming * 0.6) {
    namingStyle = "snake_case";
  } else if (stats.PascalCase > totalNaming * 0.6) {
    namingStyle = "PascalCase";
  }

  // Determine import style
  let importStyle: CodingConventions["importStyle"] = "mixed";
  const totalImports = stats.namedImports + stats.defaultImports;
  if (stats.namedImports > totalImports * 0.7) {
    importStyle = "named";
  } else if (stats.defaultImports > totalImports * 0.7) {
    importStyle = "default";
  }

  // Determine error handling
  let errorHandling = "mixed";
  if (stats.tryCatch > stats.errorCallbacks * 2) {
    errorHandling = "try-catch blocks";
  } else if (stats.errorCallbacks > stats.tryCatch * 2) {
    errorHandling = "promise .catch()";
  }

  // Determine async preference
  const prefersAsync = stats.asyncAwait > stats.promiseCount;

  return {
    namingStyle,
    importStyle,
    errorHandling,
    prefersAsync,
  };
}

/**
 * Get a summary of source analysis.
 *
 * @param analysis - Source analysis result
 * @returns Human-readable source summary
 */
export function getSourceSummary(analysis: SourceAnalysis): string {
  const parts: string[] = [];

  parts.push(`${analysis.filesAnalyzed} files analyzed`);
  parts.push(`${analysis.modules.length} modules`);

  if (analysis.patterns.length > 0) {
    parts.push(`Patterns: ${analysis.patterns.map((p) => p.type).join(", ")}`);
  }

  parts.push(`Style: ${analysis.conventions.namingStyle}`);

  return parts.join("; ");
}
