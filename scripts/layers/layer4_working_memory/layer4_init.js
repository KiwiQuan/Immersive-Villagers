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

import { initializeWorkingMemory, hasWorkingMemory } from "./working_memory_helpers.js";
import { startWorkingMemorySyncLoop } from "./working_memory_sync.js";

let syncLoopStarted = false;

/**
 * Initializes Working Memory for a specific villager.
 * Called by villager_lifecycle.js when a new villager is detected.
 * 
 * @param {Entity} villager - The villager entity to initialize
 * @returns {boolean} True if initialization succeeded
 * 
 * @example
 * import { initializeLayer4ForVillager } from "../layers/layer4_working_memory/layer4_init.js";
 * 
 * function handleNewVillager(villager) {
 *   await registerVillager(...);
 *   initializeLayer4ForVillager(villager);
 * }
 */
function initializeLayer4ForVillager(villager) {
  if (!villager || !villager.isValid) return false;
  
  if (hasWorkingMemory(villager)) {
    console.warn(
      `§e[Layer 4] Villager ${villager.id} already has Working Memory initialized`
    );
    return true;
  }
  
  return initializeWorkingMemory(villager);
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
