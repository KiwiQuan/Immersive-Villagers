import pool from "../db/pool.js";
import logger from "../utils/logger.js";
import { ensureVillagerExists } from "./villagers.js";

/**
 * Gets the current AI_MODE from environment variable.
 * Determines which vector column to use in queries.
 * @returns {string} "MONOLITHIC" or "MICROSERVICES"
 */
function getAIMode() {
  return process.env.AI_MODE || "MONOLITHIC";
}

/**
 * Syncs Working Memory from DynamicProperties to PostgreSQL.
 * Uses UPSERT pattern with timestamp-based conflict detection.
 * Stores vectors in the appropriate column based on AI_MODE.
 *
 * @param {Object} workingMemory - Working Memory object from DynamicProperties
 * @param {string} workingMemory.villagerID - Villager entity ID
 * @param {Object} workingMemory.currentMood - Mood vector {C, V, I, S, X}
 * @param {string|null} workingMemory.currentFocus - Entity ID being observed
 * @param {boolean} workingMemory.shockState - Shock state flag
 * @param {number} workingMemory.lastUpdate - Timestamp of last update
 * @returns {Promise<Object>} Result object with status
 */
async function syncWorkingMemory(workingMemory) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const { villagerID, currentMood, currentFocus, shockState, lastUpdate, villagerMetadata } =
      workingMemory;

    const aiMode = getAIMode();
    const vectorArray = [
      currentMood.C,
      currentMood.V,
      currentMood.I,
      currentMood.S,
      currentMood.X,
    ];
    const vectorString = `[${vectorArray.join(",")}]`;
    const timestamp = lastUpdate || Date.now();

    // ATOMIC STEP 1: Ensure villager exists (lazy initialization)
    await ensureVillagerExists(client, villagerID, villagerMetadata, timestamp);

    // ATOMIC STEP 2: Sync Working Memory
    let query;
    let params;

    if (aiMode === "MONOLITHIC") {
      query = `
        INSERT INTO working_memory (villager_id, current_mood_manual, current_focus, shock_state, last_update)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (villager_id) DO UPDATE SET
          current_mood_manual = EXCLUDED.current_mood_manual,
          current_focus = EXCLUDED.current_focus,
          shock_state = EXCLUDED.shock_state,
          last_update = EXCLUDED.last_update
        WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
        RETURNING last_update
      `;
      params = [villagerID, vectorString, currentFocus, shockState || false, timestamp];
    } else {
      query = `
        INSERT INTO working_memory (villager_id, current_mood_minilm, current_focus, shock_state, last_update)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (villager_id) DO UPDATE SET
          current_mood_minilm = EXCLUDED.current_mood_minilm,
          current_focus = EXCLUDED.current_focus,
          shock_state = EXCLUDED.shock_state,
          last_update = EXCLUDED.last_update
        WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
        RETURNING last_update
      `;
      params = [villagerID, vectorString, currentFocus, shockState || false, timestamp];
    }

    const result = await client.query(query, params);

    await client.query('COMMIT');

    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Stale Working Memory data rejected");
      return { status: "conflict", message: "Stale data rejected" };
    }

    logger.info({ villagerID, aiMode }, "[Query] Working Memory synced (atomic: villager + WM)");

    return { status: "success", timestamp: result.rows[0].last_update };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(
      { error: error.message, villagerID: workingMemory.villagerID },
      "[Query] Working Memory sync failed",
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Syncs multiple Working Memory records in a single batch transaction.
 * More efficient than individual requests, prevents race conditions.
 * @param {Array<Object>} memories - Array of Working Memory objects
 * @returns {Promise<Object>} Result with success/failed arrays
 */
async function syncWorkingMemoryBatch(memories) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = { success: [], failed: [] };
    const aiMode = getAIMode();
    
    for (const wm of memories) {
      try {
        const { villagerID, currentMood, currentFocus, shockState, lastUpdate, villagerMetadata } = wm;
        
        const vectorArray = [
          currentMood.C,
          currentMood.V,
          currentMood.I,
          currentMood.S,
          currentMood.X,
        ];
        const vectorString = `[${vectorArray.join(",")}]`;
        const timestamp = lastUpdate || Date.now();
        
        // ATOMIC STEP 1: Ensure villager exists (lazy initialization)
        await ensureVillagerExists(client, villagerID, villagerMetadata, timestamp);
        
        // ATOMIC STEP 2: Sync Working Memory
        let query;
        let params;
        
        if (aiMode === "MONOLITHIC") {
          query = `
            INSERT INTO working_memory (villager_id, current_mood_manual, current_focus, shock_state, last_update)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (villager_id) DO UPDATE SET
              current_mood_manual = EXCLUDED.current_mood_manual,
              current_focus = EXCLUDED.current_focus,
              shock_state = EXCLUDED.shock_state,
              last_update = EXCLUDED.last_update
            WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
            RETURNING last_update
          `;
          params = [villagerID, vectorString, currentFocus, shockState || false, timestamp];
        } else {
          query = `
            INSERT INTO working_memory (villager_id, current_mood_minilm, current_focus, shock_state, last_update)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (villager_id) DO UPDATE SET
              current_mood_minilm = EXCLUDED.current_mood_minilm,
              current_focus = EXCLUDED.current_focus,
              shock_state = EXCLUDED.shock_state,
              last_update = EXCLUDED.last_update
            WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
            RETURNING last_update
          `;
          params = [villagerID, vectorString, currentFocus, shockState || false, timestamp];
        }
        
        const result = await client.query(query, params);
        
        if (result.rowCount === 0) {
          results.failed.push({ villagerID, reason: "stale_data" });
        } else {
          results.success.push({ villagerID, timestamp: result.rows[0].last_update });
        }
      } catch (error) {
        results.failed.push({ villagerID: wm.villagerID, reason: error.message });
      }
    }
    
    await client.query('COMMIT');
    
    logger.info(
      { successCount: results.success.length, failedCount: results.failed.length },
      "[Query] Batch WM sync complete (atomic: villager + WM)"
    );
    
    return {
      status: "success",
      results
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, "[Query] Batch WM sync failed");
    throw error;
  } finally {
    client.release();
  }
}

export { syncWorkingMemory, syncWorkingMemoryBatch };
