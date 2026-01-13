/**
 * Tests for the Semaphore class.
 * @module tests/unit/gemini/semaphore
 *
 * Tests cover:
 * - Constructor validation
 * - Basic acquire/release cycle
 * - Concurrent acquisitions up to max
 * - Queuing when all slots are taken
 * - FIFO ordering verification
 * - Error handling (release in finally block)
 * - Stress test with many concurrent requests
 * - Internal state tracking (availableSlots, queueLength)
 */

import { describe, it, expect } from "vitest";
import { Semaphore } from "../../../src/gemini/semaphore.js";

describe("Semaphore", () => {
  describe("constructor", () => {
    it("should create semaphore with valid maxConcurrent", () => {
      const semaphore = new Semaphore(3);

      expect(semaphore.availableSlots).toBe(3);
      expect(semaphore.queueLength).toBe(0);
    });

    it("should accept maxConcurrent of 1", () => {
      const semaphore = new Semaphore(1);

      expect(semaphore.availableSlots).toBe(1);
    });

    it("should throw error if maxConcurrent is 0", () => {
      expect(() => new Semaphore(0)).toThrow(
        "Semaphore maxConcurrent must be >= 1, got: 0",
      );
    });

    it("should throw error if maxConcurrent is negative", () => {
      expect(() => new Semaphore(-1)).toThrow(
        "Semaphore maxConcurrent must be >= 1, got: -1",
      );
    });

    it("should throw error if maxConcurrent is negative decimal", () => {
      expect(() => new Semaphore(-0.5)).toThrow(
        "Semaphore maxConcurrent must be >= 1, got: -0.5",
      );
    });
  });

  describe("basic acquire/release", () => {
    it("should acquire and release a single slot", async () => {
      const semaphore = new Semaphore(3);

      expect(semaphore.availableSlots).toBe(3);

      const release = await semaphore.acquire();

      expect(semaphore.availableSlots).toBe(2);

      release();

      expect(semaphore.availableSlots).toBe(3);
    });

    it("should return release function immediately when slot available", async () => {
      const semaphore = new Semaphore(1);

      const release = await semaphore.acquire();

      expect(typeof release).toBe("function");
      expect(semaphore.availableSlots).toBe(0);
    });

    it("should handle multiple acquire/release cycles", async () => {
      const semaphore = new Semaphore(2);

      const release1 = await semaphore.acquire();
      expect(semaphore.availableSlots).toBe(1);

      const release2 = await semaphore.acquire();
      expect(semaphore.availableSlots).toBe(0);

      release1();
      expect(semaphore.availableSlots).toBe(1);

      release2();
      expect(semaphore.availableSlots).toBe(2);
    });
  });

  describe("concurrent acquisitions", () => {
    it("should allow acquisitions up to max concurrent", async () => {
      const semaphore = new Semaphore(3);

      const release1 = await semaphore.acquire();
      const release2 = await semaphore.acquire();
      const release3 = await semaphore.acquire();

      expect(semaphore.availableSlots).toBe(0);
      expect(semaphore.queueLength).toBe(0);

      release1();
      release2();
      release3();

      expect(semaphore.availableSlots).toBe(3);
    });

    it("should queue acquisition when all slots taken", async () => {
      const semaphore = new Semaphore(1);

      const release1 = await semaphore.acquire();
      expect(semaphore.availableSlots).toBe(0);

      // This acquire should queue, not resolve immediately
      const acquire2Promise = semaphore.acquire();
      expect(semaphore.queueLength).toBe(1);

      // Promise should not resolve until release
      let release2: (() => void) | undefined;
      acquire2Promise.then((r) => {
        release2 = r;
      });

      // Give microtasks a chance to run
      await Promise.resolve();
      expect(release2).toBeUndefined();

      // Release first slot
      release1();

      // Wait for second acquire to resolve
      const finalRelease2 = await acquire2Promise;
      expect(semaphore.availableSlots).toBe(0);
      expect(semaphore.queueLength).toBe(0);

      finalRelease2();
      expect(semaphore.availableSlots).toBe(1);
    });

    it("should handle multiple queued acquisitions", async () => {
      const semaphore = new Semaphore(1);

      const release1 = await semaphore.acquire();

      const acquire2Promise = semaphore.acquire();
      const acquire3Promise = semaphore.acquire();
      const acquire4Promise = semaphore.acquire();

      expect(semaphore.queueLength).toBe(3);
      expect(semaphore.availableSlots).toBe(0);

      // Release first slot - should immediately go to acquire2
      release1();
      const release2 = await acquire2Promise;

      expect(semaphore.queueLength).toBe(2);
      expect(semaphore.availableSlots).toBe(0);

      release2();
      const release3 = await acquire3Promise;

      expect(semaphore.queueLength).toBe(1);
      expect(semaphore.availableSlots).toBe(0);

      release3();
      const release4 = await acquire4Promise;

      expect(semaphore.queueLength).toBe(0);
      expect(semaphore.availableSlots).toBe(0);

      release4();
      expect(semaphore.availableSlots).toBe(1);
    });
  });

  describe("FIFO ordering", () => {
    it("should grant slots in FIFO order", async () => {
      const semaphore = new Semaphore(1);
      const executionOrder: number[] = [];

      // Acquire the only slot
      const release1 = await semaphore.acquire();

      // Queue multiple requests
      const task2 = semaphore.acquire().then((release) => {
        executionOrder.push(2);
        return release;
      });

      const task3 = semaphore.acquire().then((release) => {
        executionOrder.push(3);
        return release;
      });

      const task4 = semaphore.acquire().then((release) => {
        executionOrder.push(4);
        return release;
      });

      expect(semaphore.queueLength).toBe(3);

      // Release in order and verify execution order
      release1();
      const release2 = await task2;
      expect(executionOrder).toEqual([2]);

      release2();
      const release3 = await task3;
      expect(executionOrder).toEqual([2, 3]);

      release3();
      const release4 = await task4;
      expect(executionOrder).toEqual([2, 3, 4]);

      release4();
    });

    it("should maintain FIFO order with mixed acquisition timing", async () => {
      const semaphore = new Semaphore(2);
      const executionOrder: number[] = [];

      // Take both slots
      const release1 = await semaphore.acquire();
      const release2 = await semaphore.acquire();

      // Queue three more
      const task3 = semaphore.acquire().then((release) => {
        executionOrder.push(3);
        return release;
      });

      const task4 = semaphore.acquire().then((release) => {
        executionOrder.push(4);
        return release;
      });

      const task5 = semaphore.acquire().then((release) => {
        executionOrder.push(5);
        return release;
      });

      expect(semaphore.queueLength).toBe(3);

      // Release both slots - should wake tasks 3 and 4
      release1();
      release2();

      const release3 = await task3;
      const release4 = await task4;

      expect(executionOrder).toEqual([3, 4]);
      expect(semaphore.queueLength).toBe(1);

      // Release one - should wake task 5
      release3();
      const release5 = await task5;

      expect(executionOrder).toEqual([3, 4, 5]);

      release4();
      release5();
    });
  });

  describe("error handling", () => {
    it("should properly release slot when operation throws error", async () => {
      const semaphore = new Semaphore(1);

      async function operationThatThrows() {
        const release = await semaphore.acquire();
        try {
          throw new Error("Operation failed");
        } finally {
          release();
        }
      }

      expect(semaphore.availableSlots).toBe(1);

      await expect(operationThatThrows()).rejects.toThrow("Operation failed");

      expect(semaphore.availableSlots).toBe(1);
    });

    it("should not corrupt state if release is not called", async () => {
      const semaphore = new Semaphore(2);

      const release1 = await semaphore.acquire();
      await semaphore.acquire();
      // Intentionally not storing release2

      expect(semaphore.availableSlots).toBe(0);

      release1();

      expect(semaphore.availableSlots).toBe(1);
    });

    it("should handle errors in queued operations", async () => {
      const semaphore = new Semaphore(1);

      const release1 = await semaphore.acquire();

      async function queuedOperation() {
        const release = await semaphore.acquire();
        try {
          throw new Error("Queued operation failed");
        } finally {
          release();
        }
      }

      const promise = queuedOperation();

      // Release first slot - should unblock the queued operation
      release1();

      await expect(promise).rejects.toThrow("Queued operation failed");

      // Semaphore should still be functional
      expect(semaphore.availableSlots).toBe(1);
      expect(semaphore.queueLength).toBe(0);
    });

    it("should prevent double release corruption", async () => {
      const semaphore = new Semaphore(1);

      const release = await semaphore.acquire();
      expect(semaphore.availableSlots).toBe(0);

      release();
      expect(semaphore.availableSlots).toBe(1);

      // Calling release again should throw
      expect(() => release()).toThrow(
        "Semaphore corrupted: available (2) > max (1)",
      );
    });
  });

  describe("state tracking", () => {
    it("should track availableSlots correctly", async () => {
      const semaphore = new Semaphore(5);

      expect(semaphore.availableSlots).toBe(5);

      const release1 = await semaphore.acquire();
      expect(semaphore.availableSlots).toBe(4);

      const release2 = await semaphore.acquire();
      expect(semaphore.availableSlots).toBe(3);

      release1();
      expect(semaphore.availableSlots).toBe(4);

      release2();
      expect(semaphore.availableSlots).toBe(5);
    });

    it("should track queueLength correctly", async () => {
      const semaphore = new Semaphore(1);

      expect(semaphore.queueLength).toBe(0);

      const release1 = await semaphore.acquire();
      expect(semaphore.queueLength).toBe(0);

      const acquire2 = semaphore.acquire();
      expect(semaphore.queueLength).toBe(1);

      const acquire3 = semaphore.acquire();
      expect(semaphore.queueLength).toBe(2);

      release1();
      const release2 = await acquire2;
      expect(semaphore.queueLength).toBe(1);

      release2();
      const release3 = await acquire3;
      expect(semaphore.queueLength).toBe(0);

      release3();
    });

    it("should maintain correct state with mixed operations", async () => {
      const semaphore = new Semaphore(3);

      const release1 = await semaphore.acquire();
      const release2 = await semaphore.acquire();
      const release3 = await semaphore.acquire();

      expect(semaphore.availableSlots).toBe(0);
      expect(semaphore.queueLength).toBe(0);

      const acquire4 = semaphore.acquire();
      const acquire5 = semaphore.acquire();

      expect(semaphore.availableSlots).toBe(0);
      expect(semaphore.queueLength).toBe(2);

      release1();
      const release4 = await acquire4;

      expect(semaphore.availableSlots).toBe(0);
      expect(semaphore.queueLength).toBe(1);

      release2();
      const release5 = await acquire5;

      expect(semaphore.availableSlots).toBe(0);
      expect(semaphore.queueLength).toBe(0);

      release3();

      expect(semaphore.availableSlots).toBe(1);
      expect(semaphore.queueLength).toBe(0);

      release4();
      release5();
      expect(semaphore.availableSlots).toBe(3);
    });
  });

  describe("stress test", () => {
    it("should handle many concurrent requests correctly", async () => {
      const semaphore = new Semaphore(5);
      const numTasks = 100;
      const executionOrder: number[] = [];
      let concurrentCount = 0;
      let maxConcurrent = 0;

      async function task(id: number) {
        const release = await semaphore.acquire();
        try {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          executionOrder.push(id);

          // Simulate some async work
          await new Promise((resolve) => setTimeout(resolve, 1));
        } finally {
          concurrentCount--;
          release();
        }
      }

      // Launch all tasks
      const tasks = Array.from({ length: numTasks }, (_, i) => task(i));

      // Wait for all to complete
      await Promise.all(tasks);

      // Verify all tasks executed
      expect(executionOrder.length).toBe(numTasks);
      expect(new Set(executionOrder).size).toBe(numTasks);

      // Verify max concurrent never exceeded limit
      expect(maxConcurrent).toBeLessThanOrEqual(5);

      // Verify semaphore returned to initial state
      expect(semaphore.availableSlots).toBe(5);
      expect(semaphore.queueLength).toBe(0);
    });

    it("should handle rapid acquire/release cycles", async () => {
      const semaphore = new Semaphore(2);
      const numIterations = 50;

      for (let i = 0; i < numIterations; i++) {
        const release1 = await semaphore.acquire();
        const release2 = await semaphore.acquire();

        expect(semaphore.availableSlots).toBe(0);

        release1();
        release2();

        expect(semaphore.availableSlots).toBe(2);
      }
    });

    it("should handle stress test with errors", async () => {
      const semaphore = new Semaphore(3);
      const numTasks = 50;
      let successCount = 0;
      let errorCount = 0;

      async function taskWithRandomError(id: number) {
        const release = await semaphore.acquire();
        try {
          // 30% chance of error
          if (id % 10 < 3) {
            throw new Error(`Task ${id} failed`);
          }
          successCount++;
        } catch (error) {
          errorCount++;
          throw error;
        } finally {
          release();
        }
      }

      // Launch all tasks
      const tasks = Array.from({ length: numTasks }, (_, i) =>
        taskWithRandomError(i).catch(() => {}),
      );

      await Promise.all(tasks);

      // Verify counts
      expect(successCount + errorCount).toBe(numTasks);

      // Verify semaphore returned to initial state
      expect(semaphore.availableSlots).toBe(3);
      expect(semaphore.queueLength).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should work correctly with maxConcurrent of 1", async () => {
      const semaphore = new Semaphore(1);
      const executionOrder: number[] = [];

      async function serialTask(id: number) {
        const release = await semaphore.acquire();
        try {
          executionOrder.push(id);
          await new Promise((resolve) => setTimeout(resolve, 1));
        } finally {
          release();
        }
      }

      await Promise.all([
        serialTask(1),
        serialTask(2),
        serialTask(3),
        serialTask(4),
      ]);

      // All tasks should execute (order doesn't matter, just that they all run)
      expect(executionOrder.length).toBe(4);
      expect(new Set(executionOrder).size).toBe(4);
      expect(semaphore.availableSlots).toBe(1);
    });

    it("should work correctly with large maxConcurrent", async () => {
      const semaphore = new Semaphore(1000);

      const releases = await Promise.all(
        Array.from({ length: 100 }, () => semaphore.acquire()),
      );

      expect(semaphore.availableSlots).toBe(900);
      expect(semaphore.queueLength).toBe(0);

      releases.forEach((release) => release());

      expect(semaphore.availableSlots).toBe(1000);
    });

    it("should handle immediate release after acquire", async () => {
      const semaphore = new Semaphore(1);

      for (let i = 0; i < 10; i++) {
        const release = await semaphore.acquire();
        release();
      }

      expect(semaphore.availableSlots).toBe(1);
      expect(semaphore.queueLength).toBe(0);
    });

    it("should handle acquire with no await (fire and forget)", async () => {
      const semaphore = new Semaphore(2);

      // Acquire without awaiting immediately
      const promise1 = semaphore.acquire();
      const promise2 = semaphore.acquire();

      expect(semaphore.availableSlots).toBe(0);

      const release1 = await promise1;
      const release2 = await promise2;

      release1();
      release2();

      expect(semaphore.availableSlots).toBe(2);
    });
  });

  describe("realistic usage patterns", () => {
    it("should limit concurrent API calls", async () => {
      const semaphore = new Semaphore(3);
      const apiCallCount: number[] = [];
      let currentCalls = 0;

      async function makeApiCall(_id: number) {
        const release = await semaphore.acquire();
        try {
          currentCalls++;
          apiCallCount.push(currentCalls);

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 5));

          currentCalls--;
        } finally {
          release();
        }
      }

      await Promise.all(Array.from({ length: 20 }, (_, i) => makeApiCall(i)));

      // Verify no more than 3 concurrent calls
      expect(Math.max(...apiCallCount)).toBeLessThanOrEqual(3);
      expect(semaphore.availableSlots).toBe(3);
    });

    it("should support nested semaphore usage", async () => {
      const outerSemaphore = new Semaphore(2);
      const innerSemaphore = new Semaphore(1);

      async function nestedOperation() {
        const outerRelease = await outerSemaphore.acquire();
        try {
          const innerRelease = await innerSemaphore.acquire();
          try {
            // Do work
            await new Promise((resolve) => setTimeout(resolve, 1));
          } finally {
            innerRelease();
          }
        } finally {
          outerRelease();
        }
      }

      await Promise.all([
        nestedOperation(),
        nestedOperation(),
        nestedOperation(),
      ]);

      expect(outerSemaphore.availableSlots).toBe(2);
      expect(innerSemaphore.availableSlots).toBe(1);
    });
  });
});
