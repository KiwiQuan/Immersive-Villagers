import createApp from "./app.js";

const PORT = process.env.PORT || 3000;
const app = createApp();

/**
 * Start the Express server and handle graceful shutdown.
 */
function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`[Backend] Server listening on port ${PORT}`);
    console.log(`[Backend] Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[Backend] Debug mode: ${process.env.DEBUG_MODE || "false"}`);
  });

  // Graceful shutdown handler
  function shutdown(signal) {
    console.log(`\n[Backend] Received ${signal}, shutting down gracefully...`);
    
    server.close(() => {
      console.log("[Backend] HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds if server hasn't closed
    setTimeout(() => {
      console.error("[Backend] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  }

  // Listen for termination signals
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (err) => {
    console.error("[Backend] Uncaught exception:", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Backend] Unhandled rejection at:", promise, "reason:", reason);
    process.exit(1);
  });
}

startServer();
