/**
 * Villager Lifecycle - Coordinator (Main Entry Point)
 *
 * Orchestrates villager detection and state management.
 * Uses API-native proximity detection (location + maxDistance).
 *
 * "FETCH ONCE, CONSUME EVERYWHERE" PATTERN:
 * - Queries entities ONCE per tick
 * - Caches in activeVillagers Map (villagerID → Entity)
 * - Layers consume Map.values() (zero duplicate queries!)
 * - O(1) lookups by ID (vs O(n) for array)
 * - Entities valid for 1-2 ticks (fresh enough for sync)
 *
 * @module lifecycle_coordinator
 */

import { world, system } from "@minecraft/server";
import { getNearestPlayerDistance } from "../../utils/geometry_helpers.js";
import { isDebugMode } from "../../utils/debug_mode_helper.js";
import {
  LIFECYCLE_CONFIG,
  activeVillagers,
  trackedVillagers,
  updateActiveVillagers,
  setLifecycleHandle,
  lifecycleHandle,
} from "./lifecycle_state.js";
import {
  initQueue,
  handleActivation,
  handleDeactivation,
  handleVillagerDeath,
} from "./lifecycle_handlers.js";
import { getAllVillagersFromDB } from "./lifecycle_db.js";
import { setWorkingMemory } from "../../layers/layer4_working_memory/helpers/working_memory_helpers.js";

// ========================================
// STATE RECOVERY
// ========================================

/**
 * Auto-recovery: Restores system state from database on startup.
 * Restores trackedVillagers Map and DynamicProperties from persistent storage.
 * Runs silently - logs to console only.
 */
async function autoRecoverState() {
  console.warn("§b[Villager Lifecycle] Auto-recovering state from database...");
  
  try {
    const villagers = await getAllVillagersFromDB();
    
    if (!villagers || villagers.length === 0) {
      console.warn("§7[Villager Lifecycle] No villagers in database (fresh start)");
      return;
    }
    
    let restoredCount = 0;
    let dpRestoredCount = 0;
    
    for (const dbVillager of villagers) {
      const villagerID = dbVillager.villager_id;

      // Build Working Memory cache from DB (LOCAL MIRROR pattern)
      let wmCache = null;
      if (dbVillager.working_memory) {
        const wm = dbVillager.working_memory;
        
        // Parse vector string from PostgreSQL (row_to_json returns vectors as strings)
        let moodArray = [0.0, 0.0, 0.0, 0.0, 0.0];
        if (wm.current_mood_manual) {
          try {
            // Parse "[0.5, -0.3, 1.0, 0.0, -1.0]" -> [0.5, -0.3, 1.0, 0.0, -1.0]
            moodArray = typeof wm.current_mood_manual === 'string' 
              ? JSON.parse(wm.current_mood_manual)
              : wm.current_mood_manual;
          } catch (parseError) {
            console.warn(`§e[Recovery] Failed to parse mood vector for ${villagerID.substring(0, 12)}: ${parseError.message}`);
          }
        }
        
        wmCache = {
          currentMood: {
            C: moodArray[0] ?? 0.0,
            V: moodArray[1] ?? 0.0,
            I: moodArray[2] ?? 0.0,
            S: moodArray[3] ?? 0.0,
            X: moodArray[4] ?? 0.0,
          },
          currentFocus: wm.current_focus,
          shockState: wm.shock_state,
          lastUpdate: wm.last_update,
          needsDPSync: true,  // DPs not restored yet (will sync when in range)
          needsDBSync: false, // Restored from DB - no DB sync needed!
          needsSync: false,   // Legacy flag
          networkStatus: "restored",
          lastSyncSuccess: Date.now(),
        };
        
        if (isDebugMode()) {
          console.warn(`§b[Recovery] Built cache for ${villagerID.substring(0, 12)}: C=${wmCache.currentMood.C} V=${wmCache.currentMood.V} I=${wmCache.currentMood.I}`);
        }
      }

      // Restore to trackedVillagers Map with WM cache
      trackedVillagers.set(villagerID, {
        firstSeen: dbVillager.created_at,
        lastSeen: dbVillager.last_seen,
        location: {
          x: dbVillager.home_x,
          y: dbVillager.home_y,
          z: dbVillager.home_z,
        },
        nameTag: dbVillager.name,
        workingMemory: wmCache, // Populate cache (proximity-independent access!)
      });
      restoredCount++;

      // Restore DynamicProperties if entity is loaded (cache already populated above!)
      if (wmCache) {
        // Try to get entity (might not be loaded if out of range)
        let entity = activeVillagers.get(villagerID);
        if (!entity) {
          entity = world.getEntity(villagerID);
        }

        if (entity?.isValid) {
          // Use setWorkingMemory helper to write DPs (cache already set correctly above!)
          // IMPORTANT: skipCacheUpdate=true prevents overwriting the cache we just built!
          const success = setWorkingMemory(entity, wmCache, { skipCacheUpdate: true });
          
          if (success) {
            // Clear needsSync flag in DPs - data came FROM database
            entity.setDynamicProperty("wm_needsSync", false);
            entity.setDynamicProperty("wm_lastSyncSuccess", Date.now());
            entity.setDynamicProperty("wm_networkStatus", "restored");
            dpRestoredCount++;
          }
        }
        // If entity not loaded, that's OK - cache is already populated!
      }
    }
    
    console.warn(`§a[Villager Lifecycle] Auto-recovery complete:`);
    console.warn(`§a  - ${restoredCount} villagers restored to tracking`);
    console.warn(`§a  - ${dpRestoredCount} DynamicProperties restored`);
    
  } catch (error) {
    console.warn(`§e[Villager Lifecycle] Auto-recovery failed: ${error.message}`);
    console.warn("§7System will continue with empty state");
  }
}

// ========================================
// DETECTION SYSTEMS
// ========================================

/**
 * API-native proximity detection with "Fetch Once, Consume Everywhere" pattern.
 *
 * Detection Flow:
 * 1. For each player, query villagers within radius (API-native)
 * 2. Build Map of active villagers (villagerID → Entity)
 * 3. Detect NEW villagers (not in trackedVillagers Map)
 * 4. Activate villagers within radius
 * 5. Deactivate villagers beyond radius
 *
 * Performance Optimization:
 * - Queries entities ONCE per tick (in coordinator)
 * - Caches in activeVillagers Map
 * - Layers consume Map.values() or Map.entries() (ZERO queries in layers!)
 * - O(1) lookups by ID (vs O(n) for array)
 * - 50x faster than layers calling getEntities independently
 */
function startProximityDetection() {
  // Prevent duplicate loops
  if (lifecycleHandle) {
    console.warn("§e[Villager Lifecycle] Detection loop already running, stopping old loop first");
    system.clearRun(lifecycleHandle);
    setLifecycleHandle(null);
  }
  
  const handle = system.runInterval(() => {
    try {
      const allPlayers = world.getAllPlayers();

      if (allPlayers.length === 0) {
        // No players - deactivate all and clear state
        if (activeVillagers.size > 0) {
          for (const villagerID of activeVillagers.keys()) {
            handleDeactivation(villagerID);
          }
          updateActiveVillagers(new Map());
        }
        return;
      }

      const dimension = world.getDimension("overworld");
      const currentTickMap = new Map(); // Build fresh Map for this tick
      const seenThisTick = new Set(); // Dedupe within this tick (prevents getEntities() duplicates)

      // For each player, get ALL villagers within radius
      // Engine does distance calculation in C++ (FAST!)
      for (const player of allPlayers) {
        const nearbyVillagers = dimension.getEntities({
          type: "minecraft:villager_v2",
          location: player.location,
          maxDistance: LIFECYCLE_CONFIG.proximityRadius,
        });

        for (const villager of nearbyVillagers) {
          if (!villager?.isValid) continue;

          const villagerID = villager.id;
          
          // Skip if already processed this tick (getEntities() sometimes returns duplicates)
          if (seenThisTick.has(villagerID)) continue;
          seenThisTick.add(villagerID);

          // Cache entity reference (dedupe handled by Map)
          currentTickMap.set(villagerID, villager);

          // NEW VILLAGER DETECTION (exactly like sandbox)
          if (!trackedVillagers.has(villagerID)) {
            console.warn(`§e[Lifecycle] New villager detected: ${villager.nameTag || villagerID.substring(0, 12)}`);
            
            // Mark as tracked IMMEDIATELY to prevent re-detection (sandbox pattern)
            trackedVillagers.set(villagerID, {
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              location: villager.location,
              nameTag: villager.nameTag || "Unnamed",
              workingMemory: null, // Not initialized yet (LOCAL MIRROR pattern)
            });
            
            // Queue for delayed batch initialization
            initQueue.add(villager);
            
            continue; // Skip activation - let registration complete first
          }

          // Update metadata for existing villager
          const metadata = trackedVillagers.get(villagerID);
          metadata.lastSeen = Date.now();
          metadata.location = villager.location;

          // ACTIVATION: Use GLOBAL activeVillagers to check if this is new activation
          if (!activeVillagers.has(villagerID)) {
            handleActivation(villagerID, villager);
          }
        }
      }

      // DEACTIVATION: If ID was in GLOBAL map but NOT in new map
      for (const villagerID of activeVillagers.keys()) {
        if (!currentTickMap.has(villagerID)) {
          handleDeactivation(villagerID);
        }
      }

      // Update canonical state with fresh batch
      updateActiveVillagers(currentTickMap);
    } catch (error) {
      console.error(
        `§c[Villager Lifecycle] Proximity detection error: ${error.message}`,
      );
    }
  }, LIFECYCLE_CONFIG.proximityInterval);

  setLifecycleHandle(handle);

  console.warn(
    `§a[Villager Lifecycle] Proximity detection started (every ${LIFECYCLE_CONFIG.proximityInterval} ticks, radius: ${LIFECYCLE_CONFIG.proximityRadius} blocks)`,
  );
}

/**
 * Death event handler: Detects when a villager dies.
 * Removes villager from database (cascades to all related tables).
 */
function startDeathDetection() {
  world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;

    if (!entity || entity.typeId !== "minecraft:villager_v2") return;

    const villagerID = entity.id;

    if (trackedVillagers.has(villagerID)) {
      const metadata = trackedVillagers.get(villagerID);
      const villagerName = metadata.nameTag || "Unnamed";
      const location = metadata.location;

      handleVillagerDeath(villagerID, villagerName, location);
    }
  });

  console.warn("§a[Villager Lifecycle] Death detection enabled");
}

/**
 * Player leave handler: Re-evaluates proximity for all active villagers.
 * Deactivates villagers no longer within range of any remaining player.
 */
function startPlayerLeaveDetection() {
  world.afterEvents.playerLeave.subscribe(() => {
    system.runTimeout(() => {
      const remainingPlayers = world.getAllPlayers();

      if (remainingPlayers.length === 0) {
        // All players gone - deactivate all and clear state
        const count = activeVillagers.size;

        if (count > 0) {
          for (const villagerID of activeVillagers.keys()) {
            handleDeactivation(villagerID);
          }
          updateActiveVillagers(new Map());

          console.warn(
            `§c[Villager Lifecycle] All players left - deactivated ${count} villagers`,
          );
        }
      } else {
        // Some players remain - check which villagers are still in range
        const toDeactivate = [];

        for (const villagerID of activeVillagers.keys()) {
          const metadata = trackedVillagers.get(villagerID);
          if (!metadata) continue;

          const distance = getNearestPlayerDistance(
            metadata.location,
            remainingPlayers,
          );

          if (distance > LIFECYCLE_CONFIG.proximityRadius) {
            toDeactivate.push(villagerID);
          }
        }

        for (const villagerID of toDeactivate) {
          handleDeactivation(villagerID);
        }

        if (toDeactivate.length > 0) {
          console.warn(
            `§c[Villager Lifecycle] Player left - deactivated ${toDeactivate.length} villagers`,
          );
        }
      }
    }, 1);
  });

  console.warn("§a[Villager Lifecycle] Player leave detection enabled");
}

// ========================================
// PUBLIC INITIALIZATION
// ========================================

/**
 * Initializes the villager lifecycle system.
 * Restores state from database, then starts detection loops.
 * Should be called once during script initialization.
 */
export async function initializeVillagerLifecycle() {
  console.warn("§b[Villager Lifecycle] Initializing system...");

  // Step 1: Auto-recover state from database (warm start)
  await autoRecoverState();

  // Step 2: Start event-based detection (runs automatically)
  startDeathDetection();
  startPlayerLeaveDetection();

  // Step 3: Start proximity-based detection loop
  startProximityDetection();

  console.warn("§a[Villager Lifecycle] System initialized");
  console.warn(
    `§a[Villager Lifecycle] Detection radius: ${LIFECYCLE_CONFIG.proximityRadius} blocks`,
  );
  console.warn(
    `§a[Villager Lifecycle] Check interval: ${LIFECYCLE_CONFIG.proximityInterval} ticks`,
  );
}

/**
 * Starts the proximity detection loop.
 * Can be called to restart after manual stop.
 */
export function startLifecycleLoop() {
  // Stop existing loop if running
  stopLifecycleLoop();
  
  // Start proximity detection
  startProximityDetection();
  
  console.warn("§a[Villager Lifecycle] Detection loop started");
}

/**
 * Stops the proximity detection loop.
 * Useful for debugging or manual DP cleanup.
 */
export function stopLifecycleLoop() {
  const handle = lifecycleHandle;
  
  if (handle) {
    system.clearRun(handle);
    setLifecycleHandle(null);
    console.warn("§c[Villager Lifecycle] Detection loop stopped");
  } else {
    console.warn("§7[Villager Lifecycle] No loop running");
  }
}
