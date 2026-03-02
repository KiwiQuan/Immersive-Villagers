import express from "express";
import debugRoutes from "./routes/debug.js";

/**
 * Initializes and configures the Express application.
 * @returns {express.Application} Configured Express app instance
 */
function createApp() {
  const app = express();

  // JSON body parser middleware (1mb limit for security)
  app.use(express.json({ limit: "1mb" }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
      );
    });
    next();
  });

  // Response timeout middleware (5 seconds)
  app.use((req, res, next) => {
    res.setTimeout(5000, () => {
      if (!res.headersSent) {
        console.warn(`[Express] Request timeout: ${req.path}`);
        res.status(408).json({ 
          status: "timeout", 
          message: "Request took too long" 
        });
      }
    });
    next();
  });

  // Route structure
  // Debug routes (Health check, diagnostics)
  app.use("/api/debug", debugRoutes);

  // Layer 5: Memory routes (Episode writes, Working Memory sync) - Phase 0 Feature 4+
  // app.use("/api/memory", memoryRoutes);

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
    console.error(`[Express] Unhandled error:`, err);
    
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

export default createApp;
