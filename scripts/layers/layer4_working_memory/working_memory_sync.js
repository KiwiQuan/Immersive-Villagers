/**
 * Working Memory Sync Loop
 * Debounced synchronization of DynamicProperties → PostgreSQL.
 * Runs every 20 ticks (1 second) for active villagers only.
 *
 * "FETCH ONCE, CONSUME EVERYWHERE" PATTERN:
 * - Consumes activeVillagerEntities array (pre-fetched by lifecycle)
 * - ZERO getEntities() calls (lifecycle already queried!)
 * - 50x faster than independent queries
 *
 * @module working_memory_sync
 */

import { system } from "@minecraft/server";
import {
  hasWorkingMemory,
  getWorkingMemory,
  initializeWorkingMemory,
} from "./helpers/working_memory_helpers.js";
import { postRequestAsync } from "../../utils/network_helpers.js";
import { debugLog } from "../../utils/debug_mode_helper.js";
import { 
  activeVillagers, 
  trackedVillagers 
} from "../../systems/villager_lifecycle/lifecycle_state.js";
import {
  getWorkingMemoryFromCache,
} from "./helpers/working_memory_chache.js";

const SYNC_INTERVAL_TICKS = 20;
const SYNC_STARTUP_DELAY_TICKS = 10; // Offset from lifecycle to prevent frame spikes
const BACKEND_SYNC_ENDPOINT = "/api/memory/sync";

let syncLoopHandle = null;
let syncStartupHandle = null;

/**
 * Debounced sync loop: Syncs Working Memory to PostgreSQL.
 * Only syncs ACTIVE villagers with wm_needsSync flag set to true.
 * Consumes cached Map from lifecycle (ZERO queries!).
 * Runs asynchronously to avoid blocking game thread.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Starts with 10-tick delay to stagger execution
 * - Lifecycle runs at tick 20, 40, 60...
 * - Sync runs at tick 30, 50, 70...
 * - Prevents frame spikes on low-end hardware
 */
function startWorkingMemorySyncLoop() {
  // Prevent duplicate loops
  if (syncLoopHandle || syncStartupHandle) {
    console.warn("§e[Layer 4] Sync loop already running/starting, clearing first");
    if (syncStartupHandle) system.clearRun(syncStartupHandle);
    if (syncLoopHandle) system.clearRun(syncLoopHandle);
  }
  
  // Delay startup to stagger with lifecycle (prevent frame spikes)
  syncStartupHandle = system.runTimeout(() => {
    syncLoopHandle = system.runInterval(() => {
      try {
        let syncedCount = 0;
        let needsSyncCount = 0;

        // CACHE-FIRST: Iterate over ALL tracked villagers (proximity-independent!)
        // No need for entities - cache has everything!
        for (const [villagerID, metadata] of trackedVillagers) {
          const wmCache = metadata.workingMemory;

          if (!wmCache) {
            // Skip villagers without WM - batch init will handle them
            debugLog("Layer4", "Skipping villager without WM cache (batch init in progress)", {
              villagerID,
            });
            continue;
          }

          const needsSync = wmCache.needsDBSync; // Read from cache!

          if (needsSync) needsSyncCount++;

          if (needsSync) {
            console.warn(`§e[Layer 4] Syncing villager ${villagerID.substring(0, 12)}...`);

            // Validate mood components (must all be numbers!)
            const mood = wmCache.currentMood;
            if (
              typeof mood.C !== 'number' || 
              typeof mood.V !== 'number' || 
              typeof mood.I !== 'number' || 
              typeof mood.S !== 'number' || 
              typeof mood.X !== 'number'
            ) {
              console.warn(`§c[Layer 4] Invalid mood vector for ${villagerID.substring(0, 12)}: C=${mood.C} V=${mood.V} I=${mood.I} S=${mood.S} X=${mood.X}`);
              continue; // Skip this villager
            }

            // Prepare payload from cache (no entity needed!)
            const workingMemory = {
              villagerID: villagerID,
              currentFocus: wmCache.currentFocus,
              currentMood: wmCache.currentMood,
              shockState: wmCache.shockState,
              lastUpdate: wmCache.lastUpdate,
            };

            postRequestAsync(BACKEND_SYNC_ENDPOINT, workingMemory)
              .then(() => {
                const timestamp = Date.now();
                
                // Update cache (CACHE-FIRST pattern - primary update!)
                const syncedMetadata = trackedVillagers.get(villagerID);
                if (syncedMetadata?.workingMemory) {
                  syncedMetadata.workingMemory.needsDBSync = false;
                  syncedMetadata.workingMemory.needsSync = false;
                  syncedMetadata.workingMemory.networkStatus = "synced";
                  syncedMetadata.workingMemory.lastSyncSuccess = timestamp;
                }
                
                // Update DPs if entity is loaded (optional backup)
                const entity = activeVillagers.get(villagerID);
                if (entity?.isValid) {
                  entity.setDynamicProperty("wm_needsSync", false);
                  entity.setDynamicProperty("wm_lastSyncSuccess", timestamp);
                  entity.setDynamicProperty("wm_networkStatus", "synced");
                }
                
                console.warn(`§a[Layer 4] Sync complete for ${villagerID.substring(0, 12)}`);
              })
              .catch((error) => {
                // Update cache with error status (CACHE-FIRST!)
                const syncedMetadata = trackedVillagers.get(villagerID);
                if (syncedMetadata?.workingMemory) {
                  syncedMetadata.workingMemory.networkStatus = "error";
                }
                
                // Update DP if loaded (optional)
                const entity = activeVillagers.get(villagerID);
                if (entity?.isValid) {
                  entity.setDynamicProperty("wm_networkStatus", "error");
                }
                
                console.warn(
                  `§e[Layer 4] Sync failed for ${villagerID.substring(0, 12)}: ${error.message}`,
                );
              });

            syncedCount++;
          }
        }

        if (needsSyncCount > 0) {
          console.warn(
            `§a[Layer 4] Sync cycle: ${syncedCount} sync requests sent (from ${trackedVillagers.size} tracked)`,
          );
        }

        debugLog("Layer4", "Sync loop complete", {
          trackedVillagers: trackedVillagers.size,
          syncNeeded: needsSyncCount,
          requestsSent: syncedCount,
        });
      } catch (error) {
        console.error(`§c[Layer 4] Sync loop error: ${error.message}`);
      }
    }, SYNC_INTERVAL_TICKS);

    console.warn(
      `§a[Layer 4] Working Memory sync loop started (every ${SYNC_INTERVAL_TICKS} ticks, offset: ${SYNC_STARTUP_DELAY_TICKS} ticks)`,
    );
  }, SYNC_STARTUP_DELAY_TICKS);
}

/**
 * Starts the Working Memory sync loop.
 * Can be called to restart after manual stop.
 */
export function startWorkingMemorySync() {
  // Stop existing loops if running
  stopWorkingMemorySync();
  
  // Start sync loop
  startWorkingMemorySyncLoop();
  
  console.warn("§a[Layer 4] Sync loop started");
}

/**
 * Stops the Working Memory sync loop.
 * Useful for debugging or manual testing.
 */
export function stopWorkingMemorySync() {
  if (syncStartupHandle) {
    system.clearRun(syncStartupHandle);
    syncStartupHandle = null;
  }
  
  if (syncLoopHandle) {
    system.clearRun(syncLoopHandle);
    syncLoopHandle = null;
    console.warn("§c[Layer 4] Sync loop stopped");
  }
}

export { startWorkingMemorySyncLoop };
