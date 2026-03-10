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
        C: entity.getDynamicProperty("wm_currentMood_C") ?? 0.5,
        V: entity.getDynamicProperty("wm_currentMood_V") ?? 0.5,
        I: entity.getDynamicProperty("wm_currentMood_I") ?? 0.5,
        S: entity.getDynamicProperty("wm_currentMood_S") ?? 0.5,
        X: entity.getDynamicProperty("wm_currentMood_X") ?? 0.5,
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
      `§c[DynamicProperties] Failed to read Working Memory for ${entity.id}: ${error.message}`,
    );
    throw new Error(
      `getWorkingMemory failed for ${entity.id}: ${error.message}`,
    );
  }
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
      `§c[DynamicProperties] Failed to write Working Memory for ${entity.id}: ${error.message}`,
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
      `§c[DynamicProperties] Failed to update ${propertyName} for ${entity.id}: ${error.message}`,
    );
    throw new Error(
      `updateWorkingMemoryProperty failed for ${entity.id}.${propertyName}: ${error.message}`,
    );
  }
}

/**
 * Initializes Working Memory properties with default values.
 * Should be called when a villager first spawns or after data reset.
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if initialization succeeded, false if entity invalid
 */
function initializeWorkingMemory(entity) {
  if (!entity || !entity.isValid) {
    console.warn(
      `§e[DynamicProperties] Cannot initialize Working Memory: entity invalid`,
    );
    return false;
  }

  try {
    const propertyNames = getWorkingMemoryPropertyNames();

    for (const propName of propertyNames) {
      const defaultValue = getDefaultValue(propName);
      entity.setDynamicProperty(propName, defaultValue);
    }

    entity.setDynamicProperty("wm_lastUpdate", Date.now());
    entity.setDynamicProperty("wm_needsSync", true);

    debugLog("DynamicProperties", "initializeWorkingMemory succeeded", {
      villagerID: entity.id,
      propertyCount: propertyNames.length,
    });

    console.warn(
      `§a[DynamicProperties] Initialized Working Memory for ${entity.id}`,
    );
    return true;
  } catch (error) {
    console.error(
      `§c[DynamicProperties] Failed to initialize Working Memory for ${entity.id}: ${error.message}`,
    );
    return false;
  }
}

/**
 * Checks if Working Memory has been initialized for an entity.
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if at least one WM property exists
 */
function hasWorkingMemory(entity) {
  if (!entity || !entity.isValid) return false;

  try {
    const lastUpdate = entity.getDynamicProperty("wm_lastUpdate");
    return lastUpdate !== undefined && lastUpdate !== null;
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
      `§a[DynamicProperties] Cleared Working Memory for ${entity.id}`,
    );
    return true;
  } catch (error) {
    console.error(
      `§c[DynamicProperties] Failed to clear Working Memory for ${entity.id}: ${error.message}`,
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
      `§e[DynamicProperties] Failed to get byte count for ${entity.id}: ${error.message}`,
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
      `§e[DynamicProperties] Failed to mark for sync ${entity.id}: ${error.message}`,
    );
    return false;
  }
}

export {
  getWorkingMemory,
  setWorkingMemory,
  updateWorkingMemoryProperty,
  initializeWorkingMemory,
  hasWorkingMemory,
  clearWorkingMemory,
  getWorkingMemoryByteCount,
  markForSync,
};
