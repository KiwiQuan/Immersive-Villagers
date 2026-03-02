import createApp, { logger } from "./app.js";

const PORT = process.env.PORT || 3000;
const app = createApp();

/**
 * Start the Express server and handle graceful shutdown.
 */
function startServer() {
  const server = app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        env: process.env.NODE_ENV || "development",
        debugMode: process.env.DEBUG_MODE || "false",
      },
      "Server started"
    );
  });

  // Graceful shutdown handler
  function shutdown(signal) {
    logger.info({ signal }, "Shutting down gracefully");
    
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds if server hasn't closed
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  }

  // Listen for termination signals
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (err) => {
    logger.fatal({ error: err.message, stack: err.stack }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal(
      { reason, promise },
      "Unhandled promise rejection"
    );
    process.exit(1);
  });
}

startServer();
