/**
 * Offline feedback signal queue for degraded mode.
 * Stores feedback signals locally when Hindsight is unavailable.
 * Auto-syncs to Hindsight when connection is restored.
 * @module feedback/offline-queue
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SignalItem } from "../types.js";

/**
 * A feedback signal stored offline with queue metadata.
 */
export interface OfflineSignal extends SignalItem {
  /** Local queue ID */
  id: string;
  /** When queued (ISO 8601) */
  queuedAt: string;
  /** Whether this has been synced to Hindsight */
  synced: boolean;
}

/**
 * Offline queue file structure.
 */
interface OfflineQueueStore {
  /** Version for future migrations */
  version: 1;
  /** Queued signals */
  signals: OfflineSignal[];
  /** Last sync attempt timestamp */
  lastSyncAttempt?: string;
  /** Last successful sync timestamp */
  lastSyncSuccess?: string;
}

/**
 * Options for OfflineFeedbackQueue.
 */
export interface OfflineFeedbackQueueOptions {
  /** Project root directory */
  projectPath: string;
  /** Custom storage file path (default: .claude/offline-feedback.json) */
  storagePath?: string;
}

/**
 * Queue statistics.
 */
export interface QueueStats {
  /** Total signals in queue */
  total: number;
  /** Signals pending sync */
  pending: number;
  /** Signals already synced */
  synced: number;
  /** Last sync attempt */
  lastSyncAttempt?: string;
  /** Last successful sync */
  lastSyncSuccess?: string;
}

/**
 * Local file-based feedback signal queue for offline/degraded mode.
 */
export class OfflineFeedbackQueue {
  private readonly filePath: string;
  private store: OfflineQueueStore | null = null;

  constructor(options: OfflineFeedbackQueueOptions) {
    this.filePath =
      options.storagePath ??
      join(options.projectPath, ".claude", "offline-feedback.json");
  }

  /**
   * Get the storage file path.
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Load the store from disk.
   */
  private async load(): Promise<OfflineQueueStore> {
    if (this.store) {
      return this.store;
    }

    try {
      const content = await readFile(this.filePath, "utf-8");
      this.store = JSON.parse(content) as OfflineQueueStore;
    } catch {
      // File doesn't exist or is invalid - create empty store
      this.store = {
        version: 1,
        signals: [],
      };
    }

    return this.store;
  }

  /**
   * Save the store to disk.
   */
  private async save(): Promise<void> {
    if (!this.store) return;

    // Ensure directory exists
    await mkdir(dirname(this.filePath), { recursive: true });

    await writeFile(
      this.filePath,
      JSON.stringify(this.store, null, 2),
      "utf-8",
    );
  }

  /**
   * Generate a unique ID for queued signals.
   */
  private generateId(): string {
    return `signal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Queue a single feedback signal.
   * @returns The queue ID assigned to this signal
   */
  async enqueue(signal: SignalItem): Promise<string> {
    const store = await this.load();

    const offlineSignal: OfflineSignal = {
      ...signal,
      id: this.generateId(),
      queuedAt: new Date().toISOString(),
      synced: false,
    };

    store.signals.push(offlineSignal);
    await this.save();

    return offlineSignal.id;
  }

  /**
   * Queue multiple feedback signals atomically.
   * @returns Array of queue IDs assigned to the signals
   */
  async enqueueBatch(signals: SignalItem[]): Promise<string[]> {
    if (signals.length === 0) {
      return [];
    }

    const store = await this.load();
    const ids: string[] = [];

    for (const signal of signals) {
      const offlineSignal: OfflineSignal = {
        ...signal,
        id: this.generateId(),
        queuedAt: new Date().toISOString(),
        synced: false,
      };
      store.signals.push(offlineSignal);
      ids.push(offlineSignal.id);
    }

    await this.save();
    return ids;
  }

  /**
   * Get all unsynced signals.
   */
  async getUnsynced(): Promise<OfflineSignal[]> {
    const store = await this.load();
    return store.signals.filter((s) => !s.synced);
  }

  /**
   * Mark signals as synced.
   */
  async markSynced(ids: string[]): Promise<void> {
    const store = await this.load();
    const idSet = new Set(ids);

    for (const signal of store.signals) {
      if (idSet.has(signal.id)) {
        signal.synced = true;
      }
    }

    store.lastSyncSuccess = new Date().toISOString();
    await this.save();
  }

  /**
   * Record a sync attempt (even if it failed).
   */
  async recordSyncAttempt(): Promise<void> {
    const store = await this.load();
    store.lastSyncAttempt = new Date().toISOString();
    await this.save();
  }

  /**
   * Clear all synced signals to save space.
   * @returns Number of signals cleared
   */
  async clearSynced(): Promise<number> {
    const store = await this.load();
    const before = store.signals.length;
    store.signals = store.signals.filter((s) => !s.synced);
    await this.save();
    return before - store.signals.length;
  }

  /**
   * Get signal count.
   */
  async count(): Promise<number> {
    const store = await this.load();
    return store.signals.length;
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<QueueStats> {
    const store = await this.load();
    const pending = store.signals.filter((s) => !s.synced).length;
    const synced = store.signals.filter((s) => s.synced).length;

    const stats: QueueStats = {
      total: store.signals.length,
      pending,
      synced,
    };

    // Only include optional properties if they have values
    if (store.lastSyncAttempt !== undefined) {
      stats.lastSyncAttempt = store.lastSyncAttempt;
    }
    if (store.lastSyncSuccess !== undefined) {
      stats.lastSyncSuccess = store.lastSyncSuccess;
    }

    return stats;
  }

  /**
   * Clear all signals.
   */
  async clear(): Promise<void> {
    this.store = {
      version: 1,
      signals: [],
    };
    await this.save();
  }

  /**
   * Convert OfflineSignal to SignalItem (strip queue metadata).
   */
  static toSignalItem(offline: OfflineSignal): SignalItem {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, queuedAt, synced, ...signal } = offline;
    return signal;
  }
}
