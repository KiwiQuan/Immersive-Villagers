import express from "express";
import pool from "../db/pool.js";
import axios from "axios";

const router = express.Router();

/**
 * GET /api/debug/health
 * Comprehensive health check endpoint that tests all system components.
 * @returns {Object} Health status with database and LLM connectivity
 */
router.get("/health", async (req, res) => {
  const healthStatus = {
    status: "online",
    timestamp: Date.now(),
    components: {
      database: { status: "unknown", details: null },
      llm: { status: "unknown", details: null },
    },
  };

  // Test PostgreSQL connection
  try {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT NOW() as current_time, version()");
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };

      healthStatus.components.database = {
        status: "healthy",
        details: {
          connected: true,
          serverTime: result.rows[0].current_time,
          poolStats,
        },
      };
    } finally {
      client.release();
    }
  } catch (err) {
    healthStatus.components.database = {
      status: "unhealthy",
      details: {
        connected: false,
        error: err.message,
      },
    };
    healthStatus.status = "degraded";
  }

  // Test llama.cpp connection (if LLAMA_URL is configured)
  const llamaUrl = process.env.LLAMA_URL;
  if (llamaUrl) {
    try {
      const response = await axios.get(`${llamaUrl}/health`, {
        timeout: 2000,
      });

      healthStatus.components.llm = {
        status: "healthy",
        details: {
          connected: true,
          url: llamaUrl,
        },
      };
    } catch (err) {
      healthStatus.components.llm = {
        status: "unhealthy",
        details: {
          connected: false,
          url: llamaUrl,
          error: err.message,
        },
      };
      // LLM not critical for basic operations, so don't mark as degraded
    }
  } else {
    healthStatus.components.llm = {
      status: "not_configured",
      details: {
        connected: false,
        message: "LLAMA_URL not set in environment",
      },
    };
  }

  // Determine overall status
  const httpStatus = healthStatus.status === "online" ? 200 : 503;

  res.status(httpStatus).json(healthStatus);
});

export default router;
