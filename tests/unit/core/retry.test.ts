/**
 * Tests for the retry logic module.
 * @module tests/unit/core/retry
 *
 * Note: Tests with fake timers and rejected promises need special handling
 * to avoid unhandled rejection warnings. We use .catch() immediately when
 * calling functions that will reject.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, createRetryable } from "../../../src/retry.js";
import { HindsightError } from "../../../src/errors.js";

describe("withRetry()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  describe("successful execution", () => {
    it("should return result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should return result after retry success", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          new HindsightError("Timeout", "CONNECTION_TIMEOUT", {
            isRetryable: true,
          }),
        )
        .mockResolvedValue("success");

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry behavior", () => {
    it("should retry on retryable HindsightError", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          new HindsightError("Server error", "SERVER_ERROR", {
            isRetryable: true,
          }),
        )
        .mockResolvedValue("success");

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should retry on TimeoutError", async () => {
      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";

      const fn = vi
        .fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue("success");

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retryable HindsightError", async () => {
      const error = new HindsightError("Validation error", "VALIDATION_ERROR", {
        isRetryable: false,
      });
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toThrow("Validation error");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should not retry on regular Error by default", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Regular error"));

      await expect(withRetry(fn)).rejects.toThrow("Regular error");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should exhaust all attempts on persistent failure", async () => {
      const error = new HindsightError("Timeout", "CONNECTION_TIMEOUT", {
        isRetryable: true,
      });
      const fn = vi.fn().mockRejectedValue(error);

      // Catch immediately to prevent unhandled rejection warning
      let caughtError: Error | undefined;
      const resultPromise = withRetry(fn, { maxAttempts: 3 }).catch((e) => {
        caughtError = e;
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(caughtError?.message).toBe("Timeout");
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("custom shouldRetry", () => {
    it("should use custom shouldRetry function", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Custom retryable"))
        .mockResolvedValue("success");

      const shouldRetry = vi.fn().mockReturnValue(true);

      const resultPromise = withRetry(fn, { shouldRetry });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(shouldRetry).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it("should not retry when shouldRetry returns false", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Not retryable"));
      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(withRetry(fn, { shouldRetry })).rejects.toThrow(
        "Not retryable",
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("onRetry callback", () => {
    it("should invoke onRetry before each retry", async () => {
      const error = new HindsightError("Error", "SERVER_ERROR", {
        isRetryable: true,
      });
      const fn = vi.fn().mockRejectedValue(error);
      const onRetry = vi.fn();

      // Catch immediately to prevent unhandled rejection warning
      const resultPromise = withRetry(fn, { maxAttempts: 3, onRetry }).catch(
        () => {},
      );
      await vi.runAllTimersAsync();
      await resultPromise;

      // onRetry is called before attempts 2 and 3 (not before 1, not after last)
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, error, 1, expect.any(Number));
      expect(onRetry).toHaveBeenNthCalledWith(2, error, 2, expect.any(Number));
    });

    it("should not invoke onRetry on success", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const onRetry = vi.fn();

      const resultPromise = withRetry(fn, { onRetry });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe("exponential backoff", () => {
    it("should increase delay exponentially", async () => {
      const error = new HindsightError("Error", "SERVER_ERROR", {
        isRetryable: true,
      });
      const fn = vi.fn().mockRejectedValue(error);
      const delays: number[] = [];
      const onRetry = vi.fn((_err, _attempt, delay) => {
        delays.push(delay);
      });

      // Catch immediately to prevent unhandled rejection warning
      const resultPromise = withRetry(fn, {
        maxAttempts: 4,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        jitter: false,
        onRetry,
      }).catch(() => {});
      await vi.runAllTimersAsync();
      await resultPromise;

      // Delays: 100, 200, 400
      expect(delays).toEqual([100, 200, 400]);
    });

    it("should cap delay at maxDelayMs", async () => {
      const error = new HindsightError("Error", "SERVER_ERROR", {
        isRetryable: true,
      });
      const fn = vi.fn().mockRejectedValue(error);
      const delays: number[] = [];
      const onRetry = vi.fn((_err, _attempt, delay) => {
        delays.push(delay);
      });

      // Catch immediately to prevent unhandled rejection warning
      const resultPromise = withRetry(fn, {
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        jitter: false,
        onRetry,
      }).catch(() => {});
      await vi.runAllTimersAsync();
      await resultPromise;

      // Delays: 1000, 2000 (capped), 2000 (capped), 2000 (capped)
      expect(delays).toEqual([1000, 2000, 2000, 2000]);
    });

    it("should add jitter when enabled", async () => {
      const error = new HindsightError("Error", "SERVER_ERROR", {
        isRetryable: true,
      });
      const fn = vi.fn().mockRejectedValue(error);
      const delays: number[] = [];
      const onRetry = vi.fn((_err, _attempt, delay) => {
        delays.push(delay);
      });

      // Run multiple times to check jitter adds randomness
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      // Catch immediately to prevent unhandled rejection warning
      const resultPromise = withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        jitter: true,
        onRetry,
      }).catch(() => {});
      await vi.runAllTimersAsync();
      await resultPromise;

      // With jitter at 50% (random = 0.5), delay = base + base * 0.5 * 0.5
      // First: 100 + 100 * 0.5 * 0.5 = 125
      // Second: 200 + 200 * 0.5 * 0.5 = 250
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThanOrEqual(150);
      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThanOrEqual(300);
    });
  });

  describe("error handling", () => {
    it("should convert non-Error to Error", async () => {
      const fn = vi.fn().mockRejectedValue("string error");

      await expect(withRetry(fn)).rejects.toThrow("string error");
    });
  });
});

describe("createRetryable()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it("should create a wrapped function that retries", async () => {
    const original = vi
      .fn()
      .mockRejectedValueOnce(
        new HindsightError("Error", "SERVER_ERROR", { isRetryable: true }),
      )
      .mockResolvedValue("success");

    const wrapped = createRetryable(original);

    const resultPromise = wrapped();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe("success");
    expect(original).toHaveBeenCalledTimes(2);
  });

  it("should pass arguments to wrapped function", async () => {
    const original = vi.fn().mockResolvedValue("result");
    const wrapped = createRetryable(original);

    const resultPromise = wrapped("arg1", 42, { key: "value" });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(original).toHaveBeenCalledWith("arg1", 42, { key: "value" });
  });

  it("should use provided retry options", async () => {
    const error = new HindsightError("Error", "SERVER_ERROR", {
      isRetryable: true,
    });
    const original = vi.fn().mockRejectedValue(error);

    const wrapped = createRetryable(original, { maxAttempts: 5 });

    // Catch immediately to prevent unhandled rejection warning
    const resultPromise = wrapped().catch(() => {});
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(original).toHaveBeenCalledTimes(5);
  });
});
