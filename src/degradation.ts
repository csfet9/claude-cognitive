/**
 * DegradationController - manages graceful degradation when Hindsight is unavailable.
 * @module degradation
 */

import type { HindsightClient } from "./client.js";
import { HindsightError } from "./errors.js";
import type { TypedEventEmitter } from "./events.js";
import type { OfflineMemoryStore } from "./offline.js";

/**
 * Manages the degraded/offline state for Mind.
 *
 * Responsible for:
 * - Tracking whether Hindsight is available
 * - Entering/exiting degraded mode with event emission
 * - Attempting recovery and syncing offline memories
 * - Deciding whether errors should trigger degraded mode
 */
export class DegradationController {
  private degraded = false;
  private readonly emitter: TypedEventEmitter;

  constructor(emitter: TypedEventEmitter) {
    this.emitter = emitter;
  }

  /**
   * Whether the system is currently in degraded mode.
   */
  get isDegraded(): boolean {
    return this.degraded;
  }

  /**
   * Enter degraded mode.
   * Emits `degraded:change` and `error` events.
   */
  enterDegradedMode(reason: string): void {
    if (!this.degraded) {
      this.degraded = true;
      this.emitter.emit("degraded:change", true);
      this.emitter.emit("error", new Error(`Degraded mode: ${reason}`));
    }
  }

  /**
   * Exit degraded mode.
   * Emits `degraded:change` event.
   */
  exitDegradedMode(): void {
    if (this.degraded) {
      this.degraded = false;
      this.emitter.emit("degraded:change", false);
    }
  }

  /**
   * Handle an error, potentially entering degraded mode if the error
   * indicates Hindsight is unavailable.
   */
  handleError(error: unknown, operation: string): void {
    const err = error instanceof Error ? error : new Error(String(error));

    if (HindsightError.isHindsightError(error) && error.isUnavailable) {
      this.enterDegradedMode(`${operation}: ${err.message}`);
    }

    this.emitter.emit("error", err);
  }

  /**
   * Attempt to recover from degraded mode.
   * If successful, ensures the bank exists and syncs offline memories.
   *
   * @param client - The HindsightClient to check health on
   * @param ensureBank - Callback to ensure the bank exists after recovery
   * @param offlineStore - The offline store to sync from
   * @param bankId - The bank ID to sync memories to
   * @returns True if recovery was successful
   */
  async attemptRecovery(
    client: HindsightClient | null,
    ensureBank: () => Promise<void>,
    offlineStore: OfflineMemoryStore | null,
    bankId: string,
  ): Promise<boolean> {
    if (!this.degraded || !client) {
      return !this.degraded;
    }

    const health = await client.health();
    if (health.healthy) {
      this.exitDegradedMode();
      await ensureBank();
      await this.syncOfflineMemories(client, offlineStore, bankId);
      return true;
    }

    return false;
  }

  /**
   * Sync offline memories to Hindsight.
   *
   * @param client - The HindsightClient to sync to
   * @param offlineStore - The offline store to sync from
   * @param bankId - The bank ID to retain memories under
   * @returns Number of memories synced
   */
  async syncOfflineMemories(
    client: HindsightClient | null,
    offlineStore: OfflineMemoryStore | null,
    bankId: string,
  ): Promise<number> {
    if (!client || this.degraded || !offlineStore) {
      return 0;
    }

    try {
      await offlineStore.recordSyncAttempt();
      const unsynced = await offlineStore.getUnsynced();

      if (unsynced.length === 0) {
        return 0;
      }

      const syncedIds: string[] = [];

      for (const memory of unsynced) {
        try {
          const retainInput: {
            bankId: string;
            content: string;
            context?: string;
          } = {
            bankId,
            content: memory.text,
          };
          if (memory.context !== undefined) retainInput.context = memory.context;

          await client.retain(retainInput);
          syncedIds.push(memory.id);
        } catch (error) {
          this.emitter.emit(
            "error",
            error instanceof Error
              ? error
              : new Error(`Failed to sync memory ${memory.id}`),
          );
          break;
        }
      }

      if (syncedIds.length > 0) {
        await offlineStore.markSynced(syncedIds);
        this.emitter.emit("offline:synced", { count: syncedIds.length });
        await offlineStore.clearSynced();
      }

      return syncedIds.length;
    } catch (error) {
      this.emitter.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  /**
   * Reset degradation state (used by dispose).
   */
  reset(): void {
    this.degraded = false;
  }
}
