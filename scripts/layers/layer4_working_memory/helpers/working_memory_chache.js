import { trackedVillagers } from "../../../systems/villager_lifecycle/lifecycle_state.js";

// ========================================
// CACHE HELPERS (LOCAL MIRROR)
// ========================================

/**
 * Gets Working Memory from trackedVillagers cache.
 * Does NOT require entity - works from anywhere, any distance.
 *
 * @param {string} villagerID - The villager entity ID
 * @returns {Object|null} Working Memory object or null if not cached
 */
function getWorkingMemoryFromCache(villagerID) {
  const metadata = trackedVillagers.get(villagerID);
  return metadata?.workingMemory || null;
}

/**
 * Updates Working Memory cache in trackedVillagers.
 * Should be called atomically with DP writes.
 *
 * @param {string} villagerID - The villager entity ID
 * @param {Object} wmData - Working Memory data object
 */
function updateWorkingMemoryCache(villagerID, wmData) {
  const metadata = trackedVillagers.get(villagerID);
  if (!metadata) {
    console.warn(
      `§e[Cache] Cannot update WM cache: ${villagerID.substring(0, 12)} not tracked`,
    );
    return;
  }

  metadata.workingMemory = { ...wmData };
  trackedVillagers.set(villagerID, metadata);
}

/**
 * Checks if Working Memory exists in cache.
 *
 * @param {string} villagerID - The villager entity ID
 * @returns {boolean} True if WM exists in cache
 */
function hasWorkingMemoryInCache(villagerID) {
  const metadata = trackedVillagers.get(villagerID);
  return (
    metadata?.workingMemory !== null && metadata?.workingMemory !== undefined
  );
}

// ========================================
// CACHE-FIRST OPERATIONS (NEW)
// ========================================

/**
 * Modifies Working Memory in cache directly (NO ENTITY NEEDED!).
 * This is the new primary write operation - works from any distance.
 * 
 * @param {string} villagerID - The villager entity ID
 * @param {Object} updates - Partial WM updates { currentMood: {...}, currentFocus: "...", etc. }
 * @returns {boolean} True if update succeeded
 */
function modifyWorkingMemoryCache(villagerID, updates) {
  const metadata = trackedVillagers.get(villagerID);
  
  if (!metadata) {
    console.warn(`§e[Cache] Cannot modify WM: ${villagerID.substring(0, 12)} not tracked`);
    return false;
  }
  
  if (!metadata.workingMemory) {
    console.warn(`§e[Cache] Cannot modify WM: ${villagerID.substring(0, 12)} not initialized`);
    return false;
  }
  
  // Apply updates to cache (deep merge for nested objects like currentMood)
  if (updates.currentMood) {
    metadata.workingMemory.currentMood = {
      ...metadata.workingMemory.currentMood,
      ...updates.currentMood
    };
  }
  
  if (updates.currentFocus !== undefined) {
    metadata.workingMemory.currentFocus = updates.currentFocus;
  }
  
  if (updates.shockState !== undefined) {
    metadata.workingMemory.shockState = updates.shockState;
  }
  
  // Update metadata
  metadata.workingMemory.lastUpdate = Date.now();
  metadata.workingMemory.needsDPSync = true;  // DPs need updating
  metadata.workingMemory.needsDBSync = true;  // DB needs updating
  metadata.workingMemory.needsSync = true;    // Legacy flag for compatibility
  
  trackedVillagers.set(villagerID, metadata);
  
  return true;
}

/**
 * Initializes Working Memory in cache (NO ENTITY NEEDED!).
 * Creates default WM state that will be synced to DPs/DB later.
 * 
 * @param {string} villagerID - The villager entity ID
 * @returns {boolean} True if initialization succeeded
 */
function initializeWorkingMemoryCache(villagerID) {
  const metadata = trackedVillagers.get(villagerID);
  
  if (!metadata) {
    console.warn(`§e[Cache] Cannot initialize WM: ${villagerID.substring(0, 12)} not tracked`);
    return false;
  }
  
  if (metadata.workingMemory) {
    console.warn(`§7[Cache] WM already initialized for ${villagerID.substring(0, 12)}`);
    return true; // Already initialized
  }
  
  // Create default WM state (CACHE-FIRST!)
  metadata.workingMemory = {
    currentMood: {
      C: 0.0,
      V: 0.0,
      I: 0.0,
      S: 0.0,
      X: 0.0,
    },
    currentFocus: null,
    shockState: false,
    lastUpdate: Date.now(),
    needsDPSync: true,   // DPs don't exist yet - will sync when in range
    needsDBSync: true,   // DB doesn't exist yet - will sync via batch
    needsSync: true,     // Legacy flag for compatibility
    networkStatus: "cache_only",
    lastSyncSuccess: null,
  };
  
  trackedVillagers.set(villagerID, metadata);
  
  console.warn(`§a[Cache] Initialized WM for ${villagerID.substring(0, 12)}`);
  return true;
}

/**
 * Syncs cache to DynamicProperties (when entity is in range).
 * Called by proximity system when villager is loaded.
 * 
 * @param {Entity} entity - The villager entity
 * @returns {boolean} True if sync succeeded
 */
function syncCacheToDynamicProperties(entity) {
  if (!entity || !entity.isValid) return false;
  
  const villagerID = entity.id;
  const metadata = trackedVillagers.get(villagerID);
  
  if (!metadata?.workingMemory) {
    console.warn(`§7[Cache→DP] No cache to sync for ${villagerID.substring(0, 12)}`);
    return false;
  }
  
  const wm = metadata.workingMemory;
  
  // Check if sync needed
  if (!wm.needsDPSync) {
    return true; // Already in sync
  }
  
  try {
    // Write cache to DPs
    entity.setDynamicProperty("wm_currentMood_C", wm.currentMood.C);
    entity.setDynamicProperty("wm_currentMood_V", wm.currentMood.V);
    entity.setDynamicProperty("wm_currentMood_I", wm.currentMood.I);
    entity.setDynamicProperty("wm_currentMood_S", wm.currentMood.S);
    entity.setDynamicProperty("wm_currentMood_X", wm.currentMood.X);
    entity.setDynamicProperty("wm_currentFocus", wm.currentFocus);
    entity.setDynamicProperty("wm_shockState", wm.shockState);
    entity.setDynamicProperty("wm_lastUpdate", wm.lastUpdate);
    entity.setDynamicProperty("wm_needsSync", wm.needsDBSync); // For DB sync loop
    entity.setDynamicProperty("wm_networkStatus", wm.networkStatus);
    entity.setDynamicProperty("wm_lastSyncSuccess", wm.lastSyncSuccess || 0);
    
    // Clear DP sync flag
    wm.needsDPSync = false;
    trackedVillagers.set(villagerID, metadata);
    
    console.warn(`§a[Cache→DP] Synced cache to DPs for ${villagerID.substring(0, 12)}`);
    return true;
  } catch (error) {
    console.warn(`§e[Cache→DP] Failed to sync for ${villagerID.substring(0, 12)}: ${error.message}`);
    return false;
  }
}

export {
  getWorkingMemoryFromCache,
  updateWorkingMemoryCache,
  hasWorkingMemoryInCache,
  modifyWorkingMemoryCache,
  initializeWorkingMemoryCache,
  syncCacheToDynamicProperties,
};
