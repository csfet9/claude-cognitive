/**
 * Usage Detection Strategies
 *
 * Implements 4 detection strategies to identify which recalled facts
 * Claude actually used during a session:
 *
 * 1. Explicit Reference Detection (High Confidence)
 * 2. Semantic Similarity Detection (Medium Confidence)
 * 3. Behavioral Signal Detection (Low Confidence)
 * 4. Negative Signal Detection
 *
 * @module feedback/detector
 */

import {
  EXPLICIT_TRIGGERS,
  EXPLICIT_CONFIDENCE,
  SEMANTIC_THRESHOLD,
  SEMANTIC_MAX_CONFIDENCE,
  FILE_ACCESS_CONFIDENCE,
  TASK_TOPIC_CONFIDENCE,
  createFileReferencePatterns,
  LOW_POSITION_WEIGHT,
  LOW_POSITION_THRESHOLD,
  TOPIC_MISMATCH_WEIGHT,
  TOPIC_MISMATCH_THRESHOLD,
  FILES_NOT_ACCESSED_WEIGHT,
  MAX_IGNORE_CONFIDENCE,
  CHUNK_MAX_WORDS,
  CHUNK_OVERLAP_WORDS,
} from "./constants.js";
import { calculateSimilarity, jaccardSimilarity } from "./similarity.js";
import type { RecalledFact } from "./tracker.js";
import type { FeedbackDetectionConfig } from "../types.js";

// =============================================================================
// Types
// =============================================================================

export interface Detection {
  factId: string;
  detectionType:
    | "explicit_reference"
    | "semantic_match"
    | "file_access_correlation"
    | "task_topic_correlation";
  confidence: number;
  evidence: Record<string, unknown>;
}

export interface NegativeSignalDetail {
  type: "low_position" | "topic_mismatch" | "files_not_accessed";
  weight: number;
  detail: string;
}

export interface NegativeSignal {
  factId: string;
  signals: NegativeSignalDetail[];
  ignoreConfidence: number;
}

export interface DetectionResults {
  explicit: Detection[];
  semantic: Detection[];
  behavioral: Detection[];
  negative: NegativeSignal[];
}

export interface SessionActivity {
  filesAccessed?: string[];
  tasksCompleted?: Array<{ description?: string; title?: string }>;
  summary?: string;
}

// =============================================================================
// Strategy 1: Explicit Reference Detection (High Confidence)
// =============================================================================

/**
 * Detect explicit references to context in Claude's response
 */
export function detectExplicitReferences(
  response: string,
  recalledFacts: RecalledFact[],
): Detection[] {
  if (!response || !recalledFacts?.length) {
    return [];
  }

  const detections: Detection[] = [];
  const detectedFactIds = new Set<string>();

  // Check each trigger pattern
  for (const pattern of EXPLICIT_TRIGGERS) {
    const matches = response.match(pattern);
    if (!matches) continue;

    // Found explicit reference - try to match to specific fact
    for (const match of [matches[0]]) {
      // Get surrounding context - use sentence boundary or limited window
      const matchIndex = response.indexOf(match);

      // Find sentence boundaries (period, newline, or window limit)
      let contextStart = matchIndex;
      let contextEnd = matchIndex + match.length;

      // Look backwards for sentence start (max 50 chars)
      for (let i = matchIndex - 1; i >= Math.max(0, matchIndex - 50); i--) {
        if (response[i] === "." || response[i] === "\n") {
          contextStart = i + 1;
          break;
        }
        contextStart = i;
      }

      // Look forwards for sentence end (max 100 chars)
      for (
        let i = matchIndex + match.length;
        i < Math.min(response.length, matchIndex + match.length + 100);
        i++
      ) {
        contextEnd = i + 1;
        if (response[i] === "." || response[i] === "\n") {
          break;
        }
      }

      const surroundingContext = response
        .slice(contextStart, contextEnd)
        .trim();

      // Find best matching fact based on context
      const matchedFact = findBestMatchingFact(
        surroundingContext,
        recalledFacts,
      );

      if (matchedFact && !detectedFactIds.has(matchedFact.factId)) {
        detectedFactIds.add(matchedFact.factId);
        detections.push({
          factId: matchedFact.factId,
          detectionType: "explicit_reference",
          confidence: EXPLICIT_CONFIDENCE,
          evidence: {
            trigger: pattern.source,
            match,
            context: surroundingContext.slice(0, 200),
          },
        });
      }
    }
  }

  return detections;
}

/**
 * Find the best matching fact for a given context
 */
function findBestMatchingFact(
  context: string,
  facts: RecalledFact[],
  minThreshold = 0.1,
): RecalledFact | null {
  if (!context || !facts?.length) {
    return null;
  }

  let bestMatch: RecalledFact | null = null;
  let bestScore = 0;

  for (const fact of facts) {
    const factText = fact.text || "";
    const similarity = calculateSimilarity(context, factText);

    // Lower threshold (0.1) since explicit triggers already indicate high confidence
    if (similarity > bestScore && similarity > minThreshold) {
      bestScore = similarity;
      bestMatch = fact;
    }
  }

  return bestMatch;
}

// =============================================================================
// Strategy 2: Semantic Similarity Detection (Medium Confidence)
// =============================================================================

/**
 * Detect semantic matches between response and facts
 * Uses Jaccard similarity (word overlap) for comparison
 */
export function detectSemanticMatches(
  response: string,
  recalledFacts: RecalledFact[],
  threshold: number = SEMANTIC_THRESHOLD,
): Detection[] {
  if (!response || !recalledFacts?.length) {
    return [];
  }

  const detections: Detection[] = [];
  const factDetections = new Map<string, Detection>();

  // Split response into chunks for comparison
  const chunks = splitIntoChunks(
    response,
    CHUNK_MAX_WORDS,
    CHUNK_OVERLAP_WORDS,
  );

  // Compare each chunk to each fact
  for (const chunk of chunks) {
    for (const fact of recalledFacts) {
      const factText = fact.text || "";
      const similarity = calculateSimilarity(chunk, factText);

      if (similarity >= threshold) {
        const confidence = Math.min(
          similarity * SEMANTIC_MAX_CONFIDENCE,
          SEMANTIC_MAX_CONFIDENCE,
        );

        // Keep best detection per fact
        const existing = factDetections.get(fact.factId);
        if (!existing || confidence > existing.confidence) {
          factDetections.set(fact.factId, {
            factId: fact.factId,
            detectionType: "semantic_match",
            confidence,
            evidence: {
              chunk: chunk.slice(0, 200),
              factText: factText.slice(0, 200),
              similarity,
            },
          });
        }
      }
    }
  }

  // Convert map to array
  for (const detection of factDetections.values()) {
    detections.push(detection);
  }

  return detections;
}

/**
 * Split text into overlapping chunks
 */
function splitIntoChunks(
  text: string,
  maxWords: number = CHUNK_MAX_WORDS,
  overlap: number = CHUNK_OVERLAP_WORDS,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  if (words.length <= maxWords) {
    return [text];
  }

  const step = maxWords - overlap;
  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + maxWords);
    if (chunkWords.length >= overlap) {
      chunks.push(chunkWords.join(" "));
    }
  }

  return chunks;
}

// =============================================================================
// Strategy 3: Behavioral Signal Detection (Low Confidence)
// =============================================================================

/**
 * Detect behavioral signals that indicate fact usage
 */
export function detectBehavioralSignals(
  sessionActivity: SessionActivity,
  recalledFacts: RecalledFact[],
): Detection[] {
  if (!sessionActivity || !recalledFacts?.length) {
    return [];
  }

  const detections: Detection[] = [];
  const detectedFactIds = new Set<string>();

  // 1. File access correlation
  const accessedFiles = sessionActivity.filesAccessed || [];
  if (accessedFiles.length > 0) {
    for (const fact of recalledFacts) {
      const factText = fact.text || "";
      const mentionedFiles = extractFileReferences(factText);

      if (mentionedFiles.length > 0) {
        const overlap = intersection(accessedFiles, mentionedFiles);

        if (overlap.length > 0 && !detectedFactIds.has(fact.factId)) {
          detectedFactIds.add(fact.factId);
          detections.push({
            factId: fact.factId,
            detectionType: "file_access_correlation",
            confidence: FILE_ACCESS_CONFIDENCE,
            evidence: {
              filesInFact: mentionedFiles,
              filesAccessed: overlap,
            },
          });
        }
      }
    }
  }

  // 2. Task topic correlation
  const tasksCompleted = sessionActivity.tasksCompleted || [];
  if (tasksCompleted.length > 0) {
    for (const fact of recalledFacts) {
      if (detectedFactIds.has(fact.factId)) continue;

      const factText = fact.text || "";
      const factTopics = extractTopics(factText);

      for (const task of tasksCompleted) {
        const taskDesc = task.description || task.title || String(task);
        const taskTopics = extractTopics(taskDesc);
        const topicOverlap = jaccardSimilarity(factTopics, taskTopics);

        if (topicOverlap > 0.3 && !detectedFactIds.has(fact.factId)) {
          detectedFactIds.add(fact.factId);
          detections.push({
            factId: fact.factId,
            detectionType: "task_topic_correlation",
            confidence: TASK_TOPIC_CONFIDENCE * topicOverlap,
            evidence: {
              task: taskDesc.slice(0, 100),
              factTopics: [...factTopics].slice(0, 5),
              taskTopics: [...taskTopics].slice(0, 5),
              overlap: topicOverlap,
            },
          });
          break;
        }
      }
    }
  }

  return detections;
}

/**
 * Extract file references from text
 */
export function extractFileReferences(text: string): string[] {
  if (!text) return [];

  const files = new Set<string>();

  // Create fresh regex patterns for each call to avoid shared state issues
  const patterns = createFileReferencePatterns();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const file = match[1] || match[0];
      if (file && file.length > 2) {
        const normalized = normalizeFileName(file);
        if (normalized) {
          files.add(normalized);
        }
      }
    }
  }

  return [...files];
}

/**
 * Normalize a file name for comparison
 * @returns Normalized file name or empty string if input is invalid
 */
function normalizeFileName(fileName: string): string {
  if (!fileName) return "";

  const normalized = fileName
    .toLowerCase()
    .replace(/^['"]|['"]$/g, "") // Remove quotes
    .trim();

  if (!normalized) return "";

  const parts = normalized.split("/").filter(Boolean);
  const baseName = parts.length > 0 ? parts[parts.length - 1] : "";
  return baseName ?? "";
}

/**
 * Extract topic keywords from text
 */
export function extractTopics(text: string): Set<string> {
  if (!text) return new Set();

  // Common stop words to filter out
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "they",
    "them",
    "their",
    "we",
    "us",
    "our",
    "you",
    "your",
    "i",
    "me",
    "my",
    "he",
    "she",
    "him",
    "her",
    "his",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(words);
}

/**
 * Calculate intersection of two arrays
 */
function intersection(arr1: string[], arr2: string[]): string[] {
  const set2 = new Set(arr2.map((s) => s.toLowerCase()));
  return arr1.filter((item) => set2.has(item.toLowerCase()));
}

// =============================================================================
// Strategy 4: Negative Signal Detection
// =============================================================================

/**
 * Detect negative signals for facts that were likely NOT used
 */
export function detectNegativeSignals(
  sessionActivity: SessionActivity | null,
  recalledFacts: RecalledFact[],
  usedFactIds: Set<string>,
): NegativeSignal[] {
  if (!recalledFacts?.length) {
    return [];
  }

  const negativeSignals: NegativeSignal[] = [];
  const sessionTopics = sessionActivity?.summary
    ? extractTopics(sessionActivity.summary)
    : new Set<string>();
  const accessedFiles = new Set(
    (sessionActivity?.filesAccessed || []).map((f) => f.toLowerCase()),
  );

  for (const fact of recalledFacts) {
    // Skip facts already detected as used
    if (usedFactIds.has(fact.factId)) continue;

    const signals: NegativeSignalDetail[] = [];
    const factText = fact.text || "";

    // 1. Position-based signal (facts at end less likely useful)
    if (fact.position > LOW_POSITION_THRESHOLD) {
      signals.push({
        type: "low_position",
        weight: LOW_POSITION_WEIGHT,
        detail: `Position ${fact.position} > ${LOW_POSITION_THRESHOLD}`,
      });
    }

    // 2. Topic mismatch signal
    if (sessionTopics.size > 0) {
      const factTopics = extractTopics(factText);
      const topicOverlap = jaccardSimilarity(sessionTopics, factTopics);

      if (topicOverlap < TOPIC_MISMATCH_THRESHOLD) {
        signals.push({
          type: "topic_mismatch",
          weight: TOPIC_MISMATCH_WEIGHT,
          detail: `Topic overlap ${(topicOverlap * 100).toFixed(1)}% < ${TOPIC_MISMATCH_THRESHOLD * 100}%`,
        });
      }
    }

    // 3. Files not accessed signal
    const factFiles = extractFileReferences(factText);
    if (factFiles.length > 0) {
      const filesAccessed = factFiles.filter((f) =>
        accessedFiles.has(f.toLowerCase()),
      );
      if (filesAccessed.length === 0) {
        signals.push({
          type: "files_not_accessed",
          weight: FILES_NOT_ACCESSED_WEIGHT,
          detail: `Fact mentions ${factFiles.length} files, none accessed`,
        });
      }
    }

    // Only add negative signal if we found at least one indicator
    if (signals.length > 0) {
      const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
      negativeSignals.push({
        factId: fact.factId,
        signals,
        ignoreConfidence: Math.min(totalWeight, MAX_IGNORE_CONFIDENCE),
      });
    }
  }

  return negativeSignals;
}

// =============================================================================
// Detection Pipeline
// =============================================================================

/**
 * Run the full detection pipeline
 */
export function runDetectionPipeline(
  conversationText: string | null,
  sessionActivity: SessionActivity | null,
  recalledFacts: RecalledFact[],
  config: FeedbackDetectionConfig = {},
): DetectionResults {
  const results: DetectionResults = {
    explicit: [],
    semantic: [],
    behavioral: [],
    negative: [],
  };

  // Run enabled detection strategies
  if (conversationText) {
    if (config.explicit !== false) {
      results.explicit = detectExplicitReferences(
        conversationText,
        recalledFacts,
      );
    }

    if (config.semantic !== false) {
      const threshold = config.semanticThreshold || SEMANTIC_THRESHOLD;
      results.semantic = detectSemanticMatches(
        conversationText,
        recalledFacts,
        threshold,
      );
    }
  }

  if (sessionActivity && config.behavioral !== false) {
    results.behavioral = detectBehavioralSignals(
      sessionActivity,
      recalledFacts,
    );
  }

  // Collect all used fact IDs for negative signal detection
  const usedFactIds = new Set([
    ...results.explicit.map((d) => d.factId),
    ...results.semantic.map((d) => d.factId),
    ...results.behavioral.map((d) => d.factId),
  ]);

  // Run negative signal detection
  results.negative = detectNegativeSignals(
    sessionActivity,
    recalledFacts,
    usedFactIds,
  );

  return results;
}
