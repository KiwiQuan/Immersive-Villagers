/**
 * Working Memory Debug Modal
 * 
 * Interactive UI for testing and inspecting Working Memory state.
 * Allows modification, inspection, and comparison of DP vs DB data.
 * 
 * @module working_memory_modal
 */

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isDebugMode } from "../../../utils/debug_mode_helper.js";
import { 
  trackedVillagers, 
  activeVillagers 
} from "../../villager_lifecycle/lifecycle_state.js";
import {
  hasWorkingMemory,
  getWorkingMemory,
  getWorkingMemoryFromDB,
  compareWorkingMemory,
  updateWorkingMemoryProperty,
  markForSync,
} from "../../../layers/layer4_working_memory/helpers/working_memory_helpers.js";
import {
  modifyWorkingMemoryCache,
} from "../../../layers/layer4_working_memory/helpers/working_memory_chache.js";

// ========================================
// MAIN MENU
// ========================================

/**
 * Shows main Working Memory debug modal.
 * @param {Player} player - The player to show the modal to
 * @returns {Promise<void>}
 */
export async function showWorkingMemoryDebugModal(player) {
  try {
    const form = new ActionFormData();
    form.title("§l§dWorking Memory Debugger");

    // Use cache directly (LOCAL MIRROR pattern - no entities needed!)
    const allTracked = Array.from(trackedVillagers.entries());
    
    const withDP = allTracked.filter(([id, meta]) => {
      return meta && meta.workingMemory !== null && meta.workingMemory !== undefined;
    });
    const withoutDP = allTracked.filter(([id, meta]) => {
      return meta && (meta.workingMemory === null || meta.workingMemory === undefined);
    });

    form.body(
      `§e━━━ WORKING MEMORY DEBUG ━━━\n\n` +
        `§7Test and inspect Working Memory state\n` +
        `§7across DynamicProperties and Database.\n\n` +
        `§e=== STATS ===\n` +
        `§aWith DPs: ${withDP.length}\n` +
        `§cWithout DPs: ${withoutDP.length}\n` +
        `§7Total tracked: ${trackedVillagers.size}\n\n` +
        `§7Select an option below:`
    );

    form.button("✏ Modify Working Memory\nChange mood values");
    form.button("✓ View Villagers WITH DPs\nInspect initialized villagers");
    form.button("✗ View Villagers WITHOUT DPs\nFind uninitialized villagers");
    form.button("🔍 Compare DP vs DB\nVerify sync status");
    form.button("◄ Back");

    const response = await form.show(player);

    if (response.canceled) return;

    switch (response.selection) {
      case 0:
        await showModifyWMModal(player);
        break;
      case 1:
        await showVillagersWithDPs(player);
        break;
      case 2:
        await showVillagersWithoutDPs(player);
        break;
      case 3:
        await showComparisonModal(player);
        break;
      default:
        return;
    }
  } catch (error) {
    console.error(`§c[Debug] Working Memory menu error: ${error.message}`);
    console.error(`§c[Debug] Error stack: ${error.stack}`);
    player.sendMessage(`§cWorking Memory menu error: ${error.message}`);
  }
}

/**
 * Shows villager picker for modifying Working Memory.
 */
async function showModifyWMModal(player) {
  // Use cache directly (LOCAL MIRROR pattern - works from any distance!)
  const allTracked = Array.from(trackedVillagers.entries());

  if (allTracked.length === 0) {
    player.sendMessage("§cNo tracked villagers found");
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
    return;
  }

  const form = new ActionFormData();
  form.title("§l§6Modify Working Memory");
  form.body(
    "§7Select a villager to modify their Working Memory:\n\n§ePurpose: Test syncing by changing values"
  );

  for (const [id, metadata] of allTracked) {
    const name = metadata.nameTag || "Unnamed";
    const hasWM = metadata.workingMemory !== null && metadata.workingMemory !== undefined;
    const status = hasWM ? "✓" : "✗";
    form.button(`${status} ${name}\nID: ${id.substring(0, 12)}...`);
  }

  form.button("◄ Back");

  const response = await form.show(player);
  if (response.canceled || response.selection === allTracked.length) {
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
    return;
  }

  const [selectedID, selectedMetadata] = allTracked[response.selection];
  
  await showModifyForm(player, selectedID, selectedMetadata);
}

/**
 * Shows form to edit Working Memory values.
 * Uses cache for reading (works from any distance).
 * Requires entity only for writing changes.
 * 
 * @param {Player} player
 * @param {string} villagerID
 * @param {Object} metadata - Metadata from trackedVillagers
 */
async function showModifyForm(player, villagerID, metadata) {
  try {
    const name = metadata.nameTag || "Unnamed";

    // Get current values from cache (LOCAL MIRROR pattern)
    const currentWM = metadata.workingMemory;

  if (!currentWM) {
    player.sendMessage("§cWorking Memory not initialized. Initialize the villager first.");
    system.runTimeout(() => showModifyWMModal(player), 20);
    return;
  }

  const form = new ModalFormData();
  form.title(`§l§6Modify: ${name}\n§7Slider: §e0§7=-1.0  §e100§7=0.0  §e200§7=+1.0\n§a✓ Cache-first: Works from ANY distance!`);

  // NO LABELS! They return values in response.formValues and break destructuring!

  // Ensure mood values are numbers (defensive)
  const mood = currentWM.currentMood;
  const C = typeof mood.C === 'number' ? mood.C : 0.0;
  const V = typeof mood.V === 'number' ? mood.V : 0.0;
  const I = typeof mood.I === 'number' ? mood.I : 0.0;
  const S = typeof mood.S === 'number' ? mood.S : 0.0;
  const X = typeof mood.X === 'number' ? mood.X : 0.0;

  // Sliders for mood values (0-200 range, converts to -1.0 to 1.0)
  // Ensure defaults are valid integers in range [0, 200]
  const cDefault = Math.max(0, Math.min(200, Math.round((C + 1) * 100)));
  const vDefault = Math.max(0, Math.min(200, Math.round((V + 1) * 100)));
  const iDefault = Math.max(0, Math.min(200, Math.round((I + 1) * 100)));
  const sDefault = Math.max(0, Math.min(200, Math.round((S + 1) * 100)));
  const xDefault = Math.max(0, Math.min(200, Math.round((X + 1) * 100)));
  
  if (isDebugMode()) {
    console.warn(`§b[WM Debug] Slider defaults: c=${cDefault} v=${vDefault} i=${iDefault} s=${sDefault} x=${xDefault}`);
  }

  form.slider(
    `§eC §7(Constructiveness) §acurrent: ${C.toFixed(2)}\n§80=−1.0, 100=0.0, 200=+1.0`,
    0,
    200,
    { defaultValue: cDefault }
  );
  form.slider(
    `§eV §7(Value) §acurrent: ${V.toFixed(2)}\n§80=−1.0, 100=0.0, 200=+1.0`,
    0,
    200,
    { defaultValue: vDefault }
  );
  form.slider(
    `§eI §7(Intensity) §acurrent: ${I.toFixed(2)}\n§80=−1.0, 100=0.0, 200=+1.0`,
    0,
    200,
    { defaultValue: iDefault }
  );
  form.slider(
    `§eS §7(Sociality) §acurrent: ${S.toFixed(2)}\n§80=−1.0, 100=0.0, 200=+1.0`,
    0,
    200,
    { defaultValue: sDefault }
  );
  form.slider(
    `§eX §7(Complexity) §acurrent: ${X.toFixed(2)}\n§80=−1.0, 100=0.0, 200=+1.0`,
    0,
    200,
    { defaultValue: xDefault }
  );

  form.textField("§eFocus §7(entity ID or 'none')", "none", {
    defaultValue: currentWM.currentFocus || "none",
  });

  form.toggle("§eShock State", { defaultValue: currentWM.shockState });

  // IMPORTANT: No label here - labels don't return values and break destructuring!
  form.toggle("§l§6Apply to ALL villagers? §7(Default: this villager only)", {
    defaultValue: false,
  });

  const response = await form.show(player);
  if (response.canceled) {
    system.runTimeout(() => showModifyWMModal(player), 20);
    return;
  }

  // 7 values: 5 sliders + 1 textfield + 2 toggles (NO label!)
  const [c, v, i, s, x, focus, shock, applyToAll] = response.formValues;
  
  if (isDebugMode()) {
    console.warn(`§b[WM Debug] Form values: c=${c} v=${v} i=${i} s=${s} x=${x} shock=${shock} applyToAll=${applyToAll}`);
  }

  // Validate slider values are numbers
  if (typeof c !== 'number' || typeof v !== 'number' || typeof i !== 'number' || 
      typeof s !== 'number' || typeof x !== 'number') {
    console.warn(`§c[WM Debug] Invalid slider values! c=${typeof c} v=${typeof v} i=${typeof i} s=${typeof s} x=${typeof x}`);
    player.sendMessage("§c✗ Form error: Invalid slider values");
    system.runTimeout(() => showModifyWMModal(player), 20);
    return;
  }

  // Convert slider values (0-200) to actual values (-1.0 to 1.0)
  const newMood = {
    C: (c / 100) - 1,
    V: (v / 100) - 1,
    I: (i / 100) - 1,
    S: (s / 100) - 1,
    X: (x / 100) - 1,
  };
  
  if (isDebugMode()) {
    console.warn(`§b[WM Debug] Converted mood: C=${newMood.C.toFixed(2)} V=${newMood.V.toFixed(2)} I=${newMood.I.toFixed(2)} S=${newMood.S.toFixed(2)} X=${newMood.X.toFixed(2)}`);
  }

  const newFocus = focus === "none" ? null : focus;

  try {
    if (applyToAll) {
      // Apply to all tracked villagers with WM (CACHE-FIRST: no entity needed!)
      let count = 0;
      let skippedUninitialized = 0;

      for (const [id, meta] of trackedVillagers) {
        if (!meta.workingMemory) {
          skippedUninitialized++;
          continue; // Skip uninitialized
        }

        // Modify cache directly (NO ENTITY NEEDED!)
        const success = modifyWorkingMemoryCache(id, {
          currentMood: newMood,
          currentFocus: newFocus,
          shockState: shock
        });
        
        if (success) count++;
      }

      player.sendMessage(`§aModified ${count} villagers (cache-first!)`);
      player.sendMessage(`§7DPs will sync when villagers are in range`);
      if (skippedUninitialized > 0) {
        player.sendMessage(`§7Skipped ${skippedUninitialized} villagers (not initialized)`);
      }
    } else {
      // Apply to single villager (CACHE-FIRST: no entity needed!)
      if (isDebugMode()) {
        console.warn(`§7[WM Debug] Modifying villager cache: ${villagerID.substring(0, 12)}`);
      }
      
      // Modify cache directly (NO ENTITY NEEDED!)
      const success = modifyWorkingMemoryCache(villagerID, {
        currentMood: newMood,
        currentFocus: newFocus,
        shockState: shock
      });
      
      if (!success) {
        player.sendMessage(`§cFailed to modify cache for ${name}`);
        system.runTimeout(() => showModifyWMModal(player), 20);
        return;
      }

      if (isDebugMode()) {
        console.warn(`§a[WM Debug] Cache modified successfully`);
      }
      player.sendMessage(`§aModified ${name} (cache-first!)`);
      player.sendMessage(`§7C=${newMood.C.toFixed(2)} V=${newMood.V.toFixed(2)} I=${newMood.I.toFixed(2)} S=${newMood.S.toFixed(2)} X=${newMood.X.toFixed(2)}`);
      player.sendMessage(`§7DPs will sync when villager is in range`);
    }
  } catch (error) {
    player.sendMessage(`§cFailed to modify: ${error.message}`);
  }

  system.runTimeout(() => showModifyWMModal(player), 40);
  } catch (error) {
    console.error(`§c[Debug] showModifyForm error: ${error.message}`);
    console.error(`§c[Debug] Stack: ${error.stack}`);
    player.sendMessage(`§cError showing modify form: ${error.message}`);
    system.runTimeout(() => showModifyWMModal(player), 20);
  }
}

/**
 * Shows list of villagers WITH DynamicProperties.
 */
async function showVillagersWithDPs(player) {
  try {
    // Use cache directly (LOCAL MIRROR pattern - works from any distance!)
    const allTracked = Array.from(trackedVillagers.entries());
    const withDP = allTracked.filter(([id, meta]) => meta.workingMemory !== null && meta.workingMemory !== undefined);

  const form = new ActionFormData();
  form.title("§l§aVillagers WITH WM (Cache)");

  if (withDP.length === 0) {
    form.body("§7No villagers have Working Memory initialized.");
    form.button("◄ Back");

    await form.show(player);
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
    return;
  }

  let bodyText = `§7Found ${withDP.length} villager(s) with Working Memory (from cache):\n\n`;

  for (const [id, metadata] of withDP) {
    const wm = metadata.workingMemory;
    const name = metadata.nameTag || "Unnamed";
    
    // Defensive checks for cache data integrity
    if (!wm || !wm.currentMood) {
      bodyText += `§c✗ ${name}\n  §7Cache corrupted - missing mood data\n\n`;
      continue;
    }
    
    const C = typeof wm.currentMood.C === 'number' ? wm.currentMood.C : 0.0;
    const V = typeof wm.currentMood.V === 'number' ? wm.currentMood.V : 0.0;
    
    bodyText += `§a✓ ${name}\n`;
    bodyText += `  §7C=${C.toFixed(2)} V=${V.toFixed(2)}\n`;
    
    // Show new cache-first flags
    const dpSync = wm.needsDPSync !== undefined ? wm.needsDPSync : wm.needsSync;
    const dbSync = wm.needsDBSync !== undefined ? wm.needsDBSync : wm.needsSync;
    
    bodyText += `  §7DP Sync: ${dpSync ? "§eneeded" : "§aok"} | `;
    bodyText += `DB Sync: ${dbSync ? "§eneeded" : "§aok"}\n\n`;
  }

  form.body(bodyText);
  form.button("◄ Back");

    await form.show(player);
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
  } catch (error) {
    console.error(`§c[Debug] showVillagersWithDPs error: ${error.message}`);
    console.error(`§c[Debug] Stack: ${error.stack}`);
    player.sendMessage(`§cError displaying villagers: ${error.message}`);
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
  }
}

/**
 * Shows list of villagers WITHOUT DynamicProperties.
 */
async function showVillagersWithoutDPs(player) {
  // Use cache directly (LOCAL MIRROR pattern - works from any distance!)
  const allTracked = Array.from(trackedVillagers.entries());
  const withoutDP = allTracked.filter(([id, meta]) => meta.workingMemory === null || meta.workingMemory === undefined);

  const form = new ActionFormData();
  form.title("§l§cVillagers WITHOUT DPs");

  if (withoutDP.length === 0) {
    form.body("§a✓ All villagers have Working Memory initialized!");
    form.button("◄ Back");

    await form.show(player);
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
    return;
  }

  let bodyText = `§7Found ${withoutDP.length} villager(s) WITHOUT Working Memory:\n\n`;

  for (const [id, metadata] of withoutDP) {
    const name = metadata.nameTag || "Unnamed";
    const shortID = id.substring(0, 12);
    bodyText += `§c✗ ${name} §7(${shortID}...)\n`;
    bodyText += `  §7Tracked: §ayes\n\n`; // All are tracked (from trackedVillagers)
  }

  form.body(bodyText);
  form.button("◄ Back");

  await form.show(player);
  system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
}

/**
 * Shows comparison picker for DP vs DB verification.
 */
async function showComparisonModal(player) {
  // Use cache directly (LOCAL MIRROR pattern - works from any distance!)
  const allTracked = Array.from(trackedVillagers.entries());
  const withDP = allTracked.filter(([id, meta]) => meta.workingMemory !== null && meta.workingMemory !== undefined);

  if (withDP.length === 0) {
    player.sendMessage("§cNo villagers have Working Memory to compare");
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
    return;
  }

  const form = new ActionFormData();
  form.title("§l§9Compare DP vs DB");
  form.body("§7Select a villager to compare DynamicProperties vs Database:");

  for (const [id, metadata] of withDP) {
    const name = metadata.nameTag || "Unnamed";
    const needsSync = metadata.workingMemory.needsSync;
    const status = needsSync ? "§e⚠" : "§a✓";
    form.button(`${status} ${name}\nID: ${id.substring(0, 12)}...`);
  }

  form.button("◄ Back");

  const response = await form.show(player);
  if (response.canceled || response.selection === withDP.length) {
    system.runTimeout(() => showWorkingMemoryDebugModal(player), 20);
    return;
  }

  const [selectedID, selectedMetadata] = withDP[response.selection];
  
  await showComparisonResult(player, selectedID, selectedMetadata);
}

/**
 * Shows detailed comparison of DP vs DB for a villager.
 */
/**
 * Shows detailed comparison of DP vs DB for a villager.
 * Uses cache for display, but needs entity for compareWorkingMemory helper.
 * 
 * @param {Player} player
 * @param {string} villagerID
 * @param {Object} metadata - Metadata from trackedVillagers
 */
async function showComparisonResult(player, villagerID, metadata) {
  const name = metadata.nameTag || "Unnamed";

  player.sendMessage("§7Comparing DP vs DB...");

  try {
    // Get entity for compareWorkingMemory helper (try cache first)
    let entity = activeVillagers.get(villagerID);
    if (!entity) entity = world.getEntity(villagerID);
    
    if (!entity?.isValid) {
      player.sendMessage("§cVillager not loaded (out of range or unloaded chunk)");
      system.runTimeout(() => showComparisonModal(player), 20);
      return;
    }

    const comparison = await compareWorkingMemory(entity);

    const form = new ActionFormData();
    form.title(`§l§9Compare: ${name}`);

    let bodyText = `§7Villager: §f${name}\n`;
    bodyText += `§7ID: §8${villagerID.substring(0, 12)}...\n\n`;

    if (comparison.status === "success") {
      if (comparison.inSync) {
        bodyText += `§a✓ IN SYNC\n\n`;
        bodyText += `§7Max difference: §a${comparison.maxDifference.toFixed(6)}\n`;
      } else {
        bodyText += `§c✗ OUT OF SYNC\n\n`;
        bodyText += `§7Max difference: §e${comparison.maxDifference.toFixed(6)}\n\n`;
        bodyText += `§7Mood differences:\n`;
        bodyText += `  §7C: ${comparison.differences.mood.C.toFixed(4)}\n`;
        bodyText += `  §7V: ${comparison.differences.mood.V.toFixed(4)}\n`;
        bodyText += `  §7I: ${comparison.differences.mood.I.toFixed(4)}\n`;
        bodyText += `  §7S: ${comparison.differences.mood.S.toFixed(4)}\n`;
        bodyText += `  §7X: ${comparison.differences.mood.X.toFixed(4)}\n`;

        if (comparison.differences.focus) {
          bodyText += `\n§7Focus mismatch:\n`;
          bodyText += `  §7DP: ${comparison.dynamicProperties.currentFocus || "null"}\n`;
          bodyText += `  §7DB: ${comparison.database.currentFocus || "null"}\n`;
        }
      }
    } else {
      bodyText += `§c✗ Comparison failed\n\n`;
      bodyText += `§7Reason: ${comparison.message}`;
    }

    form.body(bodyText);
    form.button("◄ Back");

    await form.show(player);
    system.runTimeout(() => showComparisonModal(player), 20);
  } catch (error) {
    player.sendMessage(`§cComparison error: ${error.message}`);
    system.runTimeout(() => showComparisonModal(player), 20);
  }
}
