/**
 * Debug Modals - Main Entry Point
 * 
 * Router for all debug modal systems.
 * Provides main menu and delegates to specialized modal modules.
 * 
 * @module debug_modals
 */

import { ActionFormData } from "@minecraft/server-ui";
import { showProximityDebugModal } from "./debug_modals/proximity_modal.js";
import { showDatabaseDebugModal } from "./debug_modals/database_modal.js";

/**
 * Shows main debug menu with all available tools.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
export async function showMainDebugModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§l§6Debug Tools");

    form.body(
      `§e━━━ IMMERSIVE VILLAGERS DEBUG ━━━\n\n` +
        `§7Select a debugging tool:\n\n` +
        `§6Proximity Detection §7- Test villager tracking\n` +
        `§9Database Operations §7- CRUD testing\n`
    );

    form.button("§6📍 Proximity Detection\n§7Test tracking accuracy");
    form.button("§9💾 Database Operations\n§7Test backend CRUD");
    form.button("§8✕ Close");

    const response = await form.show(player);

    if (response.canceled) return;

    switch (response.selection) {
      case 0:
        await showProximityDebugModal(player);
        break;
      case 1:
        await showDatabaseDebugModal(player);
        break;
      default:
        return;
    }
  } catch (error) {
    console.error(`§c[Debug] Main menu error: ${error.message}`);
    player.sendMessage("§cDebug menu failed to load");
  }
}

// Re-export modal functions for direct access
export { showProximityDebugModal } from "./debug_modals/proximity_modal.js";
export { showDatabaseDebugModal } from "./debug_modals/database_modal.js";
