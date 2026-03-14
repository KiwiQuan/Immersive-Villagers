/**
 * SANDBOX: Working Memory Sync Diagnostics
 *
 * Purpose: Test state recovery and sync flow with ATOMIC initialization
 *
 * Key Features:
 * 1. Restore frontend state from backend (trackedVillagers + DynamicProperties)
 * 2. Automatic loops with batch queuing (detection + sync)
 * 3. Manual step-by-step testing (register → init DP → sync)
 * 4. Manual Working Memory modification (test sync)
 * 5. Sync verification (compare DP vs DB)
 * 6. Detailed diagnostics for each villager
 *
 * SIMPLIFIED APPROACH (v3 - BACKEND LAZY INITIALIZATION):
 * - Backend WM sync endpoint ensures villager exists FIRST (lazy initialization)
 * - Frontend just calls initializeWorkingMemory() - NO MORE registration queueing!
 * - Backend handles villager creation + WM sync in ONE atomic transaction
 * - ZERO race conditions - impossible to get FK violations
 * - Sync queue ONLY for runtime updates (mood changes during gameplay)
 *
 * Commands:
 * - /scriptevent sandbox:recover - Restore state from DB
 * - /scriptevent sandbox:inspect - Show current state & verify sync
 * - /scriptevent sandbox:cleanup - Clear all DynamicProperties
 * - /scriptevent sandbox:test - Step-by-step manual testing
 * - /scriptevent sandbox:modify - Manually change Working Memory values
 * - /scriptevent sandbox:start - Start automatic loops (detection + sync)
 * - /scriptevent sandbox:stop - Stop automatic loops
 */

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  getRequest,
  postRequest,
  deleteRequest,
} from "../utils/network_helpers.js";
import {
  initializeWorkingMemory,
  hasWorkingMemory,
  hasWorkingMemoryInDB,
  clearWorkingMemory,
  getWorkingMemory,
  getWorkingMemoryWithMetadata,
  compareWorkingMemory,
} from "../layers/layer4_working_memory/helpers/working_memory_helpers.js";

// ========================================
// STATE MANAGEMENT
// ========================================

const sandboxTrackedVillagers = new Map();

// ========================================
// STATE RECOVERY (DB → Frontend)
// ========================================

/**
 * Fetches all villagers from database and restores frontend state.
 *
 * Recovery Flow:
 * 1. Fetch all villager records from DB
 * 2. Populate sandboxTrackedVillagers Map
 * 3. For each villager with working_memory:
 *    - Find entity in world via world.getEntity(id)
 *    - Restore DynamicProperties from DB data
 *
 * @param {Player} player - Player requesting recovery
 */
async function recoverStateFromDatabase(player) {
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§b§lSTATE RECOVERY: DB → Frontend");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Step 1: Fetch all DB villagers
  player.sendMessage("\n§7[1/3] Fetching villagers from database...");

  let dbVillagers = [];
  try {
    const response = await getRequest("/api/villagers/all");

    if (response.status !== "success" || !response.villagers) {
      player.sendMessage(
        `§c✗ Failed to fetch: ${response.message || "Unknown error"}`,
      );
      return;
    }

    dbVillagers = response.villagers;
    player.sendMessage(
      `§a✓ Found ${dbVillagers.length} villager(s) in database`,
    );
  } catch (error) {
    player.sendMessage(`§c✗ Database fetch failed: ${error.message}`);
    return;
  }

  if (dbVillagers.length === 0) {
    player.sendMessage("§7No villagers in database - nothing to recover");
    return;
  }

  // Step 2: Populate trackedVillagers Map
  player.sendMessage("\n§7[2/3] Populating trackedVillagers Map...");

  sandboxTrackedVillagers.clear();

  for (const dbVillager of dbVillagers) {
    sandboxTrackedVillagers.set(dbVillager.villager_id, {
      firstSeen: Date.now(), // We don't have original timestamp
      lastSeen: Date.now(),
      location: {
        x: dbVillager.home_x,
        y: dbVillager.home_y,
        z: dbVillager.home_z,
      },
      nameTag: dbVillager.name,
    });
  }

  player.sendMessage(`§a✓ Populated ${sandboxTrackedVillagers.size} entries`);

  // Step 3: Restore DynamicProperties from working_memory
  player.sendMessage("\n§7[3/3] Restoring DynamicProperties...");

  let restoredCount = 0;
  let notFoundCount = 0;
  let noWorkingMemoryCount = 0;

  for (const dbVillager of dbVillagers) {
    const villagerID = dbVillager.villager_id;

    // Fetch entity from world
    const entity = world.getEntity(villagerID);

    if (!entity || !entity.isValid) {
      notFoundCount++;
      player.sendMessage(`§7  ${dbVillager.name}: §8Entity not in world`);
      continue;
    }

    // Check if DB has working_memory (LEFT JOIN returns {villager_id: null, ...} when no row)
    const wm = dbVillager.working_memory;
    if (!wm || wm.villager_id === null) {
      noWorkingMemoryCount++;
      player.sendMessage(`§7  ${dbVillager.name}: §8No WM in DB`);
      continue;
    }

    // Restore DynamicProperties from DB
    try {
      // Unpack current_mood_manual array [C, V, I, S, X]
      // PostgreSQL VECTOR(5) comes back as string "[0.5,0.5,0.5,0.5,0.5]"
      let moodVector = wm.current_mood_manual;

      if (typeof moodVector === "string") {
        moodVector = JSON.parse(moodVector);
      }

      player.sendMessage(`§7  DB moodVector: ${JSON.stringify(moodVector)}`);

      if (moodVector && Array.isArray(moodVector) && moodVector.length === 5) {
        entity.setDynamicProperty("wm_currentMood_C", moodVector[0]);
        entity.setDynamicProperty("wm_currentMood_V", moodVector[1]);
        entity.setDynamicProperty("wm_currentMood_I", moodVector[2]);
        entity.setDynamicProperty("wm_currentMood_S", moodVector[3]);
        entity.setDynamicProperty("wm_currentMood_X", moodVector[4]);
      } else {
        player.sendMessage(
          `§e  Invalid mood vector, using defaults (neutral 0.0)`,
        );
        entity.setDynamicProperty("wm_currentMood_C", 0.0);
        entity.setDynamicProperty("wm_currentMood_V", 0.0);
        entity.setDynamicProperty("wm_currentMood_I", 0.0);
        entity.setDynamicProperty("wm_currentMood_S", 0.0);
        entity.setDynamicProperty("wm_currentMood_X", 0.0);
      }

      entity.setDynamicProperty("wm_currentFocus", wm.current_focus || "none");
      entity.setDynamicProperty("wm_shockState", wm.shock_state || false);
      entity.setDynamicProperty("wm_lastUpdate", wm.last_update || Date.now());
      entity.setDynamicProperty("wm_needsSync", false); // Already synced from DB
      entity.setDynamicProperty("wm_networkStatus", "recovered");
      entity.setDynamicProperty("wm_lastSyncSuccess", Date.now());

      // Verify what was actually set
      const verifyC = entity.getDynamicProperty("wm_currentMood_C");
      player.sendMessage(`§7  Verified: C = ${verifyC}`);

      restoredCount++;
      player.sendMessage(`§a  ${dbVillager.name}: §a✓ Restored`);
    } catch (error) {
      player.sendMessage(`§c  ${dbVillager.name}: §c✗ ${error.message}`);
    }
  }

  // Summary
  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§a§lRECOVERY COMPLETE");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage(`§7Total DB records: ${dbVillagers.length}`);
  player.sendMessage(`§a✓ Restored DynamicProps: ${restoredCount}`);
  player.sendMessage(`§8⊘ Entity not in world: ${notFoundCount}`);
  player.sendMessage(`§8⊘ No WM in DB: ${noWorkingMemoryCount}`);
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ========================================
// CLEANUP (Clear DynamicProperties)
// ========================================

/**
 * Clears all Working Memory DynamicProperties from all villagers AND deletes all DB records.
 * Uses production helper: clearWorkingMemory()
 */
async function clearAllDynamicProperties(player) {
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

  sandboxTrackedVillagers.clear();

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
  player.sendMessage("§a§lFULL CLEANUP COMPLETE");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage(`§a✓ DPs Cleared: ${clearedCount}`);
  player.sendMessage(`§a✓ Tracking Map Cleared`);
  player.sendMessage(`§a✓ Database Reset`);
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ========================================
// INSPECTION (Current State)
// ========================================

/**
 * Shows villager picker modal for inspection.
 */
async function showInspectModal(player) {
  const dimension = world.getDimension("overworld");
  const allVillagers = dimension.getEntities({ type: "minecraft:villager_v2" });

  if (allVillagers.length === 0) {
    player.sendMessage("§cNo villagers found in world");
    return;
  }

  const form = new ActionFormData();
  form.title("§l§9Villager Inspector");
  form.body(
    `§7Found ${allVillagers.length} villager(s) in world\n\n§eSelect to inspect:`,
  );

  for (const villager of allVillagers) {
    if (!villager?.isValid) continue;

    const name = villager.nameTag || "Unnamed";
    const id = villager.id;

    // Quick status check using production helper
    const hasWM = hasWorkingMemory(villager);
    const inTracking = sandboxTrackedVillagers.has(id);

    const dpIcon = hasWM ? "§a✓" : "§c✗";
    const trackIcon = inTracking ? "§a✓" : "§c✗";

    form.button(
      `§0${name} ${dpIcon}\n§0Track:${trackIcon} §0ID:${id.substring(0, 10)}...`,
    );
  }

  const response = await form.show(player);
  if (response.canceled) return;

  const selectedVillager = allVillagers[response.selection];
  await showVillagerInspectDetail(player, selectedVillager);
}

/**
 * Shows detailed inspection for a single villager.
 */
async function showVillagerInspectDetail(player, villager) {
  if (!villager?.isValid) {
    player.sendMessage("§cVillager no longer valid");
    return;
  }

  const id = villager.id;
  const name = villager.nameTag || "Unnamed";

  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage(`§b§lINSPECTING: §e${name}`);
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage(`§7ID: §8${id}`);

  // Check 1: Is tracked in sandbox?
  const inTracking = sandboxTrackedVillagers.has(id);
  player.sendMessage(`\n§l§9TRACKING STATE:`);
  player.sendMessage(
    inTracking ? "§a✓ In sandboxTrackedVillagers" : "§c✗ Not tracked",
  );

  // Check 2: DynamicProperties using production helpers
  player.sendMessage(`\n§l§9DYNAMIC PROPERTIES:`);
  player.sendMessage("§7Using: hasWorkingMemory() & getWorkingMemory()");

  const hasWM = hasWorkingMemory(villager); // Use production helper

  if (hasWM) {
    const wm = getWorkingMemory(villager); // Use production helper

    if (wm) {
      player.sendMessage("§a✓ Working Memory initialized:");
      player.sendMessage(
        `  §7C:${wm.currentMood.C.toFixed(2)} V:${wm.currentMood.V.toFixed(2)} I:${wm.currentMood.I.toFixed(2)}`,
      );
      player.sendMessage(
        `  §7S:${wm.currentMood.S.toFixed(2)} X:${wm.currentMood.X.toFixed(2)}`,
      );
      player.sendMessage(`  §7Focus: ${wm.currentFocus || "none"}`);
      player.sendMessage(`  §7Shock: ${wm.shockState}`);
    } else {
      player.sendMessage(
        "§c✗ hasWorkingMemory=true but getWorkingMemory failed",
      );
    }
  } else {
    player.sendMessage(
      "§c✗ Working Memory not initialized (hasWorkingMemory=false)",
    );
  }

  const hasLastUpdate =
    villager.getDynamicProperty("wm_lastUpdate") !== undefined;
  const needsSync = villager.getDynamicProperty("wm_needsSync");
  const networkStatus = villager.getDynamicProperty("wm_networkStatus");
  const lastSyncSuccess = villager.getDynamicProperty("wm_lastSyncSuccess");

  player.sendMessage(
    hasLastUpdate ? "§a✓ Metadata initialized" : "§c✗ Metadata missing",
  );
  if (needsSync !== undefined) {
    player.sendMessage(`  §7needsSync: ${needsSync}`);
  }
  if (networkStatus) {
    player.sendMessage(`  §7networkStatus: ${networkStatus}`);
  }
  if (lastSyncSuccess) {
    const elapsed = ((Date.now() - lastSyncSuccess) / 1000).toFixed(1);
    player.sendMessage(`  §7lastSync: ${elapsed}s ago`);
  }

  // Check 3: Database registration
  player.sendMessage(`\n§l§9DATABASE:`);
  try {
    const dbCheck = await getRequest(`/api/villagers/get_with_memory/${id}`);
    const exists = dbCheck.status === "success" && dbCheck.villager !== null;

    if (exists) {
      player.sendMessage("§a✓ Registered in DB");

      // LEFT JOIN returns {villager_id: null, ...} when no WM row exists
      const wm = dbCheck.villager.working_memory;
      const hasWM = wm && wm.villager_id !== null;

      player.sendMessage(
        hasWM
          ? "§a✓ Working Memory synced to DB"
          : "§c✗ Working Memory not synced yet",
      );
    } else {
      player.sendMessage("§c✗ Not registered in DB");
    }
  } catch (error) {
    player.sendMessage(`§c✗ DB check failed: ${error.message}`);
  }

  // Check 4: Compare DynamicProperties vs Database
  player.sendMessage(`\n§l§9SYNC VERIFICATION:`);
  player.sendMessage("§7Comparing DP vs DB...");

  try {
    const comparison = await compareWorkingMemory(villager);

    if (comparison.status === "success") {
      if (comparison.inSync) {
        player.sendMessage("§a✓ IN SYNC (DP matches DB)");
        player.sendMessage(
          `§7Max difference: ${comparison.maxDifference.toFixed(6)}`,
        );
      } else {
        player.sendMessage("§c✗ OUT OF SYNC");
        player.sendMessage(
          `§7Max difference: ${comparison.maxDifference.toFixed(6)}`,
        );
        player.sendMessage("§7Mood differences:");
        player.sendMessage(
          `  §7C: ${comparison.differences.mood.C.toFixed(4)}`,
        );
        player.sendMessage(
          `  §7V: ${comparison.differences.mood.V.toFixed(4)}`,
        );
        player.sendMessage(
          `  §7I: ${comparison.differences.mood.I.toFixed(4)}`,
        );
        player.sendMessage(
          `  §7S: ${comparison.differences.mood.S.toFixed(4)}`,
        );
        player.sendMessage(
          `  §7X: ${comparison.differences.mood.X.toFixed(4)}`,
        );

        if (comparison.differences.focus) {
          player.sendMessage(
            `  §7Focus mismatch: DP=${comparison.dynamicProperties.currentFocus}, DB=${comparison.database.currentFocus}`,
          );
        }
      }
    } else {
      player.sendMessage(`§c✗ Comparison failed: ${comparison.message}`);
    }
  } catch (error) {
    player.sendMessage(`§c✗ Comparison error: ${error.message}`);
  }

  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Return to picker
  system.runTimeout(() => showInspectModal(player), 40);
}

// ========================================
// MANUAL MODIFICATION (Testing Tool)
// ========================================

/**
 * Shows villager picker for manual Working Memory modification.
 */
async function showModifyModal(player) {
  const dimension = world.getDimension("overworld");
  const allVillagers = dimension.getEntities({ type: "minecraft:villager_v2" });

  if (allVillagers.length === 0) {
    player.sendMessage("§cNo villagers found in world");
    return;
  }

  const form = new ActionFormData();
  form.title("§l§6Modify Working Memory");
  form.body(
    "§7Select a villager to modify their Working Memory:\n\n§ePurpose: Test syncing by changing values",
  );

  for (const villager of allVillagers) {
    if (!villager?.isValid) continue;
    const name = villager.nameTag || "Unnamed";
    const hasWM = hasWorkingMemory(villager);
    const status = hasWM ? "§a✓" : "§c✗";
    form.button(
      `§0${status} ${name}\n§0ID: ${villager.id.substring(0, 12)}...`,
    );
  }

  const response = await form.show(player);
  if (response.canceled) return;

  const selectedVillager = allVillagers[response.selection];
  if (!selectedVillager?.isValid) {
    player.sendMessage("§cVillager is no longer valid");
    return;
  }

  await showModifyForm(player, selectedVillager);
}

/**
 * Shows form to edit Working Memory values.
 */
async function showModifyForm(player, villager) {
  const name = villager.nameTag || "Unnamed";

  // Get current values
  let currentWM = null;
  if (hasWorkingMemory(villager)) {
    currentWM = getWorkingMemory(villager);
  }

  const form = new ModalFormData();
  form.title(`§l§6Modify: ${name}`);

  if (!currentWM) {
    form.textField("§cWorking Memory not initialized!", "Initialize first");
    const response = await form.show(player);
    player.sendMessage(
      "§cWorking Memory not initialized. Run Step 2 or use automatic loops.",
    );
    return;
  }

  // Add explanation label
  form.label(
    "§7Slider Conversion: §e0§7=§c-1.0  §e100§7=§a0.0  §e200§7=§b+1.0",
  );
  form.label("§8────────────────────────────────");

  // Sliders for mood values (0-200 integer range, converts to -1.0 to 1.0)
  // 0 = -1.0, 100 = 0.0 (neutral), 200 = 1.0
  // Conversion: (slider_value / 100) - 1 = actual_value
  const cDefault = Math.round((currentWM.currentMood.C + 1) * 100);
  const vDefault = Math.round((currentWM.currentMood.V + 1) * 100);
  const iDefault = Math.round((currentWM.currentMood.I + 1) * 100);
  const sDefault = Math.round((currentWM.currentMood.S + 1) * 100);
  const xDefault = Math.round((currentWM.currentMood.X + 1) * 100);

  form.slider(
    `§l§eC §f(Constructiveness) §a[${currentWM.currentMood.C.toFixed(2)}]`,
    0,
    200,
    { defaultValue: cDefault },
  );
  form.slider(
    `§l§eV §f(Value) §a[${currentWM.currentMood.V.toFixed(2)}]`,
    0,
    200,
    { defaultValue: vDefault },
  );
  form.slider(
    `§l§eI §f(Intensity) §a[${currentWM.currentMood.I.toFixed(2)}]`,
    0,
    200,
    { defaultValue: iDefault },
  );
  form.slider(
    `§l§eS §f(Sociality) §a[${currentWM.currentMood.S.toFixed(2)}]`,
    0,
    200,
    { defaultValue: sDefault },
  );
  form.slider(
    `§l§eX §f(Complexity) §a[${currentWM.currentMood.X.toFixed(2)}]`,
    0,
    200,
    { defaultValue: xDefault },
  );

  form.textField("§eFocus §7(entity ID or 'none')", "none", {
    defaultValue: currentWM.currentFocus || "none",
  });

  form.toggle("§eShock State", { defaultValue: currentWM.shockState });

  form.label("\n§8────────────────────────────────");
  form.toggle("§l§6Apply to ALL villagers? §7(Default: this villager only)", {
    defaultValue: false,
  });

  const response = await form.show(player);
  if (response.canceled) {
    system.runTimeout(() => showModifyModal(player), 5);
    return;
  }

  // Labels add null entries: [null, null, c, v, i, s, x, focus, shock, null, batchApply]
  const [_, __, c, v, i, s, x, focus, shock, ___, batchApply] =
    response.formValues;

  // Convert from 0-200 range to -1.0 to 1.0 range
  const convertedC = c / 100 - 1;
  const convertedV = v / 100 - 1;
  const convertedI = i / 100 - 1;
  const convertedS = s / 100 - 1;
  const convertedX = x / 100 - 1;

  const focusValue = focus === "none" ? null : focus;

  // Determine targets
  const dimension = world.getDimension("overworld");
  const targets = batchApply
    ? dimension
        .getEntities({ type: "minecraft:villager_v2" })
        .filter((v) => v?.isValid && hasWorkingMemory(v))
    : [villager];

  let successCount = 0;
  let failCount = 0;

  // Apply to all targets
  for (const target of targets) {
    try {
      target.setDynamicProperty("wm_currentMood_C", convertedC);
      target.setDynamicProperty("wm_currentMood_V", convertedV);
      target.setDynamicProperty("wm_currentMood_I", convertedI);
      target.setDynamicProperty("wm_currentMood_S", convertedS);
      target.setDynamicProperty("wm_currentMood_X", convertedX);
      target.setDynamicProperty("wm_currentFocus", focusValue);
      target.setDynamicProperty("wm_shockState", shock);
      target.setDynamicProperty("wm_lastUpdate", Date.now());
      target.setDynamicProperty("wm_needsSync", true);
      target.setDynamicProperty("wm_networkStatus", "modified");
      successCount++;
    } catch (error) {
      console.warn(
        `§c[Sandbox] Failed to modify ${target.id}: ${error.message}`,
      );
      failCount++;
    }
  }

  // Feedback
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (batchApply) {
    player.sendMessage(`§a§lBATCH MODIFIED: §e${successCount} villagers`);
  } else {
    player.sendMessage(`§a§lMODIFIED: §e${name}`);
  }
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage(`§7C: ${convertedC.toFixed(2)}`);
  player.sendMessage(`§7V: ${convertedV.toFixed(2)}`);
  player.sendMessage(`§7I: ${convertedI.toFixed(2)}`);
  player.sendMessage(`§7S: ${convertedS.toFixed(2)}`);
  player.sendMessage(`§7X: ${convertedX.toFixed(2)}`);
  player.sendMessage(`§7Focus: ${focusValue || "none"}`);
  player.sendMessage(`§7Shock: ${shock}`);
  player.sendMessage(`\n§a✓ Modified: ${successCount} villagers`);
  if (failCount > 0) {
    player.sendMessage(`§c✗ Failed: ${failCount} villagers`);
  }
  player.sendMessage("§e⚠ needsSync set to TRUE for all");
  player.sendMessage("§7Sync loop will batch them automatically");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ========================================
// AUTOMATIC LOOPS (Production Simulation)
// ========================================

/**
 * Batch queue for Working Memory sync requests.
 * Accumulates memories and flushes every 4 ticks (200ms).
 *
 * NOTE: This is ONLY for runtime updates (mood changes during gameplay).
 * Initialization is handled by delayed batch queue below.
 */
const syncQueue = [];
const syncQueueSet = new Set(); // Tracks villager IDs in queue to prevent duplicates
let syncFlushHandle = null;

/**
 * Delayed initialization queue for new villagers.
 * Collects villagers over 10 seconds to handle chunk loading during travel.
 * This ensures all villagers in an area are batched together for initialization.
 */
const initQueue = [];
const initQueueSet = new Set(); // Tracks villager IDs in queue to prevent duplicates
let initFlushHandle = null;
const INIT_BATCH_DELAY = 200; // 200 ticks = 10 seconds

/**
 * Adds villager to delayed initialization queue.
 * Uses DEBOUNCED timer - resets on each new villager to collect all during travel.
 * Waits 10 seconds of NO new detections before flushing.
 * Prevents duplicate entries for the same villager.
 */
function queueInit(villager) {
  const villagerID = villager.id;
  
  // Skip if already queued
  if (initQueueSet.has(villagerID)) {
    return;
  }
  
  initQueue.push(villager);
  initQueueSet.add(villagerID);
  
  // Cancel existing timer and start new one (debounce pattern)
  if (initFlushHandle) {
    system.clearRun(initFlushHandle);
  }
  
  console.warn(`§7[Sandbox] Queued ${villagerID.substring(0, 12)} (timer reset, batch at ${initQueue.length})`);
  initFlushHandle = system.runTimeout(() => flushInitQueue(), INIT_BATCH_DELAY);
}

/**
 * Flushes delayed initialization queue.
 * Initializes all collected villagers in parallel.
 */
async function flushInitQueue() {
  initFlushHandle = null;
  
  if (initQueue.length === 0) return;
  
  const batch = [...initQueue];
  initQueue.length = 0;
  initQueueSet.clear(); // Clear deduplication Set
  
  console.warn(`§b[Sandbox] Flushing init batch: ${batch.length} villagers`);
  
  const initPromises = batch.map(async (villager) => {
    const villagerID = villager.id;
    const shortID = villagerID.substring(0, 12);
    
    try {
      // Fetch fresh entity to ensure validity
      const freshEntity = world.getEntity(villagerID);
      
      if (!freshEntity?.isValid) {
        console.warn(`§c[Sandbox] ${shortID} - Entity became invalid`);
        return { status: 'invalid', id: villagerID };
      }

      // These are NEW villagers (not in sandboxTrackedVillagers)
      // No need to check DB - we know they're new!
      // Backend UPSERT handles edge cases gracefully (idempotent)
      await initializeWorkingMemory(freshEntity);
      console.warn(`§a[Sandbox] ${shortID} - WM initialized`);
      return { status: 'success', id: villagerID };
      
    } catch (error) {
      console.warn(`§c[Sandbox] ${shortID} - Init failed: ${error.message}`);
      return { status: 'error', id: villagerID, error: error.message };
    }
  });

  // Wait for ALL initializations to complete
  const results = await Promise.allSettled(initPromises);
  
  // Detailed summary
  const successCount = results.filter(r => r.value?.status === 'success').length;
  const errorCount = results.filter(r => r.value?.status === 'error').length;
  const invalidCount = results.filter(r => r.value?.status === 'invalid').length;
  
  console.warn(`§b[Sandbox] ━━━ Batch Init Summary ━━━`);
  console.warn(`§a  Success: ${successCount}`);
  console.warn(`§c  Failed: ${errorCount}`);
  console.warn(`§7  Invalid: ${invalidCount}`);
  console.warn(`§b━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Log failures
  if (errorCount > 0) {
    console.warn(`§c[Sandbox] Failed villagers:`);
    results.forEach(r => {
      if (r.value?.status === 'error') {
        console.warn(`§c  ${r.value.id.substring(0, 12)}: ${r.value.error}`);
      }
    });
  }
}

/**
 * Adds Working Memory to sync queue and schedules flush.
 * Prevents duplicate entries for the same villager.
 */
function queueSync(villager) {
  const villagerID = villager.id;

  // Skip if already queued
  if (syncQueueSet.has(villagerID)) {
    return;
  }

  const wmWithMetadata = getWorkingMemoryWithMetadata(villager);
  if (!wmWithMetadata) return;

  syncQueue.push(wmWithMetadata);
  syncQueueSet.add(villagerID);

  // Schedule flush if not already scheduled
  if (!syncFlushHandle) {
    syncFlushHandle = system.runTimeout(() => flushSyncQueue(), 4);
  }
}

/**
 * Flushes sync queue to backend as batch.
 */
async function flushSyncQueue() {
  syncFlushHandle = null;

  if (syncQueue.length === 0) return;

  const batch = [...syncQueue];
  syncQueue.length = 0;
  syncQueueSet.clear(); // Clear the tracking set

  const syncStart = Date.now();
  console.warn(`§b[Sandbox] Flushing sync batch: ${batch.length} memories`);

  try {
    const result = await postRequest("/api/memory/sync", { memories: batch });
    const elapsed = Date.now() - syncStart;

    if (result.status === "success") {
      console.warn(
        `§a[Sandbox] Batch synced in ${elapsed}ms: ${result.results.success.length} success, ${result.results.failed.length} failed`,
      );

      // Log failures for diagnostics
      if (result.results.failed.length > 0) {
        console.warn(`§c[Sandbox] Sync failures:`);
        for (const failure of result.results.failed) {
          console.warn(
            `§c  ${failure.villagerID.substring(0, 12)}: ${failure.reason}`,
          );
        }
      }

      // Update sync flags for successful syncs ONLY
      for (const { villagerID, timestamp } of result.results.success) {
        const entity = world.getEntity(villagerID);
        if (entity?.isValid) {
          entity.setDynamicProperty("wm_needsSync", false);
          entity.setDynamicProperty("wm_lastSyncSuccess", timestamp);
          entity.setDynamicProperty("wm_networkStatus", "synced");
        }
      }

      // Keep needsSync=true for failed syncs so they retry
      for (const failure of result.results.failed) {
        const entity = world.getEntity(failure.villagerID);
        if (entity?.isValid) {
          entity.setDynamicProperty(
            "wm_networkStatus",
            `sync_failed: ${failure.reason}`,
          );
        }
      }
    }
  } catch (error) {
    console.warn(`§c[Sandbox] Batch sync failed: ${error.message}`);
  }
}

/**
 * Automatic proximity detection loop.
 * Runs every 20 ticks (1 second), detects new villagers.
 * New villagers are queued for delayed batch initialization (10 seconds)
 * to handle chunk loading when traveling between villages.
 */
let detectionLoopHandle = null;

function startAutomaticDetection() {
  if (detectionLoopHandle) return;

  detectionLoopHandle = system.runInterval(async () => {
    try {
      const dimension = world.getDimension("overworld");
      const allPlayers = world.getAllPlayers();

      if (allPlayers.length === 0) return;

      for (const player of allPlayers) {
        const nearbyVillagers = dimension.getEntities({
          type: "minecraft:villager_v2",
          location: player.location,
          maxDistance: 150,
        });

        for (const villager of nearbyVillagers) {
          if (!villager?.isValid) continue;

          const villagerID = villager.id;

          // NEW VILLAGER: Mark as tracked and queue for delayed batch initialization
          if (!sandboxTrackedVillagers.has(villagerID)) {
            console.warn(
              `§e[Sandbox] New villager detected: ${villager.nameTag || villagerID.substring(0, 12)}`,
            );

            // Mark as tracked IMMEDIATELY to prevent re-detection
            sandboxTrackedVillagers.set(villagerID, {
              name: villager.nameTag || "Unnamed",
              lastSeen: Date.now(),
            });

            // Queue for delayed batch initialization (10 seconds to handle chunk loading)
            queueInit(villager);
          }
        }
      }
    } catch (error) {
      console.warn(`§c[Sandbox] Detection error: ${error.message}`);
    }
  }, 20);

  console.warn("§a[Sandbox] Automatic detection started");
}

function stopAutomaticDetection() {
  if (detectionLoopHandle) {
    system.clearRun(detectionLoopHandle);
    detectionLoopHandle = null;
    console.warn("§c[Sandbox] Automatic detection stopped");
  }
  
  // Clear pending init batch
  if (initFlushHandle) {
    system.clearRun(initFlushHandle);
    initFlushHandle = null;
    initQueue.length = 0;
    initQueueSet.clear();
    console.warn("§c[Sandbox] Pending init batch cleared");
  }
}

/**
 * Automatic sync loop for RUNTIME UPDATES ONLY.
 * Runs every 20 ticks, syncs villagers with needsSync flag.
 *
 * NOTE: This does NOT handle initialization - that's atomic now!
 * This loop only syncs mood changes that happen during gameplay.
 */
let syncLoopHandle = null;

function startAutomaticSync() {
  if (syncLoopHandle) return;

  syncLoopHandle = system.runInterval(() => {
    try {
      const dimension = world.getDimension("overworld");
      const allVillagers = dimension.getEntities({
        type: "minecraft:villager_v2",
      });

      for (const villager of allVillagers) {
        if (!villager?.isValid) continue;

        const needsSync = villager.getDynamicProperty("wm_needsSync");

        // Only queue for sync if needsSync is true (runtime updates or failed init retries)
        if (needsSync && hasWorkingMemory(villager)) {
          queueSync(villager);
        }
      }
    } catch (error) {
      console.warn(`§c[Sandbox] Sync loop error: ${error.message}`);
    }
  }, 20);

  console.warn("§a[Sandbox] Automatic sync started (runtime updates only)");
}

function stopAutomaticSync() {
  if (syncLoopHandle) {
    system.clearRun(syncLoopHandle);
    syncLoopHandle = null;
    console.warn("§c[Sandbox] Automatic sync stopped");
  }
}

// ========================================
// MANUAL TESTING (Step-by-Step)
// ========================================

// Store selected villager for step testing
let selectedVillagerForTesting = null;

/**
 * Shows villager picker for step-by-step testing.
 */
async function showStepTestPicker(player) {
  const dimension = world.getDimension("overworld");
  const allVillagers = dimension.getEntities({ type: "minecraft:villager_v2" });

  if (allVillagers.length === 0) {
    player.sendMessage("§cNo villagers found in world");
    return;
  }

  const form = new ActionFormData();
  form.title("§l§eStep-by-Step Test");
  form.body(
    "§7Select a villager to test the full sync flow:\n\n§61. Register in DB\n§62. Initialize DynamicProps\n§63. Sync to Backend",
  );

  for (const villager of allVillagers) {
    if (!villager?.isValid) continue;
    const name = villager.nameTag || "Unnamed";
    form.button(`§0${name}\n§0ID: ${villager.id.substring(0, 12)}...`);
  }

  const response = await form.show(player);
  if (response.canceled) return;

  selectedVillagerForTesting = allVillagers[response.selection];
  await showStepMenu(player);
}

/**
 * Shows step menu for selected villager.
 */
async function showStepMenu(player) {
  if (!selectedVillagerForTesting || !selectedVillagerForTesting.isValid) {
    player.sendMessage("§cSelected villager no longer valid");
    selectedVillagerForTesting = null;
    return;
  }

  const name = selectedVillagerForTesting.nameTag || "Unnamed";
  const id = selectedVillagerForTesting.id;

  const form = new ActionFormData();
  form.title("§l§eTest: " + name);
  form.body(`§7ID: §8${id}\n\n§eSelect action:`);

  form.button("§01️⃣ Register in DB\n§0Step 1 of 3");
  form.button("§02️⃣ Initialize DP\n§0Step 2 of 3");
  form.button("§03️⃣ Sync to Backend\n§0Step 3 of 3");
  form.button("§a▶ Run Full Flow\n§0All 3 steps");
  form.button("§9🔍 Inspect Current State");
  form.button("§8← Back to Villager List");

  const response = await form.show(player);
  if (response.canceled) return;

  switch (response.selection) {
    case 0:
      await testStep1_Register(player, selectedVillagerForTesting);
      break;
    case 1:
      await testStep2_InitDP(player, selectedVillagerForTesting);
      break;
    case 2:
      await testStep3_Sync(player, selectedVillagerForTesting);
      break;
    case 3:
      await testFullFlow(player, selectedVillagerForTesting);
      break;
    case 4:
      await showVillagerInspectDetail(player, selectedVillagerForTesting);
      break;
    case 5:
      selectedVillagerForTesting = null;
      await showStepTestPicker(player);
      break;
  }
}

/**
 * Step 1 (DEPRECATED): Register villager in database.
 * NOTE: With lazy backend initialization, this step is OPTIONAL.
 * Backend WM sync automatically creates villager if it doesn't exist.
 * This step is kept for manual testing/debugging only.
 */
async function testStep1_Register(player, villager) {
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§e§l[STEP 1/3] REGISTER (DEPRECATED - NOW AUTOMATIC)");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const id = villager.id;
  const name = villager.nameTag || "Unnamed";

  player.sendMessage(`\n§7Registering: §e${name}`);
  player.sendMessage(`§7ID: §8${id}`);

  try {
    const result = await postRequest("/api/villagers/register", [{
      villagerID: id,
      name: name,
      homeX: Math.round(villager.location.x),
      homeY: Math.round(villager.location.y),
      homeZ: Math.round(villager.location.z),
      isActive: true,
    }]);

    if (result.status === "success") {
      player.sendMessage("\n§a✓ Registration successful!");
      player.sendMessage(`§7Action: ${result.action}`);

      // Add to tracking
      sandboxTrackedVillagers.set(id, {
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        location: villager.location,
        nameTag: name,
      });

      player.sendMessage("§a✓ Added to sandboxTrackedVillagers");
    } else {
      player.sendMessage(`\n§c✗ Registration failed: ${result.message}`);
    }
  } catch (error) {
    player.sendMessage(`\n§c✗ Error: ${error.message}`);
  }

  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Return to menu
  system.runTimeout(() => showStepMenu(player), 40);
}

/**
 * Step 2: Initialize DynamicProperties using production helper.
 */
async function testStep2_InitDP(player, villager) {
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§e§l[STEP 2/3] INITIALIZE DYNAMICPROPERTIES");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const id = villager.id;
  const name = villager.nameTag || "Unnamed";

  player.sendMessage(`\n§7Initializing WM for: §e${name}`);
  player.sendMessage("§7Using: initializeWorkingMemory() helper");

  // Fetch fresh entity (simulate production flow)
  player.sendMessage("\n§7Fetching fresh entity via world.getEntity()...");
  const freshEntity = world.getEntity(id);

  if (!freshEntity || !freshEntity.isValid) {
    player.sendMessage("§c✗ Fresh entity is invalid!");
    player.sendMessage("§cThis simulates the race condition bug!");
    system.runTimeout(() => showStepMenu(player), 40);
    return;
  }

  player.sendMessage("§a✓ Fresh entity is valid");

  try {
    player.sendMessage("\n§7Initializing WM (atomic: DPs + DB sync)...");
    const success = await initializeWorkingMemory(freshEntity);

    if (success) {
      player.sendMessage(
        "\n§a✓ DynamicProperties initialized AND synced to DB!",
      );
      player.sendMessage("§7Verify with inspect command");
    } else {
      player.sendMessage("\n§c✗ initializeWorkingMemory returned false");
    }
  } catch (error) {
    player.sendMessage(`\n§c✗ Error: ${error.message}`);
  }

  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Return to menu
  system.runTimeout(() => showStepMenu(player), 40);
}

/**
 * Step 3: Sync to backend using production helper.
 */
async function testStep3_Sync(player, villager) {
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§e§l[STEP 3/3] SYNC TO BACKEND");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const id = villager.id;
  const name = villager.nameTag || "Unnamed";

  player.sendMessage(`\n§7Syncing: §e${name}`);
  player.sendMessage("§7Using: getWorkingMemory() helper");

  // Check if WM is initialized
  if (!hasWorkingMemory(villager)) {
    player.sendMessage("\n§c✗ Working Memory not initialized!");
    player.sendMessage("§cRun Step 2 first");
    system.runTimeout(() => showStepMenu(player), 40);
    return;
  }

  const wmWithMetadata = getWorkingMemoryWithMetadata(villager);
  if (!wmWithMetadata) {
    player.sendMessage("\n§c✗ getWorkingMemoryWithMetadata failed!");
    system.runTimeout(() => showStepMenu(player), 40);
    return;
  }

  player.sendMessage("§a✓ Working Memory retrieved (with metadata)");

  try {
    const result = await postRequest("/api/memory/sync", wmWithMetadata);

    if (result.status === "success") {
      player.sendMessage("\n§a✓ Sync successful!");
      player.sendMessage(`§7Action: ${result.action}`);

      // Update flags
      villager.setDynamicProperty("wm_needsSync", false);
      villager.setDynamicProperty("wm_lastSyncSuccess", Date.now());
      villager.setDynamicProperty("wm_networkStatus", "synced");

      player.sendMessage("§a✓ Updated sync flags");
    } else {
      player.sendMessage(`\n§c✗ Sync failed: ${result.message}`);
    }
  } catch (error) {
    player.sendMessage(`\n§c✗ Error: ${error.message}`);
  }

  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Return to menu
  system.runTimeout(() => showStepMenu(player), 40);
}

/**
 * Full flow: SIMPLIFIED with lazy backend initialization.
 * Just initialize WM - backend handles villager creation atomically!
 */
async function testFullFlow(player, villager) {
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§a§l▶ FULL FLOW TEST (ATOMIC WM INIT)");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const name = villager.nameTag || "Unnamed";
  player.sendMessage(`\n§7Testing: §e${name}`);
  player.sendMessage("§7Backend ensures villager exists automatically");

  // Single atomic operation - backend handles everything!
  player.sendMessage("\n§e[1/1] Initializing WM (atomic: villager + WM)...");
  await testStep2_InitDP(player, villager);

  player.sendMessage("\n§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  player.sendMessage("§a§lFULL FLOW COMPLETE!");
  player.sendMessage("§7Backend created villager + WM in ONE transaction");
  player.sendMessage("§7Use inspect to verify final state");
  player.sendMessage("§b━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ========================================
// AUTO-RECOVERY ON STARTUP
// ========================================

/**
 * Auto-recovery: Restores state from DB on script startup.
 * Runs silently in background, logs to console only.
 */
async function autoRecoverState() {
  console.warn("§b[Sandbox] Auto-recovering state from database...");

  try {
    const response = await getRequest("/api/villagers/all");

    if (response.status !== "success" || !response.villagers) {
      console.warn(
        `§e[Sandbox] Auto-recovery failed: ${response.message || "Unknown error"}`,
      );
      return;
    }

    const dbVillagers = response.villagers;

    if (dbVillagers.length === 0) {
      console.warn("§7[Sandbox] No villagers in database - starting fresh");
      return;
    }

    // Populate tracking map
    sandboxTrackedVillagers.clear();

    for (const dbVillager of dbVillagers) {
      sandboxTrackedVillagers.set(dbVillager.villager_id, {
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        location: {
          x: dbVillager.home_x,
          y: dbVillager.home_y,
          z: dbVillager.home_z,
        },
        nameTag: dbVillager.name,
      });
    }

    // Restore DynamicProperties for villagers with working_memory
    let restoredCount = 0;

    for (const dbVillager of dbVillagers) {
      const wm = dbVillager.working_memory;
      if (!wm || wm.villager_id === null) continue;

      const entity = world.getEntity(dbVillager.villager_id);
      if (!entity || !entity.isValid) continue;

      try {
        // Unpack current_mood_manual array [C, V, I, S, X]
        // PostgreSQL VECTOR(5) comes back as string "[0.5,0.5,0.5,0.5,0.5]"
        let moodVector = wm.current_mood_manual;

        if (typeof moodVector === "string") {
          moodVector = JSON.parse(moodVector);
        }

        console.warn(
          `§7[Sandbox] Restoring ${dbVillager.name}: moodVector=${JSON.stringify(moodVector)}`,
        );

        if (
          moodVector &&
          Array.isArray(moodVector) &&
          moodVector.length === 5
        ) {
          entity.setDynamicProperty("wm_currentMood_C", moodVector[0]);
          entity.setDynamicProperty("wm_currentMood_V", moodVector[1]);
          entity.setDynamicProperty("wm_currentMood_I", moodVector[2]);
          entity.setDynamicProperty("wm_currentMood_S", moodVector[3]);
          entity.setDynamicProperty("wm_currentMood_X", moodVector[4]);
        } else {
          console.warn(
            `§e[Sandbox] Invalid mood vector for ${dbVillager.name}, using defaults (neutral 0.0)`,
          );
          entity.setDynamicProperty("wm_currentMood_C", 0.0);
          entity.setDynamicProperty("wm_currentMood_V", 0.0);
          entity.setDynamicProperty("wm_currentMood_I", 0.0);
          entity.setDynamicProperty("wm_currentMood_S", 0.0);
          entity.setDynamicProperty("wm_currentMood_X", 0.0);
        }

        entity.setDynamicProperty(
          "wm_currentFocus",
          wm.current_focus || "none",
        );
        entity.setDynamicProperty("wm_shockState", wm.shock_state || false);
        entity.setDynamicProperty(
          "wm_lastUpdate",
          wm.last_update || Date.now(),
        );
        entity.setDynamicProperty("wm_needsSync", false);
        entity.setDynamicProperty("wm_networkStatus", "recovered");
        entity.setDynamicProperty("wm_lastSyncSuccess", Date.now());

        // Verify it was set
        const verifyC = entity.getDynamicProperty("wm_currentMood_C");
        console.warn(
          `§7[Sandbox] Verified ${dbVillager.name}: C after set = ${verifyC}`,
        );

        restoredCount++;
      } catch (error) {
        console.warn(
          `§e[Sandbox] Failed to restore DP for ${dbVillager.name}: ${error.message}`,
        );
      }
    }

    console.warn(
      `§a[Sandbox] Auto-recovery complete: ${sandboxTrackedVillagers.size} tracked, ${restoredCount} DPs restored`,
    );
  } catch (error) {
    console.warn(`§e[Sandbox] Auto-recovery failed: ${error.message}`);
  }
}

// ========================================
// COMMAND REGISTRATION
// ========================================

/**
 * Registers sandbox commands and performs auto-recovery.
 */
function initializeSandboxWMTest() {
  system.runTimeout(() => {
    system.afterEvents.scriptEventReceive.subscribe(async (event) => {
      const { id, sourceEntity } = event;

      if (!sourceEntity || sourceEntity.typeId !== "minecraft:player") return;
      const player = sourceEntity;

      if (id === "sandbox:recover") {
        await recoverStateFromDatabase(player);
      } else if (id === "sandbox:inspect") {
        await showInspectModal(player);
      } else if (id === "sandbox:cleanup") {
        await clearAllDynamicProperties(player);
      } else if (id === "sandbox:test") {
        await showStepTestPicker(player);
      } else if (id === "sandbox:modify") {
        await showModifyModal(player);
      } else if (id === "sandbox:start") {
        startAutomaticDetection();
        startAutomaticSync();
        player.sendMessage("§a[Sandbox] Automatic loops started");
      } else if (id === "sandbox:stop") {
        stopAutomaticDetection();
        stopAutomaticSync();
        player.sendMessage("§c[Sandbox] Automatic loops stopped");
      }
    });

    console.warn("§a[Sandbox] Working Memory sync test initialized");
    console.warn("§7  /scriptevent sandbox:recover - Manual state recovery");
    console.warn("§7  /scriptevent sandbox:inspect - Inspect villager state");
    console.warn(
      "§7  /scriptevent sandbox:cleanup - Clear all DynamicProperties",
    );
    console.warn("§7  /scriptevent sandbox:test - Step-by-step testing");
    console.warn(
      "§7  /scriptevent sandbox:modify - Modify Working Memory values",
    );
    console.warn("§7  /scriptevent sandbox:start - Start automatic loops");
    console.warn("§7  /scriptevent sandbox:stop - Stop automatic loops");

    // Auto-recover state from database (runs in background)
    system.runTimeout(() => {
      autoRecoverState();
    }, 20); // Wait a bit for backend to be ready
  }, 10);
}

export { initializeSandboxWMTest };
