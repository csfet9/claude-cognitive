/**
 * Tests for GeminiError class.
 * @module tests/unit/gemini/errors
 */

import { describe, it, expect } from "vitest";
import { GeminiError, GeminiErrorCode } from "../../../src/gemini/errors.js";

describe("GeminiError", () => {
  describe("constructor", () => {
    it("should create error with correct code and message", () => {
      const error = new GeminiError(
        "Test error message",
        GeminiErrorCode.CLI_NOT_FOUND,
      );

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe(GeminiErrorCode.CLI_NOT_FOUND);
      expect(error.name).toBe("GeminiError");
    });

    it("should set isRetryable to false by default", () => {
      const error = new GeminiError("Test error", GeminiErrorCode.AUTH_REQUIRED);

      expect(error.isRetryable).toBe(false);
    });

    it("should accept isRetryable option", () => {
      const error = new GeminiError("Test error", GeminiErrorCode.TIMEOUT, {
        isRetryable: true,
      });

      expect(error.isRetryable).toBe(true);
    });

    it("should preserve cause", () => {
      const cause = new Error("Original error");
      const error = new GeminiError(
        "Test error",
        GeminiErrorCode.EXECUTION_FAILED,
        { cause },
      );

      expect(error.cause).toBe(cause);
    });

    it("should support instanceof checks", () => {
      const error = new GeminiError("Test", GeminiErrorCode.CLI_NOT_FOUND);

      expect(error).toBeInstanceOf(GeminiError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("isGeminiError()", () => {
    it("should return true for GeminiError instances", () => {
      const error = new GeminiError("Test", GeminiErrorCode.CLI_NOT_FOUND);

      expect(GeminiError.isGeminiError(error)).toBe(true);
    });

    it("should return false for regular Error instances", () => {
      const error = new Error("Regular error");

      expect(GeminiError.isGeminiError(error)).toBe(false);
    });

    it("should return false for non-error values", () => {
      expect(GeminiError.isGeminiError("string")).toBe(false);
      expect(GeminiError.isGeminiError(123)).toBe(false);
      expect(GeminiError.isGeminiError(null)).toBe(false);
      expect(GeminiError.isGeminiError(undefined)).toBe(false);
      expect(GeminiError.isGeminiError({})).toBe(false);
    });
  });

  describe("isCliNotFound", () => {
    it("should return true for CLI_NOT_FOUND error", () => {
      const error = new GeminiError("Test", GeminiErrorCode.CLI_NOT_FOUND);

      expect(error.isCliNotFound).toBe(true);
    });

    it("should return false for other errors", () => {
      const error = new GeminiError("Test", GeminiErrorCode.AUTH_REQUIRED);

      expect(error.isCliNotFound).toBe(false);
    });
  });

  describe("isAuthRequired", () => {
    it("should return true for AUTH_REQUIRED error", () => {
      const error = new GeminiError("Test", GeminiErrorCode.AUTH_REQUIRED);

      expect(error.isAuthRequired).toBe(true);
    });

    it("should return false for other errors", () => {
      const error = new GeminiError("Test", GeminiErrorCode.TIMEOUT);

      expect(error.isAuthRequired).toBe(false);
    });
  });

  describe("isTimeout", () => {
    it("should return true for TIMEOUT error", () => {
      const error = new GeminiError("Test", GeminiErrorCode.TIMEOUT);

      expect(error.isTimeout).toBe(true);
    });

    it("should return false for other errors", () => {
      const error = new GeminiError("Test", GeminiErrorCode.EXECUTION_FAILED);

      expect(error.isTimeout).toBe(false);
    });
  });

  describe("isSecurityError", () => {
    it("should return true for SECURITY_ERROR error", () => {
      const error = new GeminiError("Test", GeminiErrorCode.SECURITY_ERROR);

      expect(error.isSecurityError).toBe(true);
    });

    it("should return false for other errors", () => {
      const error = new GeminiError("Test", GeminiErrorCode.FILE_NOT_FOUND);

      expect(error.isSecurityError).toBe(false);
    });
  });

  describe("isFileError", () => {
    it("should return true for FILE_NOT_FOUND error", () => {
      const error = new GeminiError("Test", GeminiErrorCode.FILE_NOT_FOUND);

      expect(error.isFileError).toBe(true);
    });

    it("should return true for FILE_TOO_LARGE error", () => {
      const error = new GeminiError("Test", GeminiErrorCode.FILE_TOO_LARGE);

      expect(error.isFileError).toBe(true);
    });

    it("should return false for other errors", () => {
      const error = new GeminiError("Test", GeminiErrorCode.TIMEOUT);

      expect(error.isFileError).toBe(false);
    });
  });
});
