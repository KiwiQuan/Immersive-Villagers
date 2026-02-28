import pg from "pg";

/**
 * PostgreSQL connection pool configuration.
 * Uses pg-pool for connection reuse and concurrency management.
 */
const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "immersive_villagers",
  user: process.env.DB_USER || "MarzeeQ",
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Pool error event listener.
 * Logs unexpected pool errors without crashing the server.
 */
pool.on("error", (err, client) => {
  console.error("[PostgreSQL] Unexpected pool error:", err.message);
});

/**
 * Pool connect event listener (optional, for monitoring).
 */
pool.on("connect", (client) => {
  console.log("[PostgreSQL] New client connected to pool");
});

/**
 * Graceful shutdown handler.
 * Closes all pool connections when server terminates.
 */
process.on("SIGTERM", async () => {
  console.log("[PostgreSQL] Closing pool connections...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[PostgreSQL] Closing pool connections...");
  await pool.end();
  process.exit(0);
});

export default pool;
