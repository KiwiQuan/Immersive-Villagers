import pool from "../db/pool.js";
import logger from "../utils/logger.js";

/**
 * Registers a new villager or updates an existing villager in the database.
 * Uses UPSERT pattern to handle both new registrations and updates.
 * @param {Object} villagerData - Villager data object
 * @param {string} villagerData.villagerID - Villager entity ID
 * @param {string|null} villagerData.name - Villager name tag
 * @param {number} villagerData.homeX - Home X coordinate
 * @param {number} villagerData.homeY - Home Y coordinate
 * @param {number} villagerData.homeZ - Home Z coordinate
 * @param {string} villagerData.profession - Villager profession
 * @param {boolean} villagerData.isActive - Whether villager is in loaded chunks
 * @returns {Promise<Object>} Result object with status
 */
async function registerVillager(villagerData) {
  const client = await pool.connect();

  try {
    const { villagerID, name, homeX, homeY, homeZ, profession, isActive } =
      villagerData;

    const timestamp = Date.now();

    const result = await client.query(
      `INSERT INTO villagers (villager_id, name, home_x, home_y, home_z, profession, is_active, created_at, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (villager_id) DO UPDATE SET
         name = EXCLUDED.name,
         home_x = EXCLUDED.home_x,
         home_y = EXCLUDED.home_y,
         home_z = EXCLUDED.home_z,
         profession = EXCLUDED.profession,
         is_active = EXCLUDED.is_active,
         last_seen = EXCLUDED.last_seen
       RETURNING villager_id, created_at`,
      [
        villagerID,
        name,
        homeX,
        homeY,
        homeZ,
        profession,
        isActive,
        timestamp,
        timestamp,
      ],
    );

    const isNew = result.rows[0].created_at === timestamp;

    if (isNew) {
      logger.info({ villagerID }, "[Query] Villager registered (new)");
    } else {
      logger.info({ villagerID }, "[Query] Villager updated (existing)");
    }

    return {
      status: "success",
      villagerID: result.rows[0].villager_id,
      isNew,
    };
  } catch (error) {
    logger.error(
      { error: error.message, villagerData },
      "[Query] Villager registration failed",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Checks if a villager exists in the database.
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<boolean>} True if villager exists
 */
async function villagerExists(villagerID) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT villager_id FROM villagers WHERE villager_id = $1",
      [villagerID],
    );

    return result.rowCount > 0;
  } catch (error) {
    logger.error(
      { error: error.message, villagerID },
      "[Query] Villager existence check failed",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets all registered villager IDs from the database.
 * Used on startup to populate the tracking Set.
 * @returns {Promise<string[]>} Array of villager IDs
 */
async function getAllVillagerIDs() {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT villager_id FROM villagers ORDER BY last_seen DESC",
    );

    const villagerIDs = result.rows.map((row) => row.villager_id);

    logger.info(
      { count: villagerIDs.length },
      "[Query] Retrieved all villager IDs",
    );

    return villagerIDs;
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Query] Failed to retrieve villager IDs",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sets the is_active status for a villager.
 * Called when villager enters/leaves loaded chunks.
 * @param {string} villagerID - Villager entity ID
 * @param {boolean} isActive - Whether villager is in loaded chunks
 * @returns {Promise<boolean>} True if update succeeded
 */
async function setVillagerActive(villagerID, isActive) {
  const client = await pool.connect();

  try {
    const timestamp = Date.now();

    const result = await client.query(
      "UPDATE villagers SET is_active = $1, last_seen = $2 WHERE villager_id = $3 RETURNING villager_id",
      [isActive, timestamp, villagerID],
    );

    if (result.rowCount > 0) {
      logger.info(
        { villagerID, isActive },
        "[Query] Villager active status updated",
      );
      return true;
    }

    logger.warn(
      { villagerID },
      "[Query] Villager not found for active status update",
    );
    return false;
  } catch (error) {
    logger.error(
      { error: error.message, villagerID },
      "[Query] Failed to update active status",
    );
    return false;
  } finally {
    client.release();
  }
}

/**
 * Removes a villager from the database.
 * Deletes the villager record, which cascades to all related tables.
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object>} Result object with status
 */
async function removeVillager(villagerID) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "DELETE FROM villagers WHERE villager_id = $1 RETURNING villager_id",
      [villagerID],
    );

    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Villager not found for removal");
      return {
        status: "not_found",
        message: "Villager not found in database",
      };
    }

    logger.info({ villagerID }, "[Query] Villager removed (CASCADE delete)");

    return {
      status: "success",
      villagerID: result.rows[0].villager_id,
    };
  } catch (error) {
    logger.error(
      { error: error.message, villagerID },
      "[Query] Villager removal failed",
    );
    throw error;
  } finally {
    client.release();
  }
}

export {
  registerVillager,
  villagerExists,
  removeVillager,
  getAllVillagerIDs,
  setVillagerActive,
};
