/**
 * Event system for claude-mind Mind class.
 * @module events
 */

import { EventEmitter } from "node:events";
import type { Memory, Opinion } from "./types.js";

// ============================================
// Event Types
// ============================================

/**
 * Observation that may be promoted to semantic memory.
 */
export interface Observation {
  /** The observation text */
  text: string;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Source identifier (e.g., session ID, reflect query) */
  source: string;
}

/**
 * Event map defining all Mind events and their payload types.
 *
 * Each event is defined as a tuple of arguments that will be passed
 * to listeners when the event is emitted.
 */
export interface MindEventMap {
  /** Emitted when Mind is initialized and ready */
  ready: [];

  /** Emitted when memories are recalled */
  "memory:recalled": [memories: Memory[]];

  /** Emitted when content is retained */
  "memory:retained": [content: string];

  /** Emitted when an opinion is formed via reflect() */
  "opinion:formed": [opinion: Opinion];

  /** Emitted when an observation is promoted to semantic memory */
  "observation:promoted": [observation: Observation];

  /** Emitted when degraded mode is entered or exited */
  "degraded:change": [degraded: boolean];

  /** Emitted when learn() operation starts */
  "learn:start": [options: { depth: string }];

  /** Emitted when learn() operation completes */
  "learn:complete": [result: { summary: string; worldFacts: number }];

  /** Emitted when agent context is prepared for delegation */
  "agent:context-prepared": [info: { agent: string; task: string }];

  /** Emitted on errors (non-fatal, allows continued operation) */
  error: [error: Error];
}

/**
 * Event names as a union type.
 */
export type MindEventName = keyof MindEventMap;

// ============================================
// Typed EventEmitter
// ============================================

/**
 * Type-safe EventEmitter for Mind class.
 *
 * Provides compile-time checking for event names and listener signatures.
 * Extends the native Node.js EventEmitter with typed methods.
 *
 * @example
 * ```typescript
 * const emitter = new TypedEventEmitter();
 *
 * // Type-safe listener - compiler knows memories is Memory[]
 * emitter.on('memory:recalled', (memories) => {
 *   console.log(`Recalled ${memories.length} memories`);
 * });
 *
 * // Type-safe emit - compiler checks argument types
 * emitter.emit('memory:recalled', [{ id: '1', text: 'test', factType: 'world' }]);
 *
 * // Compile error: wrong event name
 * emitter.on('invalid-event', () => {}); // Error!
 *
 * // Compile error: wrong argument type
 * emitter.emit('memory:recalled', 'not an array'); // Error!
 * ```
 */
export class TypedEventEmitter extends EventEmitter {
  /**
   * Add a listener for the specified event.
   *
   * @param event - Event name
   * @param listener - Event handler function
   * @returns This emitter for chaining
   */
  on<K extends MindEventName>(
    event: K,
    listener: (...args: MindEventMap[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Add a one-time listener for the specified event.
   * The listener is removed after the first invocation.
   *
   * @param event - Event name
   * @param listener - Event handler function
   * @returns This emitter for chaining
   */
  once<K extends MindEventName>(
    event: K,
    listener: (...args: MindEventMap[K]) => void,
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Remove a listener for the specified event.
   *
   * @param event - Event name
   * @param listener - Event handler function to remove
   * @returns This emitter for chaining
   */
  off<K extends MindEventName>(
    event: K,
    listener: (...args: MindEventMap[K]) => void,
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Emit an event with type-safe arguments.
   *
   * @param event - Event name
   * @param args - Event arguments (type-checked against MindEventMap)
   * @returns True if the event had listeners, false otherwise
   */
  emit<K extends MindEventName>(event: K, ...args: MindEventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Add a listener to the beginning of the listeners array.
   *
   * @param event - Event name
   * @param listener - Event handler function
   * @returns This emitter for chaining
   */
  prependListener<K extends MindEventName>(
    event: K,
    listener: (...args: MindEventMap[K]) => void,
  ): this {
    return super.prependListener(
      event,
      listener as (...args: unknown[]) => void,
    );
  }

  /**
   * Add a one-time listener to the beginning of the listeners array.
   *
   * @param event - Event name
   * @param listener - Event handler function
   * @returns This emitter for chaining
   */
  prependOnceListener<K extends MindEventName>(
    event: K,
    listener: (...args: MindEventMap[K]) => void,
  ): this {
    return super.prependOnceListener(
      event,
      listener as (...args: unknown[]) => void,
    );
  }

  /**
   * Remove all listeners for the specified event, or all events if none specified.
   *
   * @param event - Optional event name
   * @returns This emitter for chaining
   */
  removeAllListeners(event?: MindEventName): this {
    return super.removeAllListeners(event);
  }

  /**
   * Get the number of listeners for the specified event.
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: MindEventName): number {
    return super.listenerCount(event);
  }
}
