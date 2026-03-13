import pool from "../db/pool.js";
import logger from "../utils/logger.js";

/**
 * Registers villager(s) in the database.
 * ALWAYS accepts an array (single = array with 1 item, batch = multiple items).
 * Uses UPSERT pattern to handle both new registrations and updates.
 * 
 * @param {Array<Object>} villagers - Array of villager data objects
 * @returns {Promise<Object>} Result object with status
 */
async function registerVillager(villagers) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = { success: [], failed: [] };
    const timestamp = Date.now();
    
    for (const villagerData of villagers) {
      try {
        const { villagerID, name, homeX, homeY, homeZ, profession, isActive } = villagerData;
        
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
          [villagerID, name, homeX, homeY, homeZ, profession, isActive, timestamp, timestamp]
        );
        
        const isNew = result.rows[0].created_at === timestamp;
        results.success.push({ villagerID, isNew });
      } catch (error) {
        results.failed.push({ villagerID: villagerData.villagerID, error: error.message });
      }
    }
    
    await client.query('COMMIT');
    
    logger.info(
      { count: villagers.length, successCount: results.success.length, failedCount: results.failed.length },
      "[Query] Villager registration complete"
    );
    
    return {
      status: "success",
      results
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, "[Query] Villager registration failed");
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
 * Gets a single villager's data from the database.
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object|null>} Villager data or null if not found
 */
async function getVillager(villagerID) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT * FROM villagers WHERE villager_id = $1",
      [villagerID],
    );

    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Villager not found");
      return null;
    }

    logger.info({ villagerID }, "[Query] Retrieved villager data");

    return result.rows[0];
  } catch (error) {
    logger.error(
      { error: error.message, villagerID },
      "[Query] Failed to retrieve villager",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets a single villager with their working memory data (if exists).
 * Used for inspection/diagnostics that need to check WM sync status.
 * @param {string} villagerID - The villager's ID
 * @returns {Promise<Object|null>} Villager record with working_memory, or null
 */
async function getVillagerWithMemory(villagerID) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 
        v.*,
        row_to_json(wm.*) as working_memory
      FROM villagers v
      LEFT JOIN working_memory wm ON v.villager_id = wm.villager_id
      WHERE v.villager_id = $1`,
      [villagerID],
    );

    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Villager not found");
      return null;
    }

    logger.info({ villagerID }, "[Query] Retrieved villager with memory");

    return result.rows[0];
  } catch (error) {
    logger.error(
      { error: error.message, villagerID },
      "[Query] Failed to retrieve villager with memory",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets all villagers with their working memory data (if exists).
 * Used for state recovery on script reload.
 * @returns {Promise<Array>} Array of villager records with working_memory
 */
async function getAllVillagersWithMemory() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        v.*,
        row_to_json(wm.*) as working_memory
      FROM villagers v
      LEFT JOIN working_memory wm ON v.villager_id = wm.villager_id
      ORDER BY v.created_at DESC
    `);

    logger.info(
      { count: result.rowCount },
      "[Query] Retrieved all villagers with memory",
    );

    return result.rows;
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Query] Failed to retrieve all villagers",
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
 * Sets the is_active status for villager(s).
 * Called when villager enters/leaves loaded chunks.
 * ALWAYS accepts an array (single = array with 1 item, batch = multiple items).
 * 
 * @param {Array<{villagerID: string, isActive: boolean}>} updates - Array of state updates
 * @returns {Promise<Object>} Result object with status
 */
async function setVillagerActive(updates) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const results = { success: [], failed: [] };
    const timestamp = Date.now();
    
    for (const update of updates) {
      try {
        const { villagerID, isActive } = update;
        
        const result = await client.query(
          "UPDATE villagers SET is_active = $1, last_seen = $2 WHERE villager_id = $3 RETURNING villager_id",
          [isActive, timestamp, villagerID]
        );
        
        if (result.rowCount > 0) {
          results.success.push({ villagerID, isActive });
        } else {
          results.failed.push({ 
            villagerID, 
            error: "Villager not found" 
          });
        }
      } catch (error) {
        results.failed.push({ 
          villagerID: update.villagerID, 
          error: error.message 
        });
      }
    }
    
    await client.query('COMMIT');
    
    logger.info(
      { count: updates.length, successCount: results.success.length, failedCount: results.failed.length },
      "[Query] Active state update complete"
    );
    
    return {
      status: "success",
      results
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, "[Query] Active state update failed");
    throw error;
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

/**
 * Deletes ALL villagers from the database.
 * WARNING: This is a destructive operation with no undo.
 * Used for testing/debugging only.
 * @returns {Promise<Object>} Result with deletedCount
 */
async function deleteAllVillagers() {
  const client = await pool.connect();
  try {
    const result = await client.query("DELETE FROM villagers");
    const deletedCount = result.rowCount || 0;

    logger.info(
      { deletedCount },
      "[Query] Deleted all villagers from database",
    );

    return {
      status: "success",
      deletedCount,
    };
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Query] Failed to delete all villagers",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ensures a villager record exists in the database (lazy initialization).
 * Used by Working Memory sync to satisfy FK constraint before inserting WM.
 * Only inserts if villager doesn't exist - never updates existing records.
 * 
 * @param {Object} client - Database client (for use within transactions)
 * @param {string} villagerID - Villager entity ID
 * @param {Object} metadata - Optional villager metadata
 * @param {string} metadata.name - Villager name
 * @param {Object} metadata.location - Villager location {x, y, z}
 * @param {string} metadata.profession - Villager profession
 * @param {number} timestamp - Timestamp for created_at/last_seen
 * @returns {Promise<void>}
 */
async function ensureVillagerExists(client, villagerID, metadata = {}, timestamp = Date.now()) {
  const name = metadata.name || 'Unnamed';
  const homeX = metadata.location?.x || 0;
  const homeY = metadata.location?.y || 0;
  const homeZ = metadata.location?.z || 0;
  const profession = metadata.profession || 'unknown';

  await client.query(
    `INSERT INTO villagers (villager_id, name, home_x, home_y, home_z, profession, is_active, created_at, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (villager_id) DO NOTHING`,
    [villagerID, name, homeX, homeY, homeZ, profession, true, timestamp, timestamp]
  );

  logger.debug(
    { villagerID, name },
    "[Query] Ensured villager exists (lazy init)"
  );
}

export {
  registerVillager,
  villagerExists,
  getVillager,
  getVillagerWithMemory,
  removeVillager,
  getAllVillagerIDs,
  getAllVillagersWithMemory,
  setVillagerActive,
  deleteAllVillagers,
  ensureVillagerExists,
};
