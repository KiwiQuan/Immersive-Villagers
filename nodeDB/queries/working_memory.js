import pool from "../db/pool.js";
import logger from "../utils/logger.js";

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
    const { villagerID, currentMood, currentFocus, shockState, lastUpdate } =
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
      params = [
        villagerID,
        vectorString,
        currentFocus,
        shockState || false,
        lastUpdate || Date.now(),
      ];
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
      params = [
        villagerID,
        vectorString,
        currentFocus,
        shockState || false,
        lastUpdate || Date.now(),
      ];
    }

    const result = await client.query(query, params);

    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Stale Working Memory data rejected");
      return { status: "conflict", message: "Stale data rejected" };
    }

    logger.debug({ villagerID, aiMode }, "[Query] Working Memory synced");

    return { status: "success", timestamp: result.rows[0].last_update };
  } catch (error) {
    logger.error(
      { error: error.message, villagerID: workingMemory.villagerID },
      "[Query] Working Memory sync failed",
    );
    throw error;
  } finally {
    client.release();
  }
}

export { syncWorkingMemory };
