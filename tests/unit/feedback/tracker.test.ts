/**
 * Tests for recall session tracking.
 * @module tests/unit/feedback/tracker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createRecallSession,
  addRecalledFacts,
  saveRecallSession,
  loadRecallSession,
  getRecallSessionPath,
  getSessionActivityDir,
  cleanupOldSessions,
  type RecallSession,
} from "../../../src/feedback/tracker.js";
import type { Memory } from "../../../src/types.js";

// Mock fs module
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    renameSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
}));

const mockFs = vi.mocked(fs);

describe("getSessionActivityDir", () => {
  it("should return the correct path", () => {
    const result = getSessionActivityDir("/project");
    expect(result).toBe(path.join("/project", ".claude", "feedback-sessions"));
  });
});

describe("getRecallSessionPath", () => {
  it("should return the correct path", () => {
    const result = getRecallSessionPath("/project");
    expect(result).toBe(
      path.join(
        "/project",
        ".claude",
        "feedback-sessions",
        ".recall-session.json",
      ),
    );
  });
});

describe("createRecallSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
  });

  it("should create a session with required fields", () => {
    const session = createRecallSession("session-123", "/project");

    expect(session.sessionId).toBe("session-123");
    expect(session.project).toBe("project");
    expect(session.startedAt).toBeDefined();
    expect(session.factsRecalled).toEqual([]);
    expect(session.totalFacts).toBe(0);
    expect(session.totalTokens).toBe(0);
  });

  it("should set recall parameters", () => {
    const session = createRecallSession("session-123", "/project", {
      query: "test query",
      queryType: "adaptive",
      limit: 10,
      budget: "medium",
      factTypes: ["world", "opinion"],
    });

    expect(session.recall.query).toBe("test query");
    expect(session.recall.queryType).toBe("adaptive");
    expect(session.recall.parameters.limit).toBe(10);
    expect(session.recall.parameters.budget).toBe("medium");
    expect(session.recall.parameters.factTypes).toEqual(["world", "opinion"]);
  });

  it("should use defaults for missing parameters", () => {
    const session = createRecallSession("session-123", "/project");

    expect(session.recall.query).toBe("");
    expect(session.recall.queryType).toBe("fixed");
    expect(session.recall.parameters.limit).toBe(20);
    expect(session.recall.parameters.budget).toBe("high");
    expect(session.recall.parameters.factTypes).toEqual([
      "world",
      "experience",
    ]);
  });

  it("should detect git branch when .git exists", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes(".git/HEAD"),
    );
    mockFs.readFileSync.mockReturnValue("ref: refs/heads/feature-branch\n");

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.branch).toBe("feature-branch");
  });

  it("should detect nodejs project type from package.json", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ dependencies: {} }));

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("nodejs");
  });

  it("should detect react project type", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ dependencies: { react: "^18.0.0" } }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("react");
  });

  it("should detect expo-mobile project type", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ dependencies: { expo: "~49.0.0", react: "^18.0.0" } }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("expo-mobile");
  });

  it("should detect nextjs project type", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("nextjs");
  });

  it("should detect express-api project type", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ dependencies: { express: "^4.18.0" } }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("express-api");
  });

  it("should detect fastify-api project type", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ dependencies: { fastify: "^4.0.0" } }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("fastify-api");
  });

  it("should detect python project type from requirements.txt", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("requirements.txt"),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("python");
  });

  it("should detect python project type from pyproject.toml", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("pyproject.toml"),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("python");
  });

  it("should prioritize expo over react when both are present", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: {
          expo: "~49.0.0",
          react: "^18.0.0",
          "react-native": "0.72.0",
        },
      }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("expo-mobile");
  });

  it("should prioritize nextjs over react when both are present", () => {
    mockFs.existsSync.mockImplementation((p) =>
      String(p).includes("package.json"),
    );
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { next: "^14.0.0", react: "^18.0.0" },
      }),
    );

    const session = createRecallSession("session-123", "/project");

    expect(session.recall.context.projectType).toBe("nextjs");
  });
});

describe("addRecalledFacts", () => {
  it("should add facts to session", () => {
    const session = createRecallSession("session-123", "/project");
    const facts: Memory[] = [
      {
        id: "fact-1",
        text: "First fact",
        factType: "world",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "fact-2",
        text: "Second fact text that is longer",
        factType: "experience",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const result = addRecalledFacts(session, facts);

    expect(result.factsRecalled).toHaveLength(2);
    expect(result.factsRecalled[0].factId).toBe("fact-1");
    expect(result.factsRecalled[0].text).toBe("First fact");
    expect(result.factsRecalled[0].factType).toBe("world");
    expect(result.factsRecalled[0].position).toBe(1);
    expect(result.factsRecalled[1].position).toBe(2);
    expect(result.totalFacts).toBe(2);
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it("should handle facts without id", () => {
    const session = createRecallSession("session-123", "/project");
    const facts = [{ text: "No ID fact" }] as unknown as Memory[];

    const result = addRecalledFacts(session, facts);

    expect(result.factsRecalled[0].factId).toBe("unknown-0");
  });

  it("should return session unchanged for empty facts", () => {
    const session = createRecallSession("session-123", "/project");

    const result = addRecalledFacts(session, []);

    expect(result.factsRecalled).toHaveLength(0);
    expect(result.totalFacts).toBe(0);
  });

  it("should handle null/undefined input", () => {
    const session = createRecallSession("session-123", "/project");

    const result1 = addRecalledFacts(session, null as unknown as Memory[]);
    const result2 = addRecalledFacts(session, undefined as unknown as Memory[]);

    expect(result1.factsRecalled).toHaveLength(0);
    expect(result2.factsRecalled).toHaveLength(0);
  });
});

describe("saveRecallSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
  });

  it("should create directory if not exists", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const session = createRecallSession("session-123", "/project");
    await saveRecallSession(session, "/project");

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("feedback-sessions"),
      { recursive: true },
    );
  });

  it("should write session to file", async () => {
    mockFs.existsSync.mockReturnValue(true);

    const session = createRecallSession("session-123", "/project");
    await saveRecallSession(session, "/project");

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(".recall-session.json"),
      expect.any(String),
    );

    const writtenContent = JSON.parse(
      mockFs.writeFileSync.mock.calls[0][1] as string,
    );
    expect(writtenContent.sessionId).toBe("session-123");
  });

  it("should archive existing session with different ID", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ sessionId: "old-session-456" }),
    );

    const session = createRecallSession("session-123", "/project");
    await saveRecallSession(session, "/project");

    expect(mockFs.renameSync).toHaveBeenCalled();
  });
});

describe("loadRecallSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if file does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = await loadRecallSession("session-123", "/project");

    expect(result).toBeNull();
  });

  it("should load session from file", async () => {
    const sessionData: RecallSession = {
      sessionId: "session-123",
      startedAt: "2024-01-01T00:00:00Z",
      project: "test",
      recall: {
        query: "test",
        queryType: "fixed",
        parameters: {
          limit: 20,
          budget: "high",
          factTypes: [],
          timeWindow: null,
        },
        context: { branch: null, recentFiles: [], projectType: null },
      },
      factsRecalled: [],
      totalFacts: 0,
      totalTokens: 0,
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(sessionData));

    const result = await loadRecallSession("session-123", "/project");

    expect(result).toEqual(sessionData);
  });

  it("should return null for mismatched session ID", async () => {
    const sessionData: RecallSession = {
      sessionId: "different-id",
      startedAt: "2024-01-01T00:00:00Z",
      project: "test",
      recall: {
        query: "test",
        queryType: "fixed",
        parameters: {
          limit: 20,
          budget: "high",
          factTypes: [],
          timeWindow: null,
        },
        context: { branch: null, recentFiles: [], projectType: null },
      },
      factsRecalled: [],
      totalFacts: 0,
      totalTokens: 0,
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(sessionData));
    mockFs.readdirSync.mockReturnValue([]);

    const result = await loadRecallSession("session-123", "/project");

    expect(result).toBeNull();
  });

  it("should load session without specifying ID", async () => {
    const sessionData: RecallSession = {
      sessionId: "any-session",
      startedAt: "2024-01-01T00:00:00Z",
      project: "test",
      recall: {
        query: "test",
        queryType: "fixed",
        parameters: {
          limit: 20,
          budget: "high",
          factTypes: [],
          timeWindow: null,
        },
        context: { branch: null, recentFiles: [], projectType: null },
      },
      factsRecalled: [],
      totalFacts: 0,
      totalTokens: 0,
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(sessionData));

    const result = await loadRecallSession(null, "/project");

    expect(result).toEqual(sessionData);
  });

  it("should return null for invalid JSON structure", async () => {
    // Missing required fields
    const invalidData = { someField: "value" };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidData));

    const result = await loadRecallSession(null, "/project");

    expect(result).toBeNull();
  });

  it("should return null for malformed JSON", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("{ invalid json }");

    const result = await loadRecallSession(null, "/project");

    expect(result).toBeNull();
  });

  it("should validate factsRecalled array structure", async () => {
    const invalidData = {
      sessionId: "session-123",
      startedAt: "2024-01-01T00:00:00Z",
      project: "test",
      factsRecalled: [{ notAFactId: "invalid" }], // Missing factId
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidData));

    const result = await loadRecallSession(null, "/project");

    expect(result).toBeNull();
  });

  it("should accept valid session with facts", async () => {
    const validData: RecallSession = {
      sessionId: "session-123",
      startedAt: "2024-01-01T00:00:00Z",
      project: "test",
      recall: {
        query: "test",
        queryType: "fixed",
        parameters: {
          limit: 20,
          budget: "high",
          factTypes: [],
          timeWindow: null,
        },
        context: { branch: null, recentFiles: [], projectType: null },
      },
      factsRecalled: [
        {
          factId: "fact-1",
          text: "Test fact",
          factType: "world",
          score: 0.9,
          position: 1,
        },
      ],
      totalFacts: 1,
      totalTokens: 10,
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(validData));

    const result = await loadRecallSession(null, "/project");

    expect(result).toEqual(validData);
    expect(result?.factsRecalled).toHaveLength(1);
    expect(result?.factsRecalled[0].factId).toBe("fact-1");
  });
});

describe("cleanupOldSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 if directory does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = await cleanupOldSessions("/project");

    expect(result).toBe(0);
  });

  it("should delete old session files", async () => {
    const now = Date.now();
    const oldTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      ".recall-session-abc12345-old.json",
      ".recall-session-def67890-recent.json",
    ] as unknown as fs.Dirent[]);
    mockFs.statSync.mockImplementation((p) => {
      if (String(p).includes("old")) {
        return { mtimeMs: oldTime } as fs.Stats;
      }
      return { mtimeMs: now } as fs.Stats;
    });

    const result = await cleanupOldSessions("/project", 7);

    expect(result).toBe(1);
    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  it("should not delete non-session files", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "other-file.json",
      ".recall-session.json",
    ] as unknown as fs.Dirent[]);

    const result = await cleanupOldSessions("/project");

    expect(result).toBe(0);
    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
  });
});
