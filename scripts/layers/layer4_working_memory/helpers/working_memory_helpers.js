/**
 * Working Memory DynamicProperties Helper Functions
 * Handles reading, writing, and managing villager Working Memory state.
 *
 * @module working_memory_helpers
 */

import {
  WORKING_MEMORY_SCHEMA,
  getWorkingMemoryPropertyNames,
  getDefaultValue,
  validatePropertyValue,
} from "../working_memory_schema.js";
import { debugLog } from "../../../utils/debug_mode_helper.js";
import { getRequest, postRequest } from "../../../utils/network_helpers.js";
import { trackedVillagers } from "../../../systems/villager_lifecycle/lifecycle_state.js";
import {
  updateWorkingMemoryCache,
  getWorkingMemoryFromCache,
  hasWorkingMemoryInCache,
  initializeWorkingMemoryCache,
  syncCacheToDynamicProperties,
} from "./working_memory_chache.js";
import {
  hasWorkingMemoryInDB,
  getWorkingMemoryFromDB,
  compareWorkingMemoryCore,
} from "./working_memory_db.js";

// ========================================
// DYNAMIC PROPERTY OPERATIONS
// ========================================

/**
 * Reads all Working Memory properties from an entity's DynamicProperties.
 * @param {Entity} entity - The villager entity to read from
 * @returns {Object|null} Working Memory object or null if entity is invalid
 * @throws {Error} If entity is invalid or property read fails
 */
function getWorkingMemory(entity) {
  if (!entity || !entity.isValid) {
    debugLog("DynamicProperties", "getWorkingMemory failed: entity invalid", {
      entityId: entity?.id || "unknown",
    });
    return null;
  }

  try {
    const workingMemory = {
      villagerID: entity.id,
      currentFocus: entity.getDynamicProperty("wm_currentFocus") || null,
      currentMood: {
        C: entity.getDynamicProperty("wm_currentMood_C") ?? 0.0,
        V: entity.getDynamicProperty("wm_currentMood_V") ?? 0.0,
        I: entity.getDynamicProperty("wm_currentMood_I") ?? 0.0,
        S: entity.getDynamicProperty("wm_currentMood_S") ?? 0.0,
        X: entity.getDynamicProperty("wm_currentMood_X") ?? 0.0,
      },
      shockState: entity.getDynamicProperty("wm_shockState") || false,
      lastUpdate: entity.getDynamicProperty("wm_lastUpdate") || 0,
      needsSync: entity.getDynamicProperty("wm_needsSync") || false,
      lastSyncSuccess: entity.getDynamicProperty("wm_lastSyncSuccess") || 0,
      networkStatus: entity.getDynamicProperty("wm_networkStatus") || "unknown",
    };

    debugLog("DynamicProperties", "getWorkingMemory succeeded", {
      villagerID: entity.id,
      mood: workingMemory.currentMood,
    });

    return workingMemory;
  } catch (error) {
    console.error(
      `?c[DynamicProperties] Failed to read Working Memory for ${entity.id}: ${error.message}`,
    );
    throw new Error(
      `getWorkingMemory failed for ${entity.id}: ${error.message}`,
    );
  }
}

/**
 * Reads Working Memory and includes villager metadata for backend sync.
 * Used when sending WM to backend for lazy initialization support.
 * @param {Entity} entity - The villager entity
 * @returns {Object|null} Working Memory with villagerMetadata, or null if invalid
 */
function getWorkingMemoryWithMetadata(entity) {
  const wm = getWorkingMemory(entity);
  if (!wm) return null;

  return {
    ...wm,
    villagerMetadata: {
      name: entity.nameTag || "Unnamed",
      location: {
        x: Math.round(entity.location.x),
        y: Math.round(entity.location.y),
        z: Math.round(entity.location.z),
      },
      profession: "unknown", // TODO: Detect actual profession
    },
  };
}

/**
 * Writes all Working Memory properties to an entity's DynamicProperties.
 * Automatically marks entity for database sync by setting wm_needsSync flag.
 * @param {Entity} entity - The villager entity to write to
 * @param {Object} workingMemory - Working Memory object
 * @param {string|null} workingMemory.currentFocus - Entity ID being observed
 * @param {Object} workingMemory.currentMood - Mood vector [C, V, I, S, X]
 * @param {boolean} workingMemory.shockState - Shock state flag
 * @param {string} workingMemory.networkStatus - Network status
 * @param {Object} options - Optional configuration
 * @param {boolean} options.skipCacheUpdate - If true, don't update cache (for auto-recovery)
 * @returns {boolean} True if write succeeded, false if entity invalid
 * @throws {Error} If property write fails
 */
function setWorkingMemory(entity, workingMemory, options = {}) {
  const { skipCacheUpdate = false } = options;
  
  if (!entity || !entity.isValid) {
    debugLog("DynamicProperties", "setWorkingMemory failed: entity invalid", {
      entityId: entity?.id || "unknown",
    });
    return false;
  }

  try {
    entity.setDynamicProperty("wm_currentFocus", workingMemory.currentFocus);

    entity.setDynamicProperty("wm_currentMood_C", workingMemory.currentMood.C);
    entity.setDynamicProperty("wm_currentMood_V", workingMemory.currentMood.V);
    entity.setDynamicProperty("wm_currentMood_I", workingMemory.currentMood.I);
    entity.setDynamicProperty("wm_currentMood_S", workingMemory.currentMood.S);
    entity.setDynamicProperty("wm_currentMood_X", workingMemory.currentMood.X);

    entity.setDynamicProperty("wm_shockState", workingMemory.shockState);
    entity.setDynamicProperty("wm_lastUpdate", Date.now());
    entity.setDynamicProperty("wm_needsSync", true);
    entity.setDynamicProperty(
      "wm_networkStatus",
      workingMemory.networkStatus || "unknown",
    );

    debugLog("DynamicProperties", "setWorkingMemory succeeded", {
      villagerID: entity.id,
      mood: workingMemory.currentMood,
    });

    // Update cache (LOCAL MIRROR pattern) - skip if auto-recovery already set it!
    if (!skipCacheUpdate) {
      const updatedWM = getWorkingMemory(entity);
      if (updatedWM) {
        updateWorkingMemoryCache(entity.id, updatedWM);
      }
    }

    return true;
  } catch (error) {
    console.error(
      `?c[DynamicProperties] Failed to write Working Memory for ${entity.id}: ${error.message}`,
    );
    throw new Error(
      `setWorkingMemory failed for ${entity.id}: ${error.message}`,
    );
  }
}

/**
 * Updates a specific Working Memory property without overwriting all properties.
 * Useful for updating single values (e.g., currentFocus) without reading/writing entire state.
 * @param {Entity} entity - The villager entity
 * @param {string} propertyName - Property name (must match WORKING_MEMORY_SCHEMA key)
 * @param {string|number|boolean|null} value - New value to set
 * @returns {boolean} True if update succeeded, false if entity invalid
 * @throws {Error} If property name is invalid or write fails
 */
function updateWorkingMemoryProperty(entity, propertyName, value) {
  if (!entity || !entity.isValid) {
    debugLog(
      "DynamicProperties",
      "updateWorkingMemoryProperty failed: entity invalid",
      {
        entityId: entity?.id || "unknown",
        propertyName,
      },
    );
    return false;
  }

  if (!WORKING_MEMORY_SCHEMA[propertyName]) {
    throw new Error(`Invalid Working Memory property: ${propertyName}`);
  }

  if (!validatePropertyValue(propertyName, value)) {
    throw new Error(
      `Invalid value type for ${propertyName}: expected ${WORKING_MEMORY_SCHEMA[propertyName].type}, got ${typeof value}`,
    );
  }

  try {
    entity.setDynamicProperty(propertyName, value);
    entity.setDynamicProperty("wm_lastUpdate", Date.now());
    entity.setDynamicProperty("wm_needsSync", true);

    debugLog("DynamicProperties", "updateWorkingMemoryProperty succeeded", {
      villagerID: entity.id,
      propertyName,
      value,
    });

    // Update cache (LOCAL MIRROR pattern)
    const updatedWM = getWorkingMemory(entity);
    if (updatedWM) {
      updateWorkingMemoryCache(entity.id, updatedWM);
    }

    return true;
  } catch (error) {
    console.error(
      `?c[DynamicProperties] Failed to update ${propertyName} for ${entity.id}: ${error.message}`,
    );
    throw new Error(
      `updateWorkingMemoryProperty failed for ${entity.id}.${propertyName}: ${error.message}`,
    );
  }
}

/**
 * Initializes Working Memory with CACHE-FIRST pattern.
 * 
 * Flow:
 * 1. Initialize cache (immediate, source of truth)
 * 2. Sync cache to DPs (backup layer)
 * 3. Sync cache to DB (remote backup)
 * 
 * @param {Entity} entity - The villager entity
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipSync - If true, skip DB sync (for batch operations)
 * @returns {Promise<boolean>} True if initialization succeeded
 */
async function initializeWorkingMemory(entity, options = {}) {
  const { skipSync = false } = options;

  if (!entity || !entity.isValid) {
    console.warn(`§e[WM Init] Cannot initialize: entity invalid`);
    return false;
  }

  const villagerID = entity.id;

  try {
    // Step 1: Initialize CACHE (CACHE-FIRST!)
    const cacheSuccess = initializeWorkingMemoryCache(villagerID);
    if (!cacheSuccess) {
      console.warn(`§e[WM Init] Failed to initialize cache for ${villagerID.substring(0, 12)}`);
      return false;
    }

    // Step 2: Sync cache to DPs (entity is available now)
    const dpSyncSuccess = syncCacheToDynamicProperties(entity);
    if (!dpSyncSuccess) {
      console.warn(`§e[WM Init] Cache OK but DP sync failed for ${villagerID.substring(0, 12)}`);
    }

    console.warn(`§a[WM Init] Initialized WM for ${villagerID.substring(0, 12)}`);

    // Step 3: Sync to database (skip if batch operation)
    if (skipSync) {
      return true; // Batch will handle DB sync
    }

    // Individual DB sync
    try {
      const wmCache = getWorkingMemoryFromCache(villagerID);
      
      if (!wmCache) {
        throw new Error("Cache missing after initialization");
      }

      // Prepare payload with metadata
      const wmWithMetadata = {
        villagerID: villagerID,
        currentFocus: wmCache.currentFocus,
        currentMood: wmCache.currentMood,
        shockState: wmCache.shockState,
        lastUpdate: wmCache.lastUpdate,
        villagerMetadata: {
          name: entity.nameTag || "Unnamed",
          location: entity.location,
          profession: entity.typeId || "unknown",
        }
      };

      await postRequest("/api/memory/sync", wmWithMetadata);

      const timestamp = Date.now();
      
      // Update cache with sync status (CACHE-FIRST!)
      const metadata = trackedVillagers.get(villagerID);
      if (metadata?.workingMemory) {
        metadata.workingMemory.needsDBSync = false;
        metadata.workingMemory.needsSync = false;
        metadata.workingMemory.networkStatus = "initialized";
        metadata.workingMemory.lastSyncSuccess = timestamp;
      }
      
      // Update DP for consistency
      if (entity.isValid) {
        entity.setDynamicProperty("wm_networkStatus", "initialized");
        entity.setDynamicProperty("wm_lastSyncSuccess", timestamp);
        entity.setDynamicProperty("wm_needsSync", false);
      }

      debugLog("WM Init", "DB sync complete", { villagerID });
    } catch (syncError) {
      // DB sync failed, but cache + DPs exist - still usable
      const metadata = trackedVillagers.get(villagerID);
      if (metadata?.workingMemory) {
        metadata.workingMemory.networkStatus = `init_sync_failed: ${syncError.message}`;
        metadata.workingMemory.needsDBSync = true;
        metadata.workingMemory.needsSync = true;
      }

      if (entity.isValid) {
        entity.setDynamicProperty("wm_networkStatus", `init_sync_failed: ${syncError.message}`);
        entity.setDynamicProperty("wm_needsSync", true);
      }

      console.warn(`§e[WM Init] DB sync failed for ${villagerID.substring(0, 12)}: ${syncError.message}`);
      console.warn("§7Villager still usable, will retry sync later");
    }

    return true;
  } catch (error) {
    console.error(`§c[WM Init] Failed for ${villagerID.substring(0, 12)}: ${error.message}`);
    return false;
  }
}

/**
 * Checks if Working Memory has been initialized for an entity.
 * Verifies core vector data exists (not just metadata).
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if core WM data exists
 */
function hasWorkingMemory(entity) {
  if (!entity || !entity.isValid) return false;

  try {
    // Check for core vector data (wm_currentMood_C is the first property initialized)
    // More reliable than checking metadata like wm_lastUpdate
    const lastUpdate = entity.getDynamicProperty("wm_lastUpdate");

    const moodC = entity.getDynamicProperty("wm_currentMood_C");
    return (
      lastUpdate !== undefined &&
      lastUpdate !== null &&
      moodC !== undefined &&
      moodC !== null
    );
  } catch (error) {
    return false;
  }
}

/**
 * Clears all Working Memory properties from an entity.
 * Used for cleanup when villager is removed or reset.
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if cleared successfully, false if entity invalid
 */
function clearWorkingMemory(entity) {
  if (!entity || !entity.isValid) {
    debugLog("DynamicProperties", "clearWorkingMemory failed: entity invalid", {
      entityId: entity?.id || "unknown",
    });
    return false;
  }

  try {
    const propertyNames = getWorkingMemoryPropertyNames();

    for (const propName of propertyNames) {
      entity.setDynamicProperty(propName, undefined);
    }

    debugLog("DynamicProperties", "clearWorkingMemory succeeded", {
      villagerID: entity.id,
      propertyCount: propertyNames.length,
    });

    console.warn(
      `?a[DynamicProperties] Cleared Working Memory for ${entity.id}`,
    );
    return true;
  } catch (error) {
    console.error(
      `?c[DynamicProperties] Failed to clear Working Memory for ${entity.id}: ${error.message}`,
    );
    return false;
  }
}

/**
 * Gets total byte count of all Working Memory properties for an entity.
 * Useful for debugging memory usage and performance monitoring.
 * @param {Entity} entity - The villager entity
 * @returns {number} Total bytes used by DynamicProperties, or 0 if entity invalid
 */
function getWorkingMemoryByteCount(entity) {
  if (!entity || !entity.isValid) return 0;

  try {
    return entity.getDynamicPropertyTotalByteCount();
  } catch (error) {
    console.warn(
      `?e[DynamicProperties] Failed to get byte count for ${entity.id}: ${error.message}`,
    );
    return 0;
  }
}

/**
 * Marks Working Memory as needing database sync.
 * Called after any WM modification to trigger debounced sync loop.
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if flag set successfully, false if entity invalid
 */
function markForSync(entity) {
  if (!entity || !entity.isValid) return false;

  try {
    const timestamp = Date.now();
    entity.setDynamicProperty("wm_needsSync", true);
    entity.setDynamicProperty("wm_lastUpdate", timestamp);

    // Update cache (LOCAL MIRROR pattern)
    const metadata = trackedVillagers.get(entity.id);
    if (metadata?.workingMemory) {
      metadata.workingMemory.needsSync = true;
      metadata.workingMemory.lastUpdate = timestamp;
    }

    return true;
  } catch (error) {
    console.warn(
      `?e[DynamicProperties] Failed to mark for sync ${entity.id}: ${error.message}`,
    );
    return false;
  }
}

/**
 * Clears ALL Working Memory properties from a villager entity.
 * Used for full resets and debugging.
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if cleared successfully, false if entity invalid
 */
function clearAllWorkingMemory(entity) {
  if (!entity || !entity.isValid) return false;

  try {
    // Clear all WM properties
    for (const key of Object.keys(WORKING_MEMORY_SCHEMA)) {
      entity.setDynamicProperty(key, undefined);
    }

    // Clear meta properties
    entity.setDynamicProperty("wm_initialized", undefined);
    entity.setDynamicProperty("wm_needsSync", undefined);
    entity.setDynamicProperty("wm_lastUpdate", undefined);
    entity.setDynamicProperty("wm_lastSyncSuccess", undefined);
    entity.setDynamicProperty("wm_networkStatus", undefined);

    return true;
  } catch (error) {
    console.warn(
      `?e[DynamicProperties] Failed to clear all WM for ${entity.id}: ${error.message}`,
    );
    return false;
  }
}

// ========================================
// DATABASE OPERATIONS (Wrapper for working_memory_db.js)
// ========================================

/**
 * Compares DynamicProperties Working Memory with Database Working Memory.
 * Wrapper for compareWorkingMemoryCore that provides getWorkingMemory automatically.
 *
 * @param {Entity} entity - The villager entity
 * @returns {Promise<Object>} Comparison result with differences
 */
async function compareWorkingMemory(entity) {
  if (!entity || !entity.isValid) {
    return { status: "error", message: "Invalid entity" };
  }

  const dpWM = getWorkingMemory(entity);
  
  if (!dpWM) {
    return { status: "error", message: "No DynamicProperties WM" };
  }

  return compareWorkingMemoryCore(dpWM, entity.id);
}

export {
  // Dynamic Property operations
  getWorkingMemory,
  getWorkingMemoryWithMetadata,
  getWorkingMemoryFromDB,
  hasWorkingMemoryInDB,
  compareWorkingMemory,
  setWorkingMemory,
  updateWorkingMemoryProperty,
  initializeWorkingMemory,
  hasWorkingMemory,
  clearWorkingMemory,
  clearAllWorkingMemory,
  getWorkingMemoryByteCount,
  markForSync,
};
