/**
 * Tests for GeminiExecutor class.
 * @module tests/unit/gemini/executor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";
import { GeminiExecutor } from "../../../src/gemini/executor.js";
import { GeminiError, GeminiErrorCode } from "../../../src/gemini/errors.js";

// Mock node:child_process
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Mock node:fs (createReadStream)
const mockCreateReadStream = vi.fn();
vi.mock("node:fs", () => ({
  createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
}));

// Mock node:fs/promises
const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

/**
 * Create a mock readable stream for createReadStream.
 */
function createMockReadStream() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    pipe: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
    }),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach((handler) => handler(...args));
    },
  };
}

/**
 * Create a mock ChildProcess with event emitter functionality.
 */
function createMockChildProcess(): ChildProcess {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const mockProc = {
    stdin: {
      on: vi.fn(),
    },
    stdout: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const list = listeners.get(`stdout:${event}`) || [];
        list.push(handler);
        listeners.set(`stdout:${event}`, list);
      }),
    },
    stderr: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const list = listeners.get(`stderr:${event}`) || [];
        list.push(handler);
        listeners.set(`stderr:${event}`, list);
      }),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
    }),
    kill: vi.fn(),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach((handler) => handler(...args));
    },
  };

  return mockProc as unknown as ChildProcess;
}

describe("GeminiExecutor", () => {
  let executor: GeminiExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    executor = new GeminiExecutor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkAvailable()", () => {
    it("should return true when CLI succeeds", async () => {
      const mockProc = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProc);

      const promise = executor.checkAvailable();

      // Simulate successful execution
      mockProc.emit("close", 0);

      const result = await promise;
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        "gemini",
        ["--version"],
        expect.any(Object),
      );
    });

    it("should return false when CLI fails", async () => {
      const mockProc = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProc);

      const promise = executor.checkAvailable();

      // Simulate failed execution
      mockProc.emit("close", 1);

      const result = await promise;
      expect(result).toBe(false);
    });

    it("should return false on spawn error", async () => {
      const mockProc = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProc);

      const promise = executor.checkAvailable();

      // Simulate spawn error
      mockProc.emit("error", new Error("Command not found"));

      const result = await promise;
      expect(result).toBe(false);
    });

    it("should return false on timeout", async () => {
      const mockProc = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProc);

      const promise = executor.checkAvailable();

      // Advance time past the 5 second timeout
      vi.advanceTimersByTime(5001);

      const result = await promise;
      expect(result).toBe(false);
      expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });

  describe("execute()", () => {
    it("should write prompt to temp file and execute CLI", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test prompt",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      // Wait for async operations to set up handlers
      await Promise.resolve();

      // Simulate successful response
      const stdoutHandler = mockProc.stdout.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stdoutHandler(Buffer.from("Response text"));
      mockProc.emit("close", 0);

      const result = await promise;

      expect(result).toBe("Response text");
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("gemini-prompt-"),
        "Test prompt",
        { mode: 0o600 },
      );
      // Now spawns gemini directly, not through sh
      expect(mockSpawn).toHaveBeenCalledWith(
        "gemini",
        ["-m", "gemini-2.5-flash", "-o", "text"],
        expect.any(Object),
      );
      // createReadStream is called to pipe to stdin
      expect(mockCreateReadStream).toHaveBeenCalledWith(
        expect.stringContaining("gemini-prompt-"),
      );
      expect(mockStream.pipe).toHaveBeenCalledWith(mockProc.stdin);
    });

    it("should clean up temp file in finally block on success", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stdoutHandler = mockProc.stdout.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stdoutHandler(Buffer.from("Success"));
      mockProc.emit("close", 0);

      await promise;

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining("gemini-prompt-"),
      );
    });

    it("should clean up temp file in finally block on error", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      mockProc.emit("close", 1);

      await expect(promise).rejects.toThrow();
      expect(mockUnlink).toHaveBeenCalled();
    });

    it("should ignore cleanup errors", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockRejectedValue(new Error("Cleanup failed"));
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stdoutHandler = mockProc.stdout.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stdoutHandler(Buffer.from("Response"));
      mockProc.emit("close", 0);

      // Should not throw despite cleanup error
      await expect(promise).resolves.toBe("Response");
    });

    // Note: Timeout behavior is tested in checkAvailable() tests above
    // Testing the timeout in execute() requires complex timer mocking that
    // is not worth the complexity for this test suite

    it("should handle spawn errors", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      mockProc.emit("error", new Error("ENOENT"));

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect(GeminiError.isGeminiError(error)).toBe(true);
      }
    });

    it("should handle non-zero exit codes", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stderrHandler = mockProc.stderr.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stderrHandler(Buffer.from("Authentication required"));
      mockProc.emit("close", 1);

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect(GeminiError.isGeminiError(error)).toBe(true);
      }
    });
  });

  describe("parseError()", () => {
    it("should identify CLI not found errors", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stderrHandler = mockProc.stderr.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stderrHandler(Buffer.from("command not found: gemini"));
      mockProc.emit("close", 127);

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(GeminiErrorCode.CLI_NOT_FOUND);
        expect((error as GeminiError).isRetryable).toBe(false);
        expect((error as GeminiError).message).toContain("npm install -g");
      }
    });

    it("should identify auth required errors", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stderrHandler = mockProc.stderr.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stderrHandler(Buffer.from("Error: Authentication required. Please login."));
      mockProc.emit("close", 1);

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(GeminiErrorCode.AUTH_REQUIRED);
        expect((error as GeminiError).isRetryable).toBe(false);
        expect((error as GeminiError).message).toContain("gemini auth login");
      }
    });

    it("should identify invalid model errors", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stderrHandler = mockProc.stderr.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stderrHandler(Buffer.from("Error: Invalid model specified"));
      mockProc.emit("close", 1);

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(GeminiErrorCode.INVALID_MODEL);
        expect((error as GeminiError).isRetryable).toBe(false);
      }
    });

    it("should handle ENOENT errors", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      mockProc.emit("error", new Error("spawn gemini ENOENT"));

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(GeminiErrorCode.CLI_NOT_FOUND);
      }
    });

    it("should mark execution failures as retryable", async () => {
      const mockProc = createMockChildProcess();
      const mockStream = createMockReadStream();
      mockSpawn.mockReturnValue(mockProc);
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const promise = executor.execute({
        prompt: "Test",
        model: "gemini-2.5-flash",
        timeout: 60000,
      });

      await Promise.resolve();
      const stderrHandler = mockProc.stderr.on.mock.calls.find(
        (call) => call[0] === "data",
      )?.[1];
      stderrHandler(Buffer.from("Some generic error"));
      mockProc.emit("close", 1);

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as GeminiError).code).toBe(GeminiErrorCode.EXECUTION_FAILED);
        expect((error as GeminiError).isRetryable).toBe(true);
      }
    });
  });
});
