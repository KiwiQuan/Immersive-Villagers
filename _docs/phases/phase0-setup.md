# Phase 0: Setup — Barebones Infrastructure

**Status:** Foundation Phase  
**Goal:** Establish minimal infrastructure to run and test basic connectivity  
**Deliverable:** Backend and database running, Script API can send HTTP requests  
**Duration Target:** 2-3 implementation sessions

---

## Overview

This phase establishes the foundational infrastructure needed for all subsequent development. The system will be non-functional for gameplay but will have all core services running and communicating.

**Success Criteria:**
- PostgreSQL database initialized with schema
- Node.js backend responding to health checks
- llama.cpp server running and responding to test prompts
- Script API can send HTTP requests to backend
- Basic logging operational

---

## Feature 1: Database Infrastructure

**Goal:** PostgreSQL database operational with initial schema

### Steps:
1. Install PostgreSQL 15+ and create `villager_memory` database
2. Create database user `minecraft_ai` with appropriate permissions
3. Execute `schema.sql` to create tables: `episodes`, `relationships`, `working_memory`, `identity_tags`
4. Verify tables created with correct indexes (villager_id, timestamp)
5. Test connection with `psql` and run sample INSERT/SELECT queries

**Files Created:**
- `nodeDB/db/schema.sql`
- `nodeDB/db/pool.js`

**Validation:**
```sql
-- Test query
SELECT * FROM episodes LIMIT 1;
SELECT * FROM relationships LIMIT 1;
```

---

## Feature 2: Node.js Backend Bootstrap

**Goal:** Express server running with basic health check endpoint

### Steps:
1. Initialize Node.js project: `npm init -y` in `nodeDB/` directory
2. Install core dependencies: `express`, `pg`, `pino`, `axios`, `dotenv`
3. Create `app.js` with Express initialization and basic middleware
4. Implement `/api/health` endpoint that returns backend status
5. Create `.env` file with database credentials and configuration

**Files Created:**
- `nodeDB/package.json`
- `nodeDB/.env`
- `nodeDB/app.js`
- `nodeDB/server.js`
- `nodeDB/utils/logger.js`

**Validation:**
```bash
# Start backend
cd nodeDB && node server.js

# Test health check
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "llm": "not_configured"
  },
  "timestamp": 1708718400000
}
```

---

## Feature 3: LLM Server Setup

**Goal:** llama.cpp server operational and responding to test prompts

### Steps:
1. Download and compile llama.cpp from source
2. Download quantized model (Llama 3 7B Q4_K_M recommended)
3. Start llama.cpp server with config: `./server -m model.gguf -c 2048 --port 8080 --threads 4`
4. Test with curl: send completion request with simple prompt
5. Verify response time (<3 seconds) and valid JSON output

**Files Created:**
- `llama.cpp/` (external directory)
- `llama.cpp/models/llama-3-7b-q4_k_m.gguf`
- `nodeDB/brain/llm_client.js`

**Validation:**
```bash
# Test llama.cpp directly
curl http://localhost:8080/completion \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello", "n_predict": 20}'

# Expected: Response with generated text in <3 seconds
```

---

## Feature 4: Script API HTTP Communication

**Goal:** Minecraft Script API can send HTTP requests to backend

### Steps:
1. Create minimal behavior pack with `manifest.json` and dependencies
2. Add `@minecraft/server` and `@minecraft/server-net` dependencies
3. Create `scripts/main.js` with world load event handler
4. Implement test HTTP POST to `/api/health` on world load
5. Verify request appears in backend logs (Pino)

**Files Created:**
- `manifest.json`
- `scripts/main.js`
- `scripts/utils/http_client.js`

**Validation:**
```javascript
// In scripts/main.js
import { world } from '@minecraft/server';
import { http } from '@minecraft/server-net';

world.afterEvents.worldInitialize.subscribe(() => {
  http.get('http://localhost:3000/api/health')
    .then(response => {
      console.warn('[Setup] Backend health check:', response.body);
    })
    .catch(err => {
      console.error('[Setup] Backend unreachable:', err.message);
    });
});
```

**Expected:** Console log showing successful connection to backend

---

## Feature 5: Connection Pooling Configuration

**Goal:** PostgreSQL connection pool operational with proper limits

### Steps:
1. Create `nodeDB/db/pool.js` with pg-pool configuration
2. Set pool parameters: max 20 connections, idle timeout 30s
3. Add pool error handlers for connection failures
4. Implement connection test function that runs on backend startup
5. Add pool metrics logging (active connections, queue size)

**Files Created:**
- `nodeDB/db/pool.js`

**Validation:**
```javascript
// Test in Node.js console
const { pool } = require('./db/pool');

async function testPool() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);
  } finally {
    client.release();
  }
}

testPool();
```

---

## Configuration Files

### `.env` (nodeDB/.env)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=villager_memory
DB_USER=minecraft_ai
DB_PASSWORD=your_secure_password_here

# Backend
PORT=3000
NODE_ENV=development

# LLM
LLAMA_URL=http://localhost:8080

# Logging
LOG_LEVEL=debug
DEBUG_MODE=true
```

### `manifest.json` (Behavior Pack Root)
```json
{
  "format_version": 2,
  "header": {
    "name": "Immersive Villagers BP",
    "description": "AI-driven cognitive villager system",
    "uuid": "generate-unique-uuid-here",
    "version": [0, 0, 1],
    "min_engine_version": [1, 26, 0]
  },
  "modules": [
    {
      "type": "data",
      "uuid": "generate-unique-uuid-here",
      "version": [0, 0, 1]
    },
    {
      "type": "script",
      "language": "javascript",
      "uuid": "generate-unique-uuid-here",
      "version": [0, 0, 1],
      "entry": "scripts/main.js"
    }
  ],
  "dependencies": [
    {
      "module_name": "@minecraft/server",
      "version": "1.17.0"
    },
    {
      "module_name": "@minecraft/server-net",
      "version": "1.0.0-beta"
    }
  ]
}
```

---

## Database Schema (nodeDB/db/schema.sql)

```sql
-- Episodes table
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  vector_c REAL NOT NULL,
  vector_v REAL NOT NULL,
  vector_i REAL NOT NULL,
  vector_s REAL NOT NULL,
  vector_x REAL NOT NULL,
  duration INTEGER,
  event_count INTEGER,
  seal_reason TEXT,
  timestamp BIGINT NOT NULL
);

CREATE INDEX idx_episodes_villager ON episodes(villager_id, timestamp DESC);
CREATE INDEX idx_episodes_actor ON episodes(actor_id, timestamp DESC);

-- Working Memory table
CREATE TABLE working_memory (
  villager_id TEXT PRIMARY KEY,
  mood_c REAL NOT NULL,
  mood_v REAL NOT NULL,
  mood_i REAL NOT NULL,
  mood_s REAL NOT NULL,
  mood_x REAL NOT NULL,
  current_focus TEXT,
  shock_state BOOLEAN DEFAULT FALSE,
  last_update BIGINT NOT NULL
);

-- Relationships table
CREATE TABLE relationships (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  interaction_count INTEGER DEFAULT 0,
  trust_score REAL DEFAULT 0.5,
  last_interaction BIGINT,
  UNIQUE(villager_id, actor_id)
);

CREATE INDEX idx_relationships_villager ON relationships(villager_id);

-- Identity tags table
CREATE TABLE identity_tags (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  created_at BIGINT NOT NULL,
  UNIQUE(villager_id, tag_name)
);

CREATE INDEX idx_identity_tags_villager ON identity_tags(villager_id);
```

---

## Testing Checklist

**Infrastructure Tests:**
- [ ] PostgreSQL service running (`systemctl status postgresql` or equivalent)
- [ ] Database `villager_memory` created and accessible
- [ ] All tables created with correct schema
- [ ] Node.js backend starts without errors
- [ ] Backend responds to health checks (`curl http://localhost:3000/api/health`)
- [ ] llama.cpp server running on port 8080
- [ ] llama.cpp responds to test completions

**Integration Tests:**
- [ ] Script API can load without errors in BDS
- [ ] HTTP request from Script API reaches backend
- [ ] Backend logs show incoming request from Script API
- [ ] Connection pool successfully connects to PostgreSQL
- [ ] No memory leaks after 5 minutes of idle operation

---

## Known Issues & Limitations

**At this phase:**
- No actual villager logic implemented
- No event listeners configured
- LLM integration exists but not called by any logic
- DynamicProperties not yet used
- No error recovery mechanisms

**These are expected** — Phase 0 is infrastructure only.

---

## Next Phase Preview

**Phase 1 (MVP)** will implement:
- Layers 1-4 (Fast Gear): Event filtering, vectorization, episode formation
- Layer 5: Basic memory writes to PostgreSQL
- Layer 7: Minimal action execution (console logging only)
- End-to-end flow: Player places block → Episode written to database

---

**Document Type:** Phase Plan  
**Phase:** 0 (Setup)  
**Status:** Ready for Implementation  
**Last Updated:** Feb 23, 2026
