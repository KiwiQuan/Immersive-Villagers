# 📜 Project Deviations & Architectural Truth

**Last Updated:** 2026-03-08

> **Purpose:** This document tracks intentional deviations from the original project documentation. In any conflict between the docs and this file, **this file wins.**

---

## 1. Minecraft Scripting API Changes

Recent updates to the Minecraft Bedrock Scripting API have shifted certain items from methods to properties.

| Context             | Documentation (Old) | Actual Codebase (New) |
| ------------------- | ------------------- | --------------------- |
| **Entity Validity** | `entity.isValid()`  | `entity.isValid`      |
| **Type**            | Method              | Read-only Property    |

---

## 2. Environment & Infrastructure

The system now supports a hybrid AI architecture via the `.env` file.

- **Database Name:** `immersive_villagers`
- **Database User:** `MarzeeQ`
- **AI Mode:** `AI_MODE=MICROSERVICES`
- _Note:_ This mode enables **384D vector embeddings** and **T5-small summarization** instead of the simpler 5D monolithic manual vectors.

---

## 3. PostgreSQL Schema (Current)

The database has been expanded to support **Dual-Vector Memory**. This allows the villagers to function in both "Manual/Monolithic" mode (5D Vectors) and "Microservices" mode (384D Vectors).

### Core Identity & Relationships

- **`villagers`**: Tracks the permanent home, profession, and activity status of each NPC.
- **`relationships`**: Stores a dynamic `trust_score` and interaction counts per player/actor.

### Memory & Knowledge Layers

- **`concepts`**: A shared pool of world knowledge. Supports dual vectors (`semantic_vector_manual` and `semantic_vector_minilm`).
- **`villager_discoveries`**: Links villagers to concepts they have personally learned.
- **`episodes`**: Long-term episodic memory. Stores event summaries and embeddings for similarity searches.
- **`working_memory`**: A high-speed snapshot synced from `DynamicProperties`. Tracks current mood, focus, and "shock" state.

### Construction & Spatial Intelligence

- **`structure_templates`**: Low-level "recipes" identified by `pattern_hash`.
- **`structure_blueprints`**: High-level assembly guides with functional zone mapping.
- **`villager_world_map`**: A villager's subjective understanding of where structures are located.
- **`build_tasks`**: A queue-based system for tracking construction progress.
- **`pattern_observations`**: Real-time logging of block changes to facilitate learning new structures.

---

### Current SQL Implementation

```sql
-- Enable pgvector extension for high-performance vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables (for clean reinstall)
DROP TABLE IF EXISTS build_tasks;
DROP TABLE IF EXISTS pattern_observations;
DROP TABLE IF EXISTS villager_world_map;
DROP TABLE IF EXISTS structure_blueprints;
DROP TABLE IF EXISTS structure_templates;
DROP TABLE IF EXISTS vector_cache;
DROP TABLE IF EXISTS working_memory;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS episodes;
DROP TABLE IF EXISTS villager_discoveries;
DROP TABLE IF EXISTS concepts;
DROP TABLE IF EXISTS villagers;
-- Drop existing indexes
DROP INDEX IF EXISTS idx_villagers_active;
DROP INDEX IF EXISTS idx_episodes_villager;
DROP INDEX IF EXISTS idx_episodes_actor;
DROP INDEX IF EXISTS idx_relationships_villager;
DROP INDEX IF EXISTS idx_relationships_actor;
DROP INDEX IF EXISTS idx_discoveries_villager;
DROP INDEX IF EXISTS idx_discoveries_concept;
DROP INDEX IF EXISTS idx_concepts_vector_manual;
DROP INDEX IF EXISTS idx_concepts_vector_minilm;
DROP INDEX IF EXISTS idx_episodes_vector_manual;
DROP INDEX IF EXISTS idx_episodes_vector_minilm;
DROP INDEX IF EXISTS idx_templates_hash;
DROP INDEX IF EXISTS idx_templates_embedding;
DROP INDEX IF EXISTS idx_templates_label;
DROP INDEX IF EXISTS idx_blueprints_embedding;
DROP INDEX IF EXISTS idx_blueprints_tags;
DROP INDEX IF EXISTS idx_blueprints_name;
DROP INDEX IF EXISTS idx_world_map_villager;
DROP INDEX IF EXISTS idx_world_map_location;
DROP INDEX IF EXISTS idx_world_map_structure;
DROP INDEX IF EXISTS idx_build_tasks_villager;
DROP INDEX IF EXISTS idx_build_tasks_status;
DROP INDEX IF EXISTS idx_pattern_observations_villager;
DROP INDEX IF EXISTS idx_pattern_observations_hash;
DROP INDEX IF EXISTS idx_vector_cache_text;
DROP INDEX IF EXISTS idx_vector_cache_accessed;


-- Core villager identity table
CREATE TABLE villagers (
  villager_id TEXT PRIMARY KEY,
  name TEXT,
  home_x REAL,
  home_y REAL,
  home_z REAL,
  profession TEXT,
  created_at BIGINT NOT NULL,
  last_seen BIGINT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Concept definitions (shared knowledge pool with dual vector support)
-- semantic_vector_manual stores [C, V, I, S, X] as VECTOR(5) for MONOLITHIC mode
-- semantic_vector_minilm stores 384D embedding for MICROSERVICES mode
CREATE TABLE concepts (
  concept_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  semantic_vector_manual VECTOR(5),
  semantic_vector_minilm VECTOR(384),
  discovery_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subjective knowledge: tracks what each villager has learned
CREATE TABLE villager_discoveries (
  villager_id TEXT REFERENCES villagers(villager_id) ON DELETE CASCADE,
  concept_id INTEGER REFERENCES concepts(concept_id) ON DELETE CASCADE,
  discovered_at BIGINT NOT NULL,
  discovery_method TEXT,
  PRIMARY KEY (villager_id, concept_id)
);

-- Episode storage: recorded memories with dual vector support
-- semantic_vector_manual stores episode's average [C, V, I, S, X] vector (MONOLITHIC mode)
-- semantic_vector_minilm stores 384D embedding (MICROSERVICES mode)
-- summary_text stores T5-small generated summary (MICROSERVICES mode)
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  semantic_vector_manual VECTOR(5),
  semantic_vector_minilm VECTOR(384),
  summary_text TEXT,
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
-- current_mood_manual stores the villager's current [C, V, I, S, X] state (MONOLITHIC mode)
-- current_mood_minilm stores 384D embedding (MICROSERVICES mode)
CREATE TABLE working_memory (
  villager_id TEXT PRIMARY KEY REFERENCES villagers(villager_id) ON DELETE CASCADE,
  current_mood_manual VECTOR(5),
  current_mood_minilm VECTOR(384),
  current_focus TEXT,
  shock_state BOOLEAN DEFAULT FALSE,
  last_update BIGINT NOT NULL
);

-- Structure templates: building "recipes"
CREATE TABLE structure_templates (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  pattern_hash TEXT UNIQUE,
  embedding VECTOR(384),
  instructions JSONB NOT NULL,
  dimensions JSONB,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observation_count INTEGER DEFAULT 1
);

-- Structure blueprints: high-level assembly guides
CREATE TABLE structure_blueprints (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  embedding VECTOR(384),
  composition JSONB NOT NULL,
  tags JSONB,
  functional_zones JSONB,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  build_count INTEGER DEFAULT 0
);

-- Villager's subjective world map
CREATE TABLE villager_world_map (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  structure_id INTEGER REFERENCES structure_blueprints(id) ON DELETE CASCADE,
  anchor_x INT NOT NULL,
  anchor_y INT NOT NULL,
  anchor_z INT NOT NULL,
  confidence REAL DEFAULT 1.0,
  last_observed BIGINT NOT NULL,
  dimension TEXT DEFAULT 'overworld',
  UNIQUE(villager_id, anchor_x, anchor_y, anchor_z)
);

-- Build task queue
CREATE TABLE build_tasks (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  blueprint_id INTEGER REFERENCES structure_blueprints(id),
  template_id INTEGER REFERENCES structure_templates(id),
  anchor_x INT NOT NULL,
  anchor_y INT NOT NULL,
  anchor_z INT NOT NULL,
  status TEXT DEFAULT 'pending',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  trigger_source TEXT,
  trigger_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at BIGINT,
  completed_at BIGINT
);

-- Pattern observation tracking (for real-time learning)
CREATE TABLE pattern_observations (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  pattern_hash TEXT NOT NULL,
  block_sequence JSONB NOT NULL,
  observation_timestamp BIGINT NOT NULL,
  consolidated BOOLEAN DEFAULT FALSE
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
-- Dual indexes support both MONOLITHIC (5D) and MICROSERVICES (384D) modes
CREATE INDEX idx_concepts_vector_manual ON concepts USING ivfflat (semantic_vector_manual vector_cosine_ops);
CREATE INDEX idx_concepts_vector_minilm ON concepts USING ivfflat (semantic_vector_minilm vector_cosine_ops);
CREATE INDEX idx_episodes_vector_manual ON episodes USING ivfflat (semantic_vector_manual vector_cosine_ops);
CREATE INDEX idx_episodes_vector_minilm ON episodes USING ivfflat (semantic_vector_minilm vector_cosine_ops);

-- Structure system indexes
CREATE INDEX idx_templates_hash ON structure_templates(pattern_hash);
CREATE INDEX idx_templates_embedding ON structure_templates USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_templates_label ON structure_templates(label);
CREATE INDEX idx_blueprints_embedding ON structure_blueprints USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_blueprints_tags ON structure_blueprints USING gin(tags);
CREATE INDEX idx_blueprints_name ON structure_blueprints(name);
CREATE INDEX idx_world_map_villager ON villager_world_map(villager_id);
CREATE INDEX idx_world_map_location ON villager_world_map(anchor_x, anchor_y, anchor_z);
CREATE INDEX idx_world_map_structure ON villager_world_map(structure_id);
CREATE INDEX idx_build_tasks_villager ON build_tasks(villager_id, status);
CREATE INDEX idx_build_tasks_status ON build_tasks(status);
CREATE INDEX idx_pattern_observations_villager ON pattern_observations(villager_id, consolidated);
CREATE INDEX idx_pattern_observations_hash ON pattern_observations(pattern_hash);


```

---

## 4. Architectural Implementation Notes

- **Vector Search**: We use the `<=>` operator for **Cosine Similarity** on both 5D and 384D vector columns.
- **Indexing**: `IVFFLAT` indexes are applied to all vector columns to ensure low-latency memory retrieval during villager decision-making.
- **Dynamic properties** dynamic properties helper function in a dedicated file and a dynamic properties schema.

---

## 5. Database Queries

- **Queries Folder** in db folder is were we store the exported functions that will query the database. this is to keep separation of concerns principle.

---

## 6. Villager Detection Method: Proximity-Based vs Event-Driven

**Decision:** Use **pure proximity-based detection** instead of `afterEvents.entityLoad` / `afterEvents.entityRemove`.

### Why Proximity Won

After extensive sandbox testing (see `scripts/sandbox/test_entity_load_detection.js` (file was deleted) → `test_proximity_detection.js`), we discovered critical inconsistencies with event-based and `isValid` property approaches:

| Method                          | Issue                                     | Result                                                   |
| ------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| **`entityLoad` event**          | Inconsistent trigger distance (too close) | Villagers only detected when player is within ~30 blocks |
| **`entityRemove` event**        | Inconsistent trigger distance (too far)   | Villagers remained "loaded" even 150+ blocks away        |
| **`isValid` property**          | Unreliable across chunk boundaries        | False positives/negatives when chunks load/unload        |
| **Polling + Events (Hybrid)**   | Better but still inconsistent             | Improved detection but occasional desyncs                |
| **Proximity-Based (Geometric)** | **100% consistent**                       | ✅ Works every time, no edge cases                       |

### Proximity Detection Logic

```javascript
// Every 20 ticks (1 second):
1. Query all villagers via dimension.getEntities()
2. Calculate distance to nearest player (using maxDistance + location EntityQueryOptions)
3. If distance <= 150 blocks → ACTIVE
4. If distance > 150 blocks → INACTIVE
5. Detect NEW villagers during scan (not in tracked Map)
```

**Advantages:**

- ✅ **Pure geometry** - No reliance on event engine event quirks
- ✅ **Predictable** - Always triggers at exact distance threshold
- ✅ **Resilient** - Works across all Bedrock versions and chunk behaviors
- ✅ **Handles death** - Dead villagers naturally drop out of `getEntities()` query

**Tradeoffs:**

- ⚠️ Runs every 20 ticks (vs instant events)
- ⚠️ Slight delay (1 second max) for state changes
- ✅ **Acceptable** - Villagers don't need instant reactions; 1-second latency is imperceptible

### Implementation Files

- **Sandbox Test (Archived):** `scripts/sandbox/test_proximity_detection.js`
- **Production:** `scripts/systems/villager_lifecycle/` (modular implementation)
  - `lifecycle_coordinator.js` - Main detection loop
  - `lifecycle_state.js` - Shared state & entity caching
  - `lifecycle_handlers.js` - Event handlers
  - `lifecycle_db.js` - Database operations

### Configuration Constants

```javascript
const PROXIMITY_CHECK_RADIUS = 150; // blocks
const PROXIMITY_CHECK_INTERVAL = 20; // ticks (1 second)
```

**Tuning Notes:**

- `150 blocks` = Safe buffer beyond typical chunk render distance
- `20 ticks` = Balance between responsiveness and performance
- Can be adjusted in production based on server load

### API-Native Approach (Final Implementation)

After discovering `location` + `maxDistance` parameters work together in `EntityQueryOptions`, we refactored to use **player-centric API-native filtering**:

```javascript
// For each player, let the C++ engine filter villagers
for (const player of allPlayers) {
  const nearbyVillagers = dimension.getEntities({
    type: "minecraft:villager_v2",
    location: player.location,
    maxDistance: 150,
  });
  // Returns ALL villagers within 150 blocks of THIS player
  // Zero manual distance calculations needed!
}
```

**Performance Impact:**

- Manual approach: O(n × m) = 1,000 distance calculations/sec (100 villagers × 10 players)
- API-native approach: O(m) = 10 API calls/sec, **zero manual calculations**
- **~10x performance improvement**

---

## 7. Script Architecture: Layer-First Organization

**Decision:** Use **layer-first folder structure** for the 7-Layer Brain Architecture.

### Rationale

The flat structure (`utils/`, `layers/`) doesn't scale beyond 3-4 layers. As we add Layer 3 (Episodes), Layer 5 (Semantic), and Construction systems, we need clear boundaries to prevent coupling and maintain the Single Responsibility Principle.

### Production Folder Structure

```
scripts/
├── systems/
│   ├── villager_lifecycle/
│   │   ├── lifecycle_coordinator.js  # Main entry point & proximity detection
│   │   ├── lifecycle_state.js        # Shared state (activeVillagers, trackedVillagers, etc.)
│   │   ├── lifecycle_handlers.js     # Event handlers (new, activation, deactivation, death)
│   │   └── lifecycle_db.js           # Database operations (register, activate, remove)
│   │
│   └── debug/
│       ├── debug_modals.js          # Main entry point & modal router
│       ├── debug_modals/
│       │   ├── proximity_modal.js   # Proximity detection testing UI
│       │   └── database_modal.js    # Database CRUD operations UI
│       ├── debug_particles.js       # Visual particle indicators
│       └── debug_commands.js        # ScriptEvent command handlers
│
├── layers/
│   ├── layer4_working_memory/
│   │   ├── working_memory_sync.js   # Sync loop (consumes activeVillagerEntities)
│   │   ├── working_memory_helpers.js # DP CRUD operations
│   │   ├── working_memory_schema.js  # Schema definition
│   │   └── layer4_init.js           # Entry point (called by lifecycle)
│   │
│   ├── layer3_episodic/ (future)
│   │   ├── episode_recorder.js
│   │   ├── episode_sync.js
│   │   └── layer3_init.js
│   │
│   └── layer5_semantic/ (future)
│       └── ...
│
├── utils/ (truly generic - no layer-specific code)
│   ├── geometry_helpers.js          # Pure distance calculations
│   ├── notification_helpers.js      # Player messaging utilities
│   ├── debug_mode_helper.js         # Debug mode utilities
│   └── network_helpers.js           # HTTP request wrappers
│
├── config/
│   └── (global config only)
│
└── sandbox/
    ├── test_proximity_detection.js  # Proximity detection testing (archived)
    └── (other temporary test scripts)
```

### Key Principles

1. **`villager_lifecycle/` is a modular coordinator:**
   - Split into focused sub-modules by responsibility:
     - `lifecycle_coordinator.js` - Detection orchestration & main entry point
     - `lifecycle_state.js` - Shared state management (single source of truth)
     - `lifecycle_handlers.js` - Event-driven state transitions
     - `lifecycle_db.js` - Database operations
   - Each file stays under 250 lines
   - Calls layer initialization functions (orchestration only)
   - Does NOT contain layer-specific sync logic

2. **Each layer is self-contained:**
   - All layer logic in its own folder
   - Exports single `layerX_init.js` entry point
   - Lifecycle imports and calls init functions
   - No cross-layer dependencies (layers don't import each other)

3. **`utils/` is truly generic:**
   - Pure functions with no layer coupling
   - Reusable across ALL layers and systems
   - No business logic or state management

4. **File size enforcement:**
   - No file exceeds 500 lines
   - Break into sub-modules if needed (e.g., `villager_lifecycle.js` → 4 files)

5. **Debug tools are system-level:**
   - `systems/debug/` contains proximity testing tools
   - Consumes production state (not separate sandbox state)
   - Available via scriptevent commands

### Example: lifecycle_handlers.js (Coordinator Pattern)

```javascript
// lifecycle_handlers.js
import { registerVillagerInDB } from "./lifecycle_db.js";
import { initializeLayer4ForVillager } from "../../layers/layer4_working_memory/layer4_init.js";
// Future:
// import { initializeLayer3ForVillager } from "../../layers/layer3_episodic/layer3_init.js";

/**
 * Handles new villager registration and layer initialization.
 * @param {Entity} villager - Villager entity
 */
export async function handleNewVillager(villager) {
  const villagerID = villager.id;

  // 1. Register in database (system concern)
  await registerVillagerInDB({
    villagerID,
    name: villager.nameTag || "Unnamed",
    home_x: villager.location.x,
    home_y: villager.location.y,
    home_z: villager.location.z,
    isActive: true,
  });

  // 2. Delegate to layers (each layer handles its own init)
  initializeLayer4ForVillager(villager);
  // initializeLayer3ForVillager(villager); // future

  // Handler stays thin - just orchestration!
}
```

### Benefits

| Aspect                   | Flat Structure             | Layer-First              |
| ------------------------ | -------------------------- | ------------------------ |
| **Scalability**          | Hard (utils bloat)         | Easy (add layer folders) |
| **Maintainability**      | Medium (unclear ownership) | High (clear boundaries)  |
| **File Size**            | Tends to grow              | Enforced under 500 lines |
| **Coupling**             | High risk                  | Low (explicit imports)   |
| **Matches Architecture** | No                         | Yes (7-Layer Brain)      |

---

## Performance Optimization: Entity Caching ("Fetch Once, Consume Everywhere")

**Problem**: Multiple systems need access to active villager entities each tick:

- Lifecycle Coordinator (proximity detection)
- Layer 4 Working Memory (sync loop)
- Future layers (Layer 3 Episodes, Layer 5 Semantic, etc.)

**Initial Approach (Inefficient)**:

```javascript
// lifecycle_coordinator.js
const villagers = dimension.getEntities({ type: "minecraft:villager_v2" }); // Call 1

// working_memory_sync.js
const villagers = dimension.getEntities({ type: "minecraft:villager_v2" }); // Call 2

// Future: layer3_episode_recorder.js
const villagers = dimension.getEntities({ type: "minecraft:villager_v2" }); // Call 3
```

**Why This is Bad**:

1. **Performance Penalty**: `dimension.getEntities()` queries ALL entities in the dimension, then filters by type. With 1,000+ entities in a large world, this becomes expensive.
2. **DRY Violation**: Every system duplicates the same query logic.
3. **Scalability Issue**: Each new layer adds another redundant API call.
4. **Lower-End Hardware**: Mobile devices and shared servers struggle with multiple heavy queries per tick.

**Solution: Centralized Entity Caching**:

The **Lifecycle Coordinator** performs `getEntities()` once per tick and caches live entity references in a shared **Map**:

```javascript
// lifecycle_state.js (shared state)
export const activeVillagers = new Map(); // Map<villagerID, Entity>

export function updateActiveVillagers(newMap) {
  activeVillagers.clear();
  for (const [id, entity] of newMap) {
    activeVillagers.set(id, entity);
  }
}

// lifecycle_coordinator.js (coordinator)
system.runInterval(() => {
  const currentTickMap = new Map();

  for (const player of allPlayers) {
    const villagers = dimension.getEntities({
      type: "minecraft:villager_v2",
      location: player.location,
      maxDistance: 150,
    });

    for (const villager of villagers) {
      if (!villager?.isValid) continue;
      currentTickMap.set(villager.id, villager);

      // Use GLOBAL activeVillagers to check if this is new activation
      if (!activeVillagers.has(villager.id)) {
        handleActivation(villager.id, villager);
      }
    }
  }

  // DEACTIVATION: Compare global vs new map
  for (const villagerID of activeVillagers.keys()) {
    if (!currentTickMap.has(villagerID)) {
      handleDeactivation(villagerID);
    }
  }

  // Update canonical state with fresh batch
  updateActiveVillagers(currentTickMap);
}, 20);

// working_memory_sync.js (consumer)
import { activeVillagers } from "../villager_lifecycle/lifecycle_state.js";

system.runInterval(() => {
  for (const [villagerID, villager] of activeVillagers) {
    if (!villager?.isValid) continue;
    // Use cached entities - NO getEntities() call needed!
    syncWorkingMemory(villager);
  }
}, 20);
```

**Why Map is Better Than Array**:

1. **O(1) Lookups**: `activeVillagers.get(villagerID)` vs `array.find(v => v.id === id)` which is O(n)
2. **Membership Checks**: `activeVillagers.has(villagerID)` is instant
3. **No Duplication**: Single source of truth (no separate Set + Array)
4. **Easy Iteration**: `Map.values()` for entities, `Map.keys()` for IDs

**Why Entity References Are Safe to Cache**:

Entity references remain valid for the duration of a tick. Since our systems run on `system.runInterval(20)`, the cached references are guaranteed valid when consumed because:

1. The cache is refreshed every 20 ticks
2. Consumers run at the same interval (with staggered offsets)
3. If an entity becomes invalid mid-tick, `villager.isValid` catches it

**Performance Impact**:

| Scenario                     | Without Cache             | With Cache               | Improvement |
| ---------------------------- | ------------------------- | ------------------------ | ----------- |
| **1 player, 100 villagers**  | 3 API calls/tick × 20 tps | 1 API call/tick × 20 tps | **3x**      |
| **5 players, 500 villagers** | 3 API calls/tick × 20 tps | 1 API call/tick × 20 tps | **3x**      |
| **Future (7 layers active)** | 7 API calls/tick × 20 tps | 1 API call/tick × 20 tps | **7x**      |

**Best Practice**: Any system that needs to iterate active villagers should consume `activeVillagers.values()` instead of querying directly.

**Related Optimization**: Combined with Staggered Intervals (see below), this pattern ensures both minimal API calls AND distributed CPU load.

---

## Performance Optimization: Staggered Intervals

**Issue**: Multiple heavy systems (Lifecycle Coordinator, Layer 4 Sync) running with the same `system.runInterval` timing could cause CPU load spikes on lower-end hardware when they execute in the same tick.

**Solution**: Implemented staggered startup delays to distribute CPU load across multiple ticks:

```javascript
// lifecycle_coordinator.js
system.runInterval(() => {
  // Proximity detection logic
}, 20); // Runs immediately on tick 0, 20, 40...

// working_memory_sync.js
const SYNC_STARTUP_DELAY_TICKS = 10;
system.runTimeout(() => {
  system.runInterval(() => {
    // Sync logic
  }, 20); // Runs on tick 10, 30, 50...
}, SYNC_STARTUP_DELAY_TICKS);
```

**Benefits**:

- Prevents frame spikes on resource-constrained devices
- Smoother overall performance profile
- Follows the "optimizing for the low-end user" principle

**Best Practice**: Offset intervals for any system that performs heavy operations (database sync, AI queries, etc.).

---

## Debug Tools: Interactive Testing System

**Purpose**: Comprehensive debug tools for testing proximity detection and database operations.

**Location**: `scripts/systems/debug/`

**Structure**:

```
scripts/systems/debug/
├── debug_modals.js                    # Main entry point & router
├── debug_modals/
│   ├── proximity_modal.js            # Proximity detection testing
│   └── database_modal.js             # Database CRUD operations
├── debug_particles.js                # Visual particle indicators
└── debug_commands.js                 # ScriptEvent command handlers
```

**Available Commands**:

- `/scriptevent debug:menu` - Opens main debug menu (hub for all tools)
- `/scriptevent debug:proximity_status` - Shows detection statistics in chat
- `/scriptevent debug:proximity_modal` - Opens proximity detection UI
- `/scriptevent debug:database_modal` - Opens database operations UI
- `/scriptevent debug:particles_on` - Enables purple particles above active villagers
- `/scriptevent debug:particles_off` - Disables particle visualization

### Proximity Detection Modal

**Features**:

- Real-time validation against actual visible villagers
- View active vs inactive villagers
- Inspect individual villager proximity metrics
- Status indicators (§a● for active, §7○ for inactive)
- Mismatch detection to identify tracking errors

**UX**: Clear messaging that tools are for testing proximity capabilities.

### Database Operations Modal

**Features**:

- **Register Villager**: Add tracked villagers to database
- **Update Status**: Set villager active/inactive status
- **Remove Villager**: Delete villager from database (with confirmation)
- **View Villager**: Fetch and display database record
- **Batch Operations**:
  - Register all tracked villagers
  - Set all villagers to active
  - Set all villagers to inactive
- **Full Reset**: Complete data wipe (double confirmation required)
  - Clears all DynamicProperties from villagers
  - Deletes all database records
  - Clears tracking maps (trackedVillagers, activeVillagers)

**UX**: Provides direct backend connectivity testing with clear success/failure feedback.

**New Backend Endpoints**:

Added `/api/villagers/get` endpoint for fetching individual villager data:

```javascript
// nodeDB/queries/villagers.js
async function getVillager(villagerID) {
  const result = await client.query(
    "SELECT * FROM villagers WHERE villager_id = $1",
    [villagerID],
  );
  return result.rows[0] || null;
}

// nodeDB/routes/villagers.js
router.post("/get", async (req, res) => {
  const { villagerID } = req.body;
  const villager = await getVillager(villagerID);
  res.json({ status: "success", villager });
});
```

**Integration**:

```javascript
// main.js
import { initializeDebugCommands as initializeProximityDebugCommands } from "./systems/debug/debug_commands.js";

initializeProximityDebugCommands();
```

**Note**: These debug tools consume the production `activeVillagers` and `trackedVillagers` state from `lifecycle_state.js`, ensuring they test the actual production system rather than separate sandbox state.

---

## Batch Queue System

**Purpose**: Reduce network overhead by grouping multiple operations into single HTTP requests.

**Implementation**: Generic, reusable batch queue utility (`scripts/utils/batch_queue.js`) that handles:
- Automatic deduplication (Set-based)
- Debounced or fixed-delay timers
- Parallel batch processing
- Graceful error handling with fallback to individual requests

**Usage**:

1. **Villager Initialization** (debounced, 10s):
   - Collects new villagers as chunks load during travel
   - Timer resets on each detection (waits for all villagers to load)
   - Processes as single batch: registration → WM initialization → DB sync
   - **Result**: 10 villagers = 2 HTTP requests (1 registration batch + 1 WM sync batch) vs 20 individual requests

2. **Active State Updates** (fixed, 1s):
   - Groups activation/deactivation events
   - Fixed delay for frequent proximity changes
   - **Result**: Multiple villagers entering/leaving range = 1 batch request vs N individual requests

**Benefits**:
- Reduces HTTP connection overhead
- Prevents backend connection pool exhaustion
- Cleaner console logs (batch summaries vs individual confirmations)
- Maintains atomicity (all-or-nothing for registration + WM sync)

**Code Example**:

```javascript
// scripts/systems/villager_lifecycle/lifecycle_handlers.js
const initQueue = createBatchQueue({
  name: "Villager Init",
  delayTicks: 200, // 10 seconds
  debounced: true, // Reset timer on each new villager
  getItemId: (villager) => villager.id,
  processBatch: processInitBatch, // Handles batch registration + WM sync
  logPrefix: "§b[Lifecycle]",
});

// Usage
initQueue.add(villager); // Automatically queued, deduplicated, and batched
```

**Backend**: Modified endpoints to **always** accept arrays (single items sent as 1-element arrays):

```javascript
// nodeDB/routes/villagers.js
router.post("/register", async (req, res) => {
  // Always expects array: [villager1, villager2, ...]
  const result = await registerVillager(req.body);
  res.json(result);
});
```

---
