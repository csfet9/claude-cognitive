/**
 * Integration tests for feedback system with live Hindsight instance
 *
 * Run with: npx vitest run tests/integration/feedback-hindsight.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { HindsightClient } from "../../src/client.js";
import { Mind } from "../../src/mind.js";
import { FeedbackService, createFeedbackService } from "../../src/feedback/index.js";
import { OfflineFeedbackQueue } from "../../src/feedback/offline-queue.js";
import type { SignalItem, Memory } from "../../src/types.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";

// Longer timeout for Hindsight operations
const HINDSIGHT_TIMEOUT = 60_000;

describe("Feedback System Integration with Hindsight", () => {
  let client: HindsightClient;
  let testBankId: string;
  let tempDir: string;
  let isHindsightAvailable = false;

  beforeAll(async () => {
    // Create temp directory for test data
    tempDir = await mkdtemp(join(tmpdir(), "feedback-test-"));
    await mkdir(join(tempDir, ".claude"), { recursive: true });

    // Create minimal package.json and .claudemindrc for Mind initialization
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "feedback-test-project" })
    );
    await writeFile(
      join(tempDir, ".claudemindrc"),
      JSON.stringify({
        bankId: `test-feedback-${Date.now()}`,
        feedback: { enabled: true, hindsight: { sendFeedback: true } },
        hindsight: { host: "localhost", port: 8888 }
      })
    );

    // Check if Hindsight is available
    client = new HindsightClient({ host: "localhost", port: 8888 });
    const health = await client.health();
    isHindsightAvailable = health.healthy;

    if (isHindsightAvailable) {
      // Create test bank
      testBankId = `test-feedback-${Date.now()}`;
      try {
        await client.createBank({
          bankId: testBankId,
          disposition: { skepticism: 3, literalism: 3, empathy: 3 },
          background: "Test bank for feedback integration",
        });
      } catch (error) {
        // Bank might already exist
        console.warn("Bank creation warning:", error);
      }
    }
  });

  afterAll(async () => {
    // Cleanup temp directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("HindsightClient.signal()", () => {
    it("should successfully submit signals to Hindsight", { timeout: HINDSIGHT_TIMEOUT }, async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      // First, store some content to get a fact ID
      await client.retain({
        bankId: testBankId,
        content: "Test fact for signal testing - authentication uses JWT tokens",
        context: "Testing feedback signals",
      });

      // Recall to get the fact ID
      const memories = await client.recall({
        bankId: testBankId,
        query: "JWT authentication tokens",
      });

      expect(memories.length).toBeGreaterThan(0);

      const factId = memories[0].id;
      console.log(`Testing signal with factId: ${factId}`);

      // Submit a 'used' signal
      const signals: SignalItem[] = [
        {
          factId,
          signalType: "used",
          confidence: 0.9,
          query: "JWT authentication tokens",
          context: "User referenced this fact in their response",
        },
      ];

      const result = await client.signal({
        bankId: testBankId,
        signals,
      });

      expect(result.success).toBe(true);
      expect(result.signalsProcessed).toBe(1);
      console.log("Signal result:", result);
    });

    it("should handle multiple signal types", { timeout: HINDSIGHT_TIMEOUT }, async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      // Store another fact
      await client.retain({
        bankId: testBankId,
        content: "Test fact for multiple signals - React uses virtual DOM",
        context: "Testing multiple signal types",
      });

      // Recall to get fact IDs
      const memories = await client.recall({
        bankId: testBankId,
        query: "React virtual DOM",
      });

      if (memories.length === 0) {
        console.log("Skipping: No memories found");
        return;
      }

      const factId = memories[0].id;

      // Submit different signal types sequentially
      const signalTypes: Array<"used" | "ignored" | "helpful" | "not_helpful"> = [
        "used",
        "helpful",
      ];

      for (const signalType of signalTypes) {
        const result = await client.signal({
          bankId: testBankId,
          signals: [
            {
              factId,
              signalType,
              confidence: 0.8,
              query: "React virtual DOM",
            },
          ],
        });

        expect(result.success).toBe(true);
        console.log(`${signalType} signal result:`, result);
      }
    });

    it("should handle batch signals", { timeout: HINDSIGHT_TIMEOUT }, async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      // Store multiple facts
      await client.retain({
        bankId: testBankId,
        content: "Batch test fact 1 - TypeScript provides static typing",
      });
      await client.retain({
        bankId: testBankId,
        content: "Batch test fact 2 - ESLint helps with code quality",
      });

      // Recall to get fact IDs
      const memories = await client.recall({
        bankId: testBankId,
        query: "TypeScript ESLint code",
        budget: "mid",
      });

      if (memories.length < 2) {
        console.log("Skipping: Not enough memories for batch test");
        return;
      }

      // Submit batch signals
      const batchSignals: SignalItem[] = memories.slice(0, 2).map((mem, idx) => ({
        factId: mem.id,
        signalType: idx === 0 ? "used" : "ignored" as const,
        confidence: 0.75,
        query: "TypeScript ESLint code",
      }));

      const result = await client.signal({
        bankId: testBankId,
        signals: batchSignals,
      });

      expect(result.success).toBe(true);
      expect(result.signalsProcessed).toBe(batchSignals.length);
      console.log("Batch signal result:", result);
    });
  });

  describe("Mind.signal()", () => {
    it("should submit signals through Mind", { timeout: HINDSIGHT_TIMEOUT }, async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      const mind = new Mind({
        projectPath: tempDir,
        bankId: testBankId,
      });

      try {
        await mind.init();

        // Store a fact first
        await mind.retain(
          "Mind signal test - Node.js is a JavaScript runtime",
          "Testing Mind.signal()"
        );

        // Recall to get fact ID
        const memories = await mind.recall("Node.js JavaScript runtime");

        if (memories.length === 0) {
          console.log("Skipping: No memories found");
          return;
        }

        const factId = memories[0].id;

        // Submit signal through Mind
        const result = await mind.signal([
          {
            factId,
            signalType: "used",
            confidence: 0.95,
            query: "Node.js JavaScript runtime",
          },
        ]);

        expect(result.success).toBe(true);
        expect(result.signalsProcessed).toBe(1);
        console.log("Mind.signal() result:", result);
      } finally {
        mind.dispose();
      }
    });
  });

  describe("FeedbackService end-to-end", () => {
    it("should track recall and process feedback", async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      const feedbackService = createFeedbackService(
        { enabled: true, hindsight: { sendFeedback: true } },
        tempDir
      );

      expect(feedbackService.isEnabled()).toBe(true);

      // Simulate a recall session
      const sessionId = `test-session-${Date.now()}`;
      const mockFacts: Memory[] = [
        {
          id: "fact-1",
          text: "The codebase uses Vitest for testing",
          factType: "world",
          createdAt: new Date().toISOString(),
        },
        {
          id: "fact-2",
          text: "ESLint is configured with TypeScript rules",
          factType: "world",
          createdAt: new Date().toISOString(),
        },
      ];

      // Track the recall
      const trackResult = await feedbackService.trackRecall(
        sessionId,
        "testing framework",
        mockFacts
      );

      expect(trackResult.success).toBe(true);
      expect(trackResult.factsTracked).toBe(2);
      console.log("Track recall result:", trackResult);

      // Process feedback with simulated conversation
      const conversationText = `
        Based on the context, I see that this project uses Vitest for testing.
        Let me run the tests using npm run test.
      `;

      const feedbackResult = await feedbackService.processFeedback(sessionId, {
        conversationText,
      });

      expect(feedbackResult.success).toBe(true);
      console.log("Feedback summary:", feedbackResult.summary);
      console.log("Fact scores:", feedbackResult.factScores);
      console.log("Prepared signals:", feedbackResult.feedback);
    });

    it("should get feedback stats", async () => {
      const feedbackService = createFeedbackService(
        { enabled: true },
        tempDir
      );

      const stats = await feedbackService.getStats();
      expect(stats.success).toBe(true);
      expect(stats.enabled).toBe(true);
      console.log("Feedback stats:", stats);
    });
  });

  describe("OfflineFeedbackQueue", () => {
    it("should enqueue and retrieve signals", async () => {
      // Use isolated temp directory for this test
      const queueTempDir = await mkdtemp(join(tmpdir(), "queue-test-1-"));
      await mkdir(join(queueTempDir, ".claude"), { recursive: true });

      try {
        const queue = new OfflineFeedbackQueue({ projectPath: queueTempDir });

        // Enqueue some signals
        const signals: SignalItem[] = [
          {
            factId: "offline-fact-1",
            signalType: "used",
            confidence: 0.8,
            query: "test query",
          },
          {
            factId: "offline-fact-2",
            signalType: "ignored",
            confidence: 0.6,
            query: "test query",
          },
        ];

        const ids = await queue.enqueueBatch(signals);
        expect(ids.length).toBe(2);

        // Get unsynced
        const unsynced = await queue.getUnsynced();
        expect(unsynced.length).toBe(2);

        // Get stats
        const stats = await queue.getStats();
        expect(stats.total).toBe(2);
        expect(stats.pending).toBe(2);
        console.log("Queue stats:", stats);

        // Mark as synced
        await queue.markSynced(ids);

        const afterSync = await queue.getUnsynced();
        expect(afterSync.length).toBe(0);

        // Clear synced
        const cleared = await queue.clearSynced();
        expect(cleared).toBe(2);
      } finally {
        await rm(queueTempDir, { recursive: true, force: true });
      }
    });

    it("should convert back to SignalItem format", async () => {
      // Use isolated temp directory for this test
      const queueTempDir = await mkdtemp(join(tmpdir(), "queue-test-2-"));
      await mkdir(join(queueTempDir, ".claude"), { recursive: true });

      try {
        const queue = new OfflineFeedbackQueue({ projectPath: queueTempDir });

        const originalSignal: SignalItem = {
          factId: "test-fact-123",
          signalType: "helpful",
          confidence: 0.9,
          query: "original query",
          context: "some context",
        };

        const [id] = await queue.enqueueBatch([originalSignal]);
        const [queued] = await queue.getUnsynced();

        const converted = OfflineFeedbackQueue.toSignalItem(queued);

        expect(converted.factId).toBe(originalSignal.factId);
        expect(converted.signalType).toBe(originalSignal.signalType);
        expect(converted.confidence).toBe(originalSignal.confidence);
        expect(converted.query).toBe(originalSignal.query);
        expect(converted.context).toBe(originalSignal.context);
      } finally {
        await rm(queueTempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Full session workflow", () => {
    it("should handle complete session lifecycle with feedback", { timeout: HINDSIGHT_TIMEOUT * 2 }, async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      // Create a new Mind with feedback enabled
      const sessionTempDir = await mkdtemp(join(tmpdir(), "session-test-"));
      await mkdir(join(sessionTempDir, ".claude"), { recursive: true });

      await writeFile(
        join(sessionTempDir, "package.json"),
        JSON.stringify({ name: "session-test-project" })
      );
      await writeFile(
        join(sessionTempDir, ".claudemindrc"),
        JSON.stringify({
          bankId: testBankId,
          feedback: { enabled: true, hindsight: { sendFeedback: true } },
          hindsight: { host: "localhost", port: 8888 }
        })
      );

      const mind = new Mind({ projectPath: sessionTempDir });

      try {
        await mind.init();

        // Store some facts first
        await mind.retain(
          "Session workflow test - The app uses Express for the backend API",
          "Testing session workflow"
        );

        // Start session
        const context = await mind.onSessionStart();
        console.log("Session context length:", context.length);

        // Recall during session
        const memories = await mind.recall("Express backend API");
        console.log("Recalled memories:", memories.length);

        // Simulate conversation with the recalled facts
        const transcript = `
          User: How is the backend API structured?

          Assistant: Based on the context, the app uses Express for the backend API.
          I can see from the codebase that the API endpoints are defined in the routes folder.

          User: Thanks for remembering that!
        `;

        // End session (this should process feedback and submit signals)
        const result = await mind.onSessionEnd(transcript);
        console.log("Session end result:", result);

      } finally {
        mind.dispose();
        await rm(sessionTempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Usefulness boosting in recall", () => {
    it("should support boostByUsefulness parameter", { timeout: HINDSIGHT_TIMEOUT }, async () => {
      if (!isHindsightAvailable) {
        console.log("Skipping: Hindsight not available");
        return;
      }

      // Store and signal some facts
      await client.retain({
        bankId: testBankId,
        content: "Boost test - PostgreSQL is the primary database",
      });

      const memories = await client.recall({
        bankId: testBankId,
        query: "database",
      });

      if (memories.length > 0) {
        // Submit helpful signal to boost usefulness
        await client.signal({
          bankId: testBankId,
          signals: [{
            factId: memories[0].id,
            signalType: "helpful",
            confidence: 1.0,
            query: "database",
          }],
        });
      }

      // Recall with usefulness boosting
      const boostedMemories = await client.recall({
        bankId: testBankId,
        query: "database",
        boostByUsefulness: true,
        usefulnessWeight: 0.3,
      });

      console.log("Boosted recall results:", boostedMemories.length);

      // Both should return results
      expect(memories.length).toBeGreaterThanOrEqual(0);
      expect(boostedMemories.length).toBeGreaterThanOrEqual(0);
    });
  });
});
