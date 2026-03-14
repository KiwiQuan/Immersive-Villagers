/**
 * Layer 4: Working Memory - Initialization Entry Point
 *
 * This module provides a single entry point for villager_lifecycle.js
 * to initialize Working Memory for new villagers.
 *
 * Responsibilities:
 * - Initialize DynamicProperties for new villagers
 * - Start the sync loop (runs once globally)
 *
 * @module layer4_init
 */

import {
  initializeWorkingMemory,
  hasWorkingMemory,
} from "./helpers/working_memory_helpers.js";
import { startWorkingMemorySyncLoop } from "./working_memory_sync.js";

let syncLoopStarted = false;

/**
 * Initializes Working Memory for a specific villager.
 * Called by villager_lifecycle.js when a new villager is detected.
 * Uses atomic backend lazy initialization - ensures villager exists first, then syncs WM.
 *
 * @param {Entity} villager - The villager entity to initialize
 * @returns {Promise<boolean>} True if initialization succeeded
 *
 * @example
 * import { initializeLayer4ForVillager } from "../layers/layer4_working_memory/layer4_init.js";
 *
 * function handleNewVillager(villager) {
 *   await initializeLayer4ForVillager(villager);
 * }
 */
async function initializeLayer4ForVillager(villager) {
  if (!villager || !villager.isValid) return false;

  // NOTE: No hasWorkingMemory() check - backend is idempotent
  // Always initialize to ensure BOTH DPs AND DB exist
  return await initializeWorkingMemory(villager);
}

/**
 * Initializes Layer 4 system (starts sync loop).
 * Should be called once during main script initialization.
 * Idempotent - safe to call multiple times.
 *
 * @example
 * import { initializeLayer4System } from "../layers/layer4_working_memory/layer4_init.js";
 *
 * // In main.js:
 * initializeLayer4System();
 */
function initializeLayer4System() {
  if (syncLoopStarted) {
    console.warn("§e[Layer 4] System already initialized, skipping");
    return;
  }

  startWorkingMemorySyncLoop();
  syncLoopStarted = true;

  console.warn("§a[Layer 4] Working Memory layer initialized");
}

export { initializeLayer4ForVillager, initializeLayer4System };
