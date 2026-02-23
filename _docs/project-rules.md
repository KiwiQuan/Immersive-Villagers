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
│   ├── layer2_vectorizer.js        # Perception (converts events to [C,V,I,S,X] vectors)
│   ├── layer3_sequencer.js         # Sequencer (groups vectors into episodes)
│   └── layer4_working_memory.js    # Working Memory (DynamicProperties management)
│
├── ui/
│   ├── hub.js                      # Main Menu (Interaction Hub)
│   ├── gossip.js                   # Gossip & Whisper Menu
│   ├── debug.js                    # Debug Modal (DEBUG_MODE only)
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

import { vectorRules } from './config/vector_rules.js';
import { normalizeVector } from './utils/vector_math.js';

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
│   ├── schema.sql                  # Database schema (episodes, relationships, working_memory)
│   └── migrations/                 # Schema version migrations
│       ├── 001_initial_schema.sql
│       └── 002_add_identity_tags.sql
│
├── queries/
│   ├── episodes.js                 # Episode-related queries (write, fetch by villager)
│   ├── relationships.js            # Relationship queries (trust scores, interaction counts)
│   ├── working_memory.js           # Working Memory sync queries (upsert, fetch)
│   └── identity.js                 # Identity tag queries (update personality tags)
│
├── routes/
│   ├── memory.js                   # Layer 5 routes (/api/memory/episode, /api/memory/sync)
│   ├── brain.js                    # Layer 6 routes (/api/brain/request, /api/brain/poll)
│   └── debug.js                    # DEBUG_MODE utilities (/api/debug/clear, /api/debug/reset)
│
├── middleware/
│   ├── validate.js                 # Request validation (check villagerID, sanitize input)
│   ├── logger.js                   # Request logging (Pino integration)
│   └── error.js                    # Error handler (centralized error responses)
│
├── brain/
│   ├── scheduler.js                # Brain Scheduler (priority queue for LLM requests)
│   ├── llm_client.js               # llama.cpp HTTP client wrapper
│   ├── prompt_builder.js           # Constructs LLM prompts from context
│   └── response_parser.js          # Parses LLM output into IntentPackets
│
├── utils/
│   ├── logger.js                   # Pino logger configuration
│   └── health_check.js             # Backend health check endpoint (/api/health)
│
├── app.js                          # Express initialization and middleware setup
├── server.js                       # Server entry point (starts HTTP listener)
├── package.json                    # Node.js dependencies
└── .env                            # Environment variables (DB credentials, DEBUG_MODE)
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

const { pool } = require('../db/pool');

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
app.post('/api/memory/episode', async (req, res) => {
  try {
    const { villagerID, episodeSummary } = req.body;
    
    // Validation
    if (!villagerID || !episodeSummary) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    
    const result = await writeEpisode(episodeSummary);
    res.json({ status: 'success', episodeID: result.id });
  } catch (err) {
    logger.error({ error: err.message, villagerID: req.body.villagerID }, '[Layer 5] Episode write failed');
    res.status(500).json({ status: 'error', message: 'Internal server error' });
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
├── phase-plans/
│   ├── phase1_backend_setup.md     # PostgreSQL, Node.js, llama.cpp setup
│   ├── phase2_layers_1-4.md        # Fast Gear implementation
│   └── phase3_layers_5-7.md        # Slow Gear implementation
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

### The 7-Layer Brain System

```
┌──────────────────────────────────────────────────────────────┐
│                    FAST GEAR (Scripts API)                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: Sensory (Retina)                                    │
│   - Filters game events (proximity, LOS)                     │
│   - Output: FilteredEventContext                             │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Perception (Vectorizer)                             │
│   - Converts events to [C, V, I, S, X] vectors              │
│   - Output: SemanticVector                                   │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Sequencer (Temporal)                                │
│   - Groups vectors into Episodes                             │
│   - Output: EpisodeSummary                                   │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Working Memory                                      │
│   - Stores active state in DynamicProperties                 │
│   - Output: ActiveAttentionState                             │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌──────────────────────────────────────────────────────────────┐
│                    SLOW GEAR (Node.js Backend)                │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Long-Term Memory (LTM)                              │
│   - Writes episodes to PostgreSQL                            │
│   - Updates relationships and identity tags                   │
│   - Output: IdentityContext                                  │
├──────────────────────────────────────────────────────────────┤
│ Brain Scheduler (Infrastructure)                             │
│   - Queues and prioritizes LLM requests                      │
│   - Batches multiple villagers when possible                 │
├──────────────────────────────────────────────────────────────┤
│ Layer 6: Language Cortex (Executive)                         │
│   - LLM inference via llama.cpp                              │
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
│   - Output: Villager behavior in game world                  │
└──────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Subjectivity First:** All database queries filtered by `villagerID`
2. **Tick Efficiency:** Layers 1-4 run in <5ms per villager per event
3. **Memory Safety:** Never store entity references, always fetch via `world.getEntity(id)`
4. **Invisible by Default:** All internal processing is silent unless `DEBUG_MODE = true`
5. **Graceful Degradation:** Fallback to Instinct if Backend or LLM fails

---

## Tech Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Game-Side** | Minecraft Script API (JavaScript) | Layers 1-4 (Fast Gear) |
| **Backend** | Node.js with Express | Layers 5-7 (Slow Gear) |
| **Database** | PostgreSQL with pg-pool | Long-term subjective memory |
| **State Management** | DynamicProperties (Write-Through Cache) | Working Memory (Layer 4) |
| **LLM** | llama.cpp (Local Inference) | Language Cortex (Layer 6) |
| **Logging** | Pino (High-Performance) | Structured logging (Backend) |
| **Networking** | @minecraft/server-net | HTTP requests from Script API to Node.js |

### Performance Targets

| Layer | Target Latency | Notes |
|-------|---------------|-------|
| Layers 1-4 (Fast Gear) | <5ms per event | Must maintain 20 TPS |
| Layer 5 (Memory Write) | 50-150ms | HTTP POST + PostgreSQL write |
| Layer 6 (LLM Inference) | 1-5 seconds | Async, non-blocking |
| Layer 7 (Polling) | 5-20ms | In-memory lookup |

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
const doubled = numbers.map(n => n * 2);

// Use "function" keyword for pure functions
function calculateTrustScore(episodes) {
  // Implementation
}

// Avoid unnecessary curly braces in conditionals
if (!villager.isValid()) return;

// Use concise syntax for simple statements
const mood = villager.getDynamicProperty('wm_currentMood') || 0.5;

// Prefer iteration over code duplication
const vectorKeys = ['C', 'V', 'I', 'S', 'X'];
vectorKeys.forEach(key => {
  villager.setDynamicProperty(`wm_currentMood_${key}`, mood[key]);
});
```

#### Error Handling

```javascript
// Always throw meaningful Error objects
if (!episodeSummary.vectorAverage) {
  throw new Error('Invalid episodeSummary: missing vectorAverage');
}

// Use try/catch for async operations
try {
  const result = await writeEpisode(episodeSummary);
  return result;
} catch (err) {
  logger.error({ error: err.message }, '[Layer 5] Episode write failed');
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

# LLM
LLAMA_URL=http://localhost:8080

# Logging
LOG_LEVEL=info
DEBUG_MODE=false
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

export const AWARENESS_RADIUS = 32; // Blocks
export const MAX_EPISODE_DURATION = 30000; // 30 seconds in ms
export const EPISODE_VECTOR_THRESHOLD = 0.3; // Context shift threshold
export const WORKING_MEMORY_SYNC_INTERVAL = 100; // Ticks (5 seconds)
export const POLLING_INTERVAL = 40; // Ticks (2 seconds)
export const LLM_TIMEOUT = 10000; // 10 seconds in ms
export const MAX_POLLING_ATTEMPTS = 10; // 20 seconds total
```

---

## DEBUG_MODE Guidelines

### Enabling DEBUG_MODE

**In-Game:**
```javascript
// Enable DEBUG_MODE (operator only)
world.setDynamicProperty('DEBUG_MODE', true);

// Disable DEBUG_MODE
world.setDynamicProperty('DEBUG_MODE', false);
```

**Backend (.env):**
```env
DEBUG_MODE=true
LOG_LEVEL=debug
```

### DEBUG_MODE Features

1. **Console Logging:** All HTTP requests and responses logged
2. **Debug Modal:** CRUD operations on villager data
3. **Live Vector Stream:** Real-time vector monitoring
4. **Force LLM Request:** Manual trigger for Layer 6 inference
5. **Episode Sealing:** Manual seal current episode

### DEBUG_MODE Usage Rules

- **Always check before logging:**
  ```javascript
  const DEBUG_MODE = world.getDynamicProperty('DEBUG_MODE') || false;
  if (DEBUG_MODE) {
    console.warn('[Layer 2] Vector calculated:', vector);
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
function calculateVector(eventContext) { /* ... */ }
function calculateConstructiveness(blockType) { /* ... */ }
function calculateValue(blockType) { /* ... */ }
function calculateIntensity(eventContext) { /* ... */ }
function calculateSociality(eventContext) { /* ... */ }
function calculateComplexity(blockType) { /* ... */ }

// AFTER (split into multiple files)
// layer2_vectorizer.js (200 lines)
import { calculateConstructiveness } from './vectorizer/constructiveness.js';
import { calculateValue } from './vectorizer/value.js';
import { calculateIntensity } from './vectorizer/intensity.js';
import { calculateSociality } from './vectorizer/sociality.js';
import { calculateComplexity } from './vectorizer/complexity.js';

function calculateVector(eventContext) {
  return {
    C: calculateConstructiveness(eventContext),
    V: calculateValue(eventContext),
    I: calculateIntensity(eventContext),
    S: calculateSociality(eventContext),
    X: calculateComplexity(eventContext)
  };
}

// vectorizer/constructiveness.js (100 lines)
export function calculateConstructiveness(eventContext) { /* ... */ }

// vectorizer/value.js (100 lines)
export function calculateValue(eventContext) { /* ... */ }

// ... etc.
```

---

## API Endpoint Standards

### Naming Conventions

**Format:** `/api/{layer}/{resource}/{action}`

**Examples:**
- `POST /api/memory/episode` - Write episode to Layer 5
- `POST /api/memory/sync` - Sync Working Memory to Layer 5
- `GET /api/memory/gossip` - Fetch recent memories
- `POST /api/brain/request` - Queue LLM inference (Layer 6)
- `GET /api/brain/poll` - Poll for pending IntentPackets (Layer 7)
- `GET /api/health` - Backend health check

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
  const villagers = world.getDimension('overworld').getEntities({ type: 'minecraft:villager_v2' });
  
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
  const villagers = world.getDimension('overworld').getEntities({ type: 'minecraft:villager_v2' });
  
  for (const villager of villagers) {
    villagerCache.set(villager.id, villager); // Entity reference stored!
  }
}, 20);
```

### ✅ GOOD: Async HTTP Requests

```javascript
// Non-blocking HTTP POST
http.post('http://localhost:3000/api/memory/episode', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(episodeSummary)
}).then(response => {
  console.log('Episode written:', response.body);
}).catch(err => {
  console.error('HTTP request failed:', err.message);
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
  await client.query('BEGIN');
  await client.query('INSERT INTO episodes ...');
  await client.query('UPDATE relationships ...');
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release(); // Always return connection to pool
}
```

---

## Glossary

- **[C, V, I, S, X]:** The 5-axis semantic vector (Constructiveness, Value, Intensity, Sociality, Complexity)
- **Episode:** A grouped sequence of vectors representing a coherent activity (e.g., "Building Session")
- **IntentPacket:** The LLM's decision output, containing an action and parameters
- **DynamicProperties:** Bedrock's persistent key-value storage for entities, survives server restarts
- **Fast Gear:** Layers 1-4, optimized for high-frequency execution in Script API (<5ms per event)
- **Slow Gear:** Layers 5-7, asynchronous processing in Node.js (1-5 seconds)
- **Brain Scheduler:** Infrastructure middleware managing LLM request batching and prioritization
- **Working Memory:** Layer 4 state stored in DynamicProperties (current mood, focus, shock state)
- **Long-Term Memory:** Layer 5 state stored in PostgreSQL (episodes, relationships, identity)

---

## Document Changelog

**Version 1.0 (Feb 23, 2026):**
- Initial project rules specification
- Defined complete directory structure for Fast Gear and Slow Gear
- Established file naming conventions for all layers
- Added code organization standards with JSDoc templates
- Defined architectural overview and performance targets
- Added common patterns, anti-patterns, and best practices

---

**Document Type:** Project Rules & Standards  
**Author:** Senior Minecraft Scripting Engineer  
**Status:** Approved (Ready for Implementation)  
**Version:** 1.0  
**Last Updated:** Feb 23, 2026
