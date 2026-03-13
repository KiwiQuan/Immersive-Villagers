/**
 * Villager Lifecycle - Database Integration
 * 
 * Handles all PostgreSQL operations for villager persistence.
 * All database calls are asynchronous and non-blocking.
 * 
 * @module lifecycle_db
 */

import { postRequestAsync, getRequest } from "../../utils/network_helpers.js";

// ========================================
// DATABASE OPERATIONS
// ========================================

/**
 * Registers villager(s) in the database.
 * Creates entry in `villagers` table with initial state.
 * Accepts single villager object OR array (backend always expects array).
 * 
 * @param {Object|Array} input - Single villager data OR array of villager data
 * @returns {Promise<void>}
 */
export async function registerVillagerInDB(input) {
  // Wrap single item in array, pass array through
  const payload = Array.isArray(input) ? input : [input];
  return postRequestAsync("/api/villagers/register", payload);
}

/**
 * Updates villager active status in database.
 * Sets `is_active` column and updates `last_seen` timestamp.
 * Sends single update wrapped in array (backend always expects array).
 * 
 * @param {string} villagerID - Villager entity ID
 * @param {boolean} isActive - Active status
 * @returns {Promise<void>}
 */
export async function setVillagerActiveInDB(villagerID, isActive) {
  return postRequestAsync("/api/villagers/set_active", [{
    villagerID,
    isActive,
  }]);
}

/**
 * Removes a villager from the database.
 * Cascades to all related tables (working_memory, episodes, etc.).
 * 
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<void>}
 */
export async function removeVillagerFromDB(villagerID) {
  return postRequestAsync("/api/villagers/remove", { villagerID });
}

/**
 * Fetches all villagers from database for state recovery.
 * Used on startup to restore trackedVillagers and DynamicProperties.
 * 
 * @returns {Promise<Array>} Array of villagers with Working Memory
 */
export async function getAllVillagersFromDB() {
  const response = await getRequest("/api/villagers/all");
  
  if (response.status !== "success" || !response.villagers) {
    throw new Error(response.message || "Failed to fetch villagers");
  }
  
  return response.villagers;
}
