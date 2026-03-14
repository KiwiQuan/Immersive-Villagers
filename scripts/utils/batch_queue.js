/**
 * Generic Batch Queue System
 * 
 * Provides configurable batch processing with:
 * - Debounced or fixed timer modes
 * - Automatic deduplication
 * - Parallel processing
 * - Error handling and logging
 * 
 * Use Cases:
 * - Villager initialization (debounced, 10s delay for chunk loading)
 * - Working Memory sync (fixed, 200ms for frequent updates)
 * - Episode creation, relationship updates, etc.
 * 
 * @module batch_queue
 */

import { system } from "@minecraft/server";
import { isDebugMode } from "./debug_mode_helper.js";

/**
 * Creates a configurable batch queue processor.
 * 
 * @param {Object} config - Queue configuration
 * @param {string} config.name - Queue name for logging
 * @param {number} config.delayTicks - Ticks to wait before flushing
 * @param {boolean} config.debounced - If true, timer resets on each item (default: false)
 * @param {Function} config.getItemId - Function to extract unique ID from item for deduplication
 * @param {Function} config.processBatch - Async function to process batch (receives array)
 * @param {string} config.logPrefix - Console log prefix (e.g., "§b[Lifecycle]")
 * 
 * @returns {Object} Queue controller with add() and flush() methods
 * 
 * @example
 * // Debounced queue (for chunk loading)
 * const initQueue = createBatchQueue({
 *   name: "Villager Init",
 *   delayTicks: 200,
 *   debounced: true,
 *   getItemId: (villager) => villager.id,
 *   processBatch: async (batch) => {
 *     // Process all villagers in parallel
 *   },
 *   logPrefix: "§b[Lifecycle]"
 * });
 * 
 * initQueue.add(villager);
 * 
 * @example
 * // Fixed-delay queue (for frequent updates)
 * const syncQueue = createBatchQueue({
 *   name: "WM Sync",
 *   delayTicks: 4,
 *   debounced: false,
 *   getItemId: (wm) => wm.villagerID,
 *   processBatch: async (batch) => {
 *     await postRequest("/api/memory/sync", { memories: batch });
 *   },
 *   logPrefix: "§b[Layer 4]"
 * });
 * 
 * syncQueue.add(workingMemory);
 */
export function createBatchQueue(config) {
  const {
    name,
    delayTicks,
    debounced = false,
    getItemId,
    processBatch,
    logPrefix = "§b[Queue]",
  } = config;

  // Validate required config
  if (!name || !delayTicks || !getItemId || !processBatch) {
    throw new Error(
      "createBatchQueue requires: name, delayTicks, getItemId, processBatch"
    );
  }

  // Internal state
  const queue = [];
  const queueSet = new Set(); // For deduplication
  let flushHandle = null;

  /**
   * Adds item to queue and schedules flush.
   * @param {*} item - Item to add (any type)
   */
  function add(item) {
    const itemId = getItemId(item);

    // Skip if already queued (deduplication)
    if (queueSet.has(itemId)) {
      return;
    }

    queue.push(item);
    queueSet.add(itemId);

    // Debounced mode: Reset timer on each addition
    if (debounced && flushHandle) {
      system.clearRun(flushHandle);
      if (isDebugMode()) {
        console.warn(
          `${logPrefix} Queued ${String(itemId).substring(0, 12)} (timer reset, batch at ${queue.length})`
        );
      }
    }

    // Schedule flush if not already scheduled (fixed mode)
    // OR if timer was just cleared (debounced mode)
    if (!flushHandle || debounced) {
      if (!debounced && queue.length === 1 && isDebugMode()) {
        // Fixed mode: Only log on first item (debug only)
        console.warn(`${logPrefix} Started ${name} batch timer (${delayTicks} ticks)...`);
      }
      flushHandle = system.runTimeout(() => flush(), delayTicks);
    }
  }

  /**
   * Flushes queue immediately (can be called manually).
   * @returns {Promise<void>}
   */
  async function flush() {
    flushHandle = null;

    if (queue.length === 0) return;

    const batch = [...queue];
    queue.length = 0;
    queueSet.clear();

    if (isDebugMode()) {
      console.warn(`${logPrefix} Flushing ${name} batch: ${batch.length} items`);
    }

    try {
      await processBatch(batch);
    } catch (error) {
      console.warn(`${logPrefix} ${name} batch processing failed: ${error.message}`);
    }
  }

  /**
   * Clears queue without processing.
   */
  function clear() {
    if (flushHandle) {
      system.clearRun(flushHandle);
      flushHandle = null;
    }
    
    const count = queue.length;
    queue.length = 0;
    queueSet.clear();
    
    if (count > 0) {
      console.warn(`${logPrefix} Cleared ${name} queue (${count} items discarded)`);
    }
  }

  /**
   * Gets current queue size.
   * @returns {number}
   */
  function size() {
    return queue.length;
  }

  return {
    add,
    flush,
    clear,
    size,
  };
}
