/**
 * Tests for the Mind orchestrator class.
 * @module tests/mind
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Mind } from "../src/mind.js";
import type { MindOptions } from "../src/types.js";

// Create mock functions
const mockHealth = vi.fn();
const mockEnsureBankExists = vi.fn();
const mockGetBank = vi.fn();
const mockCreateBank = vi.fn();
const mockRecall = vi.fn();
const mockRecent = vi.fn();
const mockReflect = vi.fn();
const mockRetain = vi.fn();

// Mock the client module
vi.mock("../src/client.js", () => {
  return {
    HindsightClient: vi.fn().mockImplementation(() => ({
      health: mockHealth,
      ensureBankExists: mockEnsureBankExists,
      getBank: mockGetBank,
      createBank: mockCreateBank,
      recall: mockRecall,
      recent: mockRecent,
      reflect: mockReflect,
      retain: mockRetain,
    })),
  };
});

// Mock the learn module
vi.mock("../src/learn/index.js", () => {
  return {
    learn: vi.fn().mockResolvedValue({
      summary: "Learned 10 facts from 5 files",
      worldFacts: 10,
      opinions: [],
      entities: [],
      filesAnalyzed: 5,
      duration: 1000,
    }),
  };
});

// Mock the agents loader
vi.mock("../src/agents/loader.js", () => {
  return {
    loadCustomAgents: vi.fn().mockResolvedValue([]),
  };
});

describe("Mind", () => {
  const defaultOptions: MindOptions = {
    projectPath: "/test/project",
    bankId: "test-bank",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to unhealthy to avoid initialization issues
    mockHealth.mockResolvedValue({ healthy: false, error: "Test" });
  });

  /**
   * Helper to create a mind instance with error handling.
   * This prevents unhandled error events from failing tests.
   */
  function createMindWithErrorHandler(options: MindOptions = defaultOptions): Mind {
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
        version: "1.0.0",
        banks: 0,
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
        banks: 0,
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
        version: "1.0.0",
        banks: 0,
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
        banks: 0,
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
        banks: 0,
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
        banks: 0,
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      await expect(mind.reflect("test query")).rejects.toThrow("requires Hindsight");
    });
  });

  describe("retain() in degraded mode", () => {
    it("should emit error event in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
        banks: 0,
      });

      const mind = new Mind(defaultOptions);
      // Collect all errors
      const errors: Error[] = [];
      mind.on("error", (err) => errors.push(err));

      await mind.init();

      // Clear errors from init, then test retain
      errors.length = 0;
      await mind.retain("test content");

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes("skipped"))).toBe(true);
    });
  });

  describe("onSessionStart()", () => {
    it("should return empty string in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
        banks: 0,
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const result = await mind.onSessionStart();
      expect(result).toBe("");
    });
  });

  describe("onSessionEnd()", () => {
    it("should return null in degraded mode", async () => {
      mockHealth.mockResolvedValue({
        healthy: false,
        error: "Connection refused",
        banks: 0,
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
        banks: 0,
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const result = await mind.attemptRecovery();
      expect(result).toBe(false);
      expect(mind.isDegraded).toBe(true);
    });
  });

  describe("getAgentTemplates()", () => {
    it("should return built-in templates", async () => {
      mockHealth.mockResolvedValue({ healthy: false, error: "Test", banks: 0 });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const templates = mind.getAgentTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.some((t) => t.name === "code-explorer")).toBe(true);
      expect(templates.some((t) => t.name === "code-architect")).toBe(true);
      expect(templates.some((t) => t.name === "code-reviewer")).toBe(true);
    });
  });

  describe("getAgentTemplate()", () => {
    it("should return template by name", async () => {
      mockHealth.mockResolvedValue({ healthy: false, error: "Test", banks: 0 });

      const mind = createMindWithErrorHandler();
      await mind.init();

      const template = mind.getAgentTemplate("code-explorer");

      expect(template).toBeDefined();
      expect(template?.name).toBe("code-explorer");
    });

    it("should return undefined for unknown template", async () => {
      mockHealth.mockResolvedValue({ healthy: false, error: "Test", banks: 0 });

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
        version: "1.0.0",
        banks: 0,
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
        banks: 0,
      });

      const mind = createMindWithErrorHandler();
      await mind.init();

      await expect(mind.learn()).rejects.toThrow("requires Hindsight");
    });
  });
});
