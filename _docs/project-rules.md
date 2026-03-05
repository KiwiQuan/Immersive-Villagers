# 📋 Project Rules — Immersive Villager AI

## Document Purpose

This document defines the **complete development standards** for the Immersive Villager AI project, including directory structure, file naming conventions, code organization, and architectural principles. This ensures the codebase remains AI-first: modular, scalable, and easy to navigate.

---

## Core Philosophy: AI-First Development

### Principles

1. **Modularity:** Every file has a single, clear responsibility
2. **Scalability:** Easy to add new features without refactoring existing code
3. **Navigability:** Descriptive names and clear directory structure make it easy for AI tools to find relevant code
4. **Documentation:** All functions have JSDoc comments explaining purpose and parameters
5. **File Size Limit:** No file exceeds 500 lines to maximize AI compatibility

---

## Project Directory Structure

### Root Structure

```
bedrock-server-1.26.1.1/
└── development_behavior_packs/
    └── Immersive_Villagers BP/
        ├── scripts/                    # Fast Gear (Layers 1-4) — Minecraft Script API
        ├── nodeDB/                     # Slow Gear (Layers 5-7) — Node.js Backend
        ├── _docs/                      # Architecture documentation
        ├── manifest.json               # Behavior Pack manifest
        └── pack_icon.png               # Pack icon
```

---

## 1. Fast Gear (Script API): `scripts/` Directory

**Purpose:** High-frequency operations that run in the game loop (Layers 1-4). Must maintain 20 TPS (50ms per tick).

### Directory Structure

```
scripts/
├── layers/
│   ├── layer1_sensory.js           # Sensory Filter (event filtering, proximity checks)
│   ├── layer2_vectorizer.js        # Perception (dual-mode: manual or MiniLM vectorization)
│   ├── layer3_sequencer.js         # Sequencer (groups vectors, intent routing)
│   └── layer4_working_memory.js    # Working Memory (DynamicProperties management)
│
├── structures/
│   ├── detector.js                 # Real-time structure pattern detection
│   ├── builder.js                  # Building execution (ghost blocks, pathfinding)
│   ├── spatial_hash.js             # MONOLITHIC mode: spatial hashing for patterns
│   └── inventory_check.js          # Verify villager has required blocks
│
├── commands/
│   ├── ai_mode_toggle.js           # Toggle AI_MODE (monolithic/microservices)
│   ├── debug_toggle.js             # Toggle DEBUG_MODE on/off
│   └── teach_structure.js          # Manual structure teaching commands
│
├── ui/
│   ├── hub.js                      # Main Menu (Interaction Hub)
│   ├── gossip.js                   # Gossip & Whisper Menu
│   ├── debug.js                    # Debug Modal (DEBUG_MODE only)
│   ├── teacher_ui.js               # Manual concept correction interface
│   ├── helpers.js                  # Shared UI formatting functions
│   ├── state.js                    # Breadcrumb & menu state management
│   ├── feedback.js                 # Async feedback (polling, loading states)
│   └── validation.js               # Input sanitization & validation
│
├── utils/
│   ├── vector_math.js              # Vector operations (distance, normalization, averaging)
│   ├── entity_helpers.js           # Entity ID storage, safe entity retrieval
│   ├── time_helpers.js             # Timestamp formatting, duration calculations
│   └── debug_logger.js             # DEBUG_MODE console logging wrapper
│
├── config/
│   ├── constants.js                # Game constants (awareness radius, tick intervals)
│   └── vector_rules.js             # Vectorization rules (block values, constructiveness)
│
├── events/
│   ├── player_events.js            # Player action listeners (place block, break block)
│   ├── entity_events.js            # Entity listeners (damage, spawn, death)
│   └── chat_events.js              # Chat message listeners
│
└── main.js                         # Entry point (imports and initializes all modules)
```

### File Naming Conventions (Fast Gear)

- **Format:** `{purpose}_{context}.js` or `{layer_number}_{layer_name}.js`
- **Examples:**
  - Layers: `layer1_sensory.js`, `layer2_vectorizer.js`
  - Utils: `vector_math.js`, `entity_helpers.js`
  - UI: `hub.js`, `gossip.js`, `debug.js`
  - Events: `player_events.js`, `entity_events.js`
- **Use lowercase with underscores** for all file names (snake_case)
- **Avoid abbreviations** unless universally understood (e.g., `ui`, `api`)

### Code Organization Standards (Fast Gear)

#### File Header Template

Every file must start with this header:

```javascript
/**
 * @fileoverview [Brief description of what this file does]
 *
 * Layer: [Layer number and name, e.g., "Layer 2: Vectorizer"]
 * Frequency: [Execution frequency, e.g., "Every tick", "Event-driven"]
 * Dependencies: [List of imported modules]
 *
 * @author Immersive Villager AI Team
 * @version 1.0
 */
```

**Example:**

```javascript
/**
 * @fileoverview Converts raw game events into semantic vectors [C, V, I, S, X].
 *
 * Layer: Layer 2 (Perception/Vectorizer)
 * Frequency: Event-driven (triggered by Layer 1 output)
 * Dependencies: config/vector_rules.js, utils/vector_math.js
 *
 * @author Immersive Villager AI Team
 * @version 1.0
 */

import { vectorRules } from "./config/vector_rules.js";
import { normalizeVector } from "./utils/vector_math.js";

// ... rest of file
```

#### Function Documentation (JSDoc)

Every function must have JSDoc comments:

```javascript
/**
 * Calculates the semantic vector for a block placement event.
 * @param {Object} eventContext - The filtered event context from Layer 1
 * @param {string} eventContext.eventName - Event type (e.g., "playerPlaceBlock")
 * @param {string} eventContext.blockType - Block type ID (e.g., "minecraft:diamond_block")
 * @param {number} eventContext.proximity - Distance to villager in blocks
 * @returns {Object} Semantic vector { C, V, I, S, X }
 */
function calculateVector(eventContext) {
  // Implementation
}
```

#### Memory Safety Rules

**CRITICAL:** Never store persistent entity references:

```javascript
// ❌ BAD: Storing entity object causes memory leaks
const villagerCache = new Map();
villagerCache.set(villager.id, villager); // Entity reference stored!

// ✅ GOOD: Only store entity ID
const villagerIDs = new Set();
villagerIDs.add(villager.id); // String stored

// Fetch entity when needed
function getVillager(villagerID) {
  return world.getEntity(villagerID); // Always fetch fresh reference
}
```

#### Naming Conventions (Variables & Functions)

- **camelCase** for variables and functions: `currentMood`, `calculateVector`
- **PascalCase** for constants: `AWARENESS_RADIUS`, `MAX_EPISODE_DURATION`
- **Auxiliary verbs** for booleans: `isValid`, `hasLineOfSight`, `needsSync`
- **Descriptive names:** Avoid single letters except in loops (`i`, `j`) or standard math (`x`, `y`, `z`)

---

## 2. Slow Gear (Backend): `nodeDB/` Directory

**Purpose:** Async operations that handle database writes, LLM inference, and memory processing (Layers 5-7). No impact on game tick performance.

### Directory Structure

```
nodeDB/
├── db/
│   ├── pool.js                     # PostgreSQL connection pool configuration
│   ├── schema.sql                  # Database schema (dual vectors, structure tables)
│   └── migrations/                 # Schema version migrations
│       ├── 001_initial_schema.sql
│       └── 002_add_dual_vectors.sql
│
├── queries/
│   ├── episodes.js                 # Episode-related queries (write, fetch by villager)
│   ├── relationships.js            # Relationship queries (trust scores, interaction counts)
│   ├── working_memory.js           # Working Memory sync queries (upsert, fetch)
│   ├── identity.js                 # Identity tag queries (update personality tags)
│   └── structures.js               # Structure template queries (learn, search, fetch)
│
├── routes/
│   ├── memory.js                   # Layer 5 routes (/api/memory/episode, /api/memory/sync)
│   ├── brain.js                    # Layer 6 routes (/api/brain/request, /api/brain/poll)
│   ├── config_router.js            # AI_MODE & DEBUG_MODE toggle (/api/config/mode)
│   ├── structures.js               # Structure learning routes (/api/structures/learn)
│   └── debug.js                    # DEBUG_MODE utilities (/api/debug/performance)
│
├── middleware/
│   ├── validate.js                 # Request validation (check villagerID, sanitize input)
│   ├── logger.js                   # Request logging (Pino integration)
│   └── error.js                    # Error handler (centralized error responses)
│
├── brain/
│   ├── scheduler.js                # Brain Scheduler (priority queue for LLM requests)
│   ├── llm_client.js               # llama.cpp HTTP client wrapper
│   ├── prompt_builder.js           # Constructs LLM prompts (mode-aware)
│   ├── response_parser.js          # Parses LLM output into IntentPackets
│   ├── model_loader.js             # Transformers.js model loader (MICROSERVICES)
│   ├── vector_engine.js            # MiniLM embedding generation wrapper
│   ├── intent_router.js            # DistilBERT intent classification wrapper
│   ├── episode_summarizer.js       # T5-small summarization wrapper
│   └── ner_extractor.js            # BERT NER entity extraction wrapper
│
├── utils/
│   ├── logger.js                   # Pino logger configuration
│   └── health_check.js             # Backend health check endpoint (/api/health)
│
├── app.js                          # Express initialization and middleware setup
├── server.js                       # Server entry point (starts HTTP listener)
├── package.json                    # Node.js dependencies (@xenova/transformers, etc.)
└── .env                            # Environment variables (DB, DEBUG_MODE, AI_MODE)
```

### File Naming Conventions (Slow Gear)

- **Format:** `{purpose}.js` (singular nouns for modules)
- **Examples:**
  - Database: `pool.js`, `schema.sql`
  - Queries: `episodes.js`, `relationships.js`
  - Routes: `memory.js`, `brain.js`, `debug.js`
  - Middleware: `validate.js`, `logger.js`, `error.js`
- **Use lowercase with underscores** for multi-word names: `llm_client.js`, `health_check.js`

### Code Organization Standards (Slow Gear)

#### File Header Template

```javascript
/**
 * @fileoverview [Brief description of what this file does]
 *
 * Layer: [Layer number and name, e.g., "Layer 5: Long-Term Memory"]
 * Purpose: [Route handling, database queries, LLM inference, etc.]
 * Dependencies: [List of imported modules]
 *
 * @author Immersive Villager AI Team
 * @version 1.0
 */
```

**Example:**

```javascript
/**
 * @fileoverview Handles episode write operations to PostgreSQL.
 *
 * Layer: Layer 5 (Long-Term Memory)
 * Purpose: Database queries for episode storage and retrieval
 * Dependencies: db/pool.js
 *
 * @author Immersive Villager AI Team
 * @version 1.0
 */

const { pool } = require("../db/pool");

// ... rest of file
```

#### Function Documentation (JSDoc)

```javascript
/**
 * Writes an episode to the PostgreSQL database.
 * @param {Object} episodeSummary - Episode data from Layer 3
 * @param {string} episodeSummary.villagerID - Villager entity ID
 * @param {string} episodeSummary.actorID - Player entity ID
 * @param {Object} episodeSummary.vectorAverage - { C, V, I, S, X }
 * @param {number} episodeSummary.duration - Episode duration in milliseconds
 * @param {number} episodeSummary.eventCount - Number of vectors in episode
 * @param {string} episodeSummary.sealReason - Reason for sealing ("context_shift", "inactivity", "manual_seal")
 * @returns {Promise<Object>} Result with episodeID
 */
async function writeEpisode(episodeSummary) {
  // Implementation
}
```

#### Error Handling Conventions

Always use try/catch for async operations:

```javascript
// ✅ GOOD: Comprehensive error handling
app.post("/api/memory/episode", async (req, res) => {
  try {
    const { villagerID, episodeSummary } = req.body;

    // Validation
    if (!villagerID || !episodeSummary) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing required fields" });
    }

    const result = await writeEpisode(episodeSummary);
    res.json({ status: "success", episodeID: result.id });
  } catch (err) {
    logger.error(
      { error: err.message, villagerID: req.body.villagerID },
      "[Layer 5] Episode write failed",
    );
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});
```

#### Naming Conventions (Variables & Functions)

- **camelCase** for variables and functions: `villagerID`, `writeEpisode`
- **PascalCase** for classes: `BrainScheduler`, `LLMClient`
- **Auxiliary verbs** for booleans: `isProcessing`, `hasError`, `needsRetry`
- **Descriptive route names:** Use REST conventions
  - `POST /api/memory/episode` (write)
  - `GET /api/memory/gossip` (read)
  - `PUT /api/memory/sync` (update)
  - `DELETE /api/memory/clear` (delete)

---

## 3. Documentation: `_docs/` Directory

**Purpose:** Architecture documentation, phase plans, and technical specifications.

### Directory Structure

```
_docs/
├── project-overview.md             # High-level vision and cognitive architecture
├── tech-stack.md                   # Technology choices, best practices, limitations
├── interaction-flow.md             # Complete user flow from player action to villager response
├── ui-rules.md                     # UI features, layout, and visual standards
├── ux-rules.md                     # UX flow, state management, async feedback
├── project-rules.md                # THIS FILE: Directory structure and naming conventions
├── Database_Schema.md              # PostgreSQL schema with dual vectors and structure tables
├── AI_Modes.md                     # MONOLITHIC vs MICROSERVICES architecture comparison
├── Structure_System.md             # Structure learning and building mechanics
├── Debug_System.md                 # Enhanced DEBUG_MODE features
│
├── Brain Layers/
│   ├── Brain Layers Summary.md     # Overview of all 7 layers
│   ├── Layer 1 - Sensory Layer.md
│   ├── Layer 2 - Perception Layer.md       # Dual-mode vectorization
│   ├── Layer 3 - Brain Sequencer.md        # Episode grouping + intent routing
│   ├── Layer 4 - Working Memory.md
│   ├── Layer 5 - Long Term Memory.md
│   ├── Layer 6 - Reasoning and Language.md # Mode-aware LLM prompting
│   └── Layer 7 - Action Layer.md
│
├── phases/
│   ├── phase0-setup.md             # PostgreSQL, Node.js, llama.cpp, Transformers.js setup
│   ├── phase1-mvp.md               # Core layers + structure learning + AI modes
│   └── phase2-advanced.md          # Gossip, teaching, advanced building
│
└── diagrams/
    ├── architecture_overview.png   # 7-layer brain diagram
    └── data_flow.png               # Packet flow between layers
```

### File Naming Conventions (Docs)

- **Format:** `{topic}_{context}.md` (lowercase with hyphens)
- **Examples:**
  - `project-overview.md`
  - `tech-stack.md`
  - `interaction-flow.md`
- **Use descriptive names** that clearly indicate content
- **Versioning:** Add version number to filenames when creating major revisions (e.g., `tech-stack-v2.md`)

---

## Architecture Overview

### The 7-Layer Brain System (Dual AI Architecture)

**AI_MODE Toggle:** Switch between MONOLITHIC and MICROSERVICES at runtime

---

#### MONOLITHIC Mode (Manual Vectors, Full LLM)

```
┌──────────────────────────────────────────────────────────────┐
│                    FAST GEAR (Scripts API)                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: Sensory (Retina)                                    │
│   - Filters game events (proximity, LOS)                     │
│   - Output: FilteredEventContext                             │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Perception (Vectorizer)                             │
│   - Converts events to [C, V, I, S, X] vectors (manual)     │
│   - Output: SemanticVector (5D)                              │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Sequencer (Temporal)                                │
│   - Groups vectors into Episodes                             │
│   - Output: EpisodeSummary                                   │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Working Memory                                      │
│   - Stores active state in DynamicProperties                 │
│   - Output: ActiveAttentionState                             │
│   - Structure Detection: Spatial hashing                     │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌──────────────────────────────────────────────────────────────┐
│                    SLOW GEAR (Node.js Backend)                │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Long-Term Memory (LTM)                              │
│   - Writes episodes to PostgreSQL (dual vectors)             │
│   - Updates relationships and identity tags                   │
│   - Output: IdentityContext                                  │
├──────────────────────────────────────────────────────────────┤
│ Brain Scheduler (Infrastructure)                             │
│   - Queues and prioritizes LLM requests                      │
│   - Batches multiple villagers when possible                 │
├──────────────────────────────────────────────────────────────┤
│ Layer 6: Language Cortex (Executive)                         │
│   - LLM inference via llama.cpp (full responsibilities)      │
│   - Generates IntentPackets                                  │
│   - Output: IntentPacket                                     │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP GET (polling)
┌──────────────────────────────────────────────────────────────┐
│                    FAST GEAR (Scripts API)                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 7: Action Layer (The Body)                             │
│   - Polls for pending IntentPackets                          │
│   - Executes physical actions (speak, pathfind, build)       │
│   - Building System: Ghost blocks, pathfinding, placement    │
│   - Output: Villager behavior in game world                  │
└──────────────────────────────────────────────────────────────┘
```

---

#### MICROSERVICES Mode (Transformers.js Models, Reduced LLM)

```
┌──────────────────────────────────────────────────────────────┐
│                    FAST GEAR (Scripts API)                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: Sensory (Retina)                                    │
│   - Filters game events (proximity, LOS)                     │
│   - Output: FilteredEventContext                             │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌──────────────────────────────────────────────────────────────┐
│                    SLOW GEAR (Node.js Backend)                │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Perception (Vectorizer)                             │
│   - MiniLM-L6-v2: Generates 384D embeddings                  │
│   - Cache check: concepts.semantic_vector_minilm             │
│   - Output: SemanticVector (384D)                            │
└──────────────────────────────────────────────────────────────┘
                              ↓ Return to Script API
┌──────────────────────────────────────────────────────────────┐
│                    FAST GEAR (Scripts API)                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Sequencer (Temporal)                                │
│   - Groups embeddings into Episodes                          │
│   - DistilBERT: Intent classification (>0.8 confidence)      │
│   - Fast Route: Bypass LLM for aggression/trading            │
│   - Output: EpisodeSummary + Intent (or bypass)              │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Working Memory                                      │
│   - Stores active state in DynamicProperties                 │
│   - Structure Detection: Semantic vectors                    │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌──────────────────────────────────────────────────────────────┐
│                    SLOW GEAR (Node.js Backend)                │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Long-Term Memory (LTM)                              │
│   - T5-small: Episode summarization (1 sentence)             │
│   - Writes to PostgreSQL (dual vectors + summary_text)       │
│   - Output: IdentityContext                                  │
├──────────────────────────────────────────────────────────────┤
│ Brain Scheduler (Infrastructure)                             │
│   - Queues LLM requests (dialogue only)                      │
├──────────────────────────────────────────────────────────────┤
│ Layer 6: Language Cortex (Executive)                         │
│   - LLM via llama.cpp (dialogue only, reduced load)          │
│   - Generates IntentPackets (if not fast-routed)             │
│   - Output: IntentPacket                                     │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP GET (polling)
┌──────────────────────────────────────────────────────────────┐
│                    FAST GEAR (Scripts API)                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 7: Action Layer (The Body)                             │
│   - Polls for pending IntentPackets                          │
│   - Executes physical actions (speak, pathfind, build)       │
│   - Building System: Ghost blocks, pathfinding, placement    │
│   - Output: Villager behavior in game world                  │
└──────────────────────────────────────────────────────────────┘
```

**Key Difference:** MICROSERVICES mode offloads vectorization, intent routing, and summarization to small models, reducing LLM calls by ~60%.

### Key Architectural Principles

1. **Subjectivity First:** All database queries filtered by `villagerID`
2. **Tick Efficiency:**
   - Fast Gear (Script API) runs in <1ms per event (MONOLITHIC) or <5ms (MICROSERVICES with HTTP calls)
   - Slow Gear (Backend) is async and non-blocking
3. **Memory Safety:** Never store entity references, always fetch via `world.getEntity(id)`
4. **Invisible by Default:** All internal processing is silent unless `DEBUG_MODE = true`
5. **Graceful Degradation:** Fallback to Instinct if Backend or LLM fails
6. **Dual AI Architecture:** Both MONOLITHIC and MICROSERVICES modes coexist in codebase, runtime-switchable
7. **Cache Before Compute:** Always check existing tables (`concepts`, `episodes`, `structure_templates`) before running model inference
8. **Physical Building:** Villagers must pathfind and place blocks like players (4-block reach, inventory checks)

---

## Tech Stack Summary

| Component            | Technology                              | Purpose                                                        |
| -------------------- | --------------------------------------- | -------------------------------------------------------------- |
| **Game-Side**        | Minecraft Script API (JavaScript)       | Layers 1, 3, 4, 7 (Fast Gear)                                  |
| **Backend**          | Node.js with Express                    | Layers 2, 5, 6 (Slow Gear)                                     |
| **Database**         | PostgreSQL with pg-pool + pgvector      | Long-term subjective memory (dual vectors)                     |
| **State Management** | DynamicProperties (Write-Through Cache) | Working Memory (Layer 4)                                       |
| **LLM**              | llama.cpp (Local Inference)             | Language Cortex (Layer 6)                                      |
| **Small Models**     | @xenova/transformers                    | MICROSERVICES mode (vectorization, intent, summarization, NER) |
| **Logging**          | Pino (High-Performance)                 | Structured logging (Backend)                                   |
| **Networking**       | @minecraft/server-net                   | HTTP requests from Script API to Node.js                       |

### Performance Targets

#### MONOLITHIC Mode

| Layer                   | Target Latency | Notes                        |
| ----------------------- | -------------- | ---------------------------- |
| Layers 1-4 (Fast Gear)  | <1ms per event | Manual vectorization         |
| Layer 5 (Memory Write)  | 50-150ms       | HTTP POST + PostgreSQL write |
| Layer 6 (LLM Inference) | 2-4 seconds    | Full planning + dialogue     |
| Layer 7 (Polling)       | 5-20ms         | In-memory lookup             |

#### MICROSERVICES Mode

| Layer                   | Target Latency | Notes                                             |
| ----------------------- | -------------- | ------------------------------------------------- |
| Layer 1 (Fast Gear)     | <1ms per event | Event filtering only                              |
| Layer 2 (MiniLM)        | 15-20ms        | 384D embedding generation (with cache)            |
| Layer 3 (DistilBERT)    | 50-150ms       | Intent classification                             |
| Layer 5 (T5-small)      | 200-500ms      | Episode summarization                             |
| Layer 6 (LLM Inference) | 1-2 seconds    | Dialogue only (reduced load)                      |
| Layer 7 (Polling)       | 5-20ms         | In-memory lookup                                  |
| **Fast Route**          | 50ms total     | Bypasses LLM entirely for high-confidence intents |

---

## Development Workflow

### 1. Starting a New Feature

1. **Create feature branch:** `git checkout -b feature/layer-X-implementation`
2. **Create file with header:** Follow file header template
3. **Write JSDoc for all functions:** Before implementing logic
4. **Keep files under 500 lines:** Split into sub-modules if needed
5. **Add DEBUG_MODE logging:** For development and troubleshooting

### 2. Code Style Rules

#### General Principles

- **Write Clean, Readable Code:** Descriptive names, clear logic flow
- **Use Functional Programming:** Prefer pure functions over classes
- **DRY & KISS:** Don't Repeat Yourself, Keep It Simple
- **Type Hinting:** Use JSDoc for all function signatures

#### Code Formatting

```javascript
// Prefer arrow functions for short callbacks
const doubled = numbers.map((n) => n * 2);

// Use "function" keyword for pure functions
function calculateTrustScore(episodes) {
  // Implementation
}

// Avoid unnecessary curly braces in conditionals
if (!villager.isValid()) return;

// Use concise syntax for simple statements
const mood = villager.getDynamicProperty("wm_currentMood") || 0.5;

// Prefer iteration over code duplication
const vectorKeys = ["C", "V", "I", "S", "X"];
vectorKeys.forEach((key) => {
  villager.setDynamicProperty(`wm_currentMood_${key}`, mood[key]);
});
```

#### Error Handling

```javascript
// Always throw meaningful Error objects
if (!episodeSummary.vectorAverage) {
  throw new Error("Invalid episodeSummary: missing vectorAverage");
}

// Use try/catch for async operations
try {
  const result = await writeEpisode(episodeSummary);
  return result;
} catch (err) {
  logger.error({ error: err.message }, "[Layer 5] Episode write failed");
  throw err; // Re-throw for upstream handling
}
```

### 3. Testing Workflow

1. **Unit Tests:** Test individual functions in isolation
2. **Integration Tests:** Test HTTP communication between Script API and Backend
3. **Performance Tests:** Verify tick budget (<5ms for Fast Gear)
4. **DEBUG_MODE:** Enable to verify data flow between layers

### 4. Git Commit Conventions

**Format:** `[Layer X] Brief description`

**Examples:**

- `[Layer 1] Add proximity filter for player events`
- `[Layer 5] Implement episode write endpoint`
- `[UI] Add Gossip & Whisper menu`
- `[Docs] Update tech-stack.md with pg-pool configuration`

---

## Configuration Management

### Environment Variables (`.env`)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=villager_memory
DB_USER=minecraft_ai
DB_PASSWORD=secure_password

# Backend
PORT=3000
NODE_ENV=production

# AI Configuration
AI_MODE=monolithic               # Options: monolithic, microservices
DEBUG_MODE=false                  # Enable debug logging and UI

# LLM
LLAMA_URL=http://localhost:8080

# Transformers.js Models (MICROSERVICES mode only)
TRANSFORMERS_CACHE_DIR=./models_cache
TRANSFORMERS_LOCAL_FILES_ONLY=false

# Logging
LOG_LEVEL=info
```

### Constants (`scripts/config/constants.js`)

```javascript
/**
 * @fileoverview Game constants for the Immersive Villager AI system.
 *
 * Layer: Configuration
 * Purpose: Centralized constants for all layers
 *
 * @author Immersive Villager AI Team
 * @version 1.0
 */

// Core System
export const AWARENESS_RADIUS = 32; // Blocks
export const MAX_EPISODE_DURATION = 30000; // 30 seconds in ms
export const EPISODE_VECTOR_THRESHOLD = 0.3; // Context shift threshold
export const WORKING_MEMORY_SYNC_INTERVAL = 100; // Ticks (5 seconds)
export const POLLING_INTERVAL = 40; // Ticks (2 seconds)
export const LLM_TIMEOUT = 10000; // 10 seconds in ms
export const MAX_POLLING_ATTEMPTS = 10; // 20 seconds total

// AI Mode
export const AI_MODE = {
  MONOLITHIC: "monolithic",
  MICROSERVICES: "microservices",
};

// Structure System
export const STRUCTURE_DETECTION_TIMEOUT = 5000; // 5 seconds of inactivity
export const BUILD_REACH = 4; // Blocks (villager can place blocks 4 blocks away)
export const BUILD_TICK_RATE = 40; // Ticks between block placements (2 seconds)
export const PATTERN_SIMILARITY_THRESHOLD = 0.85; // Cosine similarity for structure matching

// Debug System
export const DEBUG_MODE_LATENCY_THRESHOLDS = {
  FAST_GEAR: 10, // ms
  SLOW_GEAR: 5000, // ms
  STRUCTURE_DETECTION: 200, // ms
};
```

---

## DEBUG_MODE Guidelines

### Enabling DEBUG_MODE

**In-Game Commands:**

```javascript
// Enable DEBUG_MODE
/scriptevent ai:debug on

// Disable DEBUG_MODE
/scriptevent ai:debug off

// Toggle AI_MODE
/scriptevent ai:mode monolithic
/scriptevent ai:mode microservices
```

**Backend (.env):**

```env
DEBUG_MODE=true
AI_MODE=microservices
LOG_LEVEL=debug
```

### DEBUG_MODE Features

1. **Inference Tracing (The "Brain Path"):**
   - Shows processing flow in player ActionBar
   - Example: `[L1] → [L2: MiniLM 18ms] → [L3: Intent=Trade 0.92] → [L7: BYPASS]`

2. **Vector Similarity Highlighting:**
   - Green particle effects at recognized structures
   - ActionBar log: `Structure Match: oak_wall_segment (similarity: 0.94)`
   - Console log: Full cosine similarity scores

3. **Manual Concept Correction (The "Teacher" UI):**
   - Right-click villager → "Open Debug Menu" → "Structure Memory" tab
   - Correct mislabeled structures
   - Triggers re-vectorization and database update

4. **Performance Benchmarking (Gear Latency Warnings):**
   - Console logging with latency metrics
   - Threshold warnings if Fast Gear >10ms or Slow Gear >5000ms
   - Recommendation to switch AI_MODE if performance degrades

5. **Debug Modal:**
   - Live State View (current vector, open episode)
   - AI Mode toggle button
   - Structure memory list with similarity scores
   - CRUD operations on villager data
   - Knowledge injection
   - Force LLM request

6. **Console Logging:** All HTTP requests and responses logged with timing

### DEBUG_MODE Usage Rules

- **Always check before logging:**

  ```javascript
  const DEBUG_MODE = world.getDynamicProperty("DEBUG_MODE") || false;
  if (DEBUG_MODE) {
    console.warn("[Layer 2] Vector calculated:", vector);
  }
  ```

- **Use inference tracer for brain path visualization:**

  ```javascript
  if (DEBUG_MODE) {
    logInferenceTrace(villagerID, layerName, operation, latency);
  }
  ```

- **Never log in production:** Performance impact and log spam
- **Use structured logging in Backend:** Pino automatically respects `LOG_LEVEL`

---

## File Size Management

### Rule: 500-Line Maximum

**Why:** AI tools (including LLMs) work best with smaller, focused files. Long files are harder to navigate and understand.

**How to Split:**

```javascript
// BEFORE (800 lines in layer2_vectorizer.js)
function calculateVector(eventContext) {
  /* ... */
}
function calculateConstructiveness(blockType) {
  /* ... */
}
function calculateValue(blockType) {
  /* ... */
}
function calculateIntensity(eventContext) {
  /* ... */
}
function calculateSociality(eventContext) {
  /* ... */
}
function calculateComplexity(blockType) {
  /* ... */
}

// AFTER (split into multiple files)
// layer2_vectorizer.js (200 lines)
import { calculateConstructiveness } from "./vectorizer/constructiveness.js";
import { calculateValue } from "./vectorizer/value.js";
import { calculateIntensity } from "./vectorizer/intensity.js";
import { calculateSociality } from "./vectorizer/sociality.js";
import { calculateComplexity } from "./vectorizer/complexity.js";

function calculateVector(eventContext) {
  return {
    C: calculateConstructiveness(eventContext),
    V: calculateValue(eventContext),
    I: calculateIntensity(eventContext),
    S: calculateSociality(eventContext),
    X: calculateComplexity(eventContext),
  };
}

// vectorizer/constructiveness.js (100 lines)
export function calculateConstructiveness(eventContext) {
  /* ... */
}

// vectorizer/value.js (100 lines)
export function calculateValue(eventContext) {
  /* ... */
}

// ... etc.
```

---

## Structure System Standards

### File Organization

Structure-related code must be organized by responsibility:

```
scripts/structures/
├── detector.js          # Real-time pattern observation
├── builder.js           # Building execution (ghost blocks, placement)
├── spatial_hash.js      # MONOLITHIC: Geometric pattern matching
└── inventory_check.js   # Verify block availability

nodeDB/queries/
└── structures.js        # Database queries for structure templates and blueprints
```

### Structure Detection Rules

1. **Observation Window:** Monitor for 5 seconds of inactivity after last block placement
2. **Minimum Pattern Size:** At least 3 blocks to qualify as a structure
3. **Deduplication:**
   - **MONOLITHIC:** Check `structure_templates.pattern_hash` before storing
   - **MICROSERVICES:** Check `structure_templates.embedding` with cosine similarity >0.85
4. **Cache Strategy:** Always query existing templates before running MiniLM inference

### Building System Rules

1. **Pathfinding:** Villager must physically walk to each block position
2. **Block Reach:** 4 blocks (same as player)
3. **Placement Rate:** 1 block per 40 ticks (2 seconds) to maintain 20 TPS
4. **Inventory Checks:** Verify villager has required blocks before starting build
5. **Ghost Blocks:** Use particle effects to preview build location
6. **Error Handling:** If block placement fails, retry once, then skip and continue

### Database Interaction

```javascript
// Always check for existing patterns before vectorization
async function learnStructure(blockList, description) {
  // 1. Check cache
  const existing = await db.query(
    "SELECT id, embedding FROM structure_templates WHERE label = $1",
    [description],
  );

  if (existing.rows.length > 0) {
    // Increment observation_count
    await db.query(
      "UPDATE structure_templates SET observation_count = observation_count + 1 WHERE id = $1",
      [existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  // 2. Generate embedding (only if not cached)
  const embedding = await generateEmbedding(description);

  // 3. Store new template
  const result = await db.query(
    "INSERT INTO structure_templates (label, embedding, instructions) VALUES ($1, $2, $3) RETURNING id",
    [description, embedding, JSON.stringify(blockList)],
  );

  return result.rows[0].id;
}
```

---

## AI Mode Best Practices

### Mode Selection Guidelines

**Use MONOLITHIC Mode when:**

- Predictable, low-latency responses needed
- No external model dependencies desired
- Debugging manual vectorization rules
- Testing on low-resource servers

**Use MICROSERVICES Mode when:**

- Semantic understanding is critical (structure recognition)
- Reducing LLM load is priority
- Fast intent routing for simple interactions
- Handling complex player chat (NER extraction)

### Mode-Aware Code Patterns

All vectorization code must check `AI_MODE` and branch accordingly:

```javascript
/**
 * Generates semantic vector based on current AI_MODE
 * @param {Object} eventContext - Filtered event from Layer 1
 * @returns {Promise<Object>} SemanticVector (5D or 384D)
 */
async function vectorizeEvent(eventContext) {
  const aiMode = world.getDynamicProperty("AI_MODE") || "monolithic";

  if (aiMode === "monolithic") {
    // Manual vectorization (instant)
    return calculateVectorManual(eventContext);
  } else {
    // MiniLM vectorization (async, 15-20ms)
    const description = buildEventDescription(eventContext);
    const response = await http.post("http://localhost:3000/api/vector/embed", {
      body: JSON.stringify({
        description,
        villagerID: eventContext.villagerID,
      }),
    });
    return JSON.parse(response.body);
  }
}
```

### Dual Vector Storage Pattern

Always store both vector types in PostgreSQL to enable seamless mode switching:

```javascript
// Write episode with dual vectors
await db.query(
  `INSERT INTO episodes (villager_id, actor_id, semantic_vector_manual, semantic_vector_minilm, summary_text)
   VALUES ($1, $2, $3, $4, $5)`,
  [villagerID, actorID, manualVector, miniLMVector, summaryText],
);
```

---

## Transformers.js Model Standards (MICROSERVICES Mode)

### Model Loading Pattern

All models must be loaded once at server startup and reused:

```javascript
// nodeDB/brain/model_loader.js
const { pipeline } = require("@xenova/transformers");

let vectorizerModel = null;
let intentClassifierModel = null;
let summarizerModel = null;
let nerModel = null;

/**
 * Loads all Transformers.js models for MICROSERVICES mode
 * @returns {Promise<void>}
 */
async function loadModels() {
  console.log("[Model Loader] Loading Transformers.js models...");

  vectorizerModel = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );
  intentClassifierModel = await pipeline(
    "zero-shot-classification",
    "Xenova/distilbert-base-uncased-mnli",
  );
  summarizerModel = await pipeline("summarization", "Xenova/t5-small");
  nerModel = await pipeline(
    "ner",
    "Xenova/bert-base-multilingual-cased-ner-slavic",
  );

  console.log("[Model Loader] All models loaded successfully");
}

module.exports = {
  loadModels,
  vectorizerModel,
  intentClassifierModel,
  summarizerModel,
  nerModel,
};
```

### Model-Specific Rules

#### 1. MiniLM (Vectorization)

- **Purpose:** Generate 384D embeddings from text descriptions
- **Cache:** Always check `concepts.semantic_vector_minilm` before inference
- **Input:** Natural language description (max 512 tokens)
- **Output:** Float32Array(384)

#### 2. DistilBERT (Intent Classification)

- **Purpose:** Classify intent for fast routing
- **Labels:** `['aggression', 'trading', 'building', 'asking_question', 'idling']`
- **Threshold:** Only bypass LLM if confidence >0.8
- **Fallback:** Route to LLM if confidence <0.8

#### 3. T5-small (Summarization)

- **Purpose:** Compress episode logs into 1-sentence summaries
- **Input:** Concatenated event descriptions (max 512 tokens)
- **Output:** Single sentence stored in `episodes.summary_text`
- **Fallback:** If summarization fails, store first event description

#### 4. BERT NER (Entity Extraction)

- **Purpose:** Extract block types and item names from player chat
- **Input:** Raw chat message
- **Output:** Array of entities: `[{ text: "oak_planks", type: "BLOCK" }]`
- **Use Case:** Structure building from chat commands

### Error Handling for Models

```javascript
// Wrap all model calls in try/catch
try {
  const embedding = await vectorizerModel(description);
  return embedding.data;
} catch (err) {
  logger.error({ error: err.message }, "[MiniLM] Vectorization failed");
  // Fallback: Use manual vectorization or return cached result
  return fallbackVector;
}
```

---

## API Endpoint Standards

### Naming Conventions

**Format:** `/api/{layer}/{resource}/{action}` or `/api/{system}/{action}`

**Core Endpoints:**

- `POST /api/memory/episode` - Write episode to Layer 5
- `POST /api/memory/sync` - Sync Working Memory to Layer 5
- `GET /api/memory/gossip` - Fetch recent memories
- `POST /api/brain/request` - Queue LLM inference (Layer 6)
- `GET /api/brain/poll` - Poll for pending IntentPackets (Layer 7)
- `POST /api/brain/classify_intent` - DistilBERT intent classification (MICROSERVICES)
- `POST /api/brain/summarize` - T5-small episode summarization (MICROSERVICES)
- `GET /api/health` - Backend health check

**Structure System Endpoints:**

- `POST /api/structures/learn` - Save structure template from observation
- `GET /api/structures/search` - Find similar structures (cosine similarity)
- `GET /api/structures/template/:id` - Fetch structure template by ID
- `POST /api/structures/blueprint` - Save high-level blueprint

**AI Mode & Config Endpoints:**

- `POST /api/config/mode` - Toggle AI_MODE (monolithic/microservices)
- `POST /api/config/debug` - Toggle DEBUG_MODE (on/off)
- `GET /api/config/current` - Get current AI_MODE and DEBUG_MODE

**Debug Endpoints:**

- `GET /api/debug/performance` - Get latency metrics by layer
- `POST /api/debug/correct_concept` - Manual concept correction (Teacher UI)
- `GET /api/debug/inference_log` - Get recent inference traces

### Response Format (Standard)

```javascript
// Success response
{
  "status": "success",
  "data": { /* ... */ },
  "timestamp": 1645564805000
}

// Error response
{
  "status": "error",
  "message": "Human-readable error",
  "code": "EPISODE_WRITE_FAILED",
  "timestamp": 1645564805000
}

// Queued response (for async operations)
{
  "status": "queued",
  "requestID": "req_123",
  "estimatedWaitTime": 2000
}
```

---

## Common Patterns & Anti-Patterns

### ✅ GOOD: Memory-Safe Entity Handling

```javascript
// Store entity ID, not entity reference
const villagerIDs = new Set();

system.runInterval(() => {
  const villagers = world
    .getDimension("overworld")
    .getEntities({ type: "minecraft:villager_v2" });

  villagerIDs.clear();
  for (const villager of villagers) {
    villagerIDs.add(villager.id); // Only string stored
  }
}, 20);

// Fetch fresh entity reference when needed
function getVillagerEntity(villagerID) {
  const entity = world.getEntity(villagerID);
  if (!entity || !entity.isValid()) return null;
  return entity;
}
```

### ❌ BAD: Storing Entity References

```javascript
// Memory leak! Entity objects accumulate
const villagerCache = new Map();

system.runInterval(() => {
  const villagers = world
    .getDimension("overworld")
    .getEntities({ type: "minecraft:villager_v2" });

  for (const villager of villagers) {
    villagerCache.set(villager.id, villager); // Entity reference stored!
  }
}, 20);
```

### ✅ GOOD: Async HTTP Requests

```javascript
// Non-blocking HTTP POST
http
  .post("http://localhost:3000/api/memory/episode", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(episodeSummary),
  })
  .then((response) => {
    console.log("Episode written:", response.body);
  })
  .catch((err) => {
    console.error("HTTP request failed:", err.message);
  });
```

### ❌ BAD: Blocking HTTP Requests

```javascript
// Don't use synchronous patterns (await in tight loops)
for (const villager of villagers) {
  const response = await http.post(/* ... */); // Blocks game thread!
}
```

### ✅ GOOD: Transaction Handling (PostgreSQL)

```javascript
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("INSERT INTO episodes ...");
  await client.query("UPDATE relationships ...");
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release(); // Always return connection to pool
}
```

---

## Glossary

- **[C, V, I, S, X]:** The 5-axis semantic vector (Constructiveness, Value, Intensity, Sociality, Complexity) used in MONOLITHIC mode
- **384D Embedding:** Semantic vector generated by MiniLM-L6-v2 used in MICROSERVICES mode
- **AI_MODE:** Configuration toggle between MONOLITHIC (manual vectors) and MICROSERVICES (Transformers.js models)
- **Episode:** A grouped sequence of vectors representing a coherent activity (e.g., "Building Session")
- **IntentPacket:** The LLM's decision output, containing an action and parameters
- **DynamicProperties:** Bedrock's persistent key-value storage for entities, survives server restarts
- **Fast Gear:** Layers 1, 3, 4, 7 in Script API (<1ms per event in MONOLITHIC, <5ms in MICROSERVICES)
- **Slow Gear:** Layers 2, 5, 6 in Node.js (asynchronous processing, 50ms-5s)
- **Brain Scheduler:** Infrastructure middleware managing LLM request batching and prioritization
- **Working Memory:** Layer 4 state stored in DynamicProperties (current mood, focus, shock state, build tasks)
- **Long-Term Memory:** Layer 5 state stored in PostgreSQL (episodes, relationships, identity, structures)
- **Fast Intent Routing:** MICROSERVICES feature that bypasses LLM for high-confidence intents (>0.8 confidence)
- **Structure Template:** A building "recipe" storing relative block positions (stored in `structure_templates` table)
- **Structure Blueprint:** High-level assembly guide linking multiple templates into functional zones
- **Ghost Blocks:** Visual placeholders (particles) showing where a villager will place blocks during construction
- **Transformers.js:** Browser-compatible ML library providing MiniLM, DistilBERT, T5, and BERT models
- **Spatial Hash:** MONOLITHIC mode's method for recognizing structure patterns using geometric hash functions
- **Semantic Vector:** MICROSERVICES mode's method for recognizing structure patterns using MiniLM embeddings

---

## Document Changelog

**Version 1.0 (Feb 23, 2026):**

- Initial project rules specification
- Defined complete directory structure for Fast Gear and Slow Gear
- Established file naming conventions for all layers
- Added code organization standards with JSDoc templates
- Defined architectural overview and performance targets
- Added common patterns, anti-patterns, and best practices

**Version 1.1 (Mar 3, 2026):**

- Added dual AI architecture (MONOLITHIC vs MICROSERVICES modes)
- Added structure system directories (`scripts/structures/`, `scripts/commands/`)
- Added Transformers.js model standards and best practices
- Updated directory structure with new brain modules (vector_engine, intent_router, etc.)
- Added AI_MODE and DEBUG_MODE configuration standards
- Added structure detection and building system rules
- Updated API endpoint standards with structure and config routes
- Added Transformers.js model loading patterns and error handling
- Updated glossary with new terms (AI_MODE, Ghost Blocks, Spatial Hash, etc.)
- Updated performance targets for both AI modes

---

**Document Type:** Project Rules & Standards  
**Author:** Senior Minecraft Scripting Engineer  
**Status:** Approved (Ready for Implementation)  
**Version:** 1.1  
**Last Updated:** Mar 3, 2026
