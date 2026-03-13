/**
 * Database Operations Debug Modal
 *
 * Interactive UI for testing villager database CRUD operations.
 * Allows direct manipulation of villager records for testing purposes.
 *
 * @module database_modal
 */

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  getRequest,
  postRequest,
  postRequestAsync,
  deleteRequest,
} from "../../../utils/network_helpers.js";
import {
  activeVillagers,
  trackedVillagers,
} from "../../villager_lifecycle/lifecycle_state.js";
import {
  clearAllWorkingMemory,
  clearWorkingMemory,
} from "../../../layers/layer4_working_memory/working_memory_helpers.js";

const BACKEND_BASE_URL = "/api/villagers";
/**
 * Shows main database operations modal.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
export async function showDatabaseDebugModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§l§9Database Operations");

    form.body(
      `§e━━━ VILLAGER DATABASE TESTING ━━━\n\n` +
        `§7This tool allows direct database operations\n` +
        `§7for testing backend connectivity and data.\n\n` +
        `§6Tracked Villagers: ${trackedVillagers.size}\n` +
        `§aActive Villagers: ${activeVillagers.size}\n\n` +
        `§7Select an operation below:`,
    );

    form.button("§a✓ Register New Villager");
    form.button("§e⚙ Update Villager Status");
    form.button("§c✗ Remove Villager");
    form.button("§b📄 View Villager in DB");
    form.button("§6📦 Batch: Register All");
    form.button("§6📦 Batch: Set All Active");
    form.button("§6📦 Batch: Set All Inactive");
    form.button("§4🗑 FULL RESET (Danger)");
    form.button("§8◄ Back");

    const response = await form.show(player);

    if (response.canceled) return;

    switch (response.selection) {
      case 0:
        await showRegisterVillagerModal(player);
        break;
      case 1:
        await showUpdateVillagerModal(player);
        break;
      case 2:
        await showRemoveVillagerModal(player);
        break;
      case 3:
        await showViewVillagerModal(player);
        break;
      case 4:
        await batchRegisterAllTracked(player);
        break;
      case 5:
        await batchSetAllActive(player);
        break;
      case 6:
        await batchSetAllInactive(player);
        break;
      case 7:
        await showFullResetModal(player);
        break;
      default:
        return;
    }
  } catch (error) {
    console.error(`§c[Debug] Database modal error: ${error.message}`);
    player.sendMessage("§cDatabase modal failed to load");
  }
}

/**
 * Shows modal to register a new villager in the database.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showRegisterVillagerModal(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to register");
      await showDatabaseDebugModal(player);
      return;
    }

    const form = new ActionFormData();
    form.title("§l§aRegister Villager");
    form.body("§7Select a villager to register in the database:");

    const villagerList = Array.from(trackedVillagers.entries());
    for (const [villagerID, metadata] of villagerList) {
      form.button(`${metadata.nameTag}\n§7ID: ${villagerID.slice(0, 8)}...`);
    }

    form.button("§8◄ Cancel");

    const response = await form.show(player);

    if (response.canceled || response.selection === villagerList.length) {
      await showDatabaseDebugModal(player);
      return;
    }

    const [villagerID, metadata] = villagerList[response.selection];

    try {
      player.sendMessage("§eRegistering villager in database...");

      const payload = {
        villagerID,
        name: metadata.nameTag,
        homeX: Math.round(metadata.location.x),
        homeY: Math.round(metadata.location.y),
        homeZ: Math.round(metadata.location.z),
        isActive: activeVillagers.has(villagerID),
      };

      await postRequestAsync(`${BACKEND_BASE_URL}/register`, payload);

      player.sendMessage(`§a✓ Registered: ${metadata.nameTag}`);
      console.warn(`§a[Debug] Registered villager ${villagerID} in database`);
    } catch (error) {
      player.sendMessage(`§c✗ Registration failed: ${error.message}`);
      console.error(`§c[Debug] Registration error: ${error.message}`);
    }

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows modal to update villager active status.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showUpdateVillagerModal(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to update");
      await showDatabaseDebugModal(player);
      return;
    }

    const form = new ActionFormData();
    form.title("§l§eUpdate Villager Status");
    form.body("§7Select a villager to update their active status:");

    const villagerList = Array.from(trackedVillagers.entries());
    for (const [villagerID, metadata] of villagerList) {
      const isActive = activeVillagers.has(villagerID);
      const statusIcon = isActive ? "§a●" : "§7○";
      form.button(
        `${statusIcon} ${metadata.nameTag}\n§7Current: ${isActive ? "ACTIVE" : "INACTIVE"}`,
      );
    }

    form.button("§8◄ Cancel");

    const response = await form.show(player);

    if (response.canceled || response.selection === villagerList.length) {
      await showDatabaseDebugModal(player);
      return;
    }

    const [villagerID, metadata] = villagerList[response.selection];
    const currentlyActive = activeVillagers.has(villagerID);

    const statusForm = new ActionFormData();
    statusForm.title(`§l§eUpdate: ${metadata.nameTag}`);
    statusForm.body(
      `§7Current Status: ${currentlyActive ? "§aACTIVE" : "§7INACTIVE"}\n\n` +
        `§7Set new status:`,
    );

    statusForm.button("§a✓ Set ACTIVE");
    statusForm.button("§7○ Set INACTIVE");
    statusForm.button("§8◄ Cancel");

    const statusResponse = await statusForm.show(player);

    if (statusResponse.canceled || statusResponse.selection === 2) {
      await showDatabaseDebugModal(player);
      return;
    }

    const newStatus = statusResponse.selection === 0;

    try {
      player.sendMessage("§eUpdating villager status...");

      await postRequestAsync(`${BACKEND_BASE_URL}/set-active`, {
        villagerID,
        isActive: newStatus,
      });

      player.sendMessage(
        `§a✓ Updated: ${metadata.nameTag} → ${newStatus ? "ACTIVE" : "INACTIVE"}`,
      );
      console.warn(
        `§a[Debug] Updated villager ${villagerID} status to ${newStatus}`,
      );
    } catch (error) {
      player.sendMessage(`§c✗ Update failed: ${error.message}`);
      console.error(`§c[Debug] Update error: ${error.message}`);
    }

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows modal to remove a villager from the database.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showRemoveVillagerModal(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to remove");
      await showDatabaseDebugModal(player);
      return;
    }

    const form = new ActionFormData();
    form.title("§l§cRemove Villager");
    form.body("§7Select a villager to remove from the database:");

    const villagerList = Array.from(trackedVillagers.entries());
    for (const [villagerID, metadata] of villagerList) {
      form.button(`${metadata.nameTag}\n§7ID: ${villagerID.slice(0, 8)}...`);
    }

    form.button("§8◄ Cancel");

    const response = await form.show(player);

    if (response.canceled || response.selection === villagerList.length) {
      await showDatabaseDebugModal(player);
      return;
    }

    const [villagerID, metadata] = villagerList[response.selection];

    const confirmForm = new ActionFormData();
    confirmForm.title("§l§cConfirm Removal");
    confirmForm.body(
      `§7Are you sure you want to remove\n` +
        `§e${metadata.nameTag}§7 from the database?\n\n` +
        `§cThis action cannot be undone!`,
    );

    confirmForm.button("§c✓ Confirm Remove");
    confirmForm.button("§7Cancel");

    const confirmResponse = await confirmForm.show(player);

    if (confirmResponse.canceled || confirmResponse.selection === 1) {
      await showDatabaseDebugModal(player);
      return;
    }

    try {
      player.sendMessage("§eRemoving villager from database...");

      await postRequestAsync(`${BACKEND_BASE_URL}/remove`, { villagerID });

      player.sendMessage(`§a✓ Removed: ${metadata.nameTag}`);
      console.warn(`§a[Debug] Removed villager ${villagerID} from database`);
    } catch (error) {
      player.sendMessage(`§c✗ Removal failed: ${error.message}`);
      console.error(`§c[Debug] Removal error: ${error.message}`);
    }

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Shows modal to view villager data from the database.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
async function showViewVillagerModal(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to view");
      await showDatabaseDebugModal(player);
      return;
    }

    const form = new ActionFormData();
    form.title("§l§bView Villager Data");
    form.body("§7Select a villager to view their database record:");

    const villagerList = Array.from(trackedVillagers.entries());
    for (const [villagerID, metadata] of villagerList) {
      form.button(`${metadata.nameTag}\n§7ID: ${villagerID.slice(0, 8)}...`);
    }

    form.button("§8◄ Cancel");

    const response = await form.show(player);

    if (response.canceled || response.selection === villagerList.length) {
      await showDatabaseDebugModal(player);
      return;
    }

    const [villagerID, metadata] = villagerList[response.selection];

    try {
      player.sendMessage("§eFetching villager data from database...");

      const dbData = await getRequest(`${BACKEND_BASE_URL}/get/${villagerID}`);

      const dataForm = new ActionFormData();
      dataForm.title(`§l§b${metadata.nameTag}`);

      if (dbData && dbData.villager) {
        const v = dbData.villager;
        dataForm.body(
          `§e━━━ DATABASE RECORD ━━━\n\n` +
            `§7Villager ID: §f${v.villager_id.slice(0, 16)}...\n` +
            `§7Name: §f${v.name}\n` +
            `§7Status: ${v.is_active ? "§aACTIVE" : "§7INACTIVE"}\n\n` +
            `§e━━━ HOME LOCATION ━━━\n\n` +
            `§7X: §f${v.home_x}\n` +
            `§7Y: §f${v.home_y}\n` +
            `§7Z: §f${v.home_z}\n\n` +
            `§e━━━ TIMESTAMPS ━━━\n\n` +
            `§7Created: §f${new Date(v.created_at).toLocaleString()}\n` +
            `§7Updated: §f${new Date(v.updated_at).toLocaleString()}`,
        );
      } else {
        dataForm.body(
          `§cNo database record found for:\n` +
            `§e${metadata.nameTag}\n\n` +
            `§7This villager may not be registered yet.`,
        );
      }

      dataForm.button("§8◄ Back");

      await dataForm.show(player);
    } catch (error) {
      player.sendMessage(`§c✗ Fetch failed: ${error.message}`);
      console.error(`§c[Debug] Fetch error: ${error.message}`);
    }

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Modal error: ${error.message}`);
    player.sendMessage("§cModal failed to load");
  }
}

/**
 * Batch registers all tracked villagers.
 * @param {Player} player - The player executing the command
 * @returns {Promise<void>}
 */
async function batchRegisterAllTracked(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to register");
      await showDatabaseDebugModal(player);
      return;
    }

    player.sendMessage(
      `§e[Batch] Registering ${trackedVillagers.size} villagers...`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const [villagerID, metadata] of trackedVillagers) {
      try {
        const payload = {
          villagerID,
          name: metadata.nameTag,
          homeX: Math.round(metadata.location.x),
          homeY: Math.round(metadata.location.y),
          homeZ: Math.round(metadata.location.z),
          isActive: activeVillagers.has(villagerID),
        };

        await postRequestAsync(`${BACKEND_BASE_URL}/register`, payload);
        successCount++;
      } catch (error) {
        console.error(
          `§c[Debug] Failed to register ${villagerID}: ${error.message}`,
        );
        failCount++;
      }
    }

    player.sendMessage(
      `§a[Batch] Complete: ${successCount} registered, ${failCount} failed`,
    );
    console.warn(
      `§a[Debug] Batch register complete: ${successCount}/${trackedVillagers.size}`,
    );

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Batch register error: ${error.message}`);
    player.sendMessage("§cBatch operation failed");
  }
}

/**
 * Batch sets all tracked villagers to active.
 * @param {Player} player - The player executing the command
 * @returns {Promise<void>}
 */
async function batchSetAllActive(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to update");
      await showDatabaseDebugModal(player);
      return;
    }

    player.sendMessage(
      `§e[Batch] Setting ${trackedVillagers.size} villagers to ACTIVE...`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const [villagerID] of trackedVillagers) {
      try {
        await postRequestAsync(`${BACKEND_BASE_URL}/set-active`, {
          villagerID,
          isActive: true,
        });
        successCount++;
      } catch (error) {
        console.error(
          `§c[Debug] Failed to update ${villagerID}: ${error.message}`,
        );
        failCount++;
      }
    }

    player.sendMessage(
      `§a[Batch] Complete: ${successCount} updated, ${failCount} failed`,
    );
    console.warn(
      `§a[Debug] Batch set active complete: ${successCount}/${trackedVillagers.size}`,
    );

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Batch update error: ${error.message}`);
    player.sendMessage("§cBatch operation failed");
  }
}

/**
 * Batch sets all tracked villagers to inactive.
 * @param {Player} player - The player executing the command
 * @returns {Promise<void>}
 */
async function batchSetAllInactive(player) {
  try {
    if (trackedVillagers.size === 0) {
      player.sendMessage("§cNo tracked villagers to update");
      await showDatabaseDebugModal(player);
      return;
    }

    player.sendMessage(
      `§e[Batch] Setting ${trackedVillagers.size} villagers to INACTIVE...`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const [villagerID] of trackedVillagers) {
      try {
        await postRequestAsync(`${BACKEND_BASE_URL}/set-active`, {
          villagerID,
          isActive: false,
        });
        successCount++;
      } catch (error) {
        console.error(
          `§c[Debug] Failed to update ${villagerID}: ${error.message}`,
        );
        failCount++;
      }
    }

    player.sendMessage(
      `§a[Batch] Complete: ${successCount} updated, ${failCount} failed`,
    );
    console.warn(
      `§a[Debug] Batch set inactive complete: ${successCount}/${trackedVillagers.size}`,
    );

    await showDatabaseDebugModal(player);
  } catch (error) {
    console.error(`§c[Debug] Batch update error: ${error.message}`);
    player.sendMessage("§cBatch operation failed");
  }
}

/**
 * Shows full reset confirmation modal.
 * Clears ALL villager data from both script and database.
 * @param {Player} player - The player executing the command
 * @returns {Promise<void>}
 */
async function showFullResetModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§4§l⚠ FULL RESET WARNING ⚠");

    form.body(
      `§c━━━ DANGER ZONE ━━━\n\n` +
        `§7This will §c§lPERMANENTLY DELETE§r§7:\n\n` +
        `§4✗ All villager records from database\n` +
        `§4✗ All Working Memory (DynamicProperties)\n` +
        `§4✗ All tracked villager metadata\n` +
        `§4✗ All working memory sync data\n\n` +
        `§e⚠ Currently tracked: ${trackedVillagers.size} villagers\n` +
        `§e⚠ Currently active: ${activeVillagers.size} villagers\n\n` +
        `§c§lTHIS CANNOT BE UNDONE!\n\n` +
        `§7Are you absolutely sure?`,
    );

    form.button("§4§l✓ YES, DELETE EVERYTHING");
    form.button("§8◄ Cancel (Go Back)");

    const response = await form.show(player);

    if (response.canceled || response.selection === 1) {
      await showDatabaseDebugModal(player);
      return;
    }

    // Double confirmation
    const confirmForm = new ActionFormData();
    confirmForm.title("§4§lFINAL CONFIRMATION");
    confirmForm.body(
      `§cLast chance to cancel!\n\n` +
        `§7Type the command again if you're sure.\n\n` +
        `§4This will delete ${trackedVillagers.size} villagers.`,
    );

    confirmForm.button("§4§l✓ CONFIRMED - DELETE ALL");
    confirmForm.button("§8◄ Cancel");

    const finalResponse = await confirmForm.show(player);

    if (finalResponse.canceled || finalResponse.selection === 1) {
      await showDatabaseDebugModal(player);
      return;
    }

    // Execute full reset
    await performFullReset(player);
  } catch (error) {
    console.error(`§c[Debug] Reset modal error: ${error.message}`);
    player.sendMessage("§cReset modal failed");
  }
}

/**
 * Performs the actual full reset operation.
 * @param {Player} player - The player executing the command
 * @returns {Promise<void>}
 */
async function performFullReset(player) {
  try {
    player.sendMessage("§4[FULL RESET] Starting complete data wipe...");

    const dimension = world.getDimension("overworld");
    let dpClearedCount = 0;
    let dbDeletedCount = 0;
    let dbFailedCount = 0;

    // Step 1: Clear DynamicProperties from all villagers
    player.sendMessage(
      "§e[Step 1/3] Clearing Working Memory from all villagers...",
    );

    const allVillagers = dimension.getEntities({
      type: "minecraft:villager_v2",
    });

    for (const villager of allVillagers) {
      if (!villager?.isValid) continue;

      try {
        clearAllWorkingMemory(villager);
        clearWorkingMemory(villager);
        dpClearedCount++;
      } catch (error) {
        console.error(
          `§c[Debug] Failed to clear DP for ${villager.id}: ${error.message}`,
        );
      }
    }

    player.sendMessage(
      `§a[Step 1/3] Cleared ${dpClearedCount} villager DynamicProperties`,
    );

    // Step 2: Delete all villagers from database
    player.sendMessage("§e[Step 2/3] Deleting all villagers from database...");

    try {
      const result = await deleteRequest(`${BACKEND_BASE_URL}/delete_all`);
      dbDeletedCount = result.deletedCount || 0;

      player.sendMessage(
        `§a[Step 2/3] Deleted ${dbDeletedCount} villagers from database`,
      );

      console.warn(
        `§a[Debug] Database deletion complete: ${dbDeletedCount} records removed`,
      );
    } catch (error) {
      console.error(
        `§c[Debug] Failed to delete all villagers: ${error.message}`,
      );
      player.sendMessage(
        `§c[Step 2/3] Database deletion failed: ${error.message}`,
      );
      dbFailedCount = trackedVillagers.size;
    }

    player.sendMessage(
      `§a[Step 2/3] Deleted ${dbDeletedCount} villagers from database (${dbFailedCount} failed)`,
    );

    // Step 3: Clear tracking maps
    player.sendMessage("§e[Step 3/3] Clearing tracking maps...");

    trackedVillagers.clear();
    activeVillagers.clear();

    player.sendMessage(`§a[Step 3/3] Tracking maps cleared`);

    // Final summary
    player.sendMessage("§a━━━━━━━━━━━━━━━━━━━━━━");
    player.sendMessage("§a§l✓ FULL RESET COMPLETE");
    player.sendMessage("§a━━━━━━━━━━━━━━━━━━━━━━");
    player.sendMessage(`§7DynamicProperties cleared: ${dpClearedCount}`);
    player.sendMessage(`§7Database records deleted: ${dbDeletedCount}`);
    player.sendMessage(`§7Tracking maps cleared: YES`);
    player.sendMessage("§a━━━━━━━━━━━━━━━━━━━━━━");

    console.warn(
      `§a[Debug] Full reset complete: ${dpClearedCount} DP cleared, ${dbDeletedCount} DB deleted`,
    );

    // Wait a moment before returning to menu
    system.runTimeout(() => {
      showDatabaseDebugModal(player);
    }, 60); // 3 seconds
  } catch (error) {
    console.error(`§c[Debug] Full reset error: ${error.message}`);
    player.sendMessage(`§c✗ Full reset failed: ${error.message}`);
    await showDatabaseDebugModal(player);
  }
}
