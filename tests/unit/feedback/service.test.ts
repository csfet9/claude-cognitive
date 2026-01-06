/**
 * Tests for FeedbackService class.
 * @module tests/unit/feedback/service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import {
  FeedbackService,
  createFeedbackService,
} from "../../../src/feedback/index.js";
import type { FeedbackConfig, Memory } from "../../../src/types.js";

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

describe("FeedbackService", () => {
  const projectDir = "/test/project";
  const enabledConfig: FeedbackConfig = {
    enabled: true,
    detection: {
      explicit: true,
      semantic: true,
      behavioral: true,
    },
    hindsight: {
      sendFeedback: true,
    },
  };

  const disabledConfig: FeedbackConfig = {
    enabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
  });

  describe("constructor and factory", () => {
    it("should create service with config", () => {
      const service = new FeedbackService(enabledConfig, projectDir);
      expect(service.isEnabled()).toBe(true);
    });

    it("should create service with factory function", () => {
      const service = createFeedbackService(enabledConfig, projectDir);
      expect(service.isEnabled()).toBe(true);
    });

    it("should merge with default config", () => {
      const partialConfig: FeedbackConfig = { enabled: true };
      const service = new FeedbackService(partialConfig, projectDir);

      const config = service.getConfig();
      expect(config.detection?.explicit).toBe(true);
      expect(config.detection?.semantic).toBe(true);
    });
  });

  describe("isEnabled", () => {
    it("should return true when enabled", () => {
      const service = new FeedbackService(enabledConfig, projectDir);
      expect(service.isEnabled()).toBe(true);
    });

    it("should return false when disabled", () => {
      const service = new FeedbackService(disabledConfig, projectDir);
      expect(service.isEnabled()).toBe(false);
    });

    it("should return false by default", () => {
      const service = new FeedbackService({}, projectDir);
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe("trackRecall", () => {
    const facts: Memory[] = [
      {
        id: "fact-1",
        text: "Test fact about authentication",
        factType: "world",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    it("should track recall when enabled", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.trackRecall(
        "session-123",
        "test query",
        facts,
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("session-123");
      expect(result.factsTracked).toBe(1);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("should return failure reason when disabled", async () => {
      const service = new FeedbackService(disabledConfig, projectDir);

      const result = await service.trackRecall(
        "session-123",
        "test query",
        facts,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe("Feedback loop disabled");
    });

    it("should handle errors gracefully", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error("Write failed");
      });

      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.trackRecall(
        "session-123",
        "test query",
        facts,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Write failed");
    });
  });

  describe("processFeedback", () => {
    beforeEach(() => {
      // Set up mock session data
      const sessionData = {
        sessionId: "session-123",
        startedAt: "2024-01-01T00:00:00Z",
        project: "test",
        recall: {
          query: "test query",
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
            text: "Authentication uses JWT tokens",
            factType: "world",
            score: 0.8,
            position: 1,
          },
        ],
        totalFacts: 1,
        totalTokens: 10,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(sessionData));
    });

    it("should process feedback when enabled", async () => {
      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.processFeedback("session-123", {
        conversationText:
          "Based on the context, authentication uses JWT tokens.",
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("session-123");
      expect(result.summary).toBeDefined();
      expect(result.factScores).toBeDefined();
    });

    it("should return failure when disabled", async () => {
      const service = new FeedbackService(disabledConfig, projectDir);

      const result = await service.processFeedback("session-123", {});

      expect(result.success).toBe(false);
      expect(result.reason).toBe("Feedback loop disabled");
    });

    it("should return failure when no session found", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.processFeedback("session-123", {});

      expect(result.success).toBe(false);
      expect(result.reason).toContain("No recall session found");
    });

    it("should include feedback signals when hindsight.sendFeedback is true", async () => {
      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.processFeedback("session-123", {
        conversationText:
          "Based on the context, authentication uses JWT tokens.",
      });

      // Should prepare feedback for API
      expect(result.feedback).toBeDefined();
      expect(Array.isArray(result.feedback)).toBe(true);
    });

    it("should not include feedback when hindsight.sendFeedback is false", async () => {
      const noSendConfig: FeedbackConfig = {
        enabled: true,
        hindsight: { sendFeedback: false },
      };
      const service = new FeedbackService(noSendConfig, projectDir);

      const result = await service.processFeedback("session-123", {
        conversationText: "Based on the context, something happened.",
      });

      expect(result.feedback).toHaveLength(0);
    });

    it("should handle read errors gracefully", async () => {
      // When readFileSync throws, loadRecallSession returns null
      // So processFeedback returns "No recall session found" reason
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Read failed");
      });
      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.processFeedback("session-123", {});

      expect(result.success).toBe(false);
      // loadRecallSession catches the error and returns null
      expect(result.reason).toContain("No recall session found");
    });
  });

  describe("getStats", () => {
    it("should return stats successfully", async () => {
      const sessionData = {
        sessionId: "session-123",
        startedAt: "2024-01-01T00:00:00Z",
        totalFacts: 5,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(sessionData));
      mockFs.readdirSync.mockReturnValue([]);

      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.getStats();

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.currentSession).toBeDefined();
    });

    it("should handle missing directory", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new FeedbackService(enabledConfig, projectDir);

      const result = await service.getStats();

      expect(result.success).toBe(true);
      expect(result.currentSession).toBeNull();
    });

    it("should report disabled state correctly", async () => {
      const service = new FeedbackService(disabledConfig, projectDir);

      const result = await service.getStats();

      expect(result.enabled).toBe(false);
    });
  });

  describe("updateConfig", () => {
    it("should update config properties", () => {
      const service = new FeedbackService(enabledConfig, projectDir);

      service.updateConfig({ enabled: false });

      expect(service.isEnabled()).toBe(false);
    });

    it("should preserve unmodified properties", () => {
      const service = new FeedbackService(enabledConfig, projectDir);

      service.updateConfig({ debug: true });

      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.debug).toBe(true);
    });
  });

  describe("getConfig", () => {
    it("should return copy of config", () => {
      const service = new FeedbackService(enabledConfig, projectDir);

      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});

describe("createFeedbackService factory", () => {
  it("should create a FeedbackService instance", () => {
    const service = createFeedbackService({ enabled: true }, "/project");

    expect(service).toBeInstanceOf(FeedbackService);
    expect(service.isEnabled()).toBe(true);
  });
});
