import express from "express";
import {
  registerVillager,
  removeVillager,
  getAllVillagerIDs,
  setVillagerActive,
} from "../queries/villagers.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * POST /api/villagers/register
 * Registers a new villager or updates existing villager in the database.
 */
router.post("/register", async (req, res) => {
  try {
    const { villagerID, name, homeX, homeY, homeZ, profession, isActive } =
      req.body;

    if (!villagerID) {
      return res.status(400).json({
        status: "error",
        message: "Missing required field: villagerID",
      });
    }

    if (homeX === undefined || homeY === undefined || homeZ === undefined) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: homeX, homeY, homeZ",
      });
    }

    const result = await registerVillager({
      villagerID,
      name,
      homeX,
      homeY,
      homeZ,
      profession,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, "[Villagers] Villager registration failed");
    res.status(500).json({
      status: "error",
      message: "Villager registration failed",
      code: "REGISTRATION_FAILED",
    });
  }
});

/**
 * POST /api/villagers/remove
 * Removes a villager from the database (marks as inactive and triggers CASCADE deletes).
 */
router.post("/remove", async (req, res) => {
  try {
    const { villagerID } = req.body;

    if (!villagerID) {
      return res.status(400).json({
        status: "error",
        message: "Missing required field: villagerID",
      });
    }

    const result = await removeVillager(villagerID);

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, "[Villagers] Villager removal failed");
    res.status(500).json({
      status: "error",
      message: "Villager removal failed",
      code: "REMOVAL_FAILED",
    });
  }
});

/**
 * GET /api/villagers/list
 * Returns all registered villager IDs from the database.
 */
router.get("/list", async (req, res) => {
  try {
    const villagerIDs = await getAllVillagerIDs();

    res.json({
      status: "success",
      villagerIDs,
      count: villagerIDs.length,
    });
  } catch (error) {
    logger.error({ error: error.message }, "[Villagers] Failed to list villagers");
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve villager list",
      code: "LIST_FAILED",
    });
  }
});

/**
 * POST /api/villagers/set_active
 * Sets the is_active status for a villager based on chunk load state.
 */
router.post("/set_active", async (req, res) => {
  try {
    const { villagerID, isActive } = req.body;

    if (!villagerID || typeof isActive !== "boolean") {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: villagerID, isActive",
      });
    }

    const success = await setVillagerActive(villagerID, isActive);

    if (success) {
      res.json({
        status: "success",
        villagerID,
        isActive,
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Villager not found",
        code: "NOT_FOUND",
      });
    }
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Failed to update active status",
    );
    res.status(500).json({
      status: "error",
      message: "Failed to update active status",
      code: "UPDATE_FAILED",
    });
  }
});

export default router;
