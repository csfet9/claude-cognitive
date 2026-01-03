/**
 * Analyzer exports.
 * @module learn/analyzers
 */

export { analyzeReadme } from "./readme.js";
export type { ReadmeAnalysis } from "./readme.js";

export { analyzePackage, getTechStackSummary } from "./package.js";
export type {
  PackageAnalysis,
  DependencyInfo,
  DependencyCategory,
} from "./package.js";

export { analyzeStructure, getStructureSummary } from "./structure.js";
export type { StructureAnalysis } from "./structure.js";

export { analyzeGitHistory, getGitSummary } from "./git.js";
export type { GitAnalysis, SignificantCommit, FileHotspot } from "./git.js";

export { analyzeSource, getSourceSummary } from "./source.js";
export type {
  SourceAnalysis,
  CodePattern,
  ModuleInfo,
  CodingConventions,
} from "./source.js";
