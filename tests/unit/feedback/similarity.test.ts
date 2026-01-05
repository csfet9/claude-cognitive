/**
 * Tests for similarity functions.
 * @module tests/unit/feedback/similarity
 */

import { describe, it, expect } from "vitest";
import {
  calculateSimilarity,
  jaccardSimilarity,
} from "../../../src/feedback/similarity.js";

describe("calculateSimilarity", () => {
  it("should return 1 for identical texts", () => {
    const result = calculateSimilarity("hello world", "hello world");
    expect(result).toBe(1);
  });

  it("should return 1 for both empty texts", () => {
    const result = calculateSimilarity("", "");
    expect(result).toBe(1);
  });

  it("should return 0 when one text is empty", () => {
    expect(calculateSimilarity("hello world", "")).toBe(0);
    expect(calculateSimilarity("", "hello world")).toBe(0);
  });

  it("should return 0 for completely different texts", () => {
    const result = calculateSimilarity("apple banana", "xyz abc");
    expect(result).toBe(0);
  });

  it("should calculate partial similarity correctly", () => {
    // "hello world" has words {hello, world}
    // "hello there" has words {hello, there}
    // Intersection: {hello} = 1
    // Union: {hello, world, there} = 3
    // Jaccard: 1/3 ≈ 0.333
    const result = calculateSimilarity("hello world", "hello there");
    expect(result).toBeCloseTo(1 / 3, 2);
  });

  it("should be case-insensitive", () => {
    const result = calculateSimilarity("HELLO WORLD", "hello world");
    expect(result).toBe(1);
  });

  it("should ignore punctuation", () => {
    const result = calculateSimilarity("Hello, world!", "hello world");
    expect(result).toBe(1);
  });

  it("should normalize whitespace", () => {
    const result = calculateSimilarity("hello   world", "hello world");
    expect(result).toBe(1);
  });

  it("should handle whitespace-only texts", () => {
    expect(calculateSimilarity("   ", "   ")).toBe(1);
    expect(calculateSimilarity("   ", "hello")).toBe(0);
  });
});

describe("jaccardSimilarity", () => {
  it("should return 1 for identical sets", () => {
    const set1 = new Set(["a", "b", "c"]);
    const set2 = new Set(["a", "b", "c"]);
    expect(jaccardSimilarity(set1, set2)).toBe(1);
  });

  it("should return 1 for both empty sets", () => {
    const set1 = new Set<string>();
    const set2 = new Set<string>();
    expect(jaccardSimilarity(set1, set2)).toBe(1);
  });

  it("should return 0 when one set is empty", () => {
    const set1 = new Set(["a", "b"]);
    const set2 = new Set<string>();
    expect(jaccardSimilarity(set1, set2)).toBe(0);
    expect(jaccardSimilarity(set2, set1)).toBe(0);
  });

  it("should return 0 for disjoint sets", () => {
    const set1 = new Set(["a", "b"]);
    const set2 = new Set(["c", "d"]);
    expect(jaccardSimilarity(set1, set2)).toBe(0);
  });

  it("should calculate partial overlap correctly", () => {
    // {a, b, c} and {b, c, d}
    // Intersection: {b, c} = 2
    // Union: {a, b, c, d} = 4
    // Jaccard: 2/4 = 0.5
    const set1 = new Set(["a", "b", "c"]);
    const set2 = new Set(["b", "c", "d"]);
    expect(jaccardSimilarity(set1, set2)).toBe(0.5);
  });

  it("should handle subset relationships", () => {
    // {a, b} is a subset of {a, b, c}
    // Intersection: {a, b} = 2
    // Union: {a, b, c} = 3
    // Jaccard: 2/3 ≈ 0.667
    const set1 = new Set(["a", "b"]);
    const set2 = new Set(["a", "b", "c"]);
    expect(jaccardSimilarity(set1, set2)).toBeCloseTo(2 / 3, 2);
  });
});
