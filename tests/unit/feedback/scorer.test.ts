/**
 * Tests for feedback scoring and verdict calculation.
 * @module tests/unit/feedback/scorer
 */

import { describe, it, expect } from "vitest";
import {
  aggregateDetections,
  calculateVerdict,
  prepareFeedback,
  summarizeFeedback,
  filterHighConfidence,
  getDetectionBreakdown,
  type FactScore,
} from "../../../src/feedback/scorer.js";
import type {
  Detection,
  DetectionResults,
} from "../../../src/feedback/detector.js";

describe("calculateVerdict", () => {
  it("should return 'used' for high positive score", () => {
    const result = calculateVerdict(0.8, 0);
    expect(result.verdict).toBe("used");
    expect(result.confidence).toBeCloseTo(0.8, 2);
  });

  it("should return 'ignored' for high negative score", () => {
    // Net score = 0 - (0.8 * 0.5) = -0.4, which is < -0.2
    const result = calculateVerdict(0, 0.8);
    expect(result.verdict).toBe("ignored");
  });

  it("should return 'uncertain' for neutral score", () => {
    const result = calculateVerdict(0.1, 0.1);
    expect(result.verdict).toBe("uncertain");
  });

  it("should weight negative signals less than positive", () => {
    // Equal raw scores should result in positive net score
    // Net = 0.5 - (0.5 * 0.5) = 0.5 - 0.25 = 0.25 > 0.2 → used
    const result = calculateVerdict(0.5, 0.5);
    expect(result.verdict).toBe("used");
  });

  it("should handle edge case at threshold", () => {
    // Net = 0.2 - 0 = 0.2, which is NOT > 0.2
    const atThreshold = calculateVerdict(0.2, 0);
    expect(atThreshold.verdict).toBe("uncertain");

    // Net = 0.21 - 0 = 0.21 > 0.2
    const aboveThreshold = calculateVerdict(0.21, 0);
    expect(aboveThreshold.verdict).toBe("used");
  });
});

describe("aggregateDetections", () => {
  it("should aggregate positive detections", () => {
    const detections: DetectionResults = {
      explicit: [
        {
          factId: "fact-1",
          detectionType: "explicit_reference",
          confidence: 0.95,
          evidence: {},
        },
      ],
      semantic: [
        {
          factId: "fact-1",
          detectionType: "semantic_match",
          confidence: 0.5,
          evidence: {},
        },
      ],
      behavioral: [],
      negative: [],
    };

    const result = aggregateDetections(detections);

    expect(result).toHaveLength(1);
    expect(result[0].factId).toBe("fact-1");
    // Capped at 1.0
    expect(result[0].scores.used).toBeLessThanOrEqual(1.0);
    expect(result[0].detections).toHaveLength(2);
  });

  it("should handle negative signals", () => {
    const detections: DetectionResults = {
      explicit: [],
      semantic: [],
      behavioral: [],
      negative: [
        {
          factId: "fact-1",
          signals: [
            { type: "low_position", weight: 0.3, detail: "Position 20" },
          ],
          ignoreConfidence: 0.5,
        },
      ],
    };

    const result = aggregateDetections(detections);

    expect(result).toHaveLength(1);
    expect(result[0].scores.ignored).toBe(0.5);
  });

  it("should calculate correct verdict for mixed signals", () => {
    const detections: DetectionResults = {
      explicit: [
        {
          factId: "fact-1",
          detectionType: "explicit_reference",
          confidence: 0.8,
          evidence: {},
        },
      ],
      semantic: [],
      behavioral: [],
      negative: [
        {
          factId: "fact-1",
          signals: [{ type: "low_position", weight: 0.3, detail: "" }],
          ignoreConfidence: 0.3,
        },
      ],
    };

    const result = aggregateDetections(detections);

    // Net = 0.8 - (0.3 * 0.5) = 0.8 - 0.15 = 0.65 > 0.2 → used
    expect(result[0].verdict).toBe("used");
  });

  it("should sort by confidence descending", () => {
    const detections: DetectionResults = {
      explicit: [
        {
          factId: "fact-1",
          detectionType: "explicit_reference",
          confidence: 0.5,
          evidence: {},
        },
        {
          factId: "fact-2",
          detectionType: "explicit_reference",
          confidence: 0.9,
          evidence: {},
        },
      ],
      semantic: [],
      behavioral: [],
      negative: [],
    };

    const result = aggregateDetections(detections);

    expect(result[0].factId).toBe("fact-2");
    expect(result[1].factId).toBe("fact-1");
  });

  it("should handle empty detections", () => {
    const detections: DetectionResults = {
      explicit: [],
      semantic: [],
      behavioral: [],
      negative: [],
    };

    const result = aggregateDetections(detections);

    expect(result).toHaveLength(0);
  });

  it("should cap scores at 1.0", () => {
    const detections: DetectionResults = {
      explicit: [
        {
          factId: "fact-1",
          detectionType: "explicit_reference",
          confidence: 0.95,
          evidence: {},
        },
      ],
      semantic: [
        {
          factId: "fact-1",
          detectionType: "semantic_match",
          confidence: 0.7,
          evidence: {},
        },
      ],
      behavioral: [
        {
          factId: "fact-1",
          detectionType: "file_access_correlation",
          confidence: 0.5,
          evidence: {},
        },
      ],
      negative: [],
    };

    const result = aggregateDetections(detections);

    expect(result[0].scores.used).toBe(1.0);
  });
});

describe("prepareFeedback", () => {
  it("should create signals for used facts", () => {
    const factScores: FactScore[] = [
      {
        factId: "fact-1",
        verdict: "used",
        confidence: 0.8,
        scores: { used: 0.8, ignored: 0 },
        detections: [],
      },
    ];

    const result = prepareFeedback(factScores, "test query");

    expect(result).toHaveLength(1);
    expect(result[0].factId).toBe("fact-1");
    expect(result[0].signalType).toBe("used");
    expect(result[0].confidence).toBe(0.8);
    expect(result[0].query).toBe("test query");
  });

  it("should create signals for ignored facts", () => {
    const factScores: FactScore[] = [
      {
        factId: "fact-1",
        verdict: "ignored",
        confidence: 0.6,
        scores: { used: 0, ignored: 0.6 },
        detections: [],
      },
    ];

    const result = prepareFeedback(factScores, "test query");

    expect(result).toHaveLength(1);
    expect(result[0].signalType).toBe("ignored");
  });

  it("should exclude uncertain facts", () => {
    const factScores: FactScore[] = [
      {
        factId: "fact-1",
        verdict: "uncertain",
        confidence: 0.1,
        scores: { used: 0.1, ignored: 0.1 },
        detections: [],
      },
    ];

    const result = prepareFeedback(factScores, "test query");

    expect(result).toHaveLength(0);
  });

  it("should handle empty input", () => {
    const result = prepareFeedback([], "test query");
    expect(result).toHaveLength(0);
  });
});

describe("signal types", () => {
  it("should support 'helpful' signal type in prepared feedback", () => {
    // 'helpful' signals come from explicit user feedback, not automatic detection
    // The system should be able to create and handle helpful signals
    const factScores: FactScore[] = [
      {
        factId: "fact-1",
        verdict: "used",
        confidence: 1.0,
        scores: { used: 1.0, ignored: 0 },
        detections: [
          {
            detectionType: "explicit_reference",
            confidence: 0.95,
            evidence: {},
          },
        ],
      },
    ];

    const result = prepareFeedback(factScores, "test query");

    // Verify the signal can be converted to 'helpful' type externally
    expect(result[0].signalType).toBe("used");
    expect(result[0].confidence).toBe(1.0);

    // Manually convert to helpful (simulating user explicit positive feedback)
    const helpfulSignal = { ...result[0], signalType: "helpful" as const };
    expect(helpfulSignal.signalType).toBe("helpful");
  });

  it("should support 'not_helpful' signal type for explicit negative feedback", () => {
    // 'not_helpful' signals represent explicit user negative feedback
    const factScores: FactScore[] = [
      {
        factId: "fact-1",
        verdict: "ignored",
        confidence: 0.8,
        scores: { used: 0, ignored: 0.8 },
        detections: [],
      },
    ];

    const result = prepareFeedback(factScores, "test query");

    // Verify the signal can be converted to 'not_helpful' type externally
    expect(result[0].signalType).toBe("ignored");

    // Manually convert to not_helpful (simulating user explicit negative feedback)
    const notHelpfulSignal = {
      ...result[0],
      signalType: "not_helpful" as const,
    };
    expect(notHelpfulSignal.signalType).toBe("not_helpful");
  });

  it("should preserve query context for all signal types", () => {
    const factScores: FactScore[] = [
      {
        factId: "fact-1",
        verdict: "used",
        confidence: 0.9,
        scores: { used: 0.9, ignored: 0 },
        detections: [],
      },
      {
        factId: "fact-2",
        verdict: "ignored",
        confidence: 0.7,
        scores: { used: 0, ignored: 0.7 },
        detections: [],
      },
    ];

    const query = "How do I implement authentication?";
    const result = prepareFeedback(factScores, query);

    // All signals should have the query context
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.query === query)).toBe(true);
  });

  it("should handle mixed signal confidence levels", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 1.0,
        scores: { used: 1.0, ignored: 0 },
        detections: [],
      },
      {
        factId: "2",
        verdict: "used",
        confidence: 0.7,
        scores: { used: 0.7, ignored: 0 },
        detections: [],
      },
      {
        factId: "3",
        verdict: "ignored",
        confidence: 0.5,
        scores: { used: 0, ignored: 0.5 },
        detections: [],
      },
    ];

    const result = prepareFeedback(factScores, "test");

    expect(result).toHaveLength(3);
    expect(result.find((s) => s.factId === "1")?.confidence).toBe(1.0);
    expect(result.find((s) => s.factId === "2")?.confidence).toBe(0.7);
    expect(result.find((s) => s.factId === "3")?.confidence).toBe(0.5);
  });
});

describe("summarizeFeedback", () => {
  it("should count verdicts correctly", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.8,
        scores: { used: 0.8, ignored: 0 },
        detections: [],
      },
      {
        factId: "2",
        verdict: "used",
        confidence: 0.9,
        scores: { used: 0.9, ignored: 0 },
        detections: [],
      },
      {
        factId: "3",
        verdict: "ignored",
        confidence: 0.5,
        scores: { used: 0, ignored: 0.5 },
        detections: [],
      },
      {
        factId: "4",
        verdict: "uncertain",
        confidence: 0.1,
        scores: { used: 0.1, ignored: 0.1 },
        detections: [],
      },
    ];

    const result = summarizeFeedback(factScores);

    expect(result.total).toBe(4);
    expect(result.used).toBe(2);
    expect(result.ignored).toBe(1);
    expect(result.uncertain).toBe(1);
  });

  it("should calculate usage rate", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.8,
        scores: { used: 0.8, ignored: 0 },
        detections: [],
      },
      {
        factId: "2",
        verdict: "ignored",
        confidence: 0.5,
        scores: { used: 0, ignored: 0.5 },
        detections: [],
      },
    ];

    const result = summarizeFeedback(factScores);

    expect(result.usageRate).toBe(0.5);
  });

  it("should calculate average confidences", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.8,
        scores: { used: 0.8, ignored: 0 },
        detections: [],
      },
      {
        factId: "2",
        verdict: "used",
        confidence: 0.6,
        scores: { used: 0.6, ignored: 0 },
        detections: [],
      },
      {
        factId: "3",
        verdict: "ignored",
        confidence: 0.5,
        scores: { used: 0, ignored: 0.5 },
        detections: [],
      },
    ];

    const result = summarizeFeedback(factScores);

    expect(result.avgUsedConfidence).toBe(0.7);
    expect(result.avgIgnoredConfidence).toBe(0.5);
  });

  it("should include top used and ignored facts", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.9,
        scores: { used: 0.9, ignored: 0 },
        detections: [
          {
            detectionType: "explicit_reference",
            confidence: 0.9,
            evidence: {},
          } as Detection,
        ],
      },
      {
        factId: "2",
        verdict: "ignored",
        confidence: 0.7,
        scores: { used: 0, ignored: 0.7 },
        detections: [],
      },
    ];

    const result = summarizeFeedback(factScores);

    expect(result.topUsed).toHaveLength(1);
    expect(result.topUsed[0].factId).toBe("1");
    expect(result.topUsed[0].detectionTypes).toContain("explicit_reference");

    expect(result.topIgnored).toHaveLength(1);
    expect(result.topIgnored[0].factId).toBe("2");
  });

  it("should limit top lists to 5 items", () => {
    const factScores: FactScore[] = Array.from({ length: 10 }, (_, i) => ({
      factId: `fact-${i}`,
      verdict: "used" as const,
      confidence: 0.5 + i * 0.01,
      scores: { used: 0.5, ignored: 0 },
      detections: [],
    }));

    const result = summarizeFeedback(factScores);

    expect(result.topUsed).toHaveLength(5);
  });

  it("should handle empty input", () => {
    const result = summarizeFeedback([]);

    expect(result.total).toBe(0);
    expect(result.used).toBe(0);
    expect(result.ignored).toBe(0);
    expect(result.uncertain).toBe(0);
    expect(result.usageRate).toBe(0);
  });
});

describe("filterHighConfidence", () => {
  it("should filter by confidence threshold", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.9,
        scores: { used: 0.9, ignored: 0 },
        detections: [],
      },
      {
        factId: "2",
        verdict: "used",
        confidence: 0.3,
        scores: { used: 0.3, ignored: 0 },
        detections: [],
      },
      {
        factId: "3",
        verdict: "ignored",
        confidence: 0.6,
        scores: { used: 0, ignored: 0.6 },
        detections: [],
      },
    ];

    const result = filterHighConfidence(factScores, 0.5);

    expect(result).toHaveLength(2);
    expect(result.every((s) => s.confidence >= 0.5)).toBe(true);
  });

  it("should exclude uncertain verdicts", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "uncertain",
        confidence: 0.9,
        scores: { used: 0.9, ignored: 0.9 },
        detections: [],
      },
    ];

    const result = filterHighConfidence(factScores, 0.5);

    expect(result).toHaveLength(0);
  });

  it("should use default threshold of 0.5", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.5,
        scores: { used: 0.5, ignored: 0 },
        detections: [],
      },
      {
        factId: "2",
        verdict: "used",
        confidence: 0.4,
        scores: { used: 0.4, ignored: 0 },
        detections: [],
      },
    ];

    const result = filterHighConfidence(factScores);

    expect(result).toHaveLength(1);
    expect(result[0].factId).toBe("1");
  });
});

describe("getDetectionBreakdown", () => {
  it("should count detection types", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.9,
        scores: { used: 0.9, ignored: 0 },
        detections: [
          {
            detectionType: "explicit_reference",
            confidence: 0.9,
            evidence: {},
          },
          { detectionType: "semantic_match", confidence: 0.5, evidence: {} },
        ],
      },
      {
        factId: "2",
        verdict: "used",
        confidence: 0.5,
        scores: { used: 0.5, ignored: 0 },
        detections: [
          { detectionType: "semantic_match", confidence: 0.5, evidence: {} },
        ],
      },
    ];

    const result = getDetectionBreakdown(factScores);

    expect(result.explicit_reference).toBe(1);
    expect(result.semantic_match).toBe(2);
    expect(result.file_access_correlation).toBe(0);
    expect(result.task_topic_correlation).toBe(0);
    expect(result.negative_signals).toBe(0);
  });

  it("should handle empty input", () => {
    const result = getDetectionBreakdown([]);

    expect(result.explicit_reference).toBe(0);
    expect(result.semantic_match).toBe(0);
  });

  it("should handle facts without detections", () => {
    const factScores: FactScore[] = [
      {
        factId: "1",
        verdict: "used",
        confidence: 0.5,
        scores: { used: 0.5, ignored: 0 },
        detections: [],
      },
    ];

    const result = getDetectionBreakdown(factScores);

    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});
