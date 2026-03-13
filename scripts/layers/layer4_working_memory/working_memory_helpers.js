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
} from "./working_memory_schema.js";
import { debugLog } from "../../utils/debug_mode_helper.js";
import { getRequest, postRequest } from "../../utils/network_helpers.js";

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
 * @returns {boolean} True if write succeeded, false if entity invalid
 * @throws {Error} If property write fails
 */
function setWorkingMemory(entity, workingMemory) {
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
 * Initializes Working Memory properties with default values AND syncs to database.
 * This atomic operation eliminates race conditions by ensuring DP and DB are always in sync.
 * Backend uses LAZY INITIALIZATION: ensures villager exists first, then syncs WM in ONE transaction.
 * NO FK violations possible - backend handles everything!
 * Should be called when a villager first spawns or after data reset.
 * @param {Entity} entity - The villager entity
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipSync - If true, only set DPs without syncing (for batch operations)
 * @returns {Promise<boolean>} True if initialization succeeded, false if entity invalid
 */
async function initializeWorkingMemory(entity, options = {}) {
  const { skipSync = false } = options;
  
  if (!entity || !entity.isValid) {
    console.warn(
      `?e[DynamicProperties] Cannot initialize Working Memory: entity invalid`,
    );
    return false;
  }

  try {
    const propertyNames = getWorkingMemoryPropertyNames();

    // Step 1: Set DynamicProperties (synchronous, reliable)
    for (const propName of propertyNames) {
      const defaultValue = getDefaultValue(propName);
      entity.setDynamicProperty(propName, defaultValue);
    }

    entity.setDynamicProperty("wm_lastUpdate", Date.now());

    debugLog("DynamicProperties", "initializeWorkingMemory: DPs set", {
      villagerID: entity.id,
      propertyCount: propertyNames.length,
    });

    console.warn(
      `?a[DynamicProperties] Initialized Working Memory for ${entity.id}`,
    );

    // Step 2: Sync to database (skip if called from batch operation)
    if (skipSync) {
      // Batch operation will handle sync - just mark as needing it
      entity.setDynamicProperty("wm_networkStatus", "dp_only");
      entity.setDynamicProperty("wm_needsSync", true);
      return true;
    }
    
    // Individual sync (for non-batch operations)
    try {
      const wmWithMetadata = getWorkingMemoryWithMetadata(entity);

      if (!wmWithMetadata) {
        throw new Error("Failed to read WM after setting DPs");
      }

      await postRequest("/api/memory/sync", wmWithMetadata);

      entity.setDynamicProperty("wm_networkStatus", "initialized");
      entity.setDynamicProperty("wm_lastSyncSuccess", Date.now());
      entity.setDynamicProperty("wm_needsSync", false);

      debugLog("DynamicProperties", "Working Memory synced to DB", {
        villagerID: entity.id,
      });
    } catch (syncError) {
      // DB sync failed, but DPs are still valid - villager is usable
      entity.setDynamicProperty(
        "wm_networkStatus",
        `init_sync_failed: ${syncError.message}`,
      );
      entity.setDynamicProperty("wm_needsSync", true); // Retry later

      console.warn(
        `?e[DynamicProperties] WM initialized but DB sync failed for ${entity.id}: ${syncError.message}`,
      );
      console.warn("?7Villager is still usable, will retry sync later");
    }

    return true;
  } catch (error) {
    console.error(
      `?c[DynamicProperties] Failed to initialize Working Memory for ${entity.id}: ${error.message}`,
    );
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
    entity.setDynamicProperty("wm_needsSync", true);
    entity.setDynamicProperty("wm_lastUpdate", Date.now());
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

/**
 * Checks if Working Memory exists in the database.
 * Used to verify complete initialization (DPs + DB both exist).
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<boolean>} True if WM exists in DB, false otherwise
 */
async function hasWorkingMemoryInDB(villagerID) {
  try {
    const response = await getRequest(
      `/api/villagers/get_with_memory/${villagerID}`,
    );

    return response?.villager?.working_memory !== null && 
           response?.villager?.working_memory !== undefined;
  } catch (error) {
    debugLog(
      "DynamicProperties",
      "hasWorkingMemoryInDB failed",
      { villagerID, error: error.message },
    );
    return false;
  }
}

/**
 * Fetches Working Memory from the database for comparison/verification.
 * IMPORTANT: This should ONLY be used for diagnostics/verification.
 * Production flow: DynamicProperties ? Database (one-way).
 * Database should NEVER update DynamicProperties (except recovery/warm-start).
 *
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object|null>} Working Memory from DB or null if not found
 */
async function getWorkingMemoryFromDB(villagerID) {
  try {
    const response = await getRequest(
      `/api/villagers/get_with_memory/${villagerID}`,
    );

    if (!response || !response.villager) {
      debugLog(
        "DynamicProperties",
        "getWorkingMemoryFromDB: villager not found",
        { villagerID },
      );
      return null;
    }

    const wm = response.villager.working_memory;

    // No working memory in DB
    if (!wm || wm.villager_id === null) {
      debugLog("DynamicProperties", "getWorkingMemoryFromDB: no WM in DB", {
        villagerID,
      });
      return null;
    }

    // Parse VECTOR(5) string to array
    let moodVector = wm.current_mood_manual;
    if (typeof moodVector === "string") {
      moodVector = JSON.parse(moodVector);
    }

    // Return in same format as getWorkingMemory() for easy comparison
    return {
      villagerID: wm.villager_id,
      currentFocus: wm.current_focus || null,
      currentMood: {
        C: moodVector?.[0] ?? 0.0,
        V: moodVector?.[1] ?? 0.0,
        I: moodVector?.[2] ?? 0.0,
        S: moodVector?.[3] ?? 0.0,
        X: moodVector?.[4] ?? 0.0,
      },
      shockState: wm.shock_state || false,
      lastUpdate: wm.last_update || 0,
    };
  } catch (error) {
    console.warn(
      `?e[DynamicProperties] Failed to fetch WM from DB for ${villagerID}: ${error.message}`,
    );
    return null;
  }
}

/**
 * Compares DynamicProperties Working Memory with Database Working Memory.
 * Used for diagnostics and verifying sync success.
 *
 * @param {Entity} entity - The villager entity
 * @returns {Promise<Object>} Comparison result with differences
 */
async function compareWorkingMemory(entity) {
  if (!entity || !entity.isValid) {
    return { status: "error", message: "Invalid entity" };
  }

  const villagerID = entity.id;

  try {
    const dpWM = getWorkingMemory(entity);
    const dbWM = await getWorkingMemoryFromDB(villagerID);

    if (!dpWM) {
      return { status: "error", message: "No DynamicProperties WM" };
    }

    if (!dbWM) {
      return { status: "error", message: "No Database WM" };
    }

    // Compare mood vectors
    const moodDiff = {
      C: Math.abs(dpWM.currentMood.C - dbWM.currentMood.C),
      V: Math.abs(dpWM.currentMood.V - dbWM.currentMood.V),
      I: Math.abs(dpWM.currentMood.I - dbWM.currentMood.I),
      S: Math.abs(dpWM.currentMood.S - dbWM.currentMood.S),
      X: Math.abs(dpWM.currentMood.X - dbWM.currentMood.X),
    };

    const maxDiff = Math.max(...Object.values(moodDiff));
    const inSync = maxDiff < 0.001; // Floating point tolerance

    return {
      status: "success",
      inSync,
      maxDifference: maxDiff,
      dynamicProperties: dpWM,
      database: dbWM,
      differences: {
        mood: moodDiff,
        focus: dpWM.currentFocus !== dbWM.currentFocus,
        shock: dpWM.shockState !== dbWM.shockState,
        timestamp: Math.abs(dpWM.lastUpdate - dbWM.lastUpdate),
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error.message,
    };
  }
}

export {
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
