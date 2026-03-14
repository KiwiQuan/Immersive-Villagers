/**
 * Villager Lifecycle - Canonical State
 *
 * SINGLE SOURCE OF TRUTH for villager state.
 * All layers consume this state instead of querying independently.
 *
 * @module lifecycle_state
 */

// ========================================
// CONFIGURATION
// ========================================

export const LIFECYCLE_CONFIG = {
  proximityRadius: 150, // blocks
  proximityInterval: 20, // ticks (1 second)
  notificationRadius: 200, // blocks (only notify nearby players)
};

// ========================================
// CANONICAL STATE
// ========================================

/**
 * Map of currently active villagers (within proximity of any player).
 * This is the SINGLE SOURCE OF TRUTH for active villagers.
 * 
 * "Fetch Once, Consume Everywhere" Pattern:
 * - Coordinator queries entities ONCE per tick
 * - Caches live entity references in this Map
 * - Layers iterate Map.values() or Map.entries() (zero queries needed!)
 * - O(1) lookups by ID (vs O(n) for array)
 * - Entities are valid for 1-2 ticks (fresh enough for sync)
 * 
 * @type {Map<string, Entity>} Map of villagerID → Entity reference
 * 
 * @example
 * // Iterate with both ID and entity:
 * for (const [villagerID, villager] of activeVillagers) {
 *   if (!villager.isValid) continue;
 *   // Process villager
 * }
 * 
 * // Check if villager is active:
 * if (activeVillagers.has(villagerID)) { ... }
 * 
 * // Get specific villager entity:
 * const villager = activeVillagers.get(villagerID);
 */
export const activeVillagers = new Map();

/**
 * Updates the active villagers Map with a fresh batch from proximity detection.
 * Clears old/dead references and replaces with new Map.
 * 
 * @param {Map<string, Entity>} newMap - Fresh Map of active villagers from this tick
 */
export function updateActiveVillagers(newMap) {
  activeVillagers.clear();
  for (const [id, entity] of newMap) {
    activeVillagers.set(id, entity);
  }
}

/**
 * Map of all tracked villagers with metadata.
 * Persists across active/inactive transitions.
 * 
 * "CACHE-FIRST" Pattern:
 * - trackedVillagers = PRIMARY SOURCE OF TRUTH (fast, proximity-independent!)
 * - DynamicProperties = persistence layer ONLY (backup/restore across script reloads)
 * - Database = remote backup (syncs periodically)
 * 
 * Write Flow:
 * 1. Write to cache (IMMEDIATE, no entity needed!)
 * 2. Mark needsDPSync=true (DPs need updating)
 * 3. Mark needsDBSync=true (DB needs updating)
 * 4. When entity in range → sync cache to DPs (async)
 * 5. Sync loop → sync cache to DB (async)
 * 
 * Benefits:
 * - Modify WM from ANY distance (no entity required!)
 * - Faster calculations (memory access vs entity.setDynamicProperty)
 * - AI logic works without proximity constraints
 * - DPs become "save file" not "runtime storage"
 * 
 * @type {Map<string, Object>}
 *
 * Metadata structure:
 * {
 *   firstSeen: number,         // Unix timestamp
 *   lastSeen: number,          // Unix timestamp
 *   location: Object,          // {x, y, z}
 *   nameTag: string,           // Villager name
 *   workingMemory: {           // PRIMARY WM STATE (source of truth!)
 *     currentMood: { C, V, I, S, X },
 *     currentFocus: string | null,
 *     shockState: boolean,
 *     lastUpdate: number,
 *     needsDPSync: boolean,    // True if DPs need updating from cache
 *     needsDBSync: boolean,    // True if DB needs updating from cache
 *     networkStatus: string,
 *     lastSyncSuccess: number | null
 *   } | null                   // null if not initialized yet
 * }
 */
export const trackedVillagers = new Map();

/**
 * System.runInterval handle for proximity detection loop.
 * Used to stop/restart the system.
 * @type {number|null}
 */
export let lifecycleHandle = null;

/**
 * Sets the lifecycle handle (called by coordinator).
 * @param {number|null} handle
 */
export function setLifecycleHandle(handle) {
  lifecycleHandle = handle;
}

// ========================================
// STATE QUERY FUNCTIONS
// ========================================

/**
 * Gets metadata for a tracked villager.
 *
 * @param {string} villagerID - Villager entity ID
 * @returns {Object|null} Metadata object or null if not tracked
 *
 * @example
 * const metadata = getVillagerMetadata(villagerID);
 * if (metadata) {
 *   console.log(`Villager: ${metadata.nameTag}`);
 * }
 */
export function getVillagerMetadata(villagerID) {
  return trackedVillagers.get(villagerID) || null;
}

/**
 * Checks if a villager is currently active.
 * 
 * @param {string} villagerID - Villager entity ID
 * @returns {boolean} True if villager is active
 * 
 * @example
 * if (isVillagerActive(villagerID)) {
 *   console.log("Villager is within proximity range");
 * }
 */
export function isVillagerActive(villagerID) {
  return activeVillagers.has(villagerID);
}

/**
 * Gets an active villager entity by ID.
 * O(1) lookup via Map.get().
 * 
 * @param {string} villagerID - Villager entity ID
 * @returns {Entity|undefined} Entity reference or undefined if not active
 * 
 * @example
 * const villager = getActiveVillagerEntity(villagerID);
 * if (villager && villager.isValid) {
 *   // Process villager
 * }
 */
export function getActiveVillagerEntity(villagerID) {
  return activeVillagers.get(villagerID);
}
