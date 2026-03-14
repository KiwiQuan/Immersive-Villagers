# 🔍 Node Backend Code Review

**Review Date**: March 14, 2026  
**Scope**: `nodeDB/` directory (excluding `nodeDB/brain/` - llama.cpp)

---

## Overall Assessment

Your backend demonstrates **solid foundational architecture** with good transaction management and proper separation between routes, queries, and utilities. However, there are several areas where **DRY principles, resource efficiency, and production readiness** could be significantly improved.

---

## 📊 Scalability Analysis

### ✅ Strengths:
1. **Connection Pooling**: Properly configured with pg-pool (max: 20, sensible timeouts)
2. **Batch Operations**: Support for bulk inserts/updates reduces network overhead
3. **Transaction Management**: Proper BEGIN/COMMIT/ROLLBACK usage prevents data corruption
4. **Index Strategy**: Good use of pgvector indexes for fast similarity queries

### ⚠️ Concerns:

#### 1. Loop-based Updates (Major Performance Issue)

In `setVillagerActive()` and `syncWorkingMemoryBatch()`, you're running UPDATE queries in a loop:

**Current Implementation** (`queries/villagers.js:240-272`):
```javascript
async function setVillagerActive(updates) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const results = { success: [], failed: [] };
    const timestamp = Date.now();
    
    for (const update of updates) {
      try {
        const { villagerID, isActive } = update;
        
        const result = await client.query(
          "UPDATE villagers SET is_active = $1, last_seen = $2 WHERE villager_id = $3 RETURNING villager_id",
          [isActive, timestamp, villagerID]
        );
        
        if (result.rowCount > 0) {
          results.success.push({ villagerID, isActive });
        } else {
          results.failed.push({ 
            villagerID, 
            error: "Villager not found" 
          });
        }
      } catch (error) {
        results.failed.push({ 
          villagerID: update.villagerID, 
          error: error.message 
        });
      }
    }
    
    await client.query('COMMIT');
    // ...
  }
}
```

**Problem**: This executes N separate queries. With 50+ villagers, this becomes a bottleneck.

**Better Approach**: Use PostgreSQL's `unnest()` for bulk updates:
```javascript
async function setVillagerActiveBulk(updates) {
  const villagerIDs = updates.map(u => u.villagerID);
  const isActiveFlags = updates.map(u => u.isActive);
  const timestamp = Date.now();
  
  const result = await pool.query(`
    UPDATE villagers AS v
    SET 
      is_active = u.is_active::boolean,
      last_seen = $3
    FROM (
      SELECT 
        unnest($1::text[]) as villager_id,
        unnest($2::boolean[]) as is_active
    ) AS u
    WHERE v.villager_id = u.villager_id
    RETURNING v.villager_id, v.is_active
  `, [villagerIDs, isActiveFlags, timestamp]);
  
  return result.rows;
}
```

**Performance Gain**: Single query vs N queries = ~10-50x faster for large batches.

#### 2. Connection Acquisition Overhead

Every query function calls `pool.connect()` even for simple reads that don't need transactions:

**Current Implementation** (`queries/villagers.js:98-124`):
```javascript
async function getVillager(villagerID) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT * FROM villagers WHERE villager_id = $1",
      [villagerID],
    );

    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Villager not found");
      return null;
    }

    logger.info({ villagerID }, "[Query] Retrieved villager data");

    return result.rows[0];
  } catch (error) {
    logger.error(
      { error: error.message, villagerID },
      "[Query] Failed to retrieve villager",
    );
    throw error;
  } finally {
    client.release();
  }
}
```

**Problem**: `pool.connect()` has overhead. For single queries, use `pool.query()` directly.

**Better Approach**:
```javascript
async function getVillager(villagerID) {
  try {
    const result = await pool.query(
      "SELECT * FROM villagers WHERE villager_id = $1",
      [villagerID]
    );
    
    if (result.rowCount === 0) {
      logger.warn({ villagerID }, "[Query] Villager not found");
      return null;
    }

    logger.info({ villagerID }, "[Query] Retrieved villager data");
    return result.rows[0];
  } catch (error) {
    logger.error({ error: error.message, villagerID }, "[Query] Failed to retrieve villager");
    throw error;
  }
}
```

**Rule of Thumb**:
- Use `pool.query()` for single queries
- Use `pool.connect()` only for transactions (BEGIN/COMMIT)

---

## 🎯 Senior-Level Patterns & Principles

### 1. DRY Violation (Critical)

The SQL query construction logic is **duplicated** in both `syncWorkingMemory()` and `syncWorkingMemoryBatch()`:

**Duplicate Code** (`queries/working_memory.js:54-80` and `142-168`):
```javascript
// Appears twice with identical logic
if (aiMode === "MONOLITHIC") {
  query = `
    INSERT INTO working_memory (villager_id, current_mood_manual, current_focus, shock_state, last_update)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (villager_id) DO UPDATE SET
      current_mood_manual = EXCLUDED.current_mood_manual,
      current_focus = EXCLUDED.current_focus,
      shock_state = EXCLUDED.shock_state,
      last_update = EXCLUDED.last_update
    WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
    RETURNING last_update
  `;
  params = [villagerID, vectorString, currentFocus, shockState || false, timestamp];
} else {
  query = `
    INSERT INTO working_memory (villager_id, current_mood_minilm, current_focus, shock_state, last_update)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (villager_id) DO UPDATE SET
      current_mood_minilm = EXCLUDED.current_mood_minilm,
      current_focus = EXCLUDED.current_focus,
      shock_state = EXCLUDED.shock_state,
      last_update = EXCLUDED.last_update
    WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
    RETURNING last_update
  `;
  params = [villagerID, vectorString, currentFocus, shockState || false, timestamp];
}
```

**Solution**: Extract to a helper function:
```javascript
/**
 * Builds the Working Memory upsert query based on AI mode.
 * @param {string} aiMode - "MONOLITHIC" or "MICROSERVICES"
 * @returns {string} SQL query string
 */
function buildWorkingMemoryQuery(aiMode) {
  const moodColumn = aiMode === "MONOLITHIC" ? "current_mood_manual" : "current_mood_minilm";
  
  return `
    INSERT INTO working_memory (villager_id, ${moodColumn}, current_focus, shock_state, last_update)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (villager_id) DO UPDATE SET
      ${moodColumn} = EXCLUDED.${moodColumn},
      current_focus = EXCLUDED.current_focus,
      shock_state = EXCLUDED.shock_state,
      last_update = EXCLUDED.last_update
    WHERE working_memory.last_update < EXCLUDED.last_update OR working_memory.last_update IS NULL
    RETURNING last_update
  `;
}

/**
 * Builds query parameters for Working Memory sync.
 * @returns {Array} Parameter array for query
 */
function buildWorkingMemoryParams(villagerID, vectorString, currentFocus, shockState, timestamp) {
  return [villagerID, vectorString, currentFocus, shockState || false, timestamp];
}
```

Then use it:
```javascript
const query = buildWorkingMemoryQuery(aiMode);
const params = buildWorkingMemoryParams(villagerID, vectorString, currentFocus, shockState, timestamp);
const result = await client.query(query, params);
```

### 2. Inconsistent Logging (Separation of Concerns)

`pool.js` uses `console.log/error` while the rest uses Pino:

**Current** (`db/pool.js:22-31`):
```javascript
pool.on("error", (err, client) => {
  console.error("[PostgreSQL] Unexpected pool error:", err.message);
});

pool.on("connect", (client) => {
  console.log("[PostgreSQL] New client connected to pool");
});
```

**Fix**: Import and use the Pino logger throughout:
```javascript
import logger from "../utils/logger.js";

pool.on("error", (err) => {
  logger.error({ error: err.message }, "[PostgreSQL] Unexpected pool error");
});

pool.on("connect", () => {
  logger.debug("[PostgreSQL] New client connected to pool");
});
```

### 3. Validation Logic in Routes (Single Responsibility Principle)

Routes are handling validation, which violates SRP:

**Current** (`routes/memory.js:26-48`):
```javascript
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
  villagerMetadata,
});
```

**Better**: Extract to middleware validators:
```javascript
// utils/validators.js
function validateWorkingMemorySync(req, res, next) {
  const { villagerID, currentMood } = req.body;
  
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
  
  next();
}

// In routes/memory.js
router.post("/sync", validateWorkingMemorySync, async (req, res) => {
  // Validation already done by middleware
  const result = await syncWorkingMemory(req.body);
  res.json(result);
});
```

Or use industry-standard `express-validator`:
```javascript
import { body, validationResult } from 'express-validator';

router.post('/sync',
  body('villagerID').isString().notEmpty(),
  body('currentMood').isObject(),
  body('currentMood.C').isFloat(),
  body('currentMood.V').isFloat(),
  // ... etc
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: "error", 
        errors: errors.array() 
      });
    }
    // ... handler logic
  }
);
```

### 4. Inconsistent Error Handling

Some functions return `null`, some throw errors, some return status objects:

**Example 1** - Returns null:
```javascript
async function getVillager(villagerID) {
  // ...
  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0];
}
```

**Example 2** - Returns status object:
```javascript
async function removeVillager(villagerID) {
  // ...
  if (result.rowCount === 0) {
    return {
      status: "not_found",
      message: "Villager not found in database",
    };
  }
  return {
    status: "success",
    villagerID: result.rows[0].villager_id,
  };
}
```

**Better**: Consistent pattern - either:
- **Option A**: Always throw custom errors from query layer, handle in routes
- **Option B**: Always return result objects with status field

**Recommended Pattern**:
```javascript
// Custom error class
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

// Query layer - throw errors
async function getVillager(villagerID) {
  const result = await pool.query(
    "SELECT * FROM villagers WHERE villager_id = $1",
    [villagerID]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError(`Villager ${villagerID} not found`);
  }
  
  return result.rows[0];
}

// Route layer - catch and convert to HTTP response
try {
  const villager = await getVillager(villagerID);
  res.json({ status: "success", villager });
} catch (error) {
  if (error instanceof NotFoundError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message
    });
  }
  // ... other error handling
}
```

---

## 🧩 Specific Code Issues

### Issue 1: Inconsistent Client Management

```javascript
// In working_memory.js - needs transaction, uses pool.connect() ✅
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ...
} finally {
  client.release();
}

// In villagers.js for simple reads - doesn't need transaction, should use pool.query() ❌
const client = await pool.connect();
try {
  const result = await client.query("SELECT * FROM villagers...");
  return result.rows[0];
} finally {
  client.release();
}
```

**Recommendation**: 
- Use `pool.query()` for single queries (no transaction needed)
- Reserve `pool.connect()` for multi-query transactions

**Functions to Fix**:
- `getVillager()` - line 98
- `getVillagerWithMemory()` - line 132
- `getAllVillagersWithMemory()` - line 170
- `getAllVillagerIDs()` - line 205
- `villagerExists()` - line 72
- `deleteAllVillagers()` - line 340

### Issue 2: HTTP Method Mismatch Documentation

**File**: `routes/villagers.js:279`

```javascript
/**
 * POST /api/villagers/delete_all  // ❌ Comment says POST
 * Deletes all villagers from the database.
 */
router.delete("/delete_all", async (req, res) => {  // ✅ Code uses DELETE
```

**Fix**: Update comment to match code:
```javascript
/**
 * DELETE /api/villagers/delete_all
 * Deletes all villagers from the database.
 */
```

### Issue 3: Magic Numbers

**Current** (`app.js:36-48`):
```javascript
// Response timeout middleware (5 seconds)
app.use((req, res, next) => {
  res.setTimeout(5000, () => {  // Magic number
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
```

**Better**: Extract to config:
```javascript
// config/index.js
export const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 5000,
    jsonLimit: process.env.JSON_LIMIT || '1mb',
    shutdownTimeoutMs: 10000,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'immersive_villagers',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    maxConnections: 20,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 2000,
  },
  ai: {
    mode: validateAIMode(process.env.AI_MODE || 'MONOLITHIC'),
  },
};

function validateAIMode(mode) {
  const validModes = ['MONOLITHIC', 'MICROSERVICES'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid AI_MODE: ${mode}. Must be one of: ${validModes.join(', ')}`);
  }
  return mode;
}
```

Then use throughout:
```javascript
import { config } from './config/index.js';

app.use(express.json({ limit: config.server.jsonLimit }));
res.setTimeout(config.server.requestTimeoutMs, () => { ... });
```

### Issue 4: Environment Variable Access Without Validation

**Current** (`queries/working_memory.js:10-12`):
```javascript
function getAIMode() {
  return process.env.AI_MODE || "MONOLITHIC";
}
```

**Problem**: No validation that AI_MODE is valid. Called on every sync operation.

**Better**: Validate once on startup:
```javascript
// config/index.js
const VALID_AI_MODES = ['MONOLITHIC', 'MICROSERVICES'];

function validateConfig() {
  const aiMode = process.env.AI_MODE || 'MONOLITHIC';
  
  if (!VALID_AI_MODES.includes(aiMode)) {
    throw new Error(`Invalid AI_MODE: ${aiMode}. Must be one of: ${VALID_AI_MODES.join(', ')}`);
  }
  
  return aiMode;
}

export const AI_MODE = validateConfig();

// In queries/working_memory.js
import { AI_MODE } from '../config/index.js';

function buildWorkingMemoryQuery() {
  const moodColumn = AI_MODE === "MONOLITHIC" ? "current_mood_manual" : "current_mood_minilm";
  // ...
}
```

### Issue 5: Test File Using Outdated Schema

**File**: `db/test_connectivity.js:42`

```javascript
const episodeResult = await pool.query(
  `INSERT INTO episodes (villager_id, actor_id, semantic_vector, duration, event_count, seal_reason, timestamp)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING id, villager_id, actor_id`,
  // ...
);
```

**Problem**: Uses `semantic_vector` column which doesn't exist in schema. Schema has `semantic_vector_manual` and `semantic_vector_minilm`.

**Fix**: Update test to use correct columns:
```javascript
const episodeResult = await pool.query(
  `INSERT INTO episodes (villager_id, actor_id, semantic_vector_manual, duration, event_count, seal_reason, timestamp)
   VALUES ($1, $2, $3::vector, $4, $5, $6, $7)
   RETURNING id, villager_id, actor_id`,
  // ...
);
```

---

## 🚨 Critical Issues

### 1. Graceful Shutdown Race Condition

Both `server.js` and `pool.js` handle SIGTERM/SIGINT:

**pool.js:37-47**:
```javascript
process.on("SIGTERM", async () => {
  console.log("[PostgreSQL] Closing pool connections...");
  await pool.end();
  process.exit(0);  // ❌ Exits immediately
});

process.on("SIGINT", async () => {
  console.log("[PostgreSQL] Closing pool connections...");
  await pool.end();
  process.exit(0);  // ❌ Exits immediately
});
```

**server.js:37-40**:
```javascript
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

**Problem**: Two listeners for the same signals can cause race conditions. `pool.js` immediately exits without waiting for HTTP server to close. Active requests might be interrupted.

**Fix**: Remove signal handlers from `pool.js`. Let `server.js` orchestrate shutdown:

```javascript
// pool.js - remove signal handlers completely

// server.js - add pool shutdown to graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, "Shutting down gracefully");

  server.close(async () => {
    logger.info("HTTP server closed");
    
    // Close database pool after server stops accepting requests
    try {
      await pool.end();
      logger.info("Database pool closed");
    } catch (err) {
      logger.error({ error: err.message }, "Failed to close database pool");
    }
    
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}
```

### 2. Missing Database Schema Validation

No mechanism to verify that the actual database schema matches your code expectations. If someone runs an old schema, queries will fail with cryptic errors.

**Industry Standard**: Use migration tools like `node-pg-migrate` or `knex.js` migrations.

**Example Structure**:
```
nodeDB/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_minilm_vectors.sql
│   └── 003_add_structure_tables.sql
```

With version tracking:
```javascript
async function checkSchemaVersion() {
  const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
  const currentVersion = result.rows[0]?.version || 0;
  
  if (currentVersion < REQUIRED_VERSION) {
    throw new Error(`Database schema outdated. Run migrations.`);
  }
}
```

---

## 📦 Dependency Management

### ✅ Good:
- Modern Express v5.x
- Pino for structured logging
- Latest pg driver (8.14.1)
- ES Modules (`"type": "module"`)

### ⚠️ Missing Production Dependencies:

**Add to package.json**:
```json
{
  "dependencies": {
    "helmet": "^8.0.0",              // Security headers
    "express-validator": "^7.2.0",   // Input validation
    "cors": "^2.8.5",                 // CORS handling
    "compression": "^1.7.4",          // Response compression
    "express-rate-limit": "^7.4.1"   // Rate limiting
  },
  "devDependencies": {
    "supertest": "^7.1.0",
    "vitest": "^3.1.1",
    "eslint": "^9.0.0",              // Linting
    "prettier": "^3.3.0"             // Code formatting
  }
}
```

**Implementation**:
```javascript
// app.js
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

function createApp() {
  const app = express();
  
  // Security
  app.use(helmet());
  
  // CORS
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:19132'],
    credentials: true,
  }));
  
  // Compression
  app.use(compression());
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
  
  // ... rest of middleware
}
```

---

## 🔬 Over-Engineering Assessment

### Not Over-Engineered:
- The dual AI mode support (MONOLITHIC vs MICROSERVICES) is justified by your architecture
- Transaction management is appropriate
- Batch operations are necessary for performance

### Potentially Over-Engineered:

#### 1. Villager Metadata Lazy Init

**Current** (`queries/villagers.js:380-398`):
```javascript
async function ensureVillagerExists(client, villagerID, metadata = {}, timestamp = Date.now()) {
  const name = metadata.name || 'Unnamed';
  const homeX = metadata.location?.x || 0;
  const homeY = metadata.location?.y || 0;
  const homeZ = metadata.location?.z || 0;
  const profession = metadata.profession || 'unknown';

  await client.query(
    `INSERT INTO villagers (villager_id, name, home_x, home_y, home_z, profession, is_active, created_at, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (villager_id) DO NOTHING`,
    [villagerID, name, homeX, homeY, homeZ, profession, true, timestamp, timestamp]
  );

  logger.debug(
    { villagerID, name },
    "[Query] Ensured villager exists (lazy init)"
  );
}
```

**Trade-off Analysis**:
- **Pro**: Prevents FK violations, allows Working Memory to sync before registration completes
- **Con**: Can create "ghost" villagers with default/incorrect metadata

**Question**: Is this lazy initialization necessary, or should you enforce explicit registration first?

If villagers are always registered via `/api/villagers/register` before any other operations, this adds unnecessary complexity.

**Alternative**: Add FK validation and return clear errors:
```javascript
// In routes/memory.js
try {
  const result = await syncWorkingMemory(req.body);
  res.json(result);
} catch (error) {
  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json({
      status: "error",
      message: "Villager must be registered before syncing memory",
      code: "VILLAGER_NOT_REGISTERED"
    });
  }
  throw error;
}
```

#### 1.1 RECOMMENDED SOLUTION: Combined Atomic Endpoint

**Create a new `/api/villagers/initialize` endpoint that does both registration and memory initialization in a single atomic transaction.** This eliminates the race condition entirely.

**New Route** (`routes/villagers.js`):
```javascript
/**
 * POST /api/villagers/initialize
 * Atomically registers a villager AND initializes their working memory.
 * Solves race condition by doing both operations in one transaction.
 * ALWAYS accepts an array.
 * 
 * Body: Array of {villager, workingMemory} objects
 * Example: [{
 *   villager: { villagerID, name, homeX, homeY, homeZ, profession, isActive },
 *   workingMemory: { currentMood, currentFocus, shockState, lastUpdate }
 * }]
 */
router.post("/initialize", async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Expected non-empty array of initialization objects",
      });
    }

    // Validate structure
    for (const init of req.body) {
      if (!init.villager?.villagerID) {
        return res.status(400).json({
          status: "error",
          message: "Missing villager.villagerID",
        });
      }
      if (!init.workingMemory?.currentMood) {
        return res.status(400).json({
          status: "error",
          message: "Missing workingMemory.currentMood",
        });
      }
      if (init.villager.homeX === undefined || 
          init.villager.homeY === undefined || 
          init.villager.homeZ === undefined) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields: homeX, homeY, homeZ",
        });
      }
    }

    const result = await initializeVillagers(req.body);
    res.json(result);
  } catch (error) {
    logger.error(
      { error: error.message },
      "[Villagers] Initialization failed",
    );
    res.status(500).json({
      status: "error",
      message: "Villager initialization failed",
      code: "INIT_FAILED",
    });
  }
});
```

**New Query Function** (`queries/villagers.js`):
```javascript
/**
 * Atomically registers villager(s) and initializes their working memory.
 * Solves race condition by doing both operations in a single transaction.
 * 
 * @param {Array<Object>} initData - Array of {villager, workingMemory} objects
 * @returns {Promise<Object>} Result with success/failed arrays
 */
async function initializeVillagers(initData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = { success: [], failed: [] };
    const timestamp = Date.now();
    const aiMode = process.env.AI_MODE || "MONOLITHIC";
    const moodColumn = aiMode === "MONOLITHIC" ? "current_mood_manual" : "current_mood_minilm";
    
    for (const init of initData) {
      try {
        const { villager, workingMemory } = init;
        
        // STEP 1: Insert villager
        await client.query(
          `INSERT INTO villagers (villager_id, name, home_x, home_y, home_z, profession, is_active, created_at, last_seen)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (villager_id) DO UPDATE SET
             name = EXCLUDED.name,
             home_x = EXCLUDED.home_x,
             home_y = EXCLUDED.home_y,
             home_z = EXCLUDED.home_z,
             profession = EXCLUDED.profession,
             last_seen = EXCLUDED.last_seen,
             is_active = EXCLUDED.is_active`,
          [
            villager.villagerID,
            villager.name || 'Unnamed',
            villager.homeX,
            villager.homeY,
            villager.homeZ,
            villager.profession || 'unknown',
            villager.isActive !== false,
            timestamp,
            timestamp
          ]
        );
        
        // STEP 2: Initialize working memory (FK constraint is now satisfied)
        const { currentMood, currentFocus, shockState, lastUpdate } = workingMemory;
        const vectorArray = [currentMood.C, currentMood.V, currentMood.I, currentMood.S, currentMood.X];
        const vectorString = `[${vectorArray.join(",")}]`;
        
        await client.query(
          `INSERT INTO working_memory (villager_id, ${moodColumn}, current_focus, shock_state, last_update)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (villager_id) DO UPDATE SET
             ${moodColumn} = EXCLUDED.${moodColumn},
             current_focus = EXCLUDED.current_focus,
             shock_state = EXCLUDED.shock_state,
             last_update = EXCLUDED.last_update
           WHERE working_memory.last_update < EXCLUDED.last_update`,
          [villager.villagerID, vectorString, currentFocus || null, shockState || false, lastUpdate || timestamp]
        );
        
        results.success.push({ villagerID: villager.villagerID });
      } catch (error) {
        results.failed.push({ 
          villagerID: init.villager?.villagerID || 'unknown',
          reason: error.message 
        });
      }
    }
    
    await client.query('COMMIT');
    
    logger.info(
      { successCount: results.success.length, failedCount: results.failed.length },
      "[Query] Villager initialization complete (atomic: villager + WM)"
    );
    
    return { status: "success", results };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, "[Query] Villager initialization failed");
    throw error;
  } finally {
    client.release();
  }
}

// Add to exports
export { 
  registerVillager,
  villagerExists,
  getVillager,
  getVillagerWithMemory,
  removeVillager,
  getAllVillagerIDs,
  getAllVillagersWithMemory,
  setVillagerActive,
  deleteAllVillagers,
  ensureVillagerExists,
  initializeVillagers  // NEW
};
```

**Script API Usage** (`lifecycle_handlers.js`):
```javascript
/**
 * Handles villager spawn by atomically registering and initializing memory.
 * Single atomic transaction eliminates race condition.
 */
async function handleVillagerSpawn(villager) {
  try {
    const response = await httpRequest("POST", "/api/villagers/initialize", [{
      villager: {
        villagerID: villager.id,
        name: villager.nameTag || 'Villager',
        homeX: villager.location.x,
        homeY: villager.location.y,
        homeZ: villager.location.z,
        profession: villager.typeId.split(':')[1],
        isActive: true
      },
      workingMemory: {
        currentMood: { C: 0, V: 0, I: 0, S: 0, X: 0 },
        currentFocus: null,
        shockState: false,
        lastUpdate: Date.now()
      }
    }]);
    
    const data = JSON.parse(response.body);
    
    if (data.results.success.length > 0) {
      logger.info(`✅ Villager ${villager.id} initialized atomically`);
    } else {
      logger.error(`❌ Failed to initialize: ${data.results.failed[0]?.reason}`);
    }
  } catch (error) {
    logger.error(`❌ Network error during initialization: ${error.message}`);
  }
}
```

**Advantages**:
- ✅ **Zero race condition** - both operations in one transaction
- ✅ **Atomic** - either both succeed or both fail
- ✅ **No lazy init needed** - explicit registration with full metadata
- ✅ **Single network call** - faster than two separate requests
- ✅ **Clear semantics** - "initialize" for new villagers, "sync" for updates
- ✅ **Matches existing pattern** - already using array format like `/register`

**Migration Path**:
1. Add `/initialize` endpoint
2. Update Script API to use it for new villagers
3. Keep `/sync` for ongoing working memory updates (after initialization)
4. Remove `ensureVillagerExists()` call from `syncWorkingMemory()`

**When to Use Each Endpoint**:
- `/api/villagers/initialize` - First time a villager spawns (once per villager)
- `/api/memory/sync` - Periodic working memory updates (every 2-5 seconds)
- `/api/villagers/register` - Manual registration without memory init (optional, for testing)

#### 2. Array-Only Pattern (RECOMMENDED SIMPLIFICATION)

**Current** (`routes/memory.js:13-29`):
```javascript
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
```

**Problem**: Two code paths add complexity. Requires detection logic and different validation.

**Better**: **ALWAYS accept an array** (same pattern as `/register` and `/set_active`):
```javascript
/**
 * POST /api/memory/sync
 * Syncs Working Memory from DynamicProperties to PostgreSQL.
 * ALWAYS accepts an array of memory objects.
 * Single request = array with 1 item, batch = array with N items.
 * 
 * Body: Array of memory objects
 * Example: [{ villagerID, currentMood, currentFocus, shockState, lastUpdate }]
 */
router.post("/sync", async (req, res) => {
  try {
    // Validate array
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Expected non-empty array of memory objects",
      });
    }

    // Validate each memory object
    for (const memory of req.body) {
      if (!memory.villagerID) {
        return res.status(400).json({
          status: "error",
          message: "Missing required field: villagerID",
        });
      }
      if (!memory.currentMood || typeof memory.currentMood !== "object") {
        return res.status(400).json({
          status: "error",
          message: "Missing or invalid currentMood object",
        });
      }
    }

    // Always use batch function (handles 1 or N efficiently)
    const result = await syncWorkingMemoryBatch(req.body);
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
```

**Benefits**:
- ✅ Single code path (no branching)
- ✅ Consistent with `/register` and `/set_active` patterns
- ✅ Simpler client code (always send array)
- ✅ No need for two separate functions
- ✅ Clear API documentation

**Script API Usage**:
```javascript
// Single villager
await httpRequest("POST", "/api/memory/sync", [{  // Always an array
  villagerID: "123",
  currentMood: { C: 0.5, V: 0.3, I: 0.2, S: 0.7, X: 0.1 },
  currentFocus: null,
  shockState: false,
  lastUpdate: Date.now()
}]);

// Batch (same endpoint)
await httpRequest("POST", "/api/memory/sync", [
  { villagerID: "123", currentMood: {...}, ... },
  { villagerID: "456", currentMood: {...}, ... },
  { villagerID: "789", currentMood: {...}, ... }
]);
```

---

## 📐 Industry Standards Compliance

### ✅ Following Standards:
- ES Modules with proper exports
- Express.js middleware pattern
- RESTful-ish API design
- Structured logging (Pino)
- Environment variable configuration
- Proper async/await usage

### ❌ Missing Industry Standards:

#### 1. Input Validation Library
Manual validation is error-prone and verbose. Use `express-validator` or `joi`:

**Example with express-validator**:
```javascript
import { body, validationResult, param } from 'express-validator';

router.post('/register',
  body().isArray({ min: 1 }).withMessage('Expected non-empty array'),
  body('*.villagerID').isString().notEmpty(),
  body('*.homeX').isNumeric(),
  body('*.homeY').isNumeric(),
  body('*.homeZ').isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const result = await registerVillager(req.body);
    res.json(result);
  }
);
```

#### 2. Security Headers
Missing `helmet` middleware:

```javascript
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: false, // Adjust based on needs
}));
```

#### 3. CORS Configuration
No CORS policy defined. Currently accepts requests from any origin:

```javascript
import cors from 'cors';
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:19132'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

#### 4. Response Compression
Missing compression for large JSON payloads:

```javascript
import compression from 'compression';
app.use(compression());
```

#### 5. Rate Limiting
No protection against request spam from Script API:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for local API
  message: { status: "error", message: "Too many requests" }
});
app.use('/api/', limiter);
```

#### 6. Health Check Standards
Your health check is functional but doesn't follow RFC Health Check Response Format for JSON (draft-inadarei-api-health-check):

**Current**:
```json
{
  "status": "online",
  "components": {
    "database": { "status": "healthy" },
    "llm": { "status": "healthy" }
  }
}
```

**Standard Format**:
```json
{
  "status": "pass",
  "version": "1.0.0",
  "releaseId": "1.0.0-abc123",
  "checks": {
    "database:responseTime": [{
      "componentType": "datastore",
      "observedValue": 15,
      "observedUnit": "ms",
      "status": "pass",
      "time": "2026-03-14T12:00:00Z"
    }],
    "llm:health": [{
      "componentType": "component",
      "status": "pass",
      "time": "2026-03-14T12:00:00Z"
    }]
  }
}
```

---

## 🏗️ Architecture Recommendations

### 1. Create a Middleware Layer

**Current Structure**:
```
nodeDB/
├── routes/          # Contains validation + business logic
├── queries/         # Database operations
└── utils/
```

**Recommended Structure**:
```
nodeDB/
├── middleware/
│   ├── validators/
│   │   ├── memory.js       # Validation middleware
│   │   ├── villagers.js
│   ├── errorHandler.js     # Centralized error handling
│   ├── security.js         # Helmet, CORS, rate limiting
│   └── logging.js          # Request logging middleware
├── routes/                 # Pure routing logic
├── queries/                # Database operations
├── config/                 # Configuration management
│   └── index.js
└── utils/
```

### 2. Add Service Layer (Optional but Recommended)

Currently routes call queries directly. For complex logic, add a service layer:

**Structure**:
```
nodeDB/
├── services/
│   ├── villagerService.js  # Business logic
│   ├── memoryService.js    # Orchestration
```

**Example**:
```javascript
// services/memoryService.js
import { syncWorkingMemory } from '../queries/working_memory.js';
import { notifyVillagerUpdate } from './notificationService.js';

/**
 * Syncs working memory and triggers any dependent operations.
 */
export async function syncMemoryWithSideEffects(workingMemory) {
  // 1. Sync to database
  const result = await syncWorkingMemory(workingMemory);
  
  // 2. Trigger any side effects (e.g., cache invalidation, webhooks)
  if (result.status === 'success') {
    await notifyVillagerUpdate(workingMemory.villagerID);
  }
  
  return result;
}

// routes/memory.js
import { syncMemoryWithSideEffects } from '../services/memoryService.js';

router.post('/sync', async (req, res) => {
  const result = await syncMemoryWithSideEffects(req.body);
  res.json(result);
});
```

This allows you to compose multiple query operations and add business logic without polluting routes.

### 3. Add Central Error Handler

**Create** `middleware/errorHandler.js`:
```javascript
import logger from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      code: err.code,
    });
  }
  
  // Unknown/programming errors
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    code: 'UNKNOWN_ERROR',
  });
}
```

Then in queries:
```javascript
import { NotFoundError } from '../middleware/errorHandler.js';

async function getVillager(villagerID) {
  const result = await pool.query(
    "SELECT * FROM villagers WHERE villager_id = $1",
    [villagerID]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError(`Villager ${villagerID} not found`);
  }
  
  return result.rows[0];
}
```

---

## 🧪 Testing Gaps

### Current State:
- Has `supertest` and `vitest` dependencies
- Has one integration test (`test_connectivity.js`)
- No unit tests for individual functions

### Recommended Test Structure:
```
nodeDB/
├── tests/
│   ├── unit/
│   │   ├── queries.test.js
│   │   ├── validators.test.js
│   ├── integration/
│   │   ├── routes.test.js
│   │   ├── database.test.js
│   └── setup.js              # Test database setup
```

**Example Unit Test**:
```javascript
// tests/unit/queries.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as villagerQueries from '../../queries/villagers.js';

describe('Villager Queries', () => {
  it('should get villager by ID', async () => {
    const villager = await villagerQueries.getVillager('test-001');
    expect(villager).toHaveProperty('villager_id');
    expect(villager.villager_id).toBe('test-001');
  });
  
  it('should throw NotFoundError when villager does not exist', async () => {
    await expect(villagerQueries.getVillager('nonexistent'))
      .rejects
      .toThrow('not found');
  });
});
```

---

## 📊 Performance Optimization Opportunities

### 1. Query Optimization

**Current**: Multiple round-trips for batch operations

```javascript
// Current: N queries in a loop
for (const update of updates) {
  await client.query("UPDATE villagers SET ...", [update.villagerID]);
}
```

**Optimized**: Single bulk query
```javascript
// Single query with unnest
await client.query(`
  UPDATE villagers AS v
  SET is_active = u.is_active, last_seen = u.last_seen
  FROM (SELECT unnest($1::text[]) as villager_id, unnest($2::boolean[]) as is_active) AS u
  WHERE v.villager_id = u.villager_id
`, [villagerIDs, isActiveFlags, timestamp]);
```

**Expected Improvement**: 10-50x faster for batches of 20+ villagers

### 2. Connection Pooling Efficiency

**Issue**: Acquiring connections for simple reads

**Files to Optimize**:
- `queries/villagers.js`: Lines 72, 98, 132, 170, 205
- These functions use `pool.connect()` but don't need transactions

**Estimated Improvement**: ~5-10ms saved per query

### 3. Prepared Statements

PostgreSQL supports prepared statements for frequently executed queries:

```javascript
// For queries executed thousands of times
const getVillagerStatement = {
  name: 'get-villager',
  text: 'SELECT * FROM villagers WHERE villager_id = $1',
};

async function getVillager(villagerID) {
  const result = await pool.query(getVillagerStatement, [villagerID]);
  // ...
}
```

**Expected Improvement**: ~10-20% faster for hot queries

### 4. Caching Layer

For frequently accessed, rarely changing data (e.g., villager metadata):

```javascript
import NodeCache from 'node-cache';

const villagerCache = new NodeCache({ 
  stdTTL: 60,  // 60 second TTL
  checkperiod: 120 
});

async function getVillager(villagerID) {
  // Check cache first
  const cached = villagerCache.get(villagerID);
  if (cached) return cached;
  
  // Query database
  const villager = await pool.query(/* ... */);
  
  // Store in cache
  villagerCache.set(villagerID, villager);
  
  return villager;
}
```

---

## 🎯 Priority Fixes

### 🔴 High Priority (Do First):
1. **Fix graceful shutdown race condition** (pool + server signal handlers)
2. **Extract duplicate query construction logic** (DRY violation in `working_memory.js`)
3. **Optimize batch operations** (use `unnest()` instead of loops)
4. **Consistent logger usage** (remove `console.log` from `pool.js`)
5. **Fix test_connectivity.js** (outdated column name `semantic_vector`)

### 🟡 Medium Priority (Production Readiness):
6. **Extract validation to middleware** (SRP compliance)
7. **Add central configuration module** (eliminate magic numbers)
8. **Use `pool.query()` for non-transactional reads** (efficiency)
9. **Consistent error handling pattern** (throw custom errors)
10. **Add security middleware** (helmet, CORS, compression, rate limiting)

### 🟢 Low Priority (Future Improvements):
11. Add unit/integration tests (vitest setup)
12. Add database migration system (node-pg-migrate)
13. Add OpenAPI/Swagger documentation
14. Add caching layer for read-heavy operations
15. Separate endpoints for single vs batch operations

---

## 📈 Final Scores

| Category | Score | Assessment |
|----------|-------|------------|
| **Scalability** | 7/10 | Good pooling and transactions, but loop-based bulk ops hurt performance |
| **Senior Patterns** | 6/10 | Good separation of concerns, but DRY violations and validation in routes |
| **Over-Engineering** | 2/10 | Not over-engineered. Most complexity is justified |
| **Industry Standards** | 6/10 | Modern stack, but missing standard security/validation middleware |
| **Production Readiness** | 5/10 | Functional but needs security, testing, and error handling improvements |

---

## 🎓 Summary

Your backend is **well-structured and functional** with a solid foundation. The main improvements needed:

1. **Eliminate code duplication** (query builders, validation logic)
2. **Optimize batch operations** (SQL bulk updates with `unnest()`)
3. **Fix shutdown coordination** (single signal handler)
4. **Add production middleware** (helmet, CORS, validation, rate limiting)
5. **Consistent patterns** (error handling, logging, client management)

The architecture is solid for a project of this complexity. The issues identified are mostly **refinements** rather than fundamental flaws. With these improvements, your backend would be **production-ready and maintainable at scale**.

**Key Takeaway**: You've built a functional system with good instincts. Now polish it with industry-standard tooling and optimize the hot paths (batch operations).
