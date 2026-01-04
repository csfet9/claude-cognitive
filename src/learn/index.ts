/**
 * Learn operation - bootstrap memory from existing codebase.
 * @module learn
 */

import type { HindsightClient } from "../client.js";
import type { Entity, LearnOptions, LearnResult, Opinion } from "../types.js";
import {
  analyzeReadme,
  analyzePackage,
  analyzeStructure,
  analyzeGitHistory,
  analyzeSource,
} from "./analyzers/index.js";
import { createFactExtractor, type AnalysisResults } from "./extractor.js";

/**
 * Default options for learn().
 */
const DEFAULT_OPTIONS: Required<LearnOptions> = {
  depth: "standard",
  includeGitHistory: true,
  maxCommits: 100,
  includeDependencies: true,
};

/**
 * Bootstrap memory from an existing codebase.
 *
 * This operation analyzes the project and stores facts in Hindsight,
 * solving the cold start problem when adopting claude-cognitive.
 *
 * @param client - HindsightClient instance
 * @param bankId - Memory bank ID
 * @param projectPath - Project root directory
 * @param options - Learn options
 * @returns Learn result with summary and stats
 *
 * @example
 * ```typescript
 * const result = await learn(client, 'my-project', '/path/to/project', {
 *   depth: 'full',
 *   includeGitHistory: true
 * });
 *
 * console.log(result.summary);
 * // "Learned 47 world facts from 123 files, formed 5 opinions"
 * ```
 */
export async function learn(
  client: HindsightClient,
  bankId: string,
  projectPath: string,
  options: LearnOptions = {},
): Promise<LearnResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Phase 1: Run analysis based on depth
  const analysis = await runAnalysis(projectPath, opts);

  // Phase 2: Extract facts
  const extractor = createFactExtractor();
  const facts = extractor.extractFacts(analysis.results);

  // Phase 3: Store facts via retain()
  let worldFacts = 0;
  const failedFacts: string[] = [];

  for (const fact of facts) {
    try {
      await client.retain(bankId, fact.content, fact.context);
      worldFacts++;
    } catch (error) {
      // Log but continue - don't fail entire learn on single fact
      const msg = error instanceof Error ? error.message : String(error);
      failedFacts.push(`${fact.content.substring(0, 50)}...: ${msg}`);
    }
  }

  // Phase 4: Form initial opinions via reflect()
  const opinions: Opinion[] = [];
  const entities: Entity[] = [];
  const entitySet = new Set<string>();
  const reflectionFailures: string[] = [];

  const reflectionQueries = getReflectionQueries(opts.depth);

  for (const query of reflectionQueries) {
    try {
      const result = await client.reflect(bankId, query);
      opinions.push(...result.opinions);

      // Collect entities from basedOn memories
      const allMemories = [
        ...result.basedOn.world,
        ...result.basedOn.experience,
        ...result.basedOn.opinion,
      ];
      for (const memory of allMemories) {
        for (const entity of memory.entities ?? []) {
          if (!entitySet.has(entity.id)) {
            entitySet.add(entity.id);
            entities.push(entity);
          }
        }
      }
    } catch (error) {
      // Track reflection failures for visibility
      const msg = error instanceof Error ? error.message : String(error);
      reflectionFailures.push(`${query}: ${msg}`);
    }
  }

  const duration = Date.now() - startTime;

  const result: LearnResult = {
    summary: generateSummary(
      worldFacts,
      opinions,
      analysis.filesAnalyzed,
      duration,
      failedFacts,
      reflectionFailures,
    ),
    worldFacts,
    opinions,
    entities,
    filesAnalyzed: analysis.filesAnalyzed,
    duration,
  };

  // Only add reflectionFailures if there are any (exactOptionalPropertyTypes compliance)
  if (reflectionFailures.length > 0) {
    result.reflectionFailures = reflectionFailures;
  }

  return result;
}

/**
 * Analysis result container.
 * @internal
 */
interface AnalysisOutput {
  results: AnalysisResults;
  filesAnalyzed: number;
}

/**
 * Run analysis based on depth.
 * @internal
 */
async function runAnalysis(
  projectPath: string,
  opts: Required<LearnOptions>,
): Promise<AnalysisOutput> {
  const results: AnalysisResults = {};
  let filesAnalyzed = 0;

  // Quick depth: README, package.json, structure (shallow)
  results.readme = await analyzeReadme(projectPath);
  results.package = await analyzePackage(projectPath);
  results.structure = await analyzeStructure(
    projectPath,
    opts.depth === "quick" ? 2 : opts.depth === "standard" ? 4 : 10,
  );
  filesAnalyzed += results.structure?.totalFiles ?? 0;

  // Standard and full depth: add git history
  if (opts.depth !== "quick" && opts.includeGitHistory) {
    const maxCommits = opts.depth === "standard" ? 50 : opts.maxCommits;
    results.git = await analyzeGitHistory(projectPath, maxCommits);
  }

  // Full depth: add source code analysis
  if (opts.depth === "full") {
    // Get all source files from entry points and source directories
    const sourceFiles: string[] = [];

    if (results.structure?.entryPoints) {
      sourceFiles.push(...results.structure.entryPoints);
    }

    // Add files from source directories (if available from structure scan)
    // For now, we use entry points; a more complete implementation would
    // recursively collect all source files

    if (sourceFiles.length > 0) {
      results.source = await analyzeSource(projectPath, sourceFiles);
    }
  }

  return { results, filesAnalyzed };
}

/**
 * Get reflection queries based on depth.
 * @internal
 */
function getReflectionQueries(depth: string): string[] {
  const queries = [
    "What are the main technologies and patterns used in this codebase?",
  ];

  if (depth === "standard" || depth === "full") {
    queries.push(
      "What architectural decisions seem important in this project?",
      "What areas of the codebase might need attention based on its structure?",
    );
  }

  if (depth === "full") {
    queries.push(
      "What coding conventions and patterns should be followed when making changes?",
      "What are the most critical files and components in this codebase?",
    );
  }

  return queries;
}

/**
 * Generate human-readable summary.
 * @internal
 */
function generateSummary(
  worldFacts: number,
  opinions: Opinion[],
  filesAnalyzed: number,
  duration: number,
  failedFacts: string[],
  reflectionFailures: string[],
): string {
  const parts: string[] = [];

  parts.push(`Learned ${worldFacts} world facts from ${filesAnalyzed} files`);

  if (opinions.length > 0) {
    const avgConfidence =
      opinions.reduce((sum, o) => sum + o.confidence, 0) / opinions.length;
    parts.push(
      `formed ${opinions.length} opinions with avg confidence ${avgConfidence.toFixed(2)}`,
    );
  }

  parts.push(`Duration: ${(duration / 1000).toFixed(1)}s`);

  if (failedFacts.length > 0) {
    parts.push(`(${failedFacts.length} facts failed to store)`);
  }

  if (reflectionFailures.length > 0) {
    parts.push(`(${reflectionFailures.length} reflection queries failed)`);
  }

  return parts.join("; ");
}
