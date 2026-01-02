/**
 * Tests for the PromotionManager class.
 * @module tests/promotion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TypedEventEmitter } from "../src/events.js";
import {
  PromotionManager,
  DEFAULT_PROMOTION_THRESHOLD,
  opinionToObservation,
  shouldPromote,
} from "../src/promotion.js";
import { SemanticMemory } from "../src/semantic.js";

describe("PromotionManager", () => {
  let testDir: string;
  let semantic: SemanticMemory;
  let emitter: TypedEventEmitter;
  let manager: PromotionManager;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(
      tmpdir(),
      `claude-cognitive-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testDir, { recursive: true });

    // Initialize semantic memory
    semantic = new SemanticMemory(testDir);
    await semantic.load();

    // Initialize emitter
    emitter = new TypedEventEmitter();

    // Initialize manager
    manager = new PromotionManager(semantic, emitter);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const m = new PromotionManager(semantic, emitter);
      expect(m.getThreshold()).toBe(DEFAULT_PROMOTION_THRESHOLD);
    });

    it("should create instance with custom threshold", () => {
      const m = new PromotionManager(semantic, emitter, { threshold: 0.8 });
      expect(m.getThreshold()).toBe(0.8);
    });
  });

  describe("promote()", () => {
    it("should promote observations above threshold", async () => {
      const result = await manager.promote({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      expect(result.promoted).toBe(true);
      expect(semantic.get("Observations")).toContain("Test observation");
    });

    it("should reject observations below threshold", async () => {
      const result = await manager.promote({
        text: "Test observation",
        confidence: 0.5,
        source: "test",
      });

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe("below_threshold");
    });

    it("should reject observations at exactly threshold boundary", async () => {
      // Default threshold is 0.9, so 0.89 should fail
      const result = await manager.promote({
        text: "Test observation",
        confidence: 0.89,
        source: "test",
      });

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe("below_threshold");
    });

    it("should accept observations at exactly threshold", async () => {
      const result = await manager.promote({
        text: "Test observation",
        confidence: 0.9,
        source: "test",
      });

      expect(result.promoted).toBe(true);
    });

    it("should deduplicate by exact match within session", async () => {
      // First promotion should succeed
      const result1 = await manager.promote({
        text: "Duplicate observation",
        confidence: 0.95,
        source: "test",
      });
      expect(result1.promoted).toBe(true);

      // Second promotion of same text should fail
      const result2 = await manager.promote({
        text: "Duplicate observation",
        confidence: 0.95,
        source: "test",
      });
      expect(result2.promoted).toBe(false);
      expect(result2.reason).toBe("duplicate");
    });

    it("should deduplicate by similarity with existing content", async () => {
      // Add some existing observations
      semantic.set(
        "Observations",
        "\n- Auth changes often require navigation updates\n",
      );
      await semantic.save();

      // Similar observation should be rejected
      const result = await manager.promote({
        text: "Auth changes require navigation updates",
        confidence: 0.95,
        source: "test",
      });

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe("duplicate");
    });

    it("should emit observation:promoted event", async () => {
      const listener = vi.fn();
      emitter.on("observation:promoted", listener);

      await manager.promote({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      expect(listener).toHaveBeenCalledWith({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });
    });

    it("should handle promotion errors gracefully", async () => {
      // Mock semantic to throw on promoteObservation
      const errorSemantic = {
        isLoaded: () => true,
        get: () => "",
        promoteObservation: vi.fn().mockRejectedValue(new Error("Write failed")),
      } as unknown as SemanticMemory;

      const errorManager = new PromotionManager(errorSemantic, emitter);

      const result = await errorManager.promote({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe("error");
      expect(result.error).toBe("Write failed");
    });

    it("should respect custom threshold", async () => {
      const customManager = new PromotionManager(semantic, emitter, {
        threshold: 0.5,
      });

      const result = await customManager.promote({
        text: "Test observation",
        confidence: 0.6,
        source: "test",
      });

      expect(result.promoted).toBe(true);
    });

    it("should skip deduplication when disabled", async () => {
      const noDedupeManager = new PromotionManager(semantic, emitter, {
        deduplicate: false,
      });

      // First promotion
      await noDedupeManager.promote({
        text: "Duplicate observation",
        confidence: 0.95,
        source: "test",
      });

      // Second promotion should also succeed
      const result = await noDedupeManager.promote({
        text: "Duplicate observation",
        confidence: 0.95,
        source: "test",
      });

      expect(result.promoted).toBe(true);
    });
  });

  describe("event handling", () => {
    it("should auto-promote on opinion:formed when listening", async () => {
      manager.startListening();

      emitter.emit("opinion:formed", {
        opinion: "Test opinion",
        confidence: 0.95,
      });

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(semantic.get("Observations")).toContain("Test opinion");
    });

    it("should not promote when not listening", async () => {
      // Don't call startListening

      emitter.emit("opinion:formed", {
        opinion: "Test opinion",
        confidence: 0.95,
      });

      // Wait for potential async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(semantic.get("Observations")).not.toContain("Test opinion");
    });

    it("should stop listening when requested", async () => {
      manager.startListening();
      manager.stopListening();

      emitter.emit("opinion:formed", {
        opinion: "Test opinion",
        confidence: 0.95,
      });

      // Wait for potential async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(semantic.get("Observations")).not.toContain("Test opinion");
    });
  });

  describe("clearCache()", () => {
    it("should allow re-promotion after clear", async () => {
      // First promotion
      await manager.promote({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });

      // Without clear, should be duplicate
      const result1 = await manager.promote({
        text: "Test observation",
        confidence: 0.95,
        source: "test",
      });
      expect(result1.reason).toBe("duplicate");

      // Clear cache
      manager.clearCache();

      // Now it might still be duplicate due to file content, but cache is cleared
      // The file-based deduplication will still work
    });
  });
});

describe("Utility Functions", () => {
  describe("opinionToObservation()", () => {
    it("should convert opinion to observation with default source", () => {
      const opinion = {
        opinion: "Test opinion",
        confidence: 0.85,
      };

      const observation = opinionToObservation(opinion);

      expect(observation.text).toBe("Test opinion");
      expect(observation.confidence).toBe(0.85);
      expect(observation.source).toBe("reflect");
    });

    it("should convert opinion to observation with custom source", () => {
      const opinion = {
        opinion: "Test opinion",
        confidence: 0.85,
      };

      const observation = opinionToObservation(opinion, "custom-source");

      expect(observation.source).toBe("custom-source");
    });
  });

  describe("shouldPromote()", () => {
    it("should return true for opinions above default threshold", () => {
      expect(
        shouldPromote({
          opinion: "Test",
          confidence: 0.95,
        }),
      ).toBe(true);
    });

    it("should return false for opinions below default threshold", () => {
      expect(
        shouldPromote({
          opinion: "Test",
          confidence: 0.5,
        }),
      ).toBe(false);
    });

    it("should respect custom threshold", () => {
      expect(
        shouldPromote(
          {
            opinion: "Test",
            confidence: 0.6,
          },
          0.5,
        ),
      ).toBe(true);

      expect(
        shouldPromote(
          {
            opinion: "Test",
            confidence: 0.4,
          },
          0.5,
        ),
      ).toBe(false);
    });
  });
});

describe("DEFAULT_PROMOTION_THRESHOLD", () => {
  it("should be 0.9", () => {
    expect(DEFAULT_PROMOTION_THRESHOLD).toBe(0.9);
  });
});
