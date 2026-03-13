/**
 * Villager Lifecycle - Debug Commands
 * 
 * ScriptEvent command handlers for testing proximity detection system.
 * Provides status reports and interactive debugging tools.
 * 
 * @module debug_commands
 */

import { world, system } from "@minecraft/server";
import { getNearestPlayerDistance } from "../../utils/geometry_helpers.js";
import {
  activeVillagers,
  trackedVillagers,
  LIFECYCLE_CONFIG,
} from "../villager_lifecycle/lifecycle_state.js";
import {
  showMainDebugModal,
  showProximityDebugModal,
  showDatabaseDebugModal,
} from "./debug_modals.js";
import {
  startParticleVisualization,
  stopParticleVisualization,
} from "./debug_particles.js";

/**
 * Shows proximity detection status in chat.
 * Validates tracking accuracy against actual visible villagers.
 */
function showProximityStatus() {
  const dimension = world.getDimension("overworld");
  const actualVisibleVillagers = dimension.getEntities({
    type: "minecraft:villager_v2",
  });

  // Filter by proximity radius
  const allPlayers = world.getAllPlayers();
  const actualVisibleWithinRadius = actualVisibleVillagers.filter(
    (villager) => {
      if (!villager || !villager.isValid) return false;

      const nearestDistance = getNearestPlayerDistance(
        villager.location,
        allPlayers
      );
      return nearestDistance <= LIFECYCLE_CONFIG.proximityRadius;
    }
  );

  const actualVisibleCount = actualVisibleWithinRadius.length;

  for (const player of allPlayers) {
    player.sendMessage("§b════════════════════════════════");
    player.sendMessage("§6  PROXIMITY DETECTION STATUS");
    player.sendMessage("§b════════════════════════════════");
    player.sendMessage(`§e Detection radius: ${LIFECYCLE_CONFIG.proximityRadius}m`);
    player.sendMessage(`§e Check interval: ${LIFECYCLE_CONFIG.proximityInterval} ticks`);
    player.sendMessage("§b────────────────────────────────");
    player.sendMessage(`§a Active villagers: ${activeVillagers.size}`);
    player.sendMessage(`§7 Total tracked: ${trackedVillagers.size}`);
    player.sendMessage(`§7 Actual visible: ${actualVisibleCount}`);
    player.sendMessage("§b────────────────────────────────");
    
    if (activeVillagers.size === actualVisibleCount) {
      player.sendMessage(`§a✓ Perfect tracking accuracy!`);
    } else {
      player.sendMessage(`§c✗ Tracking mismatch detected`);
      player.sendMessage(`§7  Difference: ${Math.abs(activeVillagers.size - actualVisibleCount)}`);
    }
    
    player.sendMessage("§b════════════════════════════════");
  }

  console.warn("§b[Debug] ════════ PROXIMITY STATUS ════════");
  console.warn(`§e Detection radius: ${LIFECYCLE_CONFIG.proximityRadius}m`);
  console.warn(`§a Active: ${activeVillagers.size}`);
  console.warn(`§7 Total tracked: ${trackedVillagers.size}`);
  console.warn(`§7 Actual visible: ${actualVisibleCount}`);
  
  if (activeVillagers.size === actualVisibleCount) {
    console.warn(`§a✓ Perfect tracking!`);
  } else {
    console.warn(`§c✗ Mismatch detected!`);
  }

  // List each villager
  for (const [villagerID, metadata] of trackedVillagers) {
    const isActive = activeVillagers.has(villagerID);
    const statusIcon = isActive ? "§a●" : "§7○";
    console.warn(
      `${statusIcon} ${metadata.nameTag}: ${isActive ? "ACTIVE" : "INACTIVE"}`
    );
  }

  console.warn("§b[Debug] ════════════════════════════════");
}

/**
 * Command registry for debug tools.
 * Maps scriptevent IDs to handler functions.
 */
const DEBUG_COMMAND_HANDLERS = {
  "debug:menu": (event) => {
    if (event.sourceEntity) showMainDebugModal(event.sourceEntity);
  },
  "debug:proximity_status": showProximityStatus,
  "debug:proximity_modal": (event) => {
    if (event.sourceEntity) showProximityDebugModal(event.sourceEntity);
  },
  "debug:database_modal": (event) => {
    if (event.sourceEntity) showDatabaseDebugModal(event.sourceEntity);
  },
  "debug:particles_on": startParticleVisualization,
  "debug:particles_off": stopParticleVisualization,
};

/**
 * Initializes debug command handlers.
 * Registers scriptevent listeners for all debug commands.
 */
export function initializeDebugCommands() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    const handler = DEBUG_COMMAND_HANDLERS[event.id];
    if (handler) {
      try {
        handler(event);
      } catch (error) {
        console.error(
          `§c[Debug] Command error (${event.id}): ${error.message}`
        );
      }
    }
  });

  console.warn("§a[Debug] Debug commands registered");
  console.warn("§a[Debug] Commands:");
  console.warn("§a  - /scriptevent debug:menu (main debug menu)");
  console.warn("§a  - /scriptevent debug:proximity_status");
  console.warn("§a  - /scriptevent debug:proximity_modal");
  console.warn("§a  - /scriptevent debug:database_modal");
  console.warn("§a  - /scriptevent debug:particles_on");
  console.warn("§a  - /scriptevent debug:particles_off");
}
