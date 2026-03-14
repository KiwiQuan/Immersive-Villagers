/**
 * Villager Lifecycle - Manual Control Commands
 *
 * Script event handlers for manual lifecycle control.
 * Useful for debugging and manual DP cleanup.
 *
 * Commands:
 * - /scriptevent lifecycle:start - Start detection loop
 * - /scriptevent lifecycle:stop - Stop detection loop
 * - /scriptevent lifecycle:cleanup - Clear all DPs and DB records
 *
 * @module lifecycle_commands
 */

import { world, system } from "@minecraft/server";
import {
  startLifecycleLoop,
  stopLifecycleLoop,
} from "./lifecycle_coordinator.js";
import {
  startWorkingMemorySync,
  stopWorkingMemorySync,
} from "../../layers/layer4_working_memory/working_memory_sync.js";
import { clearWorkingMemory } from "../../layers/layer4_working_memory/helpers/working_memory_helpers.js";
import { trackedVillagers } from "./lifecycle_state.js";
import { deleteRequest } from "../../utils/network_helpers.js";

/**
 * Clears all DynamicProperties and database records for all villagers.
 * @param {Player} player - Player who triggered the command
 */
async function cleanupAllVillagers(player) {
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§c§lFULL CLEANUP: DPs + Database");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Step 1: Clear DynamicProperties
  player.sendMessage("\n§7[1/2] Clearing DynamicProperties...");
  const dimension = world.getDimension("overworld");
  const allVillagers = dimension.getEntities({ type: "minecraft:villager_v2" });

  let clearedCount = 0;
  let failedCount = 0;

  for (const villager of allVillagers) {
    if (!villager?.isValid) continue;

    const success = clearWorkingMemory(villager);

    if (success) {
      clearedCount++;
    } else {
      failedCount++;
    }
  }

  // Clear tracked villagers Map
  trackedVillagers.clear();

  player.sendMessage(`§a✓ Cleared DPs: ${clearedCount}`);
  if (failedCount > 0) {
    player.sendMessage(`§c✗ Failed: ${failedCount}`);
  }

  // Step 2: Delete all database records
  player.sendMessage("\n§7[2/2] Deleting database records...");

  try {
    const result = await deleteRequest("/api/villagers/delete_all");

    if (result.status === "success") {
      player.sendMessage(
        `§a✓ Deleted ${result.deletedCount} villagers from DB`,
      );
      player.sendMessage("§7(Working Memory cascade deleted automatically)");
    } else {
      player.sendMessage(`§c✗ DB delete failed: ${result.message}`);
    }
  } catch (error) {
    player.sendMessage(`§c✗ DB delete error: ${error.message}`);
  }

  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§a§lCLEANUP COMPLETE");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

/**
 * Initializes script event listeners for lifecycle commands.
 */
export function initializeLifecycleCommands() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id, sourceEntity } = event;

    if (!sourceEntity?.isValid || sourceEntity.typeId !== "minecraft:player") {
      return;
    }

    const player = sourceEntity;

    if (id === "lifecycle:start") {
      startLifecycleLoop();
      startWorkingMemorySync();
      player.sendMessage("§a[Lifecycle] Detection and sync loops started");
    } else if (id === "lifecycle:stop") {
      stopLifecycleLoop();
      stopWorkingMemorySync();
      player.sendMessage("§c[Lifecycle] Detection and sync loops stopped");
    } else if (id === "lifecycle:cleanup") {
      cleanupAllVillagers(player);
    }
  });

  console.warn("§a[Lifecycle] Manual control commands registered");
  console.warn("§7  /scriptevent lifecycle:start - Start loops");
  console.warn("§7  /scriptevent lifecycle:stop - Stop loops");
  console.warn("§7  /scriptevent lifecycle:cleanup - Clear all DPs + DB");
}
