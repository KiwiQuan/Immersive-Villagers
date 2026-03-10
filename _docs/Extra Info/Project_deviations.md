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
2. Calculate distance to nearest player (Euclidean 3D)
3. If distance <= 150 blocks → ACTIVE
4. If distance > 150 blocks → INACTIVE
5. Detect NEW villagers during scan (not in tracked Map)
```

**Advantages:**

- ✅ **Pure geometry** - No reliance on engine event quirks
- ✅ **Predictable** - Always triggers at exact distance threshold
- ✅ **Resilient** - Works across all Bedrock versions and chunk behaviors
- ✅ **Handles death** - Dead villagers naturally drop out of `getEntities()` query

**Tradeoffs:**

- ⚠️ Runs every 20 ticks (vs instant events)
- ⚠️ Slight delay (1 second max) for state changes
- ✅ **Acceptable** - Villagers don't need instant reactions; 1-second latency is imperceptible

### Implementation Files

- **Sandbox Test:** `scripts/sandbox/test_proximity_detection.js`
- **Production:** `scripts/systems/villager_lifecycle.js` (to be refactored with proximity logic)

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
│   └── villager_lifecycle.js (150-250 lines)
│       └── COORDINATOR: Detection + orchestration
│       └── DOES NOT contain layer-specific logic
│
├── layers/
│   ├── layer4_working_memory/
│   │   ├── working_memory_sync.js (sync loop)
│   │   ├── working_memory_helpers.js (DP operations)
│   │   ├── working_memory_schema.js (schema definition)
│   │   └── layer4_init.js (entry point - called by lifecycle)
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
│   ├── geometry_helpers.js (distance calculations)
│   ├── notification_helpers.js (player messaging)
│   └── debug_mode_helper.js (debug utilities)
│
├── config/
│   └── (global config only)
│
├── debug/
│   └── villager_debugger.js (modals, particles, status)
│
└── sandbox/
    └── (temporary test scripts)
```

### Key Principles

1. **`villager_lifecycle.js` is a coordinator:**
   - Handles villager detection (proximity, death, player leave)
   - Calls layer initialization functions
   - Does NOT contain layer-specific sync logic
   - Stays under 300 lines forever

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
   - Break into sub-modules if needed (e.g., `working_memory_helpers.js` → `working_memory_getters.js` + `working_memory_setters.js`)

### Example: villager_lifecycle.js (Coordinator Pattern)

```javascript
import { initializeLayer4 } from "../layers/layer4_working_memory/layer4_init.js";
// Future:
// import { initializeLayer3 } from "../layers/layer3_episodic/layer3_init.js";

/**
 * Handles new villager registration and layer initialization.
 * @param {Entity} villager - Villager entity
 */
function handleNewVillager(villager) {
  const villagerID = villager.id;

  // 1. Register in database (system concern)
  registerVillager({
    villagerID,
    name: villager.nameTag || "Unnamed",
    home_x: villager.location.x,
    home_y: villager.location.y,
    home_z: villager.location.z,
    isActive: true,
  }).then(() => {
    // 2. Delegate to layers (each layer handles its own init)
    initializeLayer4(villager);
    // initializeLayer3(villager); // future

    // Lifecycle stays thin - just orchestration!
  });
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
