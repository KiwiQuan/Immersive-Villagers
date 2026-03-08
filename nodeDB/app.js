import express from "express";
import debugRoutes from "./routes/debug.js";
import llmRoutes from "./routes/llm.js";
import memoryRoutes from "./routes/memory.js";
import villagersRoutes from "./routes/villagers.js";
import logger from "./utils/logger.js";

/**
 * Initializes and configures the Express application.
 * @returns {express.Application} Configured Express app instance
 */
function createApp() {
  const app = express();

  // JSON body parser middleware (1mb limit for security)
  app.use(express.json({ limit: "1mb" }));

  // Request logging middleware with Pino
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info(
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
        },
        "HTTP Request",
      );
    });
    next();
  });

  // Response timeout middleware (5 seconds)
  app.use((req, res, next) => {
    res.setTimeout(5000, () => {
      if (!res.headersSent) {
        logger.warn({ path: req.path }, "Request timeout");
        res.status(408).json({
          status: "timeout",
          message: "Request took too long",
        });
      }
    });
    next();
  });

  // Route structure
  // Debug routes (Health check, diagnostics)
  app.use("/api/debug", debugRoutes);

  // LLM routes (Chat endpoint for testing)
  app.use("/api/llm", llmRoutes);

  // Villager lifecycle routes (Registration, removal) - Must come before memory routes
  app.use("/api/villagers", villagersRoutes);

  // Layer 5: Memory routes (Episode writes, Working Memory sync)
  app.use("/api/memory", memoryRoutes);

  // Layer 6: Brain routes (LLM queue, polling) - Phase 0 Feature 4+
  // app.use("/api/brain", brainRoutes);

  // Root health check endpoint (basic connectivity test)
  app.get("/", (req, res) => {
    res.json({
      status: "online",
      message: "Immersive Villagers Backend",
      timestamp: Date.now(),
    });
  });

  // 404 handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      status: "error",
      message: "Route not found",
      path: req.path,
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    logger.error({ error: err.message, stack: err.stack }, "Unhandled error");

    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: "Internal server error",
        code: err.code || "UNKNOWN_ERROR",
        timestamp: Date.now(),
      });
    }
  });

  return app;
}

export { logger };
export default createApp;
