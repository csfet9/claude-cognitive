/**
 * Tests for CLI error handling utilities.
 * @module tests/unit/cli/utils/errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CLIError, ExitCode, handleError, withErrorHandling } from "../../../../src/cli/utils/errors.js";

describe("CLI errors", () => {
  describe("ExitCode", () => {
    it("should have correct exit codes", () => {
      expect(ExitCode.SUCCESS).toBe(0);
      expect(ExitCode.GENERAL_ERROR).toBe(1);
      expect(ExitCode.CONFIG_ERROR).toBe(2);
      expect(ExitCode.CONNECTION_ERROR).toBe(3);
    });
  });

  describe("CLIError", () => {
    it("should create error with message", () => {
      const error = new CLIError("Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.name).toBe("CLIError");
      expect(error.code).toBe(ExitCode.GENERAL_ERROR);
      expect(error.hint).toBeUndefined();
    });

    it("should create error with custom code", () => {
      const error = new CLIError("Config missing", ExitCode.CONFIG_ERROR);

      expect(error.code).toBe(ExitCode.CONFIG_ERROR);
    });

    it("should create error with hint", () => {
      const error = new CLIError(
        "Connection failed",
        ExitCode.CONNECTION_ERROR,
        "Check if Hindsight is running",
      );

      expect(error.hint).toBe("Check if Hindsight is running");
    });
  });

  describe("handleError()", () => {
    let mockExit: ReturnType<typeof vi.spyOn>;
    let mockErrorLog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
      mockErrorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockErrorLog.mockRestore();
    });

    it("should output error message and exit with code", () => {
      const error = new CLIError("Test error", ExitCode.CONFIG_ERROR);

      expect(() => handleError(error)).toThrow("process.exit called");

      expect(mockErrorLog).toHaveBeenCalledWith("Error: Test error");
      expect(mockExit).toHaveBeenCalledWith(ExitCode.CONFIG_ERROR);
    });

    it("should output hint when present", () => {
      const error = new CLIError(
        "Test error",
        ExitCode.GENERAL_ERROR,
        "Try this instead",
      );

      expect(() => handleError(error)).toThrow("process.exit called");

      expect(mockErrorLog).toHaveBeenCalledWith("Error: Test error");
      expect(mockErrorLog).toHaveBeenCalledWith("Hint: Try this instead");
    });

    it("should wrap non-CLIError with GENERAL_ERROR", () => {
      const error = new Error("Plain error");

      expect(() => handleError(error)).toThrow("process.exit called");

      expect(mockErrorLog).toHaveBeenCalledWith("Error: Plain error");
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it("should handle non-Error values", () => {
      expect(() => handleError("string error")).toThrow("process.exit called");

      expect(mockErrorLog).toHaveBeenCalledWith("Error: string error");
    });

    it("should output JSON format when json option is true", () => {
      const error = new CLIError(
        "JSON error",
        ExitCode.CONFIG_ERROR,
        "Some hint",
      );

      expect(() => handleError(error, { json: true })).toThrow(
        "process.exit called",
      );

      expect(mockErrorLog).toHaveBeenCalledWith(
        JSON.stringify({
          error: "JSON error",
          code: ExitCode.CONFIG_ERROR,
          hint: "Some hint",
        }),
      );
    });
  });

  describe("withErrorHandling()", () => {
    let mockExit: ReturnType<typeof vi.spyOn>;
    let mockErrorLog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
      mockErrorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockErrorLog.mockRestore();
    });

    it("should return function result on success", async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(5);

      expect(result).toBe(10);
    });

    it("should handle errors from wrapped function", async () => {
      const fn = async () => {
        throw new Error("Function failed");
      };
      const wrapped = withErrorHandling(fn);

      await expect(wrapped()).rejects.toThrow("process.exit called");

      expect(mockErrorLog).toHaveBeenCalledWith("Error: Function failed");
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it("should pass options to handleError", async () => {
      const fn = async () => {
        throw new CLIError("Error", ExitCode.CONFIG_ERROR, "Hint");
      };
      const wrapped = withErrorHandling(fn, { json: true });

      await expect(wrapped()).rejects.toThrow("process.exit called");

      expect(mockErrorLog).toHaveBeenCalledWith(
        expect.stringContaining("Error"),
      );
    });
  });
});
