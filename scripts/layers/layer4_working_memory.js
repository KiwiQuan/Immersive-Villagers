import { world, system } from "@minecraft/server";
import {
  hasWorkingMemory,
  getWorkingMemory,
} from "../utils/dynamic_properties_helpers.js";
import { postRequestAsync } from "../utils/network_helpers.js";
import { debugLog } from "../utils/debug_mode_helper.js";

const SYNC_INTERVAL_TICKS = 20;
const BACKEND_SYNC_ENDPOINT = "/api/memory/sync";

/**
 * Debounced sync loop: Syncs Working Memory to PostgreSQL every 100 ticks (5 seconds).
 * Only syncs villagers with wm_needsSync flag set to true.
 * Runs asynchronously to avoid blocking game thread.
 */
function startWorkingMemorySyncLoop() {
  system.runInterval(() => {
    try {
      const dimension = world.getDimension("overworld");
      const villagers = dimension.getEntities({
        type: "minecraft:villager_v2",
      });

      let syncedCount = 0;
      let needsSyncCount = 0;

      for (const villager of villagers) {
        if (!villager || !villager.isValid) continue;
        const initialized = hasWorkingMemory(villager);

        if (!initialized) {
          debugLog("Layer4", "Villager not initialized, skipping sync", {
            villagerID: villager.id,
          });
          continue;
        }

        const needsSync = villager.getDynamicProperty("wm_needsSync");

        if (needsSync) needsSyncCount++;

        if (needsSync) {
          console.warn(`§e[Layer 4] Syncing villager ${villager.id}...`);

          const workingMemory = getWorkingMemory(villager);

          if (!workingMemory) {
            debugLog("Layer4", "Failed to read Working Memory for sync", {
              villagerID: villager.id,
            });
            continue;
          }

          postRequestAsync(BACKEND_SYNC_ENDPOINT, workingMemory)
            .then(() => {
              if (villager.isValid) {
                villager.setDynamicProperty("wm_needsSync", false);
                villager.setDynamicProperty("wm_lastSyncSuccess", Date.now());
                villager.setDynamicProperty("wm_networkStatus", "synced");
                console.warn(`§a[Layer 4] Sync complete for ${villager.id}`);
              }
            })
            .catch((error) => {
              if (villager.isValid) {
                villager.setDynamicProperty("wm_networkStatus", "error");
              }
              console.warn(
                `§e[Layer 4] Sync failed for ${villager.id}: ${error.message}`,
              );
            });

          syncedCount++;
        }
      }

      if (needsSyncCount > 0) {
        console.warn(
          `§a[Layer 4] Sync cycle: ${syncedCount} sync requests sent`,
        );
      }

      debugLog("Layer4", "Sync loop complete", {
        totalVillagers: villagers.length,
        syncNeeded: needsSyncCount,
        requestsSent: syncedCount,
      });
    } catch (error) {
      console.error(`§c[Layer 4] Sync loop error: ${error.message}`);
    }
  }, SYNC_INTERVAL_TICKS);

  console.warn(
    `§a[Layer 4] Working Memory sync loop started (every ${SYNC_INTERVAL_TICKS} ticks)`,
  );
}

/**
 * Initializes Layer 4 (Working Memory) systems.
 * Starts the debounced sync loop for Working Memory persistence.
 */
function initializeLayer4() {
  startWorkingMemorySyncLoop();
  console.warn("§a[Layer 4] Working Memory layer initialized");
}

export { initializeLayer4, startWorkingMemorySyncLoop };
