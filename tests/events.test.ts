/**
 * Tests for the TypedEventEmitter class.
 * @module tests/events
 */

import { describe, it, expect, vi } from "vitest";
import { TypedEventEmitter } from "../src/events.js";

describe("TypedEventEmitter", () => {
  describe("on()", () => {
    it("should register event listeners", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("ready", listener);
      emitter.emit("ready");

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should pass correct arguments to listeners", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();
      const testError = new Error("test error");

      emitter.on("error", listener);
      emitter.emit("error", testError);

      expect(listener).toHaveBeenCalledWith(testError);
    });

    it("should allow multiple listeners for the same event", () => {
      const emitter = new TypedEventEmitter();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on("ready", listener1);
      emitter.on("ready", listener2);
      emitter.emit("ready");

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("off()", () => {
    it("should remove event listeners", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("ready", listener);
      emitter.off("ready", listener);
      emitter.emit("ready");

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("once()", () => {
    it("should only fire listener once", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.once("ready", listener);
      emitter.emit("ready");
      emitter.emit("ready");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("emit()", () => {
    it("should return true when listeners exist", () => {
      const emitter = new TypedEventEmitter();
      emitter.on("ready", () => {});

      expect(emitter.emit("ready")).toBe(true);
    });

    it("should return false when no listeners exist", () => {
      const emitter = new TypedEventEmitter();

      expect(emitter.emit("ready")).toBe(false);
    });

    it("should work with memory:recalled event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();
      const memories = [
        {
          id: "1",
          content: "test",
          factType: "world" as const,
          when: "2024-01-01",
          createdAt: "2024-01-01",
          relevance: 1,
        },
      ];

      emitter.on("memory:recalled", listener);
      emitter.emit("memory:recalled", memories);

      expect(listener).toHaveBeenCalledWith(memories);
    });

    it("should work with memory:retained event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("memory:retained", listener);
      emitter.emit("memory:retained", "test content");

      expect(listener).toHaveBeenCalledWith("test content");
    });

    it("should work with opinion:formed event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();
      const opinion = {
        id: "1",
        content: "This is a good pattern",
        confidence: 0.85,
        supportingMemories: [],
        formedAt: "2024-01-01",
      };

      emitter.on("opinion:formed", listener);
      emitter.emit("opinion:formed", opinion);

      expect(listener).toHaveBeenCalledWith(opinion);
    });

    it("should work with degraded:change event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("degraded:change", listener);
      emitter.emit("degraded:change", true);

      expect(listener).toHaveBeenCalledWith(true);
    });

    it("should work with learn:start event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("learn:start", listener);
      emitter.emit("learn:start", { depth: "standard" });

      expect(listener).toHaveBeenCalledWith({ depth: "standard" });
    });

    it("should work with learn:complete event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("learn:complete", listener);
      emitter.emit("learn:complete", {
        summary: "Learned 10 facts",
        worldFacts: 10,
      });

      expect(listener).toHaveBeenCalledWith({
        summary: "Learned 10 facts",
        worldFacts: 10,
      });
    });

    it("should work with agent:context-prepared event", () => {
      const emitter = new TypedEventEmitter();
      const listener = vi.fn();

      emitter.on("agent:context-prepared", listener);
      emitter.emit("agent:context-prepared", {
        agent: "explorer",
        task: "analyze codebase",
      });

      expect(listener).toHaveBeenCalledWith({
        agent: "explorer",
        task: "analyze codebase",
      });
    });
  });
});
