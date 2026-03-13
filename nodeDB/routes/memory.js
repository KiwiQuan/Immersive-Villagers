import express from "express";
import { syncWorkingMemory, syncWorkingMemoryBatch } from "../queries/working_memory.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * POST /api/memory/sync
 * Syncs Working Memory from DynamicProperties to PostgreSQL.
 * Accepts single memory OR batch (array in "memories" field).
 * Uses UPSERT (INSERT ... ON CONFLICT) to handle both new and existing records.
 */
router.post("/sync", async (req, res) => {
  try {
    // Detect batch vs single
    const isBatch = Array.isArray(req.body.memories);
    
    if (isBatch) {
      // BATCH MODE
      if (req.body.memories.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "memories array is empty",
        });
      }
      
      const result = await syncWorkingMemoryBatch(req.body.memories);
      return res.json(result);
    }
    
    // SINGLE MODE (existing logic)
    const { villagerID, currentMood, currentFocus, shockState, lastUpdate, villagerMetadata } = req.body;

    if (!villagerID) {
      return res.status(400).json({
        status: "error",
        message: "Missing required field: villagerID",
      });
    }

    if (!currentMood || typeof currentMood !== "object") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid currentMood object",
      });
    }

    const result = await syncWorkingMemory({
      villagerID,
      currentMood,
      currentFocus,
      shockState,
      lastUpdate,
      villagerMetadata, // Pass metadata for lazy initialization
    });

    if (result.status === "conflict") {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, "[Layer 5] Working Memory sync failed");
    res.status(500).json({
      status: "error",
      message: "Database sync failed",
      code: "SYNC_FAILED",
    });
  }
});

export default router;
