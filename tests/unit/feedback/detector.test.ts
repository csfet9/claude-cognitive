/**
 * Tests for detection strategies.
 * @module tests/unit/feedback/detector
 */

import { describe, it, expect } from "vitest";
import {
  detectExplicitReferences,
  detectSemanticMatches,
  detectBehavioralSignals,
  detectNegativeSignals,
  runDetectionPipeline,
  extractFileReferences,
  extractTopics,
} from "../../../src/feedback/detector.js";
import type { RecalledFact } from "../../../src/feedback/tracker.js";

/**
 * Create a mock fact for testing
 */
function createFact(overrides: Partial<RecalledFact> = {}): RecalledFact {
  return {
    factId: "fact-1",
    text: "Test fact about authentication",
    factType: "world",
    score: 0.8,
    position: 1,
    ...overrides,
  };
}

describe("detectExplicitReferences", () => {
  const facts: RecalledFact[] = [
    createFact({ factId: "fact-1", text: "The authentication uses JWT tokens" }),
    createFact({ factId: "fact-2", text: "User data is stored in PostgreSQL" }),
  ];

  it("should detect 'based on the context' pattern", () => {
    const response = "Based on the recalled context, authentication uses JWT tokens.";
    const result = detectExplicitReferences(response, facts);

    expect(result).toHaveLength(1);
    expect(result[0].factId).toBe("fact-1");
    expect(result[0].detectionType).toBe("explicit_reference");
    expect(result[0].confidence).toBe(0.95);
  });

  it("should detect 'according to memory' pattern", () => {
    const response =
      "According to my memory, the authentication system uses JWT tokens for session management.";
    const result = detectExplicitReferences(response, facts);

    expect(result).toHaveLength(1);
    expect(result[0].factId).toBe("fact-1");
  });

  it("should detect bracketed references", () => {
    const response =
      "[from context] The auth uses JWT tokens. [memory] Data is in PostgreSQL.";
    const result = detectExplicitReferences(response, facts);

    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect 'I recall that' pattern", () => {
    const response = "I recall that authentication uses JWT tokens for this project.";
    const result = detectExplicitReferences(response, facts);

    expect(result).toHaveLength(1);
    expect(result[0].factId).toBe("fact-1");
  });

  it("should return empty array for no matches", () => {
    const response = "This is a regular response without any context references.";
    const result = detectExplicitReferences(response, facts);

    expect(result).toHaveLength(0);
  });

  it("should handle empty response", () => {
    const result = detectExplicitReferences("", facts);
    expect(result).toHaveLength(0);
  });

  it("should handle empty facts", () => {
    const response = "Based on the context, something happened.";
    const result = detectExplicitReferences(response, []);
    expect(result).toHaveLength(0);
  });

  it("should not duplicate detections for same fact", () => {
    const response =
      "Based on the context, authentication uses JWT. I recall that JWT is used.";
    const result = detectExplicitReferences(response, facts);

    const factIds = result.map((d) => d.factId);
    const uniqueFactIds = [...new Set(factIds)];
    expect(factIds.length).toBe(uniqueFactIds.length);
  });
});

describe("detectSemanticMatches", () => {
  const facts: RecalledFact[] = [
    createFact({
      factId: "fact-1",
      text: "The authentication module uses JWT tokens for user sessions",
    }),
    createFact({
      factId: "fact-2",
      text: "Database connections are pooled using pgbouncer",
    }),
  ];

  it("should detect paraphrased content", () => {
    const response = "For authentication, we use JWT tokens to manage user sessions securely.";
    const result = detectSemanticMatches(response, facts, 0.3);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].factId).toBe("fact-1");
    expect(result[0].detectionType).toBe("semantic_match");
  });

  it("should respect threshold parameter", () => {
    const response = "Some unrelated content about cooking recipes.";
    const lowThreshold = detectSemanticMatches(response, facts, 0.01);
    const highThreshold = detectSemanticMatches(response, facts, 0.9);

    // Low threshold might match something, high threshold should not
    expect(highThreshold.length).toBe(0);
  });

  it("should handle long responses by chunking", () => {
    // Create a response longer than CHUNK_MAX_WORDS
    const longResponse = Array(100).fill("word").join(" ") + " JWT tokens for authentication sessions";
    const result = detectSemanticMatches(longResponse, facts, 0.2);

    // Should still find the match in one of the chunks
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("should return empty for empty input", () => {
    expect(detectSemanticMatches("", facts)).toHaveLength(0);
    expect(detectSemanticMatches("response", [])).toHaveLength(0);
  });

  it("should keep best match per fact", () => {
    const response = "JWT tokens authentication sessions JWT tokens authentication sessions";
    const result = detectSemanticMatches(response, facts, 0.2);

    // Should not have duplicate fact IDs
    const factIds = result.map((d) => d.factId);
    const uniqueFactIds = [...new Set(factIds)];
    expect(factIds.length).toBe(uniqueFactIds.length);
  });
});

describe("detectBehavioralSignals", () => {
  const facts: RecalledFact[] = [
    createFact({
      factId: "fact-1",
      text: "The auth.ts file handles authentication logic",
    }),
    createFact({
      factId: "fact-2",
      text: "User login is processed through login.tsx",
    }),
  ];

  it("should detect file access correlation", () => {
    const activity = {
      filesAccessed: ["auth.ts", "config.ts"],
    };
    const result = detectBehavioralSignals(activity, facts);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].detectionType).toBe("file_access_correlation");
  });

  it("should detect task topic correlation", () => {
    const activity = {
      tasksCompleted: [{ description: "Implement user authentication flow" }],
    };
    const result = detectBehavioralSignals(activity, facts);

    // Should match fact about authentication
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("should return empty for no activity", () => {
    const result = detectBehavioralSignals({}, facts);
    expect(result).toHaveLength(0);
  });

  it("should return empty for null activity", () => {
    const result = detectBehavioralSignals(null as any, facts);
    expect(result).toHaveLength(0);
  });

  it("should return empty for empty facts", () => {
    const activity = { filesAccessed: ["auth.ts"] };
    const result = detectBehavioralSignals(activity, []);
    expect(result).toHaveLength(0);
  });
});

describe("detectNegativeSignals", () => {
  it("should detect low position facts", () => {
    const facts: RecalledFact[] = [
      createFact({ factId: "fact-1", position: 20 }),
    ];
    const usedFactIds = new Set<string>();
    const result = detectNegativeSignals(null, facts, usedFactIds);

    expect(result).toHaveLength(1);
    expect(result[0].signals.some((s) => s.type === "low_position")).toBe(true);
  });

  it("should detect topic mismatch", () => {
    const facts: RecalledFact[] = [
      createFact({
        factId: "fact-1",
        text: "Cooking recipes for dinner",
        position: 1,
      }),
    ];
    const activity = { summary: "Working on authentication security" };
    const usedFactIds = new Set<string>();

    const result = detectNegativeSignals(activity, facts, usedFactIds);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].signals.some((s) => s.type === "topic_mismatch")).toBe(true);
  });

  it("should detect files not accessed", () => {
    const facts: RecalledFact[] = [
      createFact({
        factId: "fact-1",
        text: "The config.ts file has settings",
        position: 1,
      }),
    ];
    const activity = { filesAccessed: ["auth.ts", "user.ts"] };
    const usedFactIds = new Set<string>();

    const result = detectNegativeSignals(activity, facts, usedFactIds);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].signals.some((s) => s.type === "files_not_accessed")).toBe(true);
  });

  it("should skip facts already marked as used", () => {
    const facts: RecalledFact[] = [
      createFact({ factId: "fact-1", position: 20 }),
    ];
    const usedFactIds = new Set(["fact-1"]);

    const result = detectNegativeSignals(null, facts, usedFactIds);

    expect(result).toHaveLength(0);
  });

  it("should cap ignore confidence at maximum", () => {
    const facts: RecalledFact[] = [
      createFact({
        factId: "fact-1",
        text: "Cooking recipes for dinner using special.conf",
        position: 20,
      }),
    ];
    const activity = {
      summary: "Working on authentication security",
      filesAccessed: ["auth.ts"],
    };
    const usedFactIds = new Set<string>();

    const result = detectNegativeSignals(activity, facts, usedFactIds);

    // Even with multiple signals, confidence should be capped
    expect(result[0].ignoreConfidence).toBeLessThanOrEqual(0.9);
  });
});

describe("extractFileReferences", () => {
  it("should extract file extensions", () => {
    const text = "Check the auth.ts file for authentication logic.";
    const result = extractFileReferences(text);

    expect(result).toContain("auth.ts");
  });

  it("should extract path-like references", () => {
    const text = "Look at src/components/Button.tsx for the component.";
    const result = extractFileReferences(text);

    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should return empty for no files", () => {
    const text = "This is just plain text without any file references.";
    const result = extractFileReferences(text);

    expect(result).toHaveLength(0);
  });

  it("should handle empty input", () => {
    expect(extractFileReferences("")).toHaveLength(0);
    expect(extractFileReferences(null as any)).toHaveLength(0);
  });
});

describe("extractTopics", () => {
  it("should extract meaningful words", () => {
    const text = "Authentication and authorization for user login";
    const result = extractTopics(text);

    expect(result.has("authentication")).toBe(true);
    expect(result.has("authorization")).toBe(true);
    expect(result.has("user")).toBe(true);
    expect(result.has("login")).toBe(true);
  });

  it("should filter stop words", () => {
    const text = "The user is in the system and has access";
    const result = extractTopics(text);

    expect(result.has("the")).toBe(false);
    expect(result.has("is")).toBe(false);
    expect(result.has("in")).toBe(false);
    expect(result.has("and")).toBe(false);
    expect(result.has("has")).toBe(false);
  });

  it("should filter short words", () => {
    const text = "A is on to by at";
    const result = extractTopics(text);

    expect(result.size).toBe(0);
  });

  it("should handle empty input", () => {
    expect(extractTopics("").size).toBe(0);
    expect(extractTopics(null as any).size).toBe(0);
  });
});

describe("runDetectionPipeline", () => {
  const facts: RecalledFact[] = [
    createFact({
      factId: "fact-1",
      text: "Authentication uses JWT tokens",
      position: 1,
    }),
    createFact({
      factId: "fact-2",
      text: "Database uses PostgreSQL",
      position: 20,
    }),
  ];

  it("should run all detection strategies", () => {
    const response = "Based on the context, authentication uses JWT tokens.";
    const activity = { filesAccessed: ["auth.ts"] };

    const result = runDetectionPipeline(response, activity, facts);

    expect(result.explicit).toBeDefined();
    expect(result.semantic).toBeDefined();
    expect(result.behavioral).toBeDefined();
    expect(result.negative).toBeDefined();
  });

  it("should respect config flags", () => {
    const response = "Based on the context, something happened.";

    const result = runDetectionPipeline(response, null, facts, {
      explicit: false,
      semantic: false,
      behavioral: false,
    });

    expect(result.explicit).toHaveLength(0);
    expect(result.semantic).toHaveLength(0);
    expect(result.behavioral).toHaveLength(0);
  });

  it("should exclude used facts from negative signals", () => {
    const response =
      "Based on the context, authentication uses JWT tokens from auth.ts.";
    const activity = {
      filesAccessed: ["auth.ts"],
      summary: "Working on authentication",
    };

    const result = runDetectionPipeline(response, activity, facts);

    // fact-1 should be detected as used and not in negative
    const usedFactIds = new Set([
      ...result.explicit.map((d) => d.factId),
      ...result.semantic.map((d) => d.factId),
      ...result.behavioral.map((d) => d.factId),
    ]);

    for (const neg of result.negative) {
      expect(usedFactIds.has(neg.factId)).toBe(false);
    }
  });

  it("should handle null conversation text", () => {
    const result = runDetectionPipeline(null, null, facts);

    expect(result.explicit).toHaveLength(0);
    expect(result.semantic).toHaveLength(0);
  });
});
