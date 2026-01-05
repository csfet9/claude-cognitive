/**
 * Tests for OfflineFeedbackQueue
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OfflineFeedbackQueue, type OfflineSignal } from "../../../src/feedback/offline-queue.js";
import type { SignalItem } from "../../../src/types.js";

// In-memory store for tests
let mockStore: {
  version: 1;
  signals: OfflineSignal[];
  lastSyncAttempt?: string;
  lastSyncSuccess?: string;
} | null = null;

// Mock fs/promises module
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockImplementation(async () => {
    if (mockStore === null) {
      throw new Error("ENOENT");
    }
    return JSON.stringify(mockStore);
  }),
  writeFile: vi.fn().mockImplementation(async (_path: string, content: string) => {
    mockStore = JSON.parse(content);
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("OfflineFeedbackQueue", () => {
  const projectPath = "/test/project";
  const storagePath = "/test/project/.claude/offline-feedback.json";

  beforeEach(() => {
    mockStore = null;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should use default storage path", () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      expect(queue.getFilePath()).toBe(storagePath);
    });

    it("should use custom storage path", () => {
      const customPath = "/custom/path/queue.json";
      const queue = new OfflineFeedbackQueue({
        projectPath,
        storagePath: customPath,
      });
      expect(queue.getFilePath()).toBe(customPath);
    });
  });

  describe("enqueue", () => {
    it("should enqueue a single signal", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const signal: SignalItem = {
        factId: "fact-1",
        signalType: "used",
        sessionId: "session-1",
      };

      const id = await queue.enqueue(signal);

      expect(id).toMatch(/^signal-\d+-[a-z0-9]+$/);
      expect(await queue.count()).toBe(1);
    });

    it("should store all signal properties", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const signal: SignalItem = {
        factId: "fact-1",
        signalType: "helpful",
        sessionId: "session-1",
        confidence: 0.9,
        evidence: { trigger: "test" },
      };

      await queue.enqueue(signal);
      const unsynced = await queue.getUnsynced();

      expect(unsynced[0]).toMatchObject({
        factId: "fact-1",
        signalType: "helpful",
        sessionId: "session-1",
        confidence: 0.9,
        evidence: { trigger: "test" },
        synced: false,
      });
      expect(unsynced[0].queuedAt).toBeDefined();
      expect(unsynced[0].id).toBeDefined();
    });
  });

  describe("enqueueBatch", () => {
    it("should enqueue multiple signals", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const signals: SignalItem[] = [
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "ignored", sessionId: "session-1" },
        { factId: "fact-3", signalType: "helpful", sessionId: "session-1" },
      ];

      const ids = await queue.enqueueBatch(signals);

      expect(ids).toHaveLength(3);
      expect(await queue.count()).toBe(3);
    });

    it("should return empty array for empty input", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const ids = await queue.enqueueBatch([]);
      expect(ids).toHaveLength(0);
      expect(await queue.count()).toBe(0);
    });

    it("should assign unique IDs to each signal", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const signals: SignalItem[] = [
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "used", sessionId: "session-1" },
      ];

      const ids = await queue.enqueueBatch(signals);
      expect(new Set(ids).size).toBe(2); // All IDs unique
    });
  });

  describe("getUnsynced", () => {
    it("should return only unsynced signals", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });

      // Enqueue some signals
      await queue.enqueueBatch([
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "ignored", sessionId: "session-1" },
      ]);

      // Mark first as synced
      const unsynced = await queue.getUnsynced();
      await queue.markSynced([unsynced[0].id]);

      // Should only return the second one
      const remaining = await queue.getUnsynced();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].factId).toBe("fact-2");
    });

    it("should return empty array when no signals", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const unsynced = await queue.getUnsynced();
      expect(unsynced).toHaveLength(0);
    });
  });

  describe("markSynced", () => {
    it("should mark specific signals as synced", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const ids = await queue.enqueueBatch([
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "ignored", sessionId: "session-1" },
        { factId: "fact-3", signalType: "helpful", sessionId: "session-1" },
      ]);

      await queue.markSynced([ids[0], ids[2]]);

      const unsynced = await queue.getUnsynced();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].factId).toBe("fact-2");
    });

    it("should update lastSyncSuccess timestamp", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const id = await queue.enqueue({
        factId: "fact-1",
        signalType: "used",
        sessionId: "session-1",
      });

      await queue.markSynced([id]);

      const stats = await queue.getStats();
      expect(stats.lastSyncSuccess).toBeDefined();
    });
  });

  describe("recordSyncAttempt", () => {
    it("should update lastSyncAttempt timestamp", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      await queue.recordSyncAttempt();

      const stats = await queue.getStats();
      expect(stats.lastSyncAttempt).toBeDefined();
    });
  });

  describe("clearSynced", () => {
    it("should remove synced signals", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const ids = await queue.enqueueBatch([
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "ignored", sessionId: "session-1" },
      ]);

      await queue.markSynced([ids[0]]);
      const cleared = await queue.clearSynced();

      expect(cleared).toBe(1);
      expect(await queue.count()).toBe(1);
    });

    it("should return 0 when no synced signals", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      await queue.enqueue({
        factId: "fact-1",
        signalType: "used",
        sessionId: "session-1",
      });

      const cleared = await queue.clearSynced();
      expect(cleared).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const ids = await queue.enqueueBatch([
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "ignored", sessionId: "session-1" },
        { factId: "fact-3", signalType: "helpful", sessionId: "session-1" },
      ]);

      await queue.markSynced([ids[0]]);

      const stats = await queue.getStats();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(2);
      expect(stats.synced).toBe(1);
    });

    it("should not include undefined timestamps", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      const stats = await queue.getStats();

      expect(stats).toEqual({
        total: 0,
        pending: 0,
        synced: 0,
      });
      expect("lastSyncAttempt" in stats).toBe(false);
      expect("lastSyncSuccess" in stats).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all signals", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      await queue.enqueueBatch([
        { factId: "fact-1", signalType: "used", sessionId: "session-1" },
        { factId: "fact-2", signalType: "ignored", sessionId: "session-1" },
      ]);

      await queue.clear();

      expect(await queue.count()).toBe(0);
    });
  });

  describe("toSignalItem", () => {
    it("should strip queue metadata", async () => {
      const queue = new OfflineFeedbackQueue({ projectPath });
      await queue.enqueue({
        factId: "fact-1",
        signalType: "used",
        sessionId: "session-1",
        confidence: 0.8,
      });

      const unsynced = await queue.getUnsynced();
      const signalItem = OfflineFeedbackQueue.toSignalItem(unsynced[0]);

      expect(signalItem).toEqual({
        factId: "fact-1",
        signalType: "used",
        sessionId: "session-1",
        confidence: 0.8,
      });
      expect("id" in signalItem).toBe(false);
      expect("queuedAt" in signalItem).toBe(false);
      expect("synced" in signalItem).toBe(false);
    });
  });

  describe("persistence", () => {
    it("should persist signals to disk", async () => {
      const queue1 = new OfflineFeedbackQueue({ projectPath });
      await queue1.enqueue({
        factId: "fact-1",
        signalType: "used",
        sessionId: "session-1",
      });

      // Create new queue instance - should load from "disk" (mockStore)
      const queue2 = new OfflineFeedbackQueue({ projectPath });
      expect(await queue2.count()).toBe(1);
    });
  });
});
