import express from "express";
import pool from "../db/pool.js";
import axios from "axios";

const router = express.Router();

/**
 * GET/POST /api/debug/health
 * Comprehensive health check endpoint that tests all system components.
 * Accepts both GET and POST for testing Script API communication.
 * @returns {Object} Health status with database and LLM connectivity
 */
async function handleHealthCheck(req, res) {
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
      const result = await client.query(
        "SELECT NOW() as current_time, version()",
      );
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

  // Include request body data if POST was used (for testing)
  if (req.method === "POST" && req.body) {
    healthStatus.receivedData = req.body;
  }

  // Determine overall status
  const httpStatus = healthStatus.status === "online" ? 200 : 503;

  res.status(httpStatus).json(healthStatus);
}

// Support both GET and POST for testing Script API communication
router.get("/health", handleHealthCheck);
router.post("/health", handleHealthCheck);

/**
 * GET /api/debug/test
 * Simple test endpoint for verifying GET requests from Script API.
 * Returns test data with timestamp.
 * @returns {Object} Test response data
 */
router.get("/test", (req, res) => {
  res.json({
    status: "success",
    message: "Test endpoint reached successfully",
    timestamp: Date.now(),
    requestMethod: req.method,
    testData: {
      serverUptime: process.uptime(),
      nodeVersion: process.version,
    },
  });
});

/**
 * GET /api/debug/test/slow
 * Simulates a slow endpoint that takes 10+ seconds to respond.
 * Used to test timeout handling in Script API.
 * @returns {Object} Response after delay
 */
router.get("/test/slow", async (req, res) => {
  const delaySeconds = parseInt(req.query.delay) || 10;
  
  console.warn(`§e[Debug] Slow test endpoint triggered with ${delaySeconds}s delay`);
  
  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
  
  // Check if timeout middleware already sent a response
  if (!res.headersSent) {
    res.json({
      status: "success",
      message: "Slow endpoint completed",
      delaySeconds,
      timestamp: Date.now(),
    });
  } else {
    console.warn(`§e[Debug] Slow endpoint completed but response already sent (timeout occurred)`);
  }
});

export default router;
