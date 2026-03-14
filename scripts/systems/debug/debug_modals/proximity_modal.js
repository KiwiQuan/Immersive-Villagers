/**
 * Proximity Detection Debug Modal
 * 
 * Interactive UI for testing and validating proximity detection system.
 * Real-time inspection of villager states and detection accuracy.
 * 
 * @module proximity_modal
 */

import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getNearestPlayerDistance } from "../../../utils/geometry_helpers.js";
import { formatTimestamp, formatLocation } from "../../../utils/notification_helpers.js";
import {
  activeVillagers,
  trackedVillagers,
  LIFECYCLE_CONFIG,
} from "../../villager_lifecycle/lifecycle_state.js";

/**
 * Shows main proximity detection debug modal.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
export async function showProximityDebugModal(player) {
  try {
    const dimension = world.getDimension("overworld");
    const actualVisibleVillagers = dimension.getEntities({
      type: "minecraft:villager_v2",
    });

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

    const form = new ActionFormData();
    form.title("§l§6Proximity Detection Debugger");

    const currentList = Array.from(activeVillagers)
      .map((id) => {
        const metadata = trackedVillagers.get(id);
        return metadata ? metadata.nameTag : id;
      })
      .join(", ");

    form.body(
      `§e━━━ PROXIMITY DETECTION TEST ━━━\n\n` +
        `§7This tool verifies the accuracy of the\n` +
        `§7API-native proximity detection system.\n\n` +
        `§e=== ACTIVE (Within ${LIFECYCLE_CONFIG.proximityRadius}m) ===\n` +
        `§aTracked: ${activeVillagers.size}\n` +
        `§7${currentList || "None"}\n\n` +
        `§e=== ALL TRACKED ===\n` +
        `§aTotal: ${trackedVillagers.size}\n\n` +
        `§e=== VALIDATION ===\n` +
        `§aActual visible: ${actualVisibleCount}\n` +
        (activeVillagers.size === actualVisibleCount
          ? `§a✓ Perfect tracking!\n`
          : `§c✗ Mismatch detected!\n`) +
        `\n§7Select an option below:`
    );

    form.button("● View Active Villagers");
    form.button("○ View All Tracked");
    form.button("🔍 Inspect Specific Villager");
    form.button("✕ Close");

    const response = await form.show(player);

    if (response.canceled) return;

    if (response.selection === 0) {
      showActiveVillagersModal(player);
    } else if (response.selection === 1) {
      showAllTrackedModal(player);
    } else if (response.selection === 2) {
      showVillagerPickerModal(player);
    }
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cDebug modal failed to load");
  }
}

/**
 * Shows currently active villagers (within proximity range).
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showActiveVillagersModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§l§aActive Villagers");

    let bodyText = `§7Villagers within ${LIFECYCLE_CONFIG.proximityRadius}m of any player\n\n`;
    bodyText += `§aTotal: ${activeVillagers.size}\n\n`;

    if (activeVillagers.size === 0) {
      bodyText += "§cNo villagers currently active\n";
      bodyText += "§7(Move closer to villagers to activate)";
    } else {
      for (const villagerID of activeVillagers) {
        const metadata = trackedVillagers.get(villagerID);
        if (metadata) {
          bodyText += `§e${metadata.nameTag}\n`;
          bodyText += `§7  ${formatLocation(metadata.location)}\n\n`;
        } else {
          bodyText += `§e${villagerID}\n§7  (No metadata)\n\n`;
        }
      }
    }

    form.body(bodyText);
    form.button("◄ Back");

    const response = await form.show(player);
    if (!response.canceled) {
      showProximityDebugModal(player);
    }
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows all tracked villagers (active and inactive).
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showAllTrackedModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§l§7All Tracked Villagers");

    let bodyText = `§7All villagers detected since script started\n\n`;
    bodyText += `§aTotal: ${trackedVillagers.size}\n\n`;

    if (trackedVillagers.size === 0) {
      bodyText += "§cNo villagers tracked yet\n";
      bodyText += "§7(Summon or find villagers to begin tracking)";
    } else {
      for (const [villagerID, metadata] of trackedVillagers) {
        const isActive = activeVillagers.has(villagerID);
        const statusColor = isActive ? "§a" : "§7";
        const statusText = isActive ? "ACTIVE" : "INACTIVE";

        bodyText += `${statusColor}${metadata.nameTag} [${statusText}]\n`;
        bodyText += `§7  First seen: ${formatTimestamp(metadata.firstSeen)}\n\n`;
      }
    }

    form.body(bodyText);
    form.button("◄ Back");

    const response = await form.show(player);
    if (!response.canceled) {
      showProximityDebugModal(player);
    }
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
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
    form.title("§l§eSelect Villager");

    if (trackedVillagers.size === 0) {
      form.body(
        "§cNo villagers tracked yet\n\n" +
          "§7Summon villagers or move near existing\n" +
          "§7villagers to begin tracking."
      );
      form.button("◄ Back");
      const response = await form.show(player);
      showProximityDebugModal(player);
      return;
    }

    form.body(
      `§7Select a villager to view detailed\n` +
        `§7proximity detection information:\n\n` +
        `§a● §7= Within proximity range\n` +
        `§7○ §7= Beyond proximity range`
    );

    const villagerList = Array.from(trackedVillagers.entries());
    for (const [villagerID, metadata] of villagerList) {
      const isActive = activeVillagers.has(villagerID);
      const statusIcon = isActive ? "§a●" : "§7○";
      form.button(`${statusIcon} ${metadata.nameTag}`);
    }

    form.button("◄ Back");

    const response = await form.show(player);

    if (response.canceled) {
      showProximityDebugModal(player);
      return;
    }

    if (response.selection === villagerList.length) {
      showProximityDebugModal(player);
      return;
    }

    const selectedVillager = villagerList[response.selection];
    showVillagerDetailsModal(
      player,
      selectedVillager[0],
      selectedVillager[1]
    );
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows detailed villager info with proximity metrics.
 * @param {Player} player - The player to show the modal to
 * @param {string} villagerID - Villager entity ID
 * @param {Object} metadata - Villager metadata object
 * @returns {Promise<void>}
 */
async function showVillagerDetailsModal(player, villagerID, metadata) {
  try {
    const form = new ActionFormData();
    form.title(`§l§e${metadata.nameTag}`);

    const isActive = activeVillagers.has(villagerID);
    const statusColor = isActive ? "§a" : "§c";
    const statusText = isActive ? "ACTIVE" : "INACTIVE";

    const allPlayers = world.getAllPlayers();
    const nearestDistance = getNearestPlayerDistance(
      metadata.location,
      allPlayers
    );
    const currentDistance =
      nearestDistance !== Infinity
        ? `${Math.round(nearestDistance)}m`
        : "Unknown";

    const bodyText =
      `§e━━━ PROXIMITY DETECTION INFO ━━━\n\n` +
      `${statusColor}Detection Status: ${statusText}\n\n` +
      `§7First Detected: ${formatTimestamp(metadata.firstSeen)}\n` +
      `§7Last Seen: ${formatTimestamp(metadata.lastSeen)}\n\n` +
      `§e━━━ PROXIMITY METRICS ━━━\n\n` +
      `§6Distance to nearest player: ${currentDistance}\n` +
      `§6Detection radius: ${LIFECYCLE_CONFIG.proximityRadius}m\n` +
      (isActive
        ? `§a✓ Within detection range\n`
        : `§c✗ Beyond detection range\n`) +
      `\n§e━━━ LOCATION ━━━\n\n` +
      `§7${formatLocation(metadata.location)}`;

    form.body(bodyText);
    form.button("◄ Back");

    const response = await form.show(player);
    if (!response.canceled) {
      showVillagerPickerModal(player);
    }
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}
