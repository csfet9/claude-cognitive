/**
 * Recall Session Tracker
 *
 * Tracks recalled facts for a session to enable feedback loop analysis.
 * Writes to .claude/feedback-sessions/.recall-session.json
 *
 * @module feedback/tracker
 */

import fs from "node:fs";
import path from "node:path";
import { SESSION_DATA_RETENTION_DAYS } from "./constants.js";
import type { Memory } from "../types.js";

// =============================================================================
// Types
// =============================================================================

export interface RecallParams {
  query: string;
  queryType: "fixed" | "adaptive";
  parameters: {
    limit: number;
    budget: string;
    factTypes: string[];
    timeWindow: string | null;
  };
  context: SessionContext;
}

export interface SessionContext {
  branch: string | null;
  recentFiles: string[];
  projectType: string | null;
}

export interface RecalledFact {
  factId: string;
  text: string;
  factType: string;
  score: number;
  position: number;
}

export interface RecallSession {
  sessionId: string;
  startedAt: string;
  project: string;
  recall: RecallParams;
  factsRecalled: RecalledFact[];
  totalFacts: number;
  totalTokens: number;
}

export interface SessionStats {
  currentSession: RecallSession | null;
  archivedSessions: number;
  totalFactsTracked: number;
  oldestSession: string | null;
  newestSession: string | null;
}

// =============================================================================
// Session File Paths
// =============================================================================

/**
 * Get the path to the feedback sessions directory
 */
export function getSessionActivityDir(projectDir: string): string {
  return path.join(projectDir, ".claude", "feedback-sessions");
}

/**
 * Get the path to the recall session file
 */
export function getRecallSessionPath(projectDir: string): string {
  return path.join(getSessionActivityDir(projectDir), ".recall-session.json");
}

// =============================================================================
// Session Creation & Management
// =============================================================================

/**
 * Get context information for the session
 */
function getSessionContext(projectDir: string): SessionContext {
  const context: SessionContext = {
    branch: null,
    recentFiles: [],
    projectType: null,
  };

  // Try to get git branch
  try {
    const gitHeadPath = path.join(projectDir, ".git", "HEAD");
    if (fs.existsSync(gitHeadPath)) {
      const headContent = fs.readFileSync(gitHeadPath, "utf-8").trim();
      const match = headContent.match(/ref: refs\/heads\/(.+)/);
      if (match && match[1]) {
        context.branch = match[1];
      }
    }
  } catch {
    // Ignore git errors
  }

  // Try to detect project type from package.json or other markers
  try {
    const packageJsonPath = path.join(projectDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.expo || deps["expo-cli"]) {
        context.projectType = "expo-mobile";
      } else if (deps.next) {
        context.projectType = "nextjs";
      } else if (deps.react) {
        context.projectType = "react";
      } else if (deps.express) {
        context.projectType = "express-api";
      } else if (deps.fastify) {
        context.projectType = "fastify-api";
      } else {
        context.projectType = "nodejs";
      }
    }

    // Check for Python
    const requirementsPath = path.join(projectDir, "requirements.txt");
    const pyprojectPath = path.join(projectDir, "pyproject.toml");
    if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath)) {
      context.projectType = "python";
    }
  } catch {
    // Ignore detection errors
  }

  return context;
}

/**
 * Create a new recall session record
 */
export function createRecallSession(
  sessionId: string,
  projectDir: string,
  recallParams: {
    query?: string;
    queryType?: "fixed" | "adaptive";
    limit?: number;
    budget?: string;
    factTypes?: string[];
    timeWindow?: string | null;
  } = {},
): RecallSession {
  const context = getSessionContext(projectDir);

  return {
    sessionId,
    startedAt: new Date().toISOString(),
    project: path.basename(projectDir),
    recall: {
      query: recallParams.query || "",
      queryType: recallParams.queryType || "fixed",
      parameters: {
        limit: recallParams.limit || 20,
        budget: recallParams.budget || "high",
        factTypes: recallParams.factTypes || ["world", "experience"],
        timeWindow: recallParams.timeWindow || null,
      },
      context,
    },
    factsRecalled: [],
    totalFacts: 0,
    totalTokens: 0,
  };
}

/**
 * Add recalled facts to session
 */
export function addRecalledFacts(session: RecallSession, facts: Memory[]): RecallSession {
  if (!facts || !Array.isArray(facts)) {
    return session;
  }

  session.factsRecalled = facts.map((fact, index) => ({
    factId: fact.id || `unknown-${index}`,
    text: fact.text || "",
    factType: fact.factType || "unknown",
    score: 0, // Score may be added later from recall results
    position: index + 1,
  }));

  session.totalFacts = session.factsRecalled.length;

  // Estimate tokens (rough: ~4 chars per token)
  const totalChars = session.factsRecalled.reduce((sum, f) => sum + (f.text?.length || 0), 0);
  session.totalTokens = Math.ceil(totalChars / 4);

  return session;
}

/**
 * Save recall session to disk
 */
export async function saveRecallSession(
  session: RecallSession,
  projectDir: string,
): Promise<void> {
  const activityDir = getSessionActivityDir(projectDir);
  const sessionPath = getRecallSessionPath(projectDir);

  // Ensure directory exists
  if (!fs.existsSync(activityDir)) {
    fs.mkdirSync(activityDir, { recursive: true });
  }

  // Archive previous session if exists (different session ID)
  if (fs.existsSync(sessionPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
      if (existing.sessionId && existing.sessionId !== session.sessionId) {
        const archiveName = `.recall-session-${existing.sessionId.slice(0, 8)}-${Date.now()}.json`;
        const archivePath = path.join(activityDir, archiveName);
        fs.renameSync(sessionPath, archivePath);
      }
    } catch {
      // Ignore archive errors
    }
  }

  // Write session data
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

/**
 * Validate that parsed JSON matches RecallSession structure
 * @returns Validated session or null if invalid
 */
function validateRecallSession(data: unknown): RecallSession | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // Required fields validation
  if (typeof obj.sessionId !== "string" || !obj.sessionId) return null;
  if (typeof obj.startedAt !== "string") return null;
  if (typeof obj.project !== "string") return null;
  if (!Array.isArray(obj.factsRecalled)) return null;

  // Validate factsRecalled structure
  for (const fact of obj.factsRecalled) {
    if (!fact || typeof fact !== "object") return null;
    const f = fact as Record<string, unknown>;
    if (typeof f.factId !== "string") return null;
  }

  return data as RecallSession;
}

/**
 * Load recall session from disk
 */
export async function loadRecallSession(
  sessionId: string | null,
  projectDir: string,
): Promise<RecallSession | null> {
  const sessionPath = getRecallSessionPath(projectDir);

  if (!fs.existsSync(sessionPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
    const parsed = JSON.parse(content);
    const session = validateRecallSession(parsed);

    if (!session) {
      return null;
    }

    // If sessionId specified, verify it matches
    if (sessionId && session.sessionId !== sessionId) {
      // Look for archived session
      const activityDir = getSessionActivityDir(projectDir);
      const files = fs.readdirSync(activityDir);
      const archived = files.find(
        (f) => f.startsWith(`.recall-session-${sessionId.slice(0, 8)}`) && f.endsWith(".json"),
      );

      if (archived) {
        const archivedContent = fs.readFileSync(path.join(activityDir, archived), "utf-8");
        const archivedParsed = JSON.parse(archivedContent);
        return validateRecallSession(archivedParsed);
      }

      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Track a recall operation (convenience function combining create, add, save)
 */
export async function trackRecall(options: {
  sessionId: string;
  projectDir: string;
  query: string;
  facts: Memory[];
  params?: {
    queryType?: "fixed" | "adaptive";
    limit?: number;
    budget?: string;
    factTypes?: string[];
    timeWindow?: string | null;
  };
}): Promise<RecallSession> {
  const { sessionId, projectDir, query, facts, params = {} } = options;

  const session = createRecallSession(sessionId, projectDir, {
    query,
    ...params,
  });

  addRecalledFacts(session, facts);
  await saveRecallSession(session, projectDir);

  return session;
}

/**
 * Clean up old session data
 */
export async function cleanupOldSessions(
  projectDir: string,
  retentionDays: number = SESSION_DATA_RETENTION_DAYS,
): Promise<number> {
  const activityDir = getSessionActivityDir(projectDir);

  if (!fs.existsSync(activityDir)) {
    return 0;
  }

  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let cleanedCount = 0;

  try {
    const files = fs.readdirSync(activityDir);

    for (const file of files) {
      if (!file.startsWith(".recall-session-") || !file.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(activityDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    }
  } catch {
    // Ignore cleanup errors
  }

  return cleanedCount;
}

/**
 * Get statistics about tracked sessions
 */
export async function getSessionStats(projectDir: string): Promise<SessionStats> {
  const activityDir = getSessionActivityDir(projectDir);

  const stats: SessionStats = {
    currentSession: null,
    archivedSessions: 0,
    totalFactsTracked: 0,
    oldestSession: null,
    newestSession: null,
  };

  if (!fs.existsSync(activityDir)) {
    return stats;
  }

  try {
    // Load current session
    const currentPath = getRecallSessionPath(projectDir);
    if (fs.existsSync(currentPath)) {
      const content = fs.readFileSync(currentPath, "utf-8");
      const parsed = JSON.parse(content);
      stats.currentSession = validateRecallSession(parsed);
      stats.totalFactsTracked += stats.currentSession?.totalFacts || 0;
      stats.newestSession = stats.currentSession?.startedAt || null;
      stats.oldestSession = stats.currentSession?.startedAt || null;
    }

    // Count archived sessions
    const files = fs.readdirSync(activityDir);
    for (const file of files) {
      if (!file.startsWith(".recall-session-") || !file.endsWith(".json")) {
        continue;
      }

      stats.archivedSessions++;

      try {
        const content = fs.readFileSync(path.join(activityDir, file), "utf-8");
        const parsed = JSON.parse(content);
        const session = validateRecallSession(parsed);

        if (session) {
          stats.totalFactsTracked += session.totalFacts || 0;

          if (session.startedAt) {
            if (!stats.oldestSession || session.startedAt < stats.oldestSession) {
              stats.oldestSession = session.startedAt;
            }
            if (!stats.newestSession || session.startedAt > stats.newestSession) {
              stats.newestSession = session.startedAt;
            }
          }
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore stats errors
  }

  return stats;
}
