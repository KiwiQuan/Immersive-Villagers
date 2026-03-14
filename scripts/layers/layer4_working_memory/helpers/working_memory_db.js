/**
 * Working Memory Database Operations
 * Handles fetching and comparing Working Memory from database.
 * 
 * IMPORTANT: These functions are for diagnostics/verification only.
 * Production flow: DynamicProperties → Database (one-way sync).
 * Database should NEVER update DynamicProperties (except recovery/warm-start).
 *
 * @module working_memory_db
 */

import { getRequest } from "../../../utils/network_helpers.js";
import { debugLog } from "../../../utils/debug_mode_helper.js";

/**
 * Checks if Working Memory exists in the database.
 * Used to verify complete initialization (DPs + DB both exist).
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<boolean>} True if WM exists in DB, false otherwise
 */
async function hasWorkingMemoryInDB(villagerID) {
  try {
    const response = await getRequest(
      `/api/villagers/get_with_memory/${villagerID}`,
    );

    return (
      response?.villager?.working_memory !== null &&
      response?.villager?.working_memory !== undefined
    );
  } catch (error) {
    debugLog("DynamicProperties", "hasWorkingMemoryInDB failed", {
      villagerID,
      error: error.message,
    });
    return false;
  }
}

/**
 * Fetches Working Memory from the database for comparison/verification.
 * IMPORTANT: This should ONLY be used for diagnostics/verification.
 * Production flow: DynamicProperties → Database (one-way).
 * Database should NEVER update DynamicProperties (except recovery/warm-start).
 *
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object|null>} Working Memory from DB or null if not found
 */
async function getWorkingMemoryFromDB(villagerID) {
  try {
    const response = await getRequest(
      `/api/villagers/get_with_memory/${villagerID}`,
    );

    if (!response || !response.villager) {
      debugLog(
        "DynamicProperties",
        "getWorkingMemoryFromDB: villager not found",
        { villagerID },
      );
      return null;
    }

    const wm = response.villager.working_memory;

    // No working memory in DB
    if (!wm || wm.villager_id === null) {
      debugLog("DynamicProperties", "getWorkingMemoryFromDB: no WM in DB", {
        villagerID,
      });
      return null;
    }

    // Parse VECTOR(5) string to array
    let moodVector = wm.current_mood_manual;
    if (typeof moodVector === "string") {
      moodVector = JSON.parse(moodVector);
    }

    // Return in same format as getWorkingMemory() for easy comparison
    return {
      villagerID: wm.villager_id,
      currentFocus: wm.current_focus || null,
      currentMood: {
        C: moodVector?.[0] ?? 0.0,
        V: moodVector?.[1] ?? 0.0,
        I: moodVector?.[2] ?? 0.0,
        S: moodVector?.[3] ?? 0.0,
        X: moodVector?.[4] ?? 0.0,
      },
      shockState: wm.shock_state || false,
      lastUpdate: wm.last_update || 0,
    };
  } catch (error) {
    console.warn(
      `§e[DynamicProperties] Failed to fetch WM from DB for ${villagerID}: ${error.message}`,
    );
    return null;
  }
}

/**
 * Compares DynamicProperties Working Memory with Database Working Memory.
 * Used for diagnostics and verifying sync success.
 * 
 * NOTE: This is the core comparison logic. Use the wrapper in working_memory_helpers.js
 * which provides getWorkingMemory automatically.
 *
 * @param {Object} dpWM - Working Memory from DynamicProperties
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object>} Comparison result with differences
 */
async function compareWorkingMemoryCore(dpWM, villagerID) {
  try {
    const dbWM = await getWorkingMemoryFromDB(villagerID);

    if (!dpWM) {
      return { status: "error", message: "No DynamicProperties WM" };
    }

    if (!dbWM) {
      return { status: "error", message: "No Database WM" };
    }

    // Compare mood vectors
    const moodDiff = {
      C: Math.abs(dpWM.currentMood.C - dbWM.currentMood.C),
      V: Math.abs(dpWM.currentMood.V - dbWM.currentMood.V),
      I: Math.abs(dpWM.currentMood.I - dbWM.currentMood.I),
      S: Math.abs(dpWM.currentMood.S - dbWM.currentMood.S),
      X: Math.abs(dpWM.currentMood.X - dbWM.currentMood.X),
    };

    const maxDiff = Math.max(...Object.values(moodDiff));
    const inSync = maxDiff < 0.001; // Floating point tolerance

    return {
      status: "success",
      inSync,
      maxDifference: maxDiff,
      dynamicProperties: dpWM,
      database: dbWM,
      differences: {
        mood: moodDiff,
        focus: dpWM.currentFocus !== dbWM.currentFocus,
        shock: dpWM.shockState !== dbWM.shockState,
        timestamp: Math.abs(dpWM.lastUpdate - dbWM.lastUpdate),
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: `Comparison failed: ${error.message}`,
    };
  }
}

export { hasWorkingMemoryInDB, getWorkingMemoryFromDB, compareWorkingMemoryCore };
