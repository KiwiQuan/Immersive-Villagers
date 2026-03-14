/**
 * Villager Lifecycle - Event Handlers
 * 
 * Handles villager state transitions:
 * - New villager detection → Registration + layer initialization
 * - Activation → Set active in DB
 * - Deactivation → Set inactive in DB
 * - Death → Remove from DB
 * 
 * @module lifecycle_handlers
 */

import { world } from "@minecraft/server";
import { 
  trackedVillagers, 
  activeVillagers, 
  LIFECYCLE_CONFIG 
} from "./lifecycle_state.js";
import { 
  registerVillagerInDB, 
  setVillagerActiveInDB, 
  removeVillagerFromDB 
} from "./lifecycle_db.js";
import { postRequest } from "../../utils/network_helpers.js";
import { notifyNearbyPlayers } from "../../utils/notification_helpers.js";
import { debugLog } from "../../utils/debug_mode_helper.js";
import { initializeLayer4ForVillager } from "../../layers/layer4_working_memory/layer4_init.js";
import { 
  initializeWorkingMemory, 
  getWorkingMemoryWithMetadata 
} from "../../layers/layer4_working_memory/helpers/working_memory_helpers.js";
import {
  syncCacheToDynamicProperties,
} from "../../layers/layer4_working_memory/helpers/working_memory_chache.js";
import { createBatchQueue } from "../../utils/batch_queue.js";

// ========================================
// DEBOUNCED BATCH INITIALIZATION
// ========================================

/**
 * Delayed initialization queue for new villagers.
 * Uses generic batch queue with debounced timer (10 seconds).
 * Collects villagers as chunks load during travel.
 */
export const initQueue = createBatchQueue({
  name: "Villager Init",
  delayTicks: 200, // 10 seconds
  debounced: true, // Reset timer on each new villager
  getItemId: (villager) => villager.id, // Entity ID for deduplication
  processBatch: processInitBatch,
  logPrefix: "§b[Lifecycle]",
});

/**
 * Active state batch queue for proximity changes.
 * Uses fixed timer (1 second) to batch active/inactive state updates.
 * Reduces DB calls when multiple villagers enter/leave proximity.
 */
const activeStateQueue = createBatchQueue({
  name: "Active State",
  delayTicks: 20, // 1 second
  debounced: false, // Fixed delay for frequent updates
  getItemId: (item) => item.villagerID,
  processBatch: processActiveStateBatch,
  logPrefix: "§b[Lifecycle]",
});

/**
 * Processes batch of villagers for initialization.
 * Called automatically by generic batch queue after delay.
 * Handles registration + Working Memory init in parallel.
 * 
 * @param {Array<Entity>} batch - Array of villager entities
 */
async function processInitBatch(batch) {
  // Step 1: Batch register ALL villagers in ONE request
  const villagerDataArray = [];
  const validVillagers = []; // Track which ones are valid for WM init
  
  for (const villager of batch) {
    const villagerID = villager.id;
    
    // Try cached entity first (efficient), fall back to world.getEntity if out of range
    let freshEntity = activeVillagers.get(villagerID);
    if (!freshEntity) {
      freshEntity = world.getEntity(villagerID);
    }
    
    if (!freshEntity?.isValid) {
      console.warn(`§c[Lifecycle] ${villagerID.substring(0, 12)} - Entity became invalid`);
      continue;
    }
    
    villagerDataArray.push({
      villagerID,
      name: freshEntity.nameTag || "Unnamed Villager",
      homeX: Math.round(freshEntity.location.x),
      homeY: Math.round(freshEntity.location.y),
      homeZ: Math.round(freshEntity.location.z),
      isActive: true,
    });
    
    validVillagers.push({ id: villagerID, entity: freshEntity });
  }
  
  // Batch register in ONE request
  if (villagerDataArray.length > 0) {
    try {
      await registerVillagerInDB(villagerDataArray);
      console.warn(`§a[Lifecycle] Batch registered ${villagerDataArray.length} villagers`);
    } catch (error) {
      console.warn(`§c[Lifecycle] Batch registration failed: ${error.message}`);
      return; // Abort if registration fails
    }
  }
  
  // Step 2: Initialize Working Memory DPs (no sync yet)
  const wmDataArray = [];
  
  for (const { id: villagerID, entity: freshEntity } of validVillagers) {
    // Initialize DPs only (no network call)
    // This will also update cache via initializeWorkingMemory
    const success = initializeWorkingMemory(freshEntity, { skipSync: true });
    
    if (success) {
      // Collect WM data for batch sync
      const wmData = getWorkingMemoryWithMetadata(freshEntity);
      if (wmData) {
        wmDataArray.push(wmData);
      }
    }
  }
  
  // Step 3: Batch sync all WM to DB in ONE request
  if (wmDataArray.length > 0) {
    try {
      await postRequest("/api/memory/sync", { memories: wmDataArray });
      
      const timestamp = Date.now();
      
      // Mark all as synced (CACHE-FIRST: update cache first, DPs second!)
      for (const { id: villagerID } of validVillagers) {
        // Update cache (CACHE-FIRST pattern - PRIMARY update!)
        const metadata = trackedVillagers.get(villagerID);
        if (metadata?.workingMemory) {
          metadata.workingMemory.needsDBSync = false;
          metadata.workingMemory.needsSync = false;
          metadata.workingMemory.networkStatus = "initialized";
          metadata.workingMemory.lastSyncSuccess = timestamp;
        }
        
        // Update DPs (BACKUP layer - optional)
        const entity = activeVillagers.get(villagerID) || world.getEntity(villagerID);
        if (entity?.isValid) {
          entity.setDynamicProperty("wm_networkStatus", "initialized");
          entity.setDynamicProperty("wm_lastSyncSuccess", timestamp);
          entity.setDynamicProperty("wm_needsSync", false);
        }
      }
      
      console.warn(`§a[Lifecycle] Batch synced ${wmDataArray.length} Working Memories`);
    } catch (error) {
      console.warn(`§c[Lifecycle] Batch WM sync failed: ${error.message}`);
      
      // Mark all as needing sync retry (DP + cache)
      for (const { id: villagerID } of validVillagers) {
        const entity = activeVillagers.get(villagerID) || world.getEntity(villagerID);
        if (entity?.isValid) {
          entity.setDynamicProperty("wm_needsSync", true);
          entity.setDynamicProperty("wm_networkStatus", `batch_sync_failed: ${error.message}`);
        }
        
        // Update cache with error status (CACHE-FIRST!)
        const metadata = trackedVillagers.get(villagerID);
        if (metadata?.workingMemory) {
          metadata.workingMemory.needsDBSync = true;
          metadata.workingMemory.needsSync = true;
          metadata.workingMemory.networkStatus = `batch_sync_failed: ${error.message}`;
        }
      }
    }
  }
  
  // Step 4: Collect results
  const initPromises = validVillagers.map(async ({ id: villagerID, entity: freshEntity }) => {
    const shortID = villagerID.substring(0, 12);
    
    console.warn(`§a[Lifecycle] ${shortID} - Fully initialized (villager + WM)`);
    debugLog("[Villager Lifecycle] Villager fully initialized", { villagerID });
    
    return { status: 'success', id: villagerID, name: freshEntity.nameTag || "Unnamed Villager" };
  });

  // Wait for ALL to complete
  const results = await Promise.allSettled(initPromises);
  
  // Summary
  const successCount = results.filter(r => r.value?.status === 'success').length;
  const errorCount = results.filter(r => r.value?.status === 'error').length;
  const invalidCount = results.filter(r => r.value?.status === 'invalid').length;
  
  console.warn(`§b[Lifecycle] ━━━ Batch Init Summary ━━━`);
  console.warn(`§a  Success: ${successCount}`);
  console.warn(`§c  Failed: ${errorCount}`);
  console.warn(`§7  Invalid: ${invalidCount}`);
  console.warn(`§b━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Notify players about batch completion
  if (successCount > 0) {
    const successResults = results
      .filter(r => r.value?.status === 'success')
      .map(r => r.value);
    
    const names = successResults.map(r => r.name).join(", ");
    console.warn(`§a[Lifecycle] Initialized: ${names}`);
  }
}

/**
 * Processes batch of active state changes.
 * Called automatically by generic batch queue after delay.
 * Sends all state changes to backend in a single request.
 * 
 * @param {Array<{villagerID: string, isActive: boolean}>} batch - Array of state changes
 */
async function processActiveStateBatch(batch) {
  try {
    // Group by active state for logging
    const activations = batch.filter(item => item.isActive);
    const deactivations = batch.filter(item => !item.isActive);
    
    console.warn(
      `§b[Lifecycle] Batch updating active states: ${activations.length} active, ${deactivations.length} inactive`
    );
    
    // Send batch to backend (route always expects array)
    await postRequest("/api/villagers/set_active", batch);
    
    console.warn(`§a[Lifecycle] Batch active state update successful (${batch.length} villagers)`);
    
  } catch (error) {
    console.warn(`§c[Lifecycle] Batch active state update failed: ${error.message}`);
    
    // Fallback: Try individual updates (each wrapped in array)
    console.warn(`§e[Lifecycle] Retrying ${batch.length} updates individually...`);
    for (const item of batch) {
      try {
        await postRequest("/api/villagers/set_active", [item]);
      } catch (retryError) {
        console.warn(
          `§c[Lifecycle] Failed to update ${item.villagerID}: ${retryError.message}`
        );
      }
    }
  }
}

// ========================================
// EVENT HANDLERS
// ========================================

// handleNewVillager removed - detection logic moved inline to coordinator (matches sandbox pattern)

/**
 * Handles villager activation (entered proximity radius).
 * 
 * NOTE: activeVillagers Map is updated by coordinator's updateActiveVillagers().
 * This function only handles side effects (DB updates, notifications).
 * 
 * @param {string} villagerID - Villager entity ID
 * @param {Entity} villager - Villager entity
 */
export function handleActivation(villagerID, villager) {
  // activeVillagers Map is updated by coordinator
  // This handler only performs side effects

  // CACHE-FIRST: Sync cache to DPs when entity comes in range
  syncCacheToDynamicProperties(villager);

  // Queue active state change for batch processing
  activeStateQueue.add({ villagerID, isActive: true });

  debugLog("[Villager Lifecycle] Villager marked ACTIVE", { villagerID });

  notifyNearbyPlayers(
    `§a[System] Villager active: ${villager.nameTag || "Unnamed"}`,
    villager.location,
    LIFECYCLE_CONFIG.notificationRadius
  );
}

/**
 * Handles villager deactivation (left proximity radius).
 * 
 * NOTE: activeVillagers Map is updated by coordinator's updateActiveVillagers().
 * This function only handles side effects (DB updates, notifications).
 * 
 * @param {string} villagerID - Villager entity ID
 */
export function handleDeactivation(villagerID) {
  // activeVillagers Map is updated by coordinator
  // This handler only performs side effects

  // Queue active state change for batch processing
  activeStateQueue.add({ villagerID, isActive: false });

  debugLog("[Villager Lifecycle] Villager marked INACTIVE", { villagerID });

  const metadata = trackedVillagers.get(villagerID);
  if (metadata) {
    notifyNearbyPlayers(
      `§c[System] Villager inactive: ${metadata.nameTag}`,
      metadata.location,
      LIFECYCLE_CONFIG.notificationRadius
    );
  }
}

/**
 * Handles villager death (remove from database).
 * 
 * NOTE: Death requires immediate removal from activeVillagers Map
 * (unlike activate/deactivate which are managed by coordinator).
 * 
 * @param {string} villagerID - Villager entity ID
 * @param {string} villagerName - Villager name for logging
 * @param {Object} location - Villager location for notifications
 */
export function handleVillagerDeath(villagerID, villagerName, location) {
  trackedVillagers.delete(villagerID);
  activeVillagers.delete(villagerID); // Immediate removal for death events

  removeVillagerFromDB(villagerID).catch((error) => {
    console.error(
      `§c[Villager Lifecycle] Failed to remove villager ${villagerID}: ${error.message}`,
    );
  });

  debugLog("[Villager Lifecycle] Villager DIED - removed from database", {
    villagerID,
    villagerName,
  });

  notifyNearbyPlayers(
    `§c[System] Villager died: ${villagerName}`,
    location,
    LIFECYCLE_CONFIG.notificationRadius
  );
}
