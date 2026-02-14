/**
 * Tests for the Mind orchestrator class.
 * @module tests/mind
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MindOptions } from "../src/types.js";

// Use vi.hoisted to ensure mock functions are available at hoist time
const {
  mockHealth,
  mockEnsureBankExists,
  mockGetBank,
  mockCreateBank,
  mockRecall,
  mockRecent,
  mockReflect,
  mockRetain,
  mockLearn,
} = vi.hoisted(() => ({
  mockHealth: vi.fn(),
  mockEnsureBankExists: vi.fn(),
  mockGetBank: vi.fn(),
  mockCreateBank: vi.fn(),
  mockRecall: vi.fn(),
  mockRecent: vi.fn(),
  mockReflect: vi.fn(),
  mockRetain: vi.fn(),
  mockLearn: vi.fn(),
}));

// Mock the client module with a class
vi.mock("../src/client.js", () => {
  return {
    HindsightClient: class MockHindsightClient {
      health = mockHealth;
      ensureBankExists = mockEnsureBankExists;
      getBank = mockGetBank;
      createBank = mockCreateBank;
      recall = mockRecall;
      recent = mockRecent;
      reflect = mockReflect;
      retain = mockRetain;
    },
  };
});

// Mock the learn module
vi.mock("../src/learn/index.js", () => {
  return {
    learn: mockLearn,
  };
});

// Mock the agents loader
vi.mock("../src/agents/loader.js", () => {
  return {
    loadCustomAgents: vi.fn().mockResolvedValue([]),
  };
});

import { Mind } from "../src/mind.js";

describe("Mind", () => {
  const defaultOptions: MindOptions = {
    projectPath: "/test/project",
    bankId: "test-bank",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to unhealthy to avoid initialization issues
    mockHealth.mockResolvedValue({ healthy: false, error: "Test" });
    // Default learn mock
    mockLearn.mockResolvedValue({
      summary: "Learned 10 facts from 5 files",
      worldFacts: 10,
      opinions: [],
      entities: [],
      filesAnalyzed: 5,
      duration: 1000,
    });
  });

  /**
   * Helper to create a mind instance with error handling.
   * This prevents unhandled error events from failing tests.
   */
  function createMindWithErrorHandler(
    options: MindOptions = defaultOptions,
  ): Mind {
    const mind = new Mind(options);
    // Add default error handler to prevent unhandled error events
    mind.on("error", () => {
      // Ignore errors - tests can add their own listeners if needed
    });
    return mind;
  }

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const m = new Mind();
      expect(m).toBeInstanceOf(Mind);
    });

    it("should create instance with custom options", () => {
      const m = new Mind({
        projectPath: "/custom/path",
        bankId: "custom-bank",
        host: "custom-host",
        port: 9999,
      });
      expect(m).toBeInstanceOf(Mind);
    });

    it("should start in non-degraded mode", () => {
      const mind = new Mind(defaultOptions);
      expect(mind.isDegraded).toBe(false);
    });
  });

  describe("init()", () => {
    it("should initialize in healthy state when Hindsight is available", async () => {
      mockHealth.mockResolvedValue({
        healthy: true,
        database: "connected",
      });
      mockGetBank.mockResolvedValue({
        bankId: "test-bank",
        disposition: { skepticism: 3, literalism: 3, empathy: 3 },
        createdAt: "2024-01-01",
        memoryCount: 0,
      });

      const mind = new Mind(defaultOptions);
      await mind.init();

      expect(mind.isDegraded).toBe(false);
    });

    it("should enter degraded mode when Hindsight is unavailable", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      const readyListener = vi.fn();
      const degradedListener = vi.fn();
      mind.on("ready", readyListener);
      mind.on("degraded:change", degradedListener);

      await mind.init();

      expect(mind.isDegraded).toBe(true);
      expect(readyListener).toHaveBeenCalled();
      expect(degradedListener).toHaveBeenCalledWith(true);
    });

    it("should emit ready event after initialization", async () => {
      mockHealth.mockResolvedValue({
        healthy: true,
        database: "connected",
      });
      mockGetBank.mockResolvedValue({
        bankId: "test-bank",
        disposition: { skepticism: 3, literalism: 3, empathy: 3 },
        createdAt: "2024-01-01",
        memoryCount: 0,
      });

      const mind = new Mind(defaultOptions);
      const readyListener = vi.fn();
      mind.on("ready", readyListener);

      await mind.init();

      expect(readyListener).toHaveBeenCalled();
    });
  });

  describe("isDegraded", () => {
    it("should return true when in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      expect(mind.isDegraded).toBe(true);
    });
  });

  describe("recall() in degraded mode", () => {
    it("should return empty array in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const result = await mind.recall("test query");
      expect(result).toEqual([]);
    });
  });

  describe("reflect() in degraded mode", () => {
    it("should throw error in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      await expect(mind.reflect("test query")).rejects.toThrow(
        "requires Hindsight",
      );
    });
  });

  describe("retain() in degraded mode", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "mind-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("should store to offline in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = new Mind({ projectPath: tempDir, bankId: "test-bank" });
      // Suppress errors from init
      mind.on("error", () => {});
      // Collect all offline:stored events
      const offlineStored: Array<{ content: string; factType: string }> = [];
      mind.on("offline:stored", (info) => offlineStored.push(info));

      await mind.init();

      await mind.retain("test content");

      expect(offlineStored.length).toBe(1);
      expect(offlineStored[0].content).toBe("test content");
      expect(offlineStored[0].factType).toBe("experience");
    });
  });

  describe("onSessionStart()", () => {
    it("should return empty context in degraded mode without custom agents", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const result = await mind.onSessionStart();
      // No custom agents loaded = no orchestration instructions injected
      // (built-in agents alone don't trigger orchestration — Claude Code handles those natively)
      expect(result).toBe("");
    });
  });

  describe("onSessionEnd()", () => {
    it("should return null in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();
      await mind.onSessionStart(); // Start session first

      const result = await mind.onSessionEnd("test transcript");
      expect(result).toBeNull();
    });
  });

  describe("attemptRecovery()", () => {
    it("should return false when still unhealthy", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const result = await mind.attemptRecovery();
      expect(result).toBe(false);
      expect(mind.isDegraded).toBe(true);
    });
  });

  describe("getAgentTemplates()", () => {
    it("should return empty array when no custom agents exist", async () => {
      mockHealth.mockResolvedValue({ healthy: false, error: "Test" });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const templates = mind.getAgentTemplates();

      // No custom agents in test env = empty array
      expect(templates).toEqual([]);
    });
  });

  describe("getAgentTemplate()", () => {
    it("should return undefined for unknown template", async () => {
      mockHealth.mockResolvedValue({ healthy: false, error: "Test" });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const template = mind.getAgentTemplate("unknown-agent");

      expect(template).toBeUndefined();
    });
  });

  describe("learn()", () => {
    it("should emit learn events", async () => {
      mockHealth.mockResolvedValue({
        healthy: true,
        database: "connected",
      });
      mockGetBank.mockResolvedValue({
        bankId: "test-bank",
        disposition: { skepticism: 3, literalism: 3, empathy: 3 },
        createdAt: "2024-01-01",
        memoryCount: 0,
      });

      const mind = new Mind(defaultOptions);
      await mind.init();

      const startListener = vi.fn();
      const completeListener = vi.fn();
      mind.on("learn:start", startListener);
      mind.on("learn:complete", completeListener);

      await mind.learn({ depth: "quick" });

      expect(startListener).toHaveBeenCalledWith({ depth: "quick" });
      expect(completeListener).toHaveBeenCalled();
    });

    it("should throw error when in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      await expect(mind.learn()).rejects.toThrow("requires Hindsight");
    });
  });
});
