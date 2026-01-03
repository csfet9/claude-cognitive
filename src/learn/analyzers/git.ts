/**
 * Git history analyzer.
 * @module learn/analyzers/git
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import { join } from "node:path";

const execAsync = promisify(exec);

/**
 * Information about a significant commit.
 */
export interface SignificantCommit {
  /** Commit hash (short) */
  hash: string;
  /** Commit message (first line) */
  message: string;
  /** Commit date (ISO format) */
  date: string;
  /** Number of files changed */
  filesChanged: number;
}

/**
 * File hotspot information.
 */
export interface FileHotspot {
  /** File path */
  file: string;
  /** Number of times changed */
  changeCount: number;
}

/**
 * Analysis result from git history.
 */
export interface GitAnalysis {
  /** Total commits analyzed */
  totalCommits: number;
  /** Unique contributors */
  contributors: string[];
  /** Significant commits (refactors, major features) */
  significantCommits: SignificantCommit[];
  /** Most frequently changed files */
  hotspots: FileHotspot[];
  /** Commit message patterns */
  commitPatterns: {
    /** Average commits per day (over analyzed period) */
    avgCommitsPerDay: number;
    /** Detected commit message convention */
    messageConvention?: string;
  };
}

/** Keywords indicating significant commits */
const SIGNIFICANT_KEYWORDS = [
  "refactor",
  "migrate",
  "switch",
  "replace",
  "introduce",
  "add support",
  "remove",
  "deprecate",
  "breaking",
  "major",
  "rewrite",
  "redesign",
  "upgrade",
  "initial",
  "setup",
];

/**
 * Analyze git history of a project.
 *
 * @param projectPath - Project root directory
 * @param maxCommits - Maximum commits to analyze
 * @returns Git analysis, or null if not a git repository
 */
export async function analyzeGitHistory(
  projectPath: string,
  maxCommits: number = 100,
): Promise<GitAnalysis | null> {
  // Check if .git exists
  try {
    await stat(join(projectPath, ".git"));
  } catch {
    return null; // Not a git repository
  }

  try {
    // Get commit log
    const { stdout: logOutput } = await execAsync(
      `git log --oneline --format="%h|%s|%ad|%an" --date=short -n ${maxCommits}`,
      { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 },
    );

    const commits = parseCommitLog(logOutput);

    // Get file change counts
    const { stdout: statOutput } = await execAsync(
      `git log --oneline --name-only -n ${maxCommits}`,
      { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 },
    );

    const hotspots = parseFileHotspots(statOutput);

    // Calculate patterns
    const commitPatterns = analyzeCommitPatterns(commits);

    // Find significant commits
    const significantCommits = findSignificantCommits(commits);

    // Get unique contributors
    const contributors = [...new Set(commits.map((c) => c.author))];

    return {
      totalCommits: commits.length,
      contributors,
      significantCommits,
      hotspots: hotspots.slice(0, 20), // Top 20 hotspots
      commitPatterns,
    };
  } catch {
    return null; // Git command failed
  }
}

/**
 * Parse commit log output.
 * @internal
 */
interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  author: string;
}

function parseCommitLog(output: string): CommitInfo[] {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      return {
        hash: parts[0] ?? "",
        message: parts[1] ?? "",
        date: parts[2] ?? "",
        author: parts[3] ?? "",
      };
    })
    .filter((c) => c.hash && c.message);
}

/**
 * Parse file hotspots from git log output.
 * @internal
 */
function parseFileHotspots(output: string): FileHotspot[] {
  const fileCounts: Record<string, number> = {};

  const lines = output.split("\n");
  for (const line of lines) {
    // Skip commit lines (they start with commit hash)
    if (!line.trim() || /^[a-f0-9]{7,}/.test(line)) continue;

    // This is a file path
    const file = line.trim();
    if (file) {
      fileCounts[file] = (fileCounts[file] || 0) + 1;
    }
  }

  return Object.entries(fileCounts)
    .map(([file, changeCount]) => ({ file, changeCount }))
    .sort((a, b) => b.changeCount - a.changeCount);
}

/**
 * Analyze commit message patterns.
 * @internal
 */
function analyzeCommitPatterns(
  commits: CommitInfo[],
): GitAnalysis["commitPatterns"] {
  if (commits.length === 0) {
    return { avgCommitsPerDay: 0 };
  }

  // Calculate average commits per day
  const dates = commits.map((c) => c.date);
  const uniqueDays = new Set(dates).size;
  const avgCommitsPerDay = commits.length / Math.max(uniqueDays, 1);

  // Detect commit message convention
  const messageConvention = detectConvention(commits.map((c) => c.message));

  const result: GitAnalysis["commitPatterns"] = { avgCommitsPerDay };
  if (messageConvention) {
    result.messageConvention = messageConvention;
  }
  return result;
}

/**
 * Detect commit message convention.
 * @internal
 */
function detectConvention(messages: string[]): string | undefined {
  // Conventional commits pattern: type(scope): message
  const conventionalPattern =
    /^(feat|fix|docs|style|refactor|test|chore)(\([^)]+\))?:/;
  const conventionalCount = messages.filter((m) =>
    conventionalPattern.test(m),
  ).length;

  if (conventionalCount > messages.length * 0.5) {
    return "Conventional Commits";
  }

  // Gitmoji pattern: starts with emoji
  const emojiPattern = /^[\u{1F300}-\u{1F9FF}]|^:[a-z_]+:/u;
  const emojiCount = messages.filter((m) => emojiPattern.test(m)).length;

  if (emojiCount > messages.length * 0.3) {
    return "Gitmoji";
  }

  return undefined;
}

/**
 * Find significant commits (refactors, major changes).
 * @internal
 */
function findSignificantCommits(commits: CommitInfo[]): SignificantCommit[] {
  return commits
    .filter((c) => {
      const msgLower = c.message.toLowerCase();
      return SIGNIFICANT_KEYWORDS.some((kw) => msgLower.includes(kw));
    })
    .slice(0, 10) // Top 10 significant commits
    .map((c) => ({
      hash: c.hash,
      message: c.message,
      date: c.date,
      filesChanged: 0, // Would need additional git call to get this
    }));
}

/**
 * Get a summary of git history.
 *
 * @param analysis - Git analysis result
 * @returns Human-readable git summary
 */
export function getGitSummary(analysis: GitAnalysis): string {
  const parts: string[] = [];

  parts.push(
    `${analysis.totalCommits} commits by ${analysis.contributors.length} contributors`,
  );

  if (analysis.commitPatterns.messageConvention) {
    parts.push(`Convention: ${analysis.commitPatterns.messageConvention}`);
  }

  if (analysis.hotspots.length > 0) {
    const topHotspots = analysis.hotspots
      .slice(0, 3)
      .map((h) => h.file)
      .join(", ");
    parts.push(`Hotspots: ${topHotspots}`);
  }

  return parts.join("; ");
}
