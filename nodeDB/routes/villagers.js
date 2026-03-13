import express from "express";
import {
  registerVillager,
  getVillager,
  removeVillager,
  getAllVillagerIDs,
  setVillagerActive,
  deleteAllVillagers,
  getAllVillagersWithMemory,
  getVillagerWithMemory,
} from "../queries/villagers.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * POST /api/villagers/register
 * Registers villager(s) in the database.
 * ALWAYS accepts an array (single = array with 1 item, batch = multiple items).
 * 
 * Body: Array of villager objects
 * Example: [{ villagerID, name, homeX, homeY, homeZ, profession, isActive }]
 */
router.post("/register", async (req, res) => {
  try {
    // Validate array
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Expected non-empty array of villager objects",
      });
    }

    // Validate required fields for each villager
    for (const villager of req.body) {
      if (!villager.villagerID) {
        return res.status(400).json({
          status: "error",
          message: "Missing required field: villagerID",
        });
      }
      if (villager.homeX === undefined || villager.homeY === undefined || villager.homeZ === undefined) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields: homeX, homeY, homeZ",
        });
      }
    }

    const result = await registerVillager(req.body);
    res.json(result);
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Villager registration failed",
    );
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
    logger.error(
      { error: error.message },
      "[Villagers] Villager removal failed",
    );
    res.status(500).json({
      status: "error",
      message: "Villager removal failed",
      code: "REMOVAL_FAILED",
    });
  }
});

/**
 * POST /api/villagers/get
 * Returns a single villager's data from the database.
 */
router.get("/get/:villagerID", async (req, res) => {
  try {
    const { villagerID } = req.params;

    if (!villagerID) {
      return res.status(400).json({
        status: "error",
        message: "Missing required field: villagerID",
      });
    }

    const villager = await getVillager(villagerID);

    if (!villager) {
      return res.status(404).json({
        status: "error",
        message: "Villager not found",
        code: "NOT_FOUND",
      });
    }

    res.json({
      status: "success",
      villager,
    });
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Failed to get villager",
    );
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve villager",
      code: "GET_FAILED",
    });
  }
});

/**
 * GET /api/villagers/get_with_memory/:villagerID
 * Gets a single villager with their working memory data (for diagnostics).
 */
router.get("/get_with_memory/:villagerID", async (req, res) => {
  try {
    const { villagerID } = req.params;

    if (!villagerID) {
      return res.status(400).json({
        status: "error",
        message: "Missing required field: villagerID",
      });
    }

    const villager = await getVillagerWithMemory(villagerID);

    if (!villager) {
      return res.status(404).json({
        status: "error",
        message: "Villager not found",
        code: "NOT_FOUND",
      });
    }

    res.json({
      status: "success",
      villager,
    });
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Failed to get villager with memory",
    );
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve villager with memory",
      code: "GET_FAILED",
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
    logger.error(
      { error: error.message },
      "[Villagers] Failed to list villagers",
    );
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve villager list",
      code: "LIST_FAILED",
    });
  }
});

/**
 * GET /api/villagers/all
 * Gets all villagers with their working memory data (for state recovery).
 */
router.get("/all", async (req, res) => {
  try {
    const villagers = await getAllVillagersWithMemory();

    res.json({
      status: "success",
      villagers,
      count: villagers.length,
    });
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Failed to get all villagers",
    );
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve all villagers",
      code: "GET_ALL_FAILED",
    });
  }
});

/**
 * POST /api/villagers/set_active
 * Sets the is_active status for villager(s) based on chunk load state.
 * ALWAYS accepts an array (single = array with 1 item, batch = multiple items).
 * 
 * Body: Array of {villagerID, isActive} objects
 * Example: [{ villagerID: "123", isActive: true }]
 */
router.post("/set_active", async (req, res) => {
  try {
    // Validate array
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Expected non-empty array of {villagerID, isActive} objects",
      });
    }

    // Validate each update
    for (const update of req.body) {
      if (!update.villagerID || typeof update.isActive !== "boolean") {
        return res.status(400).json({
          status: "error",
          message: "Each update must have villagerID and isActive (boolean)",
        });
      }
    }

    const result = await setVillagerActive(req.body);
    res.json(result);
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

/**
 * POST /api/villagers/delete_all
 * Deletes all villagers from the database.
 */
router.delete("/delete_all", async (req, res) => {
  try {
    const result = await deleteAllVillagers();
    res.json(result);
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Failed to delete all villagers",
    );
    res.status(500).json({
      status: "error",
      message: "Failed to delete all villagers",
      code: "DELETE_ALL_FAILED",
    });
  }
});

export default router;
