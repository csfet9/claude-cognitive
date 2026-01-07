/**
 * Offline memory storage for degraded mode.
 * Stores memories locally when Hindsight is unavailable.
 * Auto-syncs to Hindsight when connection is restored.
 * @module offline
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import type { Memory, FactType } from "./types.js";

/**
 * A memory stored offline (simplified version of Memory).
 */
export interface OfflineMemory {
  /** Unique identifier (generated locally) */
  id: string;
  /** The memory content */
  text: string;
  /** Memory classification */
  factType: FactType;
  /** Optional context */
  context?: string;
  /** When stored (ISO 8601) */
  createdAt: string;
  /** Confidence for opinions */
  confidence?: number;
  /** Whether this has been synced to Hindsight */
  synced: boolean;
}

/**
 * Offline storage file structure.
 */
interface OfflineStore {
  /** Version for future migrations */
  version: 1;
  /** Stored memories */
  memories: OfflineMemory[];
  /** Last sync attempt timestamp */
  lastSyncAttempt?: string;
  /** Last successful sync timestamp */
  lastSyncSuccess?: string;
}

/**
 * Options for OfflineMemoryStore.
 */
export interface OfflineMemoryStoreOptions {
  /** Project root directory */
  projectPath: string;
  /** Custom storage file path (default: .claude/offline-memories.json) */
  storagePath?: string;
}

/**
 * Local file-based memory storage for offline/degraded mode.
 */
export class OfflineMemoryStore {
  private readonly filePath: string;
  private store: OfflineStore | null = null;

  constructor(options: OfflineMemoryStoreOptions) {
    const defaultPath = join(
      options.projectPath,
      ".claude",
      "offline-memories.json",
    );
    const storagePath = options.storagePath ?? defaultPath;

    // Validate the path is within the project directory
    const resolvedPath = resolve(options.projectPath, storagePath);
    const relativePath = relative(options.projectPath, resolvedPath);

    // Reject if path escapes project directory
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("Storage path must be within project directory");
    }
    this.filePath = resolvedPath;
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
  private async load(): Promise<OfflineStore> {
    if (this.store) {
      return this.store;
    }

    try {
      const content = await readFile(this.filePath, "utf-8");
      this.store = JSON.parse(content) as OfflineStore;
    } catch {
      // File doesn't exist or is invalid - create empty store
      this.store = {
        version: 1,
        memories: [],
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
   * Generate a unique ID for offline memories.
   */
  private generateId(): string {
    return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Store a memory offline.
   */
  async retain(
    text: string,
    factType: FactType,
    options?: { context?: string; confidence?: number },
  ): Promise<string> {
    const store = await this.load();

    const memory: OfflineMemory = {
      id: this.generateId(),
      text,
      factType,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    // Only add optional properties if they have values
    if (options?.context) {
      memory.context = options.context;
    }
    if (options?.confidence !== undefined) {
      memory.confidence = options.confidence;
    }

    store.memories.push(memory);
    await this.save();

    return memory.id;
  }

  /**
   * Recall memories matching a query.
   * Simple text-based search since we don't have Hindsight's semantic search.
   */
  async recall(
    query: string,
    options?: { factType?: FactType | "all"; limit?: number },
  ): Promise<OfflineMemory[]> {
    const store = await this.load();
    const queryLower = query.toLowerCase();
    const limit = options?.limit ?? 10;

    let memories = store.memories;

    // Filter by fact type if specified
    if (options?.factType && options.factType !== "all") {
      memories = memories.filter((m) => m.factType === options.factType);
    }

    // Simple text search
    const matches = memories
      .filter(
        (m) =>
          m.text.toLowerCase().includes(queryLower) ||
          m.context?.toLowerCase().includes(queryLower),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);

    return matches;
  }

  /**
   * Get recent memories (for session context injection).
   */
  async getRecent(limit: number = 5): Promise<OfflineMemory[]> {
    const store = await this.load();

    return store.memories
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Get all unsynced memories.
   */
  async getUnsynced(): Promise<OfflineMemory[]> {
    const store = await this.load();
    return store.memories.filter((m) => !m.synced);
  }

  /**
   * Mark memories as synced.
   */
  async markSynced(ids: string[]): Promise<void> {
    const store = await this.load();
    const idSet = new Set(ids);

    for (const memory of store.memories) {
      if (idSet.has(memory.id)) {
        memory.synced = true;
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
   * Get all memories.
   */
  async getAll(): Promise<OfflineMemory[]> {
    const store = await this.load();
    return [...store.memories];
  }

  /**
   * Get memory count.
   */
  async count(): Promise<number> {
    const store = await this.load();
    return store.memories.length;
  }

  /**
   * Clear all synced memories to save space.
   */
  async clearSynced(): Promise<number> {
    const store = await this.load();
    const before = store.memories.length;
    store.memories = store.memories.filter((m) => !m.synced);
    await this.save();
    return before - store.memories.length;
  }

  /**
   * Clear all memories.
   */
  async clear(): Promise<void> {
    this.store = {
      version: 1,
      memories: [],
    };
    await this.save();
  }

  /**
   * Convert offline memory to standard Memory format.
   */
  static toMemory(offline: OfflineMemory): Memory {
    const memory: Memory = {
      id: offline.id,
      text: offline.text,
      factType: offline.factType,
      createdAt: offline.createdAt,
    };

    // Only add optional properties if they have values
    if (offline.context) {
      memory.context = offline.context;
    }
    if (offline.confidence !== undefined) {
      memory.confidence = offline.confidence;
    }

    return memory;
  }
}
