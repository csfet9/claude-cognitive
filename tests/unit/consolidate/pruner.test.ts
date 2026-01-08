/**
 * Tests for the pruner module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzePruningCandidates } from "../../../src/consolidate/pruner.js";
import type { HindsightClient } from "../../../src/client.js";

describe("analyzePruningCandidates()", () => {
  let mockClient: {
    getBank: ReturnType<typeof vi.fn>;
    getBankStats: ReturnType<typeof vi.fn>;
    getFactStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClient = {
      getBank: vi.fn(),
      getBankStats: vi.fn(),
      getFactStats: vi.fn(),
    };
  });

  it("should return empty candidates when no stats available", async () => {
    mockClient.getBank.mockResolvedValue({ memoryCount: 100 });
    mockClient.getBankStats.mockRejectedValue(new Error("No stats"));

    const report = await analyzePruningCandidates(
      mockClient as unknown as HindsightClient,
      "test-bank",
    );

    expect(report.candidates).toHaveLength(0);
    expect(report.totalMemories).toBe(100);
    expect(report.bankId).toBe("test-bank");
  });

  it("should identify pruning candidates based on criteria", async () => {
    mockClient.getBank.mockResolvedValue({ memoryCount: 100 });
    mockClient.getBankStats.mockResolvedValue({
      leastUsefulFacts: [
        { factId: "fact-1", score: 0.1, text: "Low usefulness fact" },
        { factId: "fact-2", score: 0.4, text: "Above threshold fact" },
      ],
    });
    mockClient.getFactStats.mockResolvedValue({
      signalCount: 10,
      signalBreakdown: { used: 2, ignored: 8, helpful: 0, not_helpful: 0 },
    });

    const report = await analyzePruningCandidates(
      mockClient as unknown as HindsightClient,
      "test-bank",
      { minUsefulness: 0.3, minSignals: 5 },
    );

    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0].factId).toBe("fact-1");
    expect(report.candidates[0].reason).toContain("ignored 8x");
  });

  it("should skip facts without enough signals", async () => {
    mockClient.getBank.mockResolvedValue({ memoryCount: 50 });
    mockClient.getBankStats.mockResolvedValue({
      leastUsefulFacts: [
        { factId: "fact-1", score: 0.1, text: "Low signal fact" },
      ],
    });
    mockClient.getFactStats.mockResolvedValue({
      signalCount: 2, // Below default minSignals of 5
      signalBreakdown: { used: 0, ignored: 2, helpful: 0, not_helpful: 0 },
    });

    const report = await analyzePruningCandidates(
      mockClient as unknown as HindsightClient,
      "test-bank",
    );

    expect(report.candidates).toHaveLength(0);
  });

  it("should skip facts where used >= ignored", async () => {
    mockClient.getBank.mockResolvedValue({ memoryCount: 50 });
    mockClient.getBankStats.mockResolvedValue({
      leastUsefulFacts: [
        { factId: "fact-1", score: 0.2, text: "Balanced fact" },
      ],
    });
    mockClient.getFactStats.mockResolvedValue({
      signalCount: 10,
      signalBreakdown: { used: 5, ignored: 5, helpful: 0, not_helpful: 0 },
    });

    const report = await analyzePruningCandidates(
      mockClient as unknown as HindsightClient,
      "test-bank",
    );

    expect(report.candidates).toHaveLength(0);
  });

  it("should respect maxCandidates option", async () => {
    mockClient.getBank.mockResolvedValue({ memoryCount: 100 });
    mockClient.getBankStats.mockResolvedValue({
      leastUsefulFacts: [
        { factId: "fact-1", score: 0.1, text: "Fact 1" },
        { factId: "fact-2", score: 0.1, text: "Fact 2" },
        { factId: "fact-3", score: 0.1, text: "Fact 3" },
      ],
    });
    mockClient.getFactStats.mockResolvedValue({
      signalCount: 10,
      signalBreakdown: { used: 1, ignored: 9, helpful: 0, not_helpful: 0 },
    });

    const report = await analyzePruningCandidates(
      mockClient as unknown as HindsightClient,
      "test-bank",
      { maxCandidates: 2 },
    );

    expect(report.candidates).toHaveLength(2);
  });
});
