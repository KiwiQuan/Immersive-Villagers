import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

/**
 * SANDBOX TEST: API-Native Proximity Detection (REFACTORED)
 * 
 * PURPOSE: Test player-centric villager tracking using native API filtering.
 * Uses location + maxDistance parameters to let the C++ engine handle distance calculations.
 * 
 * IMPROVEMENTS FROM CODE REVIEW:
 * - DRY: Extracted distance calculation functions
 * - Performance: API-native filtering (O(m) instead of O(n × m))
 * - Maintainability: Command registry pattern (1 event subscription)
 * - UX: Reduced notification spam (only nearby players)
 * - Documentation: JSDoc type annotations
 * - Error Handling: Try-catch in async functions
 */

// ========================================
// CONSTANTS & CONFIGURATION
// ========================================

const CONFIG = {
  proximityRadius: 150, // blocks
  proximityInterval: 20, // ticks (1 second)
  particleInterval: 5, // ticks (4 times/sec - reduced from 20/sec)
  notificationRadius: 200, // blocks (only notify nearby players)
};

// ========================================
// STATE MANAGEMENT
// ========================================

const detectedVillagers = new Map(); // villagerID -> { firstSeen, lastSeen, location, nameTag }
const currentVillagerIDs = new Set(); // Villagers within proximity radius

const metrics = {
  proximityChecks: 0,
  newDetections: 0,
  activations: 0,
  deactivations: 0,
  deaths: 0,
};

const handles = {
  proximityCheck: null,
  particleVisualization: null,
};

let particleVisualizationEnabled = false;

// ========================================
// UTILITY FUNCTIONS (DRY PRINCIPLE)
// ========================================

/**
 * Calculates 3D Euclidean distance between two locations.
 * @param {Object} loc1 - First location {x, y, z}
 * @param {number} loc1.x - X coordinate
 * @param {number} loc1.y - Y coordinate
 * @param {number} loc1.z - Z coordinate
 * @param {Object} loc2 - Second location {x, y, z}
 * @returns {number} Distance in blocks
 */
function calculateDistance(loc1, loc2) {
  const dx = loc1.x - loc2.x;
  const dy = loc1.y - loc2.y;
  const dz = loc1.z - loc2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Finds the nearest player distance to a given location.
 * @param {Object} location - Target location {x, y, z}
 * @param {Player[]} players - Array of players
 * @returns {number} Distance to nearest player (Infinity if no players)
 */
function getNearestPlayerDistance(location, players) {
  if (players.length === 0) return Infinity;
  
  return Math.min(
    ...players.map(player => calculateDistance(location, player.location))
  );
}

/**
 * Notifies only players within notification radius.
 * @param {string} message - Message to send
 * @param {Object} location - Event location {x, y, z}
 * @param {number} [radius=200] - Notification radius in blocks
 */
function notifyNearbyPlayers(message, location, radius = CONFIG.notificationRadius) {
  const allPlayers = world.getAllPlayers();
  
  for (const player of allPlayers) {
    const distance = calculateDistance(player.location, location);
    if (distance <= radius) {
      player.sendMessage(message);
    }
  }
}

// ========================================
// DETECTION LOGIC
// ========================================

/**
 * Death event handler: Detects when a villager dies.
 * Removes from tracking and logs the event.
 */
function startDeathDetection() {
  world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;
    
    if (!entity || entity.typeId !== "minecraft:villager_v2") return;
    
    const villagerID = entity.id;
    
    if (detectedVillagers.has(villagerID)) {
      metrics.deaths++;
      
      const metadata = detectedVillagers.get(villagerID);
      const villagerName = metadata.nameTag || "Unnamed";
      
      // Remove from all tracking structures
      detectedVillagers.delete(villagerID);
      currentVillagerIDs.delete(villagerID);
      
      // Notify nearby players only
      notifyNearbyPlayers(
        `§c[Sandbox] Villager DIED: ${villagerName} (removed from tracking)`,
        metadata.location
      );
      
      console.warn(
        `§c[Sandbox] Villager ${villagerID} (${villagerName}) DIED - removed from tracking`
      );
    }
  });
  
  console.warn("§a[Sandbox] Death detection enabled");
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
        // No players left - deactivate all villagers
        const villagerCount = currentVillagerIDs.size;
        
        if (villagerCount > 0) {
          metrics.deactivations += villagerCount;
          
          console.warn(
            `§c[Sandbox] All players left - deactivating ${villagerCount} villagers`
          );
          
          currentVillagerIDs.clear();
        }
      } else {
        // Some players remain - check which villagers are still in range
        const villagersToDeactivate = [];
        
        for (const villagerID of currentVillagerIDs) {
          const metadata = detectedVillagers.get(villagerID);
          if (!metadata) continue;
          
          // Calculate distance to nearest remaining player
          const nearestDistance = getNearestPlayerDistance(metadata.location, remainingPlayers);
          
          // If no remaining player is within radius, deactivate
          if (nearestDistance > CONFIG.proximityRadius) {
            villagersToDeactivate.push(villagerID);
          }
        }
        
        // Deactivate villagers that are now out of range
        if (villagersToDeactivate.length > 0) {
          metrics.deactivations += villagersToDeactivate.length;
          
          console.warn(
            `§c[Sandbox] Player left - deactivating ${villagersToDeactivate.length} villagers (out of range)`
          );
          
          for (const villagerID of villagersToDeactivate) {
            currentVillagerIDs.delete(villagerID);
            
            const metadata = detectedVillagers.get(villagerID);
            const villagerName = metadata ? metadata.nameTag : villagerID;
            
            console.warn(
              `§c[Sandbox] Villager ${villagerID} (${villagerName}) marked INACTIVE (no nearby players)`
            );
            
            // Notify remaining players
            for (const player of remainingPlayers) {
              player.sendMessage(
                `§c[Sandbox] Villager INACTIVE: ${villagerName} (player left area)`
              );
            }
          }
        }
      }
    }, 1);
  });
  
  console.warn("§a[Sandbox] Player leave detection enabled");
}

/**
 * API-native proximity detection: Uses location + maxDistance for efficient filtering.
 * The C++ engine handles distance calculations - no manual loops!
 */
function startProximityDetection() {
  handles.proximityCheck = system.runInterval(() => {
    try {
      metrics.proximityChecks++;

      const allPlayers = world.getAllPlayers();
      if (allPlayers.length === 0) return;

      const dimension = world.getDimension("overworld");
      const villagersWithinRadius = new Set();

      // For each player, get ALL villagers within radius
      // Engine does distance calculation in C++ (FAST!)
      for (const player of allPlayers) {
        const nearbyVillagers = dimension.getEntities({
          type: "minecraft:villager_v2",
          location: player.location,
          maxDistance: CONFIG.proximityRadius,
        });

        // Process each villager found near this player
        for (const villager of nearbyVillagers) {
          if (!villager || !villager.isValid) continue;

          const villagerID = villager.id;
          const now = Date.now();
          
          villagersWithinRadius.add(villagerID);

          // NEW VILLAGER DETECTION
          if (!detectedVillagers.has(villagerID)) {
            metrics.newDetections++;

            detectedVillagers.set(villagerID, {
              firstSeen: now,
              lastSeen: now,
              location: villager.location,
              nameTag: villager.nameTag || "Unnamed",
            });

            const distance = calculateDistance(villager.location, player.location);
            
            notifyNearbyPlayers(
              `§a[Sandbox] NEW villager detected: ${villager.nameTag || "Unnamed"} (${Math.round(distance)}m)`,
              villager.location
            );

            console.warn(
              `§a[Sandbox] NEW villager detected: ${villagerID} at ${Math.round(distance)}m`
            );
          } else {
            // Update metadata for existing villager
            const metadata = detectedVillagers.get(villagerID);
            metadata.lastSeen = now;
            metadata.location = villager.location;
          }

          // ACTIVATION
          if (!currentVillagerIDs.has(villagerID)) {
            metrics.activations++;
            currentVillagerIDs.add(villagerID);

            const distance = calculateDistance(villager.location, player.location);

            notifyNearbyPlayers(
              `§a[Sandbox] Villager ACTIVE: ${villager.nameTag || "Unnamed"} (${Math.round(distance)}m)`,
              villager.location
            );

            console.warn(
              `§a[Sandbox] Villager ${villagerID} marked ACTIVE (distance: ${Math.round(distance)}m)`
            );
          }
        }
      }

      // DEACTIVATION CHECK: Remove villagers no longer within radius
      const villagersToDeactivate = [];
      for (const trackedID of currentVillagerIDs) {
        if (!villagersWithinRadius.has(trackedID)) {
          villagersToDeactivate.push(trackedID);
        }
      }

      if (villagersToDeactivate.length > 0) {
        metrics.deactivations += villagersToDeactivate.length;

        for (const inactiveID of villagersToDeactivate) {
          currentVillagerIDs.delete(inactiveID);

          const metadata = detectedVillagers.get(inactiveID);
          const villagerName = metadata ? metadata.nameTag : inactiveID;

          if (metadata) {
            notifyNearbyPlayers(
              `§c[Sandbox] Villager INACTIVE: ${villagerName} (beyond ${CONFIG.proximityRadius}m)`,
              metadata.location
            );
          }

          console.warn(
            `§c[Sandbox] Villager ${inactiveID} marked INACTIVE (beyond ${CONFIG.proximityRadius}m)`
          );
        }
      }
    } catch (error) {
      console.error(`§c[Sandbox] Proximity check error: ${error.message}`);
    }
  }, CONFIG.proximityInterval);

  console.warn(
    `§a[Sandbox] Proximity detection started (every ${CONFIG.proximityInterval} ticks, radius: ${CONFIG.proximityRadius} blocks)`
  );
}

/**
 * Particle visualization: Shows particles above active villagers.
 * Runs at reduced frequency (5 ticks) for better performance.
 */
function startParticleVisualization() {
  if (particleVisualizationEnabled) {
    world.sendMessage("§e[Sandbox] Particle visualization already running");
    return;
  }

  particleVisualizationEnabled = true;

  handles.particleVisualization = system.runInterval(() => {
    try {
      const dimension = world.getDimension("overworld");

      const visibleVillagers = dimension.getEntities({
        type: "minecraft:villager_v2",
      });

      for (const villager of visibleVillagers) {
        if (!villager || !villager.isValid) continue;

        if (currentVillagerIDs.has(villager.id)) {
          try {
            const particleLocation = {
              x: villager.location.x,
              y: villager.location.y + 2.5,
              z: villager.location.z,
            };

            dimension.spawnParticle("minecraft:endrod", particleLocation);
          } catch (particleError) {
            // Silently skip if chunk unloads mid-tick
          }
        }
      }
    } catch (error) {
      console.error(`§c[Sandbox] Particle error: ${error.message}`);
    }
  }, CONFIG.particleInterval);

  world.sendMessage(
    "§a[Sandbox] Particle visualization ENABLED (purple particles above active villagers)"
  );
  console.warn("§a[Sandbox] Particle visualization enabled");
}

/**
 * Stops particle visualization.
 */
function stopParticleVisualization() {
  if (!particleVisualizationEnabled) {
    world.sendMessage("§e[Sandbox] Particle visualization not running");
    return;
  }

  if (handles.particleVisualization !== null) {
    system.clearRun(handles.particleVisualization);
    handles.particleVisualization = null;
  }

  particleVisualizationEnabled = false;

  world.sendMessage("§c[Sandbox] Particle visualization DISABLED");
  console.warn("§c[Sandbox] Particle visualization disabled");
}

// ========================================
// DEBUG MODALS
// ========================================

/**
 * Shows debug modal with state inspection.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showDebugModal(player) {
  try {
    const dimension = world.getDimension("overworld");
    const actualVisibleVillagers = dimension.getEntities({
      type: "minecraft:villager_v2",
    });

    // Filter by proximity radius to match currentVillagerIDs logic
    const allPlayers = world.getAllPlayers();
    const actualVisibleWithinRadius = actualVisibleVillagers.filter((villager) => {
      if (!villager || !villager.isValid) return false;
      
      const nearestDistance = getNearestPlayerDistance(villager.location, allPlayers);
      return nearestDistance <= CONFIG.proximityRadius;
    });

    const actualVisibleCount = actualVisibleWithinRadius.length;

    const form = new ActionFormData();
    form.title("§lSandbox Debugger");

    const currentList = Array.from(currentVillagerIDs)
      .map((id) => {
        const metadata = detectedVillagers.get(id);
        return metadata ? metadata.nameTag : id;
      })
      .join(", ");

    form.body(
      `§e=== CURRENT (Active) ===\n` +
        `§aCount: ${currentVillagerIDs.size}\n` +
        `§7${currentList || "None"}\n\n` +
        `§e=== DETECTED (All Time) ===\n` +
        `§aCount: ${detectedVillagers.size}\n\n` +
        `§e=== ACTUAL VISIBLE ===\n` +
        `§aCount: ${actualVisibleCount}\n\n` +
        `§7Select an option below:`
    );

    form.button("View Current (Active)");
    form.button("View All Detected");
    form.button("View Specific Villager");
    form.button("Close");

    const response = await form.show(player);

    if (response.canceled) return;

    if (response.selection === 0) {
      showCurrentVillagersModal(player);
    } else if (response.selection === 1) {
      showAllDetectedModal(player);
    } else if (response.selection === 2) {
      showVillagerPickerModal(player);
    }
  } catch (error) {
    console.error(`§c[Sandbox] Debug modal error: ${error.message}`);
    player.sendMessage("§cDebug modal failed to load");
  }
}

/**
 * Shows current active villagers.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showCurrentVillagersModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§lCurrent Active Villagers");

    let bodyText = `§aTotal: ${currentVillagerIDs.size}\n\n`;

    for (const villagerID of currentVillagerIDs) {
      const metadata = detectedVillagers.get(villagerID);
      if (metadata) {
        bodyText += `§e${metadata.nameTag}\n`;
        bodyText += `§7  Location: X=${Math.round(metadata.location.x)}, Z=${Math.round(metadata.location.z)}\n\n`;
      } else {
        bodyText += `§e${villagerID}\n§7  (No metadata)\n\n`;
      }
    }

    if (currentVillagerIDs.size === 0) {
      bodyText = "§cNo villagers currently active";
    }

    form.body(bodyText);
    form.button("Back");

    const response = await form.show(player);
    if (!response.canceled) {
      showDebugModal(player);
    }
  } catch (error) {
    console.error(`§c[Sandbox] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows all detected villagers.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showAllDetectedModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§lAll Detected Villagers");

    let bodyText = `§aTotal: ${detectedVillagers.size}\n\n`;

    for (const [villagerID, metadata] of detectedVillagers) {
      const isActive = currentVillagerIDs.has(villagerID);
      const statusColor = isActive ? "§a" : "§7";
      const statusText = isActive ? "ACTIVE" : "INACTIVE";

      bodyText += `${statusColor}${metadata.nameTag} [${statusText}]\n`;
      bodyText += `§7  First seen: ${new Date(metadata.firstSeen).toLocaleTimeString()}\n\n`;
    }

    if (detectedVillagers.size === 0) {
      bodyText = "§cNo villagers detected yet";
    }

    form.body(bodyText);
    form.button("Back");

    const response = await form.show(player);
    if (!response.canceled) {
      showDebugModal(player);
    }
  } catch (error) {
    console.error(`§c[Sandbox] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Villager picker for detailed inspection.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showVillagerPickerModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§lSelect Villager");

    if (detectedVillagers.size === 0) {
      form.body("§cNo villagers detected yet");
      form.button("Back");
      const response = await form.show(player);
      showDebugModal(player);
      return;
    }

    form.body("§7Select a villager to view details:");

    const villagerList = Array.from(detectedVillagers.entries());
    for (const [villagerID, metadata] of villagerList) {
      const isActive = currentVillagerIDs.has(villagerID);
      const statusIcon = isActive ? "§a●" : "§7○";
      form.button(`${statusIcon} ${metadata.nameTag}`);
    }

    form.button("§cBack");

    const response = await form.show(player);

    if (response.canceled) {
      showDebugModal(player);
      return;
    }

    if (response.selection === villagerList.length) {
      showDebugModal(player);
      return;
    }

    const selectedVillager = villagerList[response.selection];
    showVillagerDetailsModal(player, selectedVillager[0], selectedVillager[1]);
  } catch (error) {
    console.error(`§c[Sandbox] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows detailed villager info.
 * @param {Player} player - The player to show the modal to
 * @param {string} villagerID - Villager entity ID
 * @param {Object} metadata - Villager metadata object
 * @returns {Promise<void>}
 */
async function showVillagerDetailsModal(player, villagerID, metadata) {
  try {
    const form = new ActionFormData();
    form.title(`§l${metadata.nameTag}`);

    const isActive = currentVillagerIDs.has(villagerID);
    const statusColor = isActive ? "§a" : "§c";
    const statusText = isActive ? "ACTIVE" : "INACTIVE";

    // Calculate current distance
    const allPlayers = world.getAllPlayers();
    const nearestDistance = getNearestPlayerDistance(metadata.location, allPlayers);
    const currentDistance = nearestDistance !== Infinity ? `${Math.round(nearestDistance)}m` : "Unknown";

    const bodyText =
      `${statusColor}Status: ${statusText}\n\n` +
      `§7First Seen: ${new Date(metadata.firstSeen).toLocaleTimeString()}\n` +
      `§7Last Seen: ${new Date(metadata.lastSeen).toLocaleTimeString()}\n\n` +
      `§eDistance to nearest player: ${currentDistance}\n` +
      `§eProximity radius: ${CONFIG.proximityRadius}m\n\n` +
      `§7Location:\n` +
      `§7  X=${Math.round(metadata.location.x)}\n` +
      `§7  Y=${Math.round(metadata.location.y)}\n` +
      `§7  Z=${Math.round(metadata.location.z)}`;

    form.body(bodyText);
    form.button("Back");

    const response = await form.show(player);
    if (!response.canceled) {
      showVillagerPickerModal(player);
    }
  } catch (error) {
    console.error(`§c[Sandbox] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

// ========================================
// COMMANDS
// ========================================

/**
 * Status command - shows detection statistics.
 */
function showStatus() {
  const dimension = world.getDimension("overworld");
  const actualVisibleVillagers = dimension.getEntities({
    type: "minecraft:villager_v2",
  });

  // Filter by proximity radius to match currentVillagerIDs logic
  const allPlayers = world.getAllPlayers();
  const actualVisibleWithinRadius = actualVisibleVillagers.filter((villager) => {
    if (!villager || !villager.isValid) return false;
    
    const nearestDistance = getNearestPlayerDistance(villager.location, allPlayers);
    return nearestDistance <= CONFIG.proximityRadius;
  });

  const actualVisibleCount = actualVisibleWithinRadius.length;

  for (const player of allPlayers) {
    player.sendMessage("§b========== SANDBOX STATUS ==========");
    player.sendMessage(`§6 Proximity checks run: ${metrics.proximityChecks}`);
    player.sendMessage(`§a New villagers detected: ${metrics.newDetections}`);
    player.sendMessage(`§a Activations: ${metrics.activations}`);
    player.sendMessage(`§c Deactivations: ${metrics.deactivations}`);
    player.sendMessage(`§4 Deaths: ${metrics.deaths}`);
    player.sendMessage("§b====================================");
    player.sendMessage(`§e Total detected: ${detectedVillagers.size}`);
    player.sendMessage(`§a Currently active: ${currentVillagerIDs.size}`);
    player.sendMessage(`§7 Actual visible: ${actualVisibleCount}`);
    if (currentVillagerIDs.size !== actualVisibleCount) {
      player.sendMessage(`§c MISMATCH! (Should investigate)`);
    } else {
      player.sendMessage(`§a Perfect tracking!`);
    }
    player.sendMessage("§b====================================");
  }

  console.warn("§b[Sandbox] ========== STATUS ==========");
  console.warn(`§6 Proximity checks: ${metrics.proximityChecks}`);
  console.warn(`§a New detections: ${metrics.newDetections}`);
  console.warn(`§a Activations: ${metrics.activations}`);
  console.warn(`§c Deactivations: ${metrics.deactivations}`);
  console.warn(`§4 Deaths: ${metrics.deaths}`);
  console.warn(`§e Total detected: ${detectedVillagers.size}`);
  console.warn(`§a Currently active: ${currentVillagerIDs.size}`);
  console.warn(`§7 Actual visible: ${actualVisibleCount}`);
  if (currentVillagerIDs.size !== actualVisibleCount) {
    console.warn(`§c MISMATCH DETECTED!`);
  } else {
    console.warn(`§a Perfect tracking!`);
  }

  // Show each villager
  for (const [villagerID, metadata] of detectedVillagers) {
    const isActive = currentVillagerIDs.has(villagerID);
    const statusIcon = isActive ? "§a●" : "§7○";
    console.warn(
      `${statusIcon} ${metadata.nameTag}: ${isActive ? "ACTIVE" : "INACTIVE"}`
    );
  }

  console.warn("§b[Sandbox] ====================================");
}

/**
 * Reset test data.
 */
function resetTest() {
  detectedVillagers.clear();
  currentVillagerIDs.clear();
  
  metrics.proximityChecks = 0;
  metrics.newDetections = 0;
  metrics.activations = 0;
  metrics.deactivations = 0;
  metrics.deaths = 0;

  if (handles.proximityCheck !== null) {
    system.clearRun(handles.proximityCheck);
    handles.proximityCheck = null;
  }

  if (handles.particleVisualization !== null) {
    system.clearRun(handles.particleVisualization);
    handles.particleVisualization = null;
    particleVisualizationEnabled = false;
  }

  world.sendMessage("§c[Sandbox] Test data reset");
  console.warn("§c[Sandbox] Test data reset");
}

// ========================================
// COMMAND REGISTRY (CONSOLIDATED EVENTS)
// ========================================

/**
 * Command registry mapping event IDs to handler functions.
 * Single event subscription pattern - more efficient than multiple subscriptions.
 */
const COMMAND_HANDLERS = {
  "sandbox:start": () => {
    world.sendMessage("§b[Sandbox] Starting proximity detection test...");
    startProximityDetection();
  },
  "sandbox:status": showStatus,
  "sandbox:debug": (event) => {
    if (event.sourceEntity) showDebugModal(event.sourceEntity);
  },
  "sandbox:particles_on": startParticleVisualization,
  "sandbox:particles_off": stopParticleVisualization,
  "sandbox:reset": resetTest,
};

/**
 * Initialize sandbox commands and event handlers.
 */
function initializeProximitySandbox() {
  // Always enable death detection (runs automatically)
  startDeathDetection();
  
  // Always enable player leave detection (runs automatically)
  startPlayerLeaveDetection();
  
  // Single event subscription with command routing
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    const handler = COMMAND_HANDLERS[event.id];
    if (handler) {
      try {
        handler(event);
      } catch (error) {
        console.error(`§c[Sandbox] Command error (${event.id}): ${error.message}`);
      }
    }
  });

  console.warn("§a[Sandbox] Proximity detection sandbox initialized");
  console.warn("§a[Sandbox] Commands:");
  console.warn("§a  - /scriptevent sandbox:start");
  console.warn("§a  - /scriptevent sandbox:status");
  console.warn("§a  - /scriptevent sandbox:debug");
  console.warn("§a  - /scriptevent sandbox:particles_on");
  console.warn("§a  - /scriptevent sandbox:particles_off");
  console.warn("§a  - /scriptevent sandbox:reset");
}

export { initializeProximitySandbox };
