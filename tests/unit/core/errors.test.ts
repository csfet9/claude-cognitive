/**
 * Tests for the error handling module.
 * @module tests/unit/core/errors
 */

import { describe, it, expect } from "vitest";
import {
  HindsightError,
  extractErrorMessage,
  parseRetryAfter,
  createErrorFromResponse,
  createErrorFromNetworkFailure,
} from "../../../src/errors.js";

describe("HindsightError", () => {
  describe("constructor", () => {
    it("should create error with message and code", () => {
      const error = new HindsightError("Test error", "UNKNOWN_ERROR");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.name).toBe("HindsightError");
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBeUndefined();
    });

    it("should set isRetryable from options", () => {
      const error = new HindsightError("Test", "SERVER_ERROR", {
        isRetryable: true,
      });

      expect(error.isRetryable).toBe(true);
    });

    it("should set statusCode from options", () => {
      const error = new HindsightError("Test", "SERVER_ERROR", {
        statusCode: 500,
      });

      expect(error.statusCode).toBe(500);
    });

    it("should preserve cause", () => {
      const cause = new Error("Original error");
      const error = new HindsightError("Wrapped", "UNKNOWN_ERROR", { cause });

      expect(error.cause).toBe(cause);
    });
  });

  describe("isHindsightError()", () => {
    it("should return true for HindsightError instances", () => {
      const error = new HindsightError("Test", "UNKNOWN_ERROR");
      expect(HindsightError.isHindsightError(error)).toBe(true);
    });

    it("should return false for regular errors", () => {
      const error = new Error("Test");
      expect(HindsightError.isHindsightError(error)).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(HindsightError.isHindsightError(null)).toBe(false);
      expect(HindsightError.isHindsightError(undefined)).toBe(false);
    });

    it("should return false for non-errors", () => {
      expect(HindsightError.isHindsightError("error")).toBe(false);
      expect(HindsightError.isHindsightError({})).toBe(false);
    });
  });

  describe("getter properties", () => {
    it("isUnavailable should return true for HINDSIGHT_UNAVAILABLE", () => {
      const error = new HindsightError("Test", "HINDSIGHT_UNAVAILABLE");
      expect(error.isUnavailable).toBe(true);
    });

    it("isUnavailable should return false for other codes", () => {
      const error = new HindsightError("Test", "SERVER_ERROR");
      expect(error.isUnavailable).toBe(false);
    });

    it("isBankNotFound should return true for BANK_NOT_FOUND", () => {
      const error = new HindsightError("Test", "BANK_NOT_FOUND");
      expect(error.isBankNotFound).toBe(true);
    });

    it("isBankNotFound should return false for other codes", () => {
      const error = new HindsightError("Test", "UNKNOWN_ERROR");
      expect(error.isBankNotFound).toBe(false);
    });

    it("isValidationError should return true for VALIDATION_ERROR", () => {
      const error = new HindsightError("Test", "VALIDATION_ERROR");
      expect(error.isValidationError).toBe(true);
    });

    it("isValidationError should return true for INVALID_DISPOSITION", () => {
      const error = new HindsightError("Test", "INVALID_DISPOSITION");
      expect(error.isValidationError).toBe(true);
    });

    it("isValidationError should return false for other codes", () => {
      const error = new HindsightError("Test", "SERVER_ERROR");
      expect(error.isValidationError).toBe(false);
    });

    it("isTimeout should return true for CONNECTION_TIMEOUT", () => {
      const error = new HindsightError("Test", "CONNECTION_TIMEOUT");
      expect(error.isTimeout).toBe(true);
    });

    it("isTimeout should return false for other codes", () => {
      const error = new HindsightError("Test", "UNKNOWN_ERROR");
      expect(error.isTimeout).toBe(false);
    });
  });
});

describe("extractErrorMessage()", () => {
  it("should extract message from object with message property", () => {
    expect(extractErrorMessage({ message: "Error message" })).toBe(
      "Error message",
    );
  });

  it("should extract error from object with error property", () => {
    expect(extractErrorMessage({ error: "Error text" })).toBe("Error text");
  });

  it("should prefer message over error", () => {
    expect(
      extractErrorMessage({ message: "Message", error: "Error" }),
    ).toBe("Message");
  });

  it("should return undefined for null", () => {
    expect(extractErrorMessage(null)).toBeUndefined();
  });

  it("should return undefined for undefined", () => {
    expect(extractErrorMessage(undefined)).toBeUndefined();
  });

  it("should return undefined for empty object", () => {
    expect(extractErrorMessage({})).toBeUndefined();
  });

  it("should return undefined for non-string message", () => {
    expect(extractErrorMessage({ message: 123 })).toBeUndefined();
  });
});

describe("parseRetryAfter()", () => {
  it("should return undefined for null", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(parseRetryAfter("")).toBeUndefined();
  });

  it("should parse integer seconds", () => {
    expect(parseRetryAfter("30")).toBe(30000);
    expect(parseRetryAfter("1")).toBe(1000);
    expect(parseRetryAfter("120")).toBe(120000);
  });

  it("should parse HTTP date in the future", () => {
    const futureDate = new Date(Date.now() + 60000).toUTCString();
    const result = parseRetryAfter(futureDate);

    expect(result).toBeDefined();
    expect(result).toBeGreaterThan(50000);
    expect(result).toBeLessThanOrEqual(60000);
  });

  it("should return undefined for HTTP date in the past", () => {
    const pastDate = new Date(Date.now() - 60000).toUTCString();
    expect(parseRetryAfter(pastDate)).toBeUndefined();
  });

  it("should return undefined for invalid string", () => {
    expect(parseRetryAfter("invalid")).toBeUndefined();
  });
});

describe("createErrorFromResponse()", () => {
  function mockResponse(status: number, statusText = ""): Response {
    return {
      status,
      statusText,
      headers: new Headers(),
    } as Response;
  }

  it("should create VALIDATION_ERROR for 400", () => {
    const error = createErrorFromResponse(
      mockResponse(400, "Bad Request"),
      { message: "Invalid input" },
      "/api/v1/banks",
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toContain("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.isRetryable).toBe(false);
  });

  it("should create VALIDATION_ERROR for 401", () => {
    const error = createErrorFromResponse(
      mockResponse(401),
      { message: "Unauthorized" },
      "/api/v1/banks",
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toContain("Authentication failed");
    expect(error.statusCode).toBe(401);
  });

  it("should create VALIDATION_ERROR for 403", () => {
    const error = createErrorFromResponse(
      mockResponse(403),
      { message: "Forbidden" },
      "/api/v1/banks",
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(403);
  });

  it("should create BANK_NOT_FOUND for 404 on banks path", () => {
    const error = createErrorFromResponse(
      mockResponse(404),
      { message: "Bank not found" },
      "/api/v1/banks/my-bank",
    );

    expect(error.code).toBe("BANK_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.isRetryable).toBe(false);
  });

  it("should create VALIDATION_ERROR for 404 on non-banks path", () => {
    const error = createErrorFromResponse(
      mockResponse(404),
      { message: "Not found" },
      "/api/v1/other",
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(404);
  });

  it("should create INVALID_DISPOSITION for 422 with disposition message", () => {
    const error = createErrorFromResponse(
      mockResponse(422),
      { message: "Invalid disposition value" },
      "/api/v1/banks/my-bank/disposition",
    );

    expect(error.code).toBe("INVALID_DISPOSITION");
    expect(error.statusCode).toBe(422);
  });

  it("should create VALIDATION_ERROR for 422 without disposition message", () => {
    const error = createErrorFromResponse(
      mockResponse(422),
      { message: "Invalid query" },
      "/api/v1/banks/my-bank/recall",
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(422);
  });

  it("should create RATE_LIMITED for 429", () => {
    const error = createErrorFromResponse(
      mockResponse(429),
      { message: "Too many requests" },
      "/api/v1/banks",
    );

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.statusCode).toBe(429);
    expect(error.isRetryable).toBe(true);
  });

  it("should create SERVER_ERROR for 500", () => {
    const error = createErrorFromResponse(
      mockResponse(500),
      { message: "Internal error" },
      "/api/v1/banks",
    );

    expect(error.code).toBe("SERVER_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.isRetryable).toBe(true);
  });

  it("should create SERVER_ERROR for 502", () => {
    const error = createErrorFromResponse(
      mockResponse(502),
      null,
      "/api/v1/banks",
    );

    expect(error.code).toBe("SERVER_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.isRetryable).toBe(true);
  });

  it("should create SERVER_ERROR for 503", () => {
    const error = createErrorFromResponse(
      mockResponse(503),
      null,
      "/api/v1/banks",
    );

    expect(error.code).toBe("SERVER_ERROR");
    expect(error.statusCode).toBe(503);
  });

  it("should create SERVER_ERROR for 504", () => {
    const error = createErrorFromResponse(
      mockResponse(504),
      null,
      "/api/v1/banks",
    );

    expect(error.code).toBe("SERVER_ERROR");
    expect(error.statusCode).toBe(504);
  });

  it("should create SERVER_ERROR for unknown 5xx status", () => {
    const error = createErrorFromResponse(
      mockResponse(599),
      null,
      "/api/v1/banks",
    );

    expect(error.code).toBe("SERVER_ERROR");
    expect(error.isRetryable).toBe(true);
  });

  it("should create UNKNOWN_ERROR for other status codes", () => {
    const error = createErrorFromResponse(
      mockResponse(418, "I'm a teapot"),
      null,
      "/api/v1/banks",
    );

    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.statusCode).toBe(418);
    expect(error.isRetryable).toBe(false);
  });

  it("should use statusText when no body message", () => {
    const error = createErrorFromResponse(
      mockResponse(500, "Internal Server Error"),
      null,
      "/api/v1/banks",
    );

    expect(error.message).toContain("Internal Server Error");
  });
});

describe("createErrorFromNetworkFailure()", () => {
  it("should create CONNECTION_TIMEOUT for TimeoutError", () => {
    const cause = new Error("Timeout");
    cause.name = "TimeoutError";

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("CONNECTION_TIMEOUT");
    expect(error.message).toBe("Request timed out");
    expect(error.isRetryable).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it("should create UNKNOWN_ERROR for AbortError", () => {
    const cause = new Error("Aborted");
    cause.name = "AbortError";

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.message).toBe("Request was cancelled");
    expect(error.isRetryable).toBe(false);
  });

  it("should create HINDSIGHT_UNAVAILABLE for ECONNREFUSED", () => {
    const cause = new Error("connect ECONNREFUSED 127.0.0.1:8888");

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("HINDSIGHT_UNAVAILABLE");
    expect(error.isRetryable).toBe(true);
  });

  it("should create HINDSIGHT_UNAVAILABLE for ENOTFOUND", () => {
    const cause = new Error("getaddrinfo ENOTFOUND localhost");

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("HINDSIGHT_UNAVAILABLE");
  });

  it("should create HINDSIGHT_UNAVAILABLE for fetch failed", () => {
    const cause = new Error("fetch failed");

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("HINDSIGHT_UNAVAILABLE");
  });

  it("should create HINDSIGHT_UNAVAILABLE for network error", () => {
    const cause = new Error("Network error occurred");

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("HINDSIGHT_UNAVAILABLE");
  });

  it("should create HINDSIGHT_UNAVAILABLE for unknown errors", () => {
    const cause = new Error("Something went wrong");

    const error = createErrorFromNetworkFailure(cause);

    expect(error.code).toBe("HINDSIGHT_UNAVAILABLE");
    expect(error.message).toContain("Something went wrong");
  });
});
