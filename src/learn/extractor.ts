/**
 * Fact extraction from analysis results.
 * @module learn/extractor
 */

import type { ExtractedFact } from "../types.js";
import type { ReadmeAnalysis } from "./analyzers/readme.js";
import type { PackageAnalysis } from "./analyzers/package.js";
import type { StructureAnalysis } from "./analyzers/structure.js";
import type { GitAnalysis } from "./analyzers/git.js";
import type { SourceAnalysis } from "./analyzers/source.js";

/**
 * Combined analysis results for fact extraction.
 */
export interface AnalysisResults {
  readme?: ReadmeAnalysis | null;
  package?: PackageAnalysis | null;
  structure?: StructureAnalysis | null;
  git?: GitAnalysis | null;
  source?: SourceAnalysis | null;
}

/**
 * Fact extractor interface.
 */
export interface FactExtractor {
  /**
   * Extract facts from analysis results.
   *
   * @param analysis - Combined analysis results
   * @returns Array of extracted facts
   */
  extractFacts(analysis: AnalysisResults): ExtractedFact[];
}

/**
 * Default fact extractor implementation.
 *
 * Converts analysis results into structured facts for storage in Hindsight.
 */
export class DefaultFactExtractor implements FactExtractor {
  /**
   * Extract facts from analysis results.
   *
   * @param analysis - Combined analysis results
   * @returns Array of extracted facts
   */
  extractFacts(analysis: AnalysisResults): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Extract from README
    if (analysis.readme) {
      facts.push(...this.extractFromReadme(analysis.readme));
    }

    // Extract from package.json
    if (analysis.package) {
      facts.push(...this.extractFromPackage(analysis.package));
    }

    // Extract from structure
    if (analysis.structure) {
      facts.push(...this.extractFromStructure(analysis.structure));
    }

    // Extract from git history
    if (analysis.git) {
      facts.push(...this.extractFromGit(analysis.git));
    }

    // Extract from source analysis
    if (analysis.source) {
      facts.push(...this.extractFromSource(analysis.source));
    }

    return facts;
  }

  /**
   * Extract facts from README analysis.
   * @internal
   */
  private extractFromReadme(readme: ReadmeAnalysis): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Project description
    if (readme.projectDescription) {
      facts.push({
        content: `Project description: ${readme.projectDescription}`,
        context: "Extracted from README.md",
        category: "decisions",
      });
    }

    // Features
    if (readme.features.length > 0) {
      facts.push({
        content: `Key features: ${readme.features.slice(0, 5).join("; ")}`,
        context: "Extracted from README.md features section",
        category: "decisions",
      });
    }

    // Setup instructions
    if (readme.setupInstructions.length > 0) {
      facts.push({
        content: `Setup commands: ${readme.setupInstructions.slice(0, 3).join(", ")}`,
        context: "Extracted from README.md installation section",
        category: "decisions",
      });
    }

    return facts;
  }

  /**
   * Extract facts from package.json analysis.
   * @internal
   */
  private extractFromPackage(pkg: PackageAnalysis): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Project identity
    if (pkg.description) {
      facts.push({
        content: `Package ${pkg.name}: ${pkg.description}`,
        context: "From package.json",
        category: "decisions",
      });
    }

    // Tech stack - frameworks
    const frameworks = pkg.dependencies.filter((d) => d.category === "framework");
    if (frameworks.length > 0) {
      facts.push({
        content: `Framework stack: ${frameworks.map((f) => f.name).join(", ")}`,
        context: "From package.json dependencies",
        category: "stack",
      });
    }

    // Tech stack - UI
    const ui = pkg.dependencies.filter((d) => d.category === "ui");
    if (ui.length > 0) {
      facts.push({
        content: `UI libraries: ${ui.map((u) => u.name).join(", ")}`,
        context: "From package.json dependencies",
        category: "stack",
      });
    }

    // Tech stack - state management
    const state = pkg.dependencies.filter((d) => d.category === "state");
    if (state.length > 0) {
      facts.push({
        content: `State management: ${state.map((s) => s.name).join(", ")}`,
        context: "From package.json dependencies",
        category: "stack",
      });
    }

    // Tech stack - database
    const db = pkg.dependencies.filter((d) => d.category === "database");
    if (db.length > 0) {
      facts.push({
        content: `Database/ORM: ${db.map((d) => d.name).join(", ")}`,
        context: "From package.json dependencies",
        category: "stack",
      });
    }

    // Development tools
    const build = pkg.devDependencies.filter((d) => d.category === "build");
    if (build.length > 0) {
      facts.push({
        content: `Build tools: ${build.map((b) => b.name).join(", ")}`,
        context: "From package.json devDependencies",
        category: "stack",
      });
    }

    // Testing tools
    const testing = pkg.devDependencies.filter((d) => d.category === "testing");
    if (testing.length > 0) {
      facts.push({
        content: `Testing tools: ${testing.map((t) => t.name).join(", ")}`,
        context: "From package.json devDependencies",
        category: "stack",
      });
    }

    // Key scripts
    const importantScripts = ["test", "build", "dev", "start", "lint"];
    const scripts = Object.entries(pkg.scripts)
      .filter(([name]) => importantScripts.includes(name))
      .map(([name, cmd]) => `${name}: ${cmd}`);
    if (scripts.length > 0) {
      facts.push({
        content: `NPM scripts: ${scripts.join("; ")}`,
        context: "From package.json scripts",
        category: "decisions",
      });
    }

    // TypeScript detection
    const hasTS =
      pkg.devDependencies.some((d) => d.name === "typescript") ||
      pkg.dependencies.some((d) => d.name === "typescript");
    if (hasTS) {
      facts.push({
        content: "Language: TypeScript",
        context: "TypeScript found in dependencies",
        category: "stack",
      });
    }

    return facts;
  }

  /**
   * Extract facts from structure analysis.
   * @internal
   */
  private extractFromStructure(structure: StructureAnalysis): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Project structure
    if (structure.sourceDirectories.length > 0 || structure.testDirectories.length > 0) {
      const parts: string[] = [];
      if (structure.sourceDirectories.length > 0) {
        parts.push(`source in ${structure.sourceDirectories.join(", ")}`);
      }
      if (structure.testDirectories.length > 0) {
        parts.push(`tests in ${structure.testDirectories.join(", ")}`);
      }
      facts.push({
        content: `Project structure: ${parts.join("; ")}`,
        context: "Analyzed directory structure",
        category: "structure",
      });
    }

    // Entry points
    if (structure.entryPoints.length > 0) {
      facts.push({
        content: `Entry points: ${structure.entryPoints.slice(0, 5).join(", ")}`,
        context: "Identified from file naming patterns",
        category: "structure",
      });
    }

    // Config files
    if (structure.configFiles.length > 0) {
      facts.push({
        content: `Configuration files: ${structure.configFiles.slice(0, 10).join(", ")}`,
        context: "Found in project root",
        category: "structure",
      });
    }

    // File type distribution
    const topTypes = Object.entries(structure.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (topTypes.length > 0) {
      facts.push({
        content: `File types: ${topTypes.map(([ext, count]) => `${ext}(${count})`).join(", ")}`,
        context: "From file extension analysis",
        category: "structure",
      });
    }

    return facts;
  }

  /**
   * Extract facts from git history analysis.
   * @internal
   */
  private extractFromGit(git: GitAnalysis): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Team size
    if (git.contributors.length > 0) {
      facts.push({
        content: `Team: ${git.contributors.length} contributors (${git.contributors.slice(0, 5).join(", ")})`,
        context: "From git history",
        category: "history",
      });
    }

    // Commit convention
    if (git.commitPatterns.messageConvention) {
      facts.push({
        content: `Commit convention: ${git.commitPatterns.messageConvention}`,
        context: "Detected from commit messages",
        category: "patterns",
      });
    }

    // Significant commits (decisions)
    for (const commit of git.significantCommits.slice(0, 5)) {
      facts.push({
        content: `Historical decision: ${commit.message}`,
        context: `From git commit ${commit.hash} on ${commit.date}`,
        category: "history",
      });
    }

    // File hotspots
    if (git.hotspots.length > 0) {
      const topHotspots = git.hotspots.slice(0, 5);
      facts.push({
        content: `Most active files: ${topHotspots.map((h) => h.file).join(", ")}`,
        context: "Based on git commit frequency",
        category: "patterns",
      });
    }

    return facts;
  }

  /**
   * Extract facts from source code analysis.
   * @internal
   */
  private extractFromSource(source: SourceAnalysis): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Coding conventions
    facts.push({
      content: `Naming convention: ${source.conventions.namingStyle}`,
      context: "Detected from source code analysis",
      category: "patterns",
    });

    facts.push({
      content: `Import style: ${source.conventions.importStyle} imports preferred`,
      context: "Detected from source code analysis",
      category: "patterns",
    });

    facts.push({
      content: `Error handling: ${source.conventions.errorHandling}`,
      context: "Detected from source code analysis",
      category: "patterns",
    });

    if (source.conventions.prefersAsync) {
      facts.push({
        content: "Async/await is preferred over raw Promises",
        context: "Detected from source code analysis",
        category: "patterns",
      });
    }

    // Code patterns
    for (const pattern of source.patterns) {
      facts.push({
        content: `Code pattern: ${pattern.description}`,
        context: `Found in: ${pattern.examples.slice(0, 3).join(", ")}`,
        category: "patterns",
      });
    }

    return facts;
  }
}

/**
 * Create a default fact extractor.
 */
export function createFactExtractor(): FactExtractor {
  return new DefaultFactExtractor();
}
