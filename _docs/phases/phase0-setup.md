# 🔧 Phase 0: Setup (Infrastructure Foundation)

## Goal

Establish the **barebones infrastructure** required for the Immersive Villager AI system. This phase creates a functional but minimal skeleton that validates network communication and database connectivity, but is **not yet usable** for gameplay.

---

## Success Criteria

- PostgreSQL database is running with base schema applied
- Node.js backend responds to test HTTP requests
- llama.cpp server is running and returns completions
- Script API can send/receive HTTP requests via `@minecraft/server-net`
- DynamicProperties schema is defined and tested
- DEBUG_MODE toggle is functional in-game

---

## Feature 1: PostgreSQL Database Setup

**Deliverable:** Running PostgreSQL instance with base schema tables for villagers, episodes, relationships, working memory, and subjective knowledge tracking.

### Steps

- [x] **1. Install PostgreSQL 15+ and create database**
  - Install PostgreSQL on host machine
  - Create `immersive_villagers` database
  - Create `minecraft_ai` user with secure password
  - Grant permissions to user

- [x] **2. Create base schema file (`nodeDB/db/schema.sql`)**
  - Enable pgvector extension for high-performance vector operations
  - Define `villagers` table (villager_id PRIMARY KEY, name, home_x/y/z, profession, created_at, last_seen, is_active)
  - Define `concepts` table (concept_id PRIMARY KEY, name, semantic_vector VECTOR(5), discovery_count)
  - Define `villager_discoveries` table (villager_id FK, concept_id FK, discovered_at, discovery_method)
  - Define `episodes` table (villager_id FK, actor_id, semantic_vector VECTOR(5), duration, event_count, seal_reason, timestamp)
  - Define `relationships` table (villager_id FK, actor_id, interaction_count, trust_score, last_interaction)
  - Define `working_memory` table (villager_id FK PRIMARY KEY, current_mood VECTOR(5), current_focus, shock_state, last_update)
  - Add indexes on villager_id, timestamp, and foreign key columns
  - Add ON DELETE CASCADE for all foreign keys

- [x] **3. Apply schema to database**
  - Run schema.sql using psql command: `psql -U minecraft_ai -d immersive_villagers -f schema.sql`
  - Verify tables exist with `\dt` command (should show 6 tables)
  - Verify foreign keys with `\d episodes` (should show REFERENCES villagers)
  - Test INSERT/SELECT operations manually

- [x] **4. Create pg-pool configuration (`nodeDB/db/pool.js`)**
  - Initialize connection pool with max 20 connections
  - Set idle timeout (30s) and connection timeout (2s)
  - Add error event listeners for pool monitoring
  - Export pool instance for use in queries

- [x] **5. Test database connectivity**
  - Write simple Node.js script to connect to pool
  - Execute test INSERT into villagers table (must insert villager before episodes)
  - Execute test INSERT into episodes table with valid villager_id
  - Execute test SELECT with JOIN to verify foreign key relationships
  - Verify connection pooling works (multiple concurrent queries)

### Schema Reference (`nodeDB/db/schema.sql`)

```sql
-- Enable pgvector extension for high-performance vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Core villager identity table
CREATE TABLE villagers (
  villager_id TEXT PRIMARY KEY,
  name TEXT,
  home_x REAL NOT NULL,
  home_y REAL NOT NULL,
  home_z REAL NOT NULL,
  profession TEXT,
  created_at BIGINT NOT NULL,
  last_seen BIGINT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Concept definitions (shared knowledge pool)
-- semantic_vector stores [C, V, I, S, X] as VECTOR(5) for fast cosine similarity
CREATE TABLE concepts (
  concept_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  semantic_vector VECTOR(5) NOT NULL,
  discovery_count INTEGER DEFAULT 0
);

-- Subjective knowledge: tracks what each villager has learned
CREATE TABLE villager_discoveries (
  villager_id TEXT REFERENCES villagers(villager_id) ON DELETE CASCADE,
  concept_id INTEGER REFERENCES concepts(concept_id) ON DELETE CASCADE,
  discovered_at BIGINT NOT NULL,
  discovery_method TEXT,  -- 'witnessed', 'gossip', 'taught'
  PRIMARY KEY (villager_id, concept_id)
);

-- Episode storage: recorded memories
-- semantic_vector stores episode's average [C, V, I, S, X] vector
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  semantic_vector VECTOR(5) NOT NULL,
  duration INTEGER,
  event_count INTEGER,
  seal_reason TEXT,
  timestamp BIGINT NOT NULL
);

-- Relationship tracking: trust scores per player
CREATE TABLE relationships (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  interaction_count INTEGER DEFAULT 0,
  trust_score REAL DEFAULT 0.5,
  last_interaction BIGINT,
  UNIQUE(villager_id, actor_id)
);

-- Working memory snapshot (synced from DynamicProperties)
-- current_mood stores the villager's current [C, V, I, S, X] state
CREATE TABLE working_memory (
  villager_id TEXT PRIMARY KEY REFERENCES villagers(villager_id) ON DELETE CASCADE,
  current_mood VECTOR(5) NOT NULL,
  current_focus TEXT,
  shock_state BOOLEAN DEFAULT FALSE,
  last_update BIGINT NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_villagers_active ON villagers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_episodes_villager ON episodes(villager_id, timestamp DESC);
CREATE INDEX idx_episodes_actor ON episodes(actor_id, timestamp DESC);
CREATE INDEX idx_relationships_villager ON relationships(villager_id);
CREATE INDEX idx_relationships_actor ON relationships(actor_id);
CREATE INDEX idx_discoveries_villager ON villager_discoveries(villager_id);
CREATE INDEX idx_discoveries_concept ON villager_discoveries(concept_id);

-- Vector similarity indexes using pgvector for fast cosine similarity queries
-- These enable the <=> operator for efficient memory retrieval
CREATE INDEX idx_concepts_vector ON concepts USING ivfflat (semantic_vector vector_cosine_ops);
CREATE INDEX idx_episodes_vector ON episodes USING ivfflat (semantic_vector vector_cosine_ops);
```

**Key Design Decisions:**

- **pgvector Integration:** Enables hardware-accelerated cosine similarity via `<=>` operator
- **VECTOR(5) Type:** Stores [C, V, I, S, X] semantic vectors natively in PostgreSQL
- **Cosine Similarity:** Uses directional vector comparison (intent-based) rather than magnitude (Euclidean)
- `villagers` table is the central registry for all villager entities
- Foreign keys use `ON DELETE CASCADE` to auto-clean data when villagers despawn
- `villager_discoveries` enforces subjectivity (villagers only know what they've learned)
- `concepts` stores the shared knowledge pool, but access is gated by `villager_discoveries`
- Indexes optimize common queries (episode history, relationship lookups, vector similarity)

---

## Feature 2: Node.js Backend Skeleton

**Deliverable:** Express server with health check endpoint and basic route structure.

### Steps

- [x] **1. Initialize Node.js project (`nodeDB/`)**
  - Create package.json with dependencies (express, pg, pino, axios, dotenv)
  - Create .env file with database credentials and configuration
  - Create .gitignore to exclude node_modules and .env
  - Run npm install to download dependencies

- [x] **2. Create Express app (`nodeDB/app.js`)**
  - Initialize Express with JSON body parser (1mb limit)
  - Add basic middleware stack (logger, error handler)
  - Define route structure (/api/memory, /api/brain, /api/debug)
  - Export app instance

- [x] **3. Create health check endpoint (`nodeDB/routes/debug.js`)**
  - GET /api/health returns { status: "online", timestamp }
  - Test database connection and return pool stats
  - Test llama.cpp connection (if available)
  - Return comprehensive health status

- [x] **4. Create Pino logger (`nodeDB/utils/logger.js`)**
  - Initialize Pino with level from LOG_LEVEL env var
  - Configure pino-pretty for development mode
  - Add log rotation setup (10MB files, daily rotation)
  - Export logger instance

- [x] **5. Start server and test (`nodeDB/server.js`)**
  - Create server.js that imports app and starts listening on port 3000
  - Test health endpoint with curl command
  - Verify logs are written to console/file
  - Confirm graceful shutdown on SIGTERM/SIGINT

---

## Feature 3: llama.cpp LLM Server Setup

**Deliverable:** Running llama.cpp server that responds to completion requests.

### Steps

- [x] **1. Download and build llama.cpp**
  - Clone llama.cpp repository from GitHub
  - Run make command to compile for host platform
  - Verify compilation succeeded (./server binary exists)
  - Test basic inference with sample model

- [x] **2. Download Llama 3.1 8B Q4_K_M model**
  - Download model file from HuggingFace (approx 5GB)
  - Save to models/ directory in llama.cpp folder
  - Verify file integrity (check file size matches expected)
  - Test model loading with ./server command

- [x] **3. Start llama.cpp server**
  - Run server with context length 2048, port 8080, 4-8 threads
  - Verify server starts without errors
  - Check memory usage (should be 5-6GB)
  - Confirm server is listening on localhost:8080

- [x] **4. Create LLM client wrapper (`nodeDB/brain/llm_client.js`)**
  - Create callLLM() function that posts to localhost:8080/completion
  - Set timeout to 10 seconds
  - Parse response and extract content field
  - Add error handling for connection failures

- [x] **5. Test LLM inference**
  - Send test prompt "You are a villager. Say hello."
  - Verify response is received within 2-4 seconds
  - Test with longer prompts (512 tokens)
  - Confirm JSON parsing works correctly

---

## Feature 4: Script API HTTP Communication

**Deliverable:** Script API can send HTTP requests to Node.js backend and receive responses.

### Steps

- [x] **1. Create test script (`scripts/test_http.js`)**
  - Import @minecraft/server-net http module
  - Create function to POST test data to /api/health
  - Parse response body and log result
  - Add error handling for network failures

- [x] **2. Test POST request to backend**
  - Start Node.js backend on port 3000
  - Run test script in Minecraft server
  - Verify request reaches backend (check Pino logs)
  - Confirm response is received in Script API

- [x] **3. Test GET request from backend**
  - Create test endpoint in backend (GET /api/test)
  - Send GET request from Script API
  - Verify response parsing works
  - Test timeout handling (simulate slow endpoint)

- [x] **4. Create network helper module (`scripts/utils/network_helpers.js`)**
  - Wrap http.post() with try/catch and timeout logic
  - Wrap http.get() with retry mechanism (3 attempts)
  - Add logging for DEBUG_MODE
  - Export helper functions

- [x] **5. Test error scenarios**
  - Stop backend server and verify Script API handles connection refused
  - Test timeout scenario (backend responds after 10+ seconds)
  - Verify error messages are logged correctly
  - Confirm game doesn't crash on network errors

---

## Feature 5: DynamicProperties Schema & Testing

**Deliverable:** Standardized DynamicProperties schema for Working Memory with validation.

### Steps

- [ ] **1. Define Working Memory schema (`scripts/config/dynamic_properties_schema.js`)**
  - Define property names (wm_currentFocus, wm_currentMood_C/V/I/S/X, etc.)
  - Define data types (TEXT, REAL, BOOLEAN, BIGINT)
  - Export schema as constant for reference
  - Add JSDoc documentation for each property

- [ ] **2. Create DynamicProperties helper module (`scripts/utils/dynamic_properties_helpers.js`)**
  - Create getWorkingMemory(entity) function to read all WM properties
  - Create setWorkingMemory(entity, workingMemory) function to write all WM properties
  - Add validation to ensure entity.isValid() before operations
  - Export helper functions with JSDoc

- [ ] **3. Test property persistence**
  - Create test villager in-game
  - Set Working Memory properties via helper functions
  - Restart Minecraft server
  - Verify properties persist after restart

- [ ] **4. Create property initialization (`scripts/layers/layer4_working_memory.js`)**
  - Create initializeWorkingMemory(entity) function
  - Set default values for all WM properties (mood: 0.5 for all axes)
  - Add timestamp for wm_lastUpdate
  - Run initialization for all villagers on world load

- [ ] **5. Test with multiple villagers**
  - Spawn 5 test villagers in-game
  - Initialize Working Memory for each
  - Verify each villager has isolated properties
  - Test entity.isValid() checks work correctly

---

## Feature 6: Configuration Toggles (AI_MODE & DEBUG_MODE)

**Deliverable:** Runtime-switchable AI architecture and debug logging system functional in MVP.

### Steps

- [ ] **1. Create configuration router (`nodeDB/routes/config_router.js`)**
  - Create GET /api/config/ai_mode endpoint (returns current AI_MODE)
  - Create POST /api/config/ai_mode endpoint (toggles MONOLITHIC ↔ MICROSERVICES)
  - Create GET /api/config/debug_mode endpoint (returns DEBUG_MODE state)
  - Create POST /api/config/debug_mode endpoint (toggles DEBUG_MODE)
  - Export getAIMode() and getDebugMode() helper functions

- [ ] **2. Create in-game toggle commands (`scripts/commands/config_commands.js`)**
  - Subscribe to scriptevent 'ai:toggle_mode' (accepts: monolithic | microservices)
  - Subscribe to scriptevent 'ai:toggle_debug' (accepts: true | false)
  - Send HTTP POST to backend to apply changes
  - Update world.setDynamicProperty('DEBUG_MODE', state) for Script API side
  - Broadcast confirmation message to all players

- [ ] **3. Create debug logger (`scripts/utils/debug_logger.js`)**
  - Read DEBUG_MODE from world.getDynamicProperty('DEBUG_MODE')
  - Create debugLog(layer, message, data) function that checks flag
  - Create errorLog(layer, message, error) function (always logs)
  - Create logInferenceTrace(layer, model, result, confidence, villagerID) for brain path visualization
  - Export logging functions with JSDoc

- [ ] **4. Implement inference trace buffer (backend)**
  - Create in-memory Map: villagerID → traces[]
  - Store last 50 inference results per villager (DEBUG_MODE only)
  - Create GET /api/debug/inference_traces endpoint
  - Auto-clear buffer when DEBUG_MODE disabled

- [ ] **5. Implement performance benchmarking**
  - Create logGearLatency(gear, latency, operation) function
  - Track Fast Gear latency (target: <5ms MONOLITHIC, <20ms MICROSERVICES)
  - Track Slow Gear latency (target: <4s)
  - Broadcast performance warnings when thresholds exceeded

- [ ] **6. Create debug endpoints (`nodeDB/routes/debug.js`)**
  - GET /api/debug/status (system health, metrics, performance averages)
  - GET /api/debug/villager/:villagerID (detailed villager state)
  - POST /api/debug/simulate_event (inject test events)
  - POST /api/debug/correct_concept (re-label concepts with re-vectorization)

- [ ] **7. Test AI_MODE toggle**
  - Start in MONOLITHIC mode
  - Toggle to MICROSERVICES: `/scriptevent ai:toggle_mode microservices`
  - Verify backend switches vector columns in queries
  - Toggle back to MONOLITHIC and verify fallback works

- [ ] **8. Test DEBUG_MODE features**
  - Enable DEBUG_MODE: `/scriptevent ai:toggle_debug true`
  - Trigger test event (place block near villager)
  - Verify inference traces appear in ActionBar
  - Verify performance metrics logged to console
  - Check /api/debug/status endpoint returns metrics

---

## Feature 7: MICROSERVICES Mode Setup (Optional)

**Deliverable:** Transformers.js models loaded and MICROSERVICES mode fully functional.

**Note:** This feature is **optional** for MVP. The system works in MONOLITHIC mode without these models. Complete this feature to enable semantic understanding, fast intent routing, and advanced structure recognition.

### Steps

- [ ] **1. Install @xenova/transformers dependency**
  - Navigate to nodeDB directory
  - Run: `npm install @xenova/transformers`
  - Verify package.json includes @xenova/transformers: ^2.17.0
  - Check node_modules folder for successful installation

- [ ] **2. Create model loader (`nodeDB/brain/model_loader.js`)**
  - Import @xenova/transformers pipeline function
  - Create initializeModels() async function
  - Load all 4 models (MiniLM, DistilBERT, BERT-NER, T5-small)
  - Export model instances and initialization function
  - Add error handling for model loading failures

- [ ] **3. Test model loading on server start**
  - Update server.js to call initializeModels() before starting Express
  - Set AI_MODE=MICROSERVICES in .env
  - Start Node.js backend: `npm start`
  - Wait for models to download (~500MB-1GB, first run only)
  - Verify all 4 models load successfully (check console logs)
  - Verify model loading completes in <30 seconds (after initial download)

- [ ] **4. Create model wrapper modules**
  - Create nodeDB/brain/vector_engine.js (MiniLM wrapper with caching)
  - Create nodeDB/brain/intent_router.js (DistilBERT intent classifier)
  - Create nodeDB/brain/episode_summarizer.js (T5-small summarizer)
  - Create nodeDB/brain/ner_extractor.js (BERT-NER entity extractor)
  - Each module exports async functions with JSDoc

- [ ] **5. Test individual models**
  - Test MiniLM: Generate embedding for "Steve placed a diamond block"
  - Test DistilBERT: Classify intent of "Why are you following me?"
  - Test T5-small: Summarize "Steve broke 5 logs. Steve crafted planks. Steve built a wall."
  - Test BERT-NER: Extract entities from "Build a wall out of cobblestone"
  - Verify all models return results within target latencies (<20ms, <50ms, <100ms, <30ms)

- [ ] **6. Test mode switching with real models**
  - Start in MONOLITHIC mode (AI_MODE=MONOLITHIC)
  - Verify manual vectorization works (Layer 2 returns 5D vectors)
  - Switch to MICROSERVICES: `/scriptevent ai:toggle_mode microservices`
  - Trigger test event (place block near villager)
  - Verify MiniLM generates 384D embedding
  - Verify DistilBERT classifies intent
  - Check concepts table for cached embeddings (deduplication)
  - Switch back to MONOLITHIC and verify fallback works

- [ ] **7. Test Fast Intent Routing**
  - Enable DEBUG_MODE and MICROSERVICES mode
  - Simulate aggressive event (player attacks villager)
  - Verify DistilBERT classifies as "aggression" with >80% confidence
  - Verify intent bypasses LLM (no 2-4s delay)
  - Check inference trace shows: "L3: [DistilBERT] → Intent: aggression (95%)"
  - Verify villager responds with flee action

- [ ] **8. Performance comparison test**
  - Run 50 test events in MONOLITHIC mode
  - Record average Fast Gear latency (should be <5ms)
  - Switch to MICROSERVICES mode
  - Run same 50 test events
  - Record average Fast Gear latency (should be <20ms)
  - Compare LLM inference times (MICROSERVICES should be 50% faster due to shorter context)

---

## Testing Checklist

**Core Infrastructure:**

- [ ] PostgreSQL accepts connections and returns query results
- [ ] All base tables created successfully (villagers, concepts, villager_discoveries, episodes, relationships, working_memory)
- [ ] Structure tables created (structure_templates, structure_blueprints, villager_world_map, build_tasks, pattern_observations)
- [ ] Dual vector columns exist (semantic_vector_manual and semantic_vector_minilm)
- [ ] Foreign key constraints work (cannot insert episode without villager)
- [ ] ON DELETE CASCADE works (deleting villager removes related data)
- [ ] Node.js backend responds to /api/health with 200 status
- [ ] llama.cpp generates completions for test prompts
- [ ] Script API can POST data to backend successfully
- [ ] Script API can GET data from backend successfully
- [ ] DynamicProperties persist across server restarts
- [ ] Network errors are handled gracefully (no crashes)
- [ ] Multiple concurrent HTTP requests work correctly
- [ ] Pino logs are written to file with proper formatting

**AI_MODE Configuration:**

- [ ] AI_MODE toggle command works: `/scriptevent ai:toggle_mode microservices`
- [ ] Backend /api/config/ai_mode endpoint responds correctly
- [ ] MONOLITHIC mode uses semantic_vector_manual columns
- [ ] MICROSERVICES mode uses semantic_vector_minilm columns
- [ ] Transformers.js models load successfully (MICROSERVICES mode only)
- [ ] Model loading takes <30 seconds on first startup

**DEBUG_MODE Features:**

- [ ] DEBUG_MODE toggle works in both Script API and backend
- [ ] Inference traces appear in ActionBar when enabled
- [ ] Performance metrics logged to console
- [ ] GET /api/debug/status returns system health
- [ ] Debug endpoints return 403 when DEBUG_MODE disabled
- [ ] Debug buffers clear automatically when DEBUG_MODE disabled

---

## Known Limitations at End of Phase 0

**Core System:**

- No event filtering (Layer 1) implemented yet
- No vectorization logic (Layer 2) exists
- No episode grouping (Layer 3) implemented
- Backend routes return mock data only
- LLM is not integrated with game logic
- No villager actions or behaviors are triggered
- Villagers table exists but is empty (no villager registration yet)
- Villager_discoveries table exists but unused (concept learning in Phase 1+)
- System is infrastructure-only, not playable

**AI Modes:**

- AI_MODE toggle exists but only infrastructure is present
- MONOLITHIC mode has no Layer 2 vectorization yet (Phase 1)
- MICROSERVICES mode has models loaded but no Layer 2 integration yet (Phase 1)
- Can toggle between modes but no functional difference yet (both inactive)

**Structure System:**

- All structure tables exist but are empty
- No pattern detection logic implemented (Phase 1)
- No building execution system (Phase 1)
- Templates and blueprints can't be created yet

**Debug:**

- DEBUG_MODE toggle works but limited debug features available
- Inference tracing not functional (no layers to trace yet)
- Performance benchmarking exists but nothing to benchmark yet

---

## File Structure After Phase 0

```
Immersive_Villagers BP/
├── scripts/
│   ├── commands/
│   │   └── config_commands.js               # AI_MODE & DEBUG_MODE toggle handlers
│   ├── config/
│   │   └── dynamic_properties_schema.js
│   ├── utils/
│   │   ├── dynamic_properties_helpers.js
│   │   ├── network_helpers.js
│   │   └── debug_logger.js                  # Enhanced with inference tracing
│   ├── layers/
│   │   └── layer4_working_memory.js        # Initialization only
│   ├── test_http.js                         # Test script (remove after Phase 0)
│   └── main.js                              # Minimal entry point
│
├── nodeDB/
│   ├── db/
│   │   ├── pool.js
│   │   └── schema.sql                       # Updated with dual vector columns
│   ├── routes/
│   │   ├── debug.js                         # Enhanced debug endpoints
│   │   └── config_router.js                 # NEW: AI_MODE & DEBUG_MODE toggles
│   ├── brain/
│   │   ├── llm_client.js
│   │   ├── model_loader.js                  # NEW: Transformers.js (MICROSERVICES mode)
│   │   ├── vector_engine.js                 # NEW: MiniLM wrapper
│   │   ├── intent_router.js                 # NEW: DistilBERT intent classifier
│   │   ├── episode_summarizer.js            # NEW: T5-small summarizer
│   │   └── ner_extractor.js                 # NEW: BERT NER
│   ├── utils/
│   │   └── logger.js
│   ├── app.js
│   ├── server.js
│   ├── package.json                         # Updated with @xenova/transformers
│   └── .env                                 # Added AI_MODE config
│
└── _docs/
    ├── Database_Schema.md                   # NEW: Complete schema reference
    ├── AI_Modes.md                          # NEW: MONOLITHIC vs MICROSERVICES
    ├── Structure_System.md                  # NEW: Building & learning
    ├── Debug_System.md                      # NEW: Enhanced DEBUG_MODE
    └── phases/
        └── phase0-setup.md                  # THIS FILE
```

---

## Estimated Complexity

**Time Investment:** Short (foundational setup)  
**Technical Difficulty:** Medium (requires external services)  
**Dependencies:** PostgreSQL, Node.js 18+, llama.cpp  
**Risk Level:** Low (isolated infrastructure testing)

---

**Document Type:** Phase Plan  
**Phase:** 0 (Setup)  
**Status:** Ready for Implementation  
**Version:** 1.0  
**Last Updated:** Feb 24, 2026
