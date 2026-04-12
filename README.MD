# 🧠 Immersive Villager AI — Minecraft Bedrock Edition

A cognitive AI system for Minecraft Bedrock that gives villagers subjective experiences, adaptive learning, and genuine conversational abilities. Each villager perceives the world through physical interactions rather than hardcoded scripts.

---

## Vision

Create villagers that can truly **adapt, chat, and build**. Each villager possesses subjective experiences and lives in their own reality, learning about the world through physical interactions (vectors) rather than omniscient game knowledge. If a villager hasn't seen it or been told about it, they don't know it.

---

## Architecture: The 7-Layer Brain System

### Fast Gear (Layers 1-4) — Script API

High-frequency operations optimized for game tick performance (<5ms per event):

1. **Sensory (Retina):** Filters game events based on proximity and Line of Sight
2. **Perception (Vectorizer):** Converts events into 5-axis semantic vectors **[C, V, I, S, X]**
   - **C** (Constructiveness): Building vs. Destroying
   - **V** (Value): Economic/Survival importance
   - **I** (Intensity): Energy/Arousal level
   - **S** (Sociality): Friendly vs. Hostile intent
   - **X** (Complexity): Systemic vs. Random logic
3. **Sequencer (Temporal):** Groups vectors into coherent "Episodes"
4. **Working Memory:** Tracks active focus and emotional state in the `trackedVillagers` in-memory cache (DynamicProperties as backup persistence)

### Slow Gear (Layers 5-7) — Node.js Backend

Asynchronous cognitive processing (1-5 seconds latency):

5. **Long-Term Memory:** PostgreSQL database storing subjective relationships and learned concepts
6. **Language Cortex (Executive):** Local LLM (llama.cpp) for decision-making and internal monologue
7. **Action Layer (The Body):** Translates AI intent into physical game actions

### Brain Scheduler (Infrastructure)

Optimizes LLM calls via batching and prioritization to prevent server lag.

---

## Tech Stack

| Component             | Technology                              | Purpose                                             |
| --------------------- | --------------------------------------- | --------------------------------------------------- |
| **Game-Side**         | JavaScript (Minecraft Script API)       | Layers 1-4 (Fast Gear)                              |
| **Backend**           | Node.js with Express                    | Layers 5-7 (Slow Gear)                              |
| **Database**          | PostgreSQL + pgvector with pg-pool      | Long-term subjective memory + vector similarity     |
| **Vector Similarity** | pgvector (<=> operator)                 | Cosine similarity for intent-based pattern matching |
| **State Management**  | DynamicProperties (Write-Through Cache) | Working Memory persistence                          |
| **LLM**               | llama.cpp (Local Inference)             | Decision-making & dialogue                          |
| **Logging**           | Pino                                    | High-performance structured logging                 |
| **Networking**        | @minecraft/server-net                   | HTTP communication                                  |

**Performance Targets:**

- Fast Gear: <5ms per event (maintains 20 TPS)
- Memory Write: 50-150ms
- Vector Similarity Search: 1-5ms (1K concepts)
- LLM Inference: 1-5 seconds (async, non-blocking)

---

## Project Structure

```
Immersive_Villagers BP/
├── scripts/                    # Bedrock Script API (Fast Gear)
│   ├── layers/                 # L1–L4 cognitive layers (cache-first)
│   ├── systems/                # Cross-cutting systems (debug, lifecycle, etc.)
│   ├── utils/                  # Shared helpers (network, geometry, batching, etc.)
│   ├── sandbox/                # Experiments (must stay isolated)
│   └── main.js                 # Script entry point
│
├── nodeDB/                     # Node.js backend (Slow Gear)
│   ├── routes/                 # Route definitions (thin)
│   ├── api/                    # Handler/adapters (optional separation)
│   ├── brain/                  # Scheduler + LLM client + cognition services
│   ├── db/                     # PostgreSQL pool + schema + migrations
│   ├── queries/                # Parameterized SQL modules
│   ├── utils/                  # Logger, validation, shared helpers
│   ├── app.js                  # Express app wiring
│   └── server.js               # Backend entry point
│
├── _docs_v2/                   # Architecture & rules documentation
│   ├── project-overview.md
│   ├── tech-stack.md
│   ├── interaction-flow.md
│   ├── project-rules.md        # Directory structure & conventions (source of truth)
│   └── Brain Layers/
│
├── entities/                   # BP entity definitions
├── functions/                  # BP functions (.mcfunction, etc.)
└── loot_tables/                # BP loot tables
```

---

## Vector Similarity: Directional vs. Coordinate-Based Memory

### Why Cosine Similarity?

The system uses **Cosine Similarity** (not Euclidean Distance) for pattern recognition and memory retrieval:

| Approach               | What It Measures                         | Example                                                 |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------- |
| **Euclidean Distance** | Magnitude/Quantity (coordinate distance) | "1 flower vs 64 diamonds = very different"              |
| **Cosine Similarity**  | Intent/Direction (angular alignment)     | "1 flower vs 64 diamonds = both gifts (similar intent)" |

**The Benefit:**

- Villagers recognize that a small favor (1 flower) and a large favor (64 diamonds) are **the same kind of action** because they point in the same semantic direction.
- Magnitude differences (intensity) are preserved in the vector but don't dominate similarity calculations.
- More human-like memory: We remember "they were generous" (direction) more than "they gave exactly 17 items" (magnitude).

**Implementation:**

- pgvector extension provides hardware-accelerated cosine distance operator (`<=>`)
- Semantic vectors stored as `VECTOR(5)` for [C, V, I, S, X] axes
- Sub-5ms similarity queries even with 1000+ learned concepts

**Post-MVP Enhancement:**

- Phase 2 introduces optional `all-MiniLM-L6-v2` for automatic 384-dimension embeddings
- Eliminates manual lookup tables, enables synonym recognition ("sword" ≈ "blade")
- Maintains directional (cosine) approach for consistency

---

## Key Architectural Principles

1. **Directional Memory:** Cosine Similarity measures intent/pattern, not magnitude/quantity
2. **Subjectivity First:** All database queries filtered by villagerID — no shared omniscient knowledge
3. **Tick Efficiency:** Fast Gear executes in <5ms; Slow Gear is fully asynchronous
4. **Memory Safety:** Never store Entity references — always fetch via `world.getEntity(id)`
5. **Invisible by Default:** Internal processing is silent unless `DEBUG_MODE = true`
6. **Graceful Degradation:** Falls back to hardcoded "Instinct" if backend/LLM fails

---

## Development Conventions

### Code Style

- **Functional Programming:** Prefer pure functions over classes
- **JSDoc Required:** All functions must have type-annotated documentation
- **File Size Limit:** Maximum 500 lines per file for AI navigability
- **Naming:** camelCase for functions/variables, PascalCase for constants
- **Memory Safety:** Store entity IDs, not entity objects

### File Naming

- **Script API:** `layer1_sensory.js`, `vector_math.js` (snake_case)
- **Backend:** `pool.js`, `brain_scheduler.js` (snake_case)
- **Docs:** `project-overview.md` (kebab-case)

### Error Handling

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
  throw err;
}
```

---

## Communication Flow

### Fast → Slow Gear (HTTP POST)

```javascript
// Script API sends episode data to backend
http.post("http://localhost:3000/api/memory/episode", {
  body: JSON.stringify({ villagerID, episodeSummary }),
});
```

### Slow → Fast Gear (Polling)

```javascript
// Script API polls for LLM-generated intents
http
  .get(`http://localhost:3000/api/brain/poll?villagerID=${villagerID}`)
  .then((response) => {
    if (response.body.status === "ready") {
      executeIntent(response.body.intentPacket);
    }
  });
```

---

## DEBUG_MODE

**Enable in-game:**

```javascript
world.setDynamicProperty("DEBUG_MODE", true);
```

**Enable in backend (.env):**

```env
DEBUG_MODE=true
LOG_LEVEL=debug
```

**Features:**

- Console logging of all HTTP requests/responses
- Live vector stream monitoring
- CRUD operations on villager data
- Manual LLM inference triggers
- Force episode sealing

---

## Documentation Reference

| Document              | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `project-overview.md` | High-level vision & 7-layer architecture        |
| `tech-stack.md`       | Technology choices, best practices, limitations |
| `interaction-flow.md` | Complete user flow with data packet examples    |
| `project-rules.md`    | Directory structure & naming conventions        |

---

## Performance Benchmarks

### Database (PostgreSQL + pgvector)

- Single INSERT: 5-15ms
- Batched Transaction: 20-40ms
- SELECT (indexed): 1-5ms
- Vector Similarity (cosine): 1-5ms (1K concepts), 5-15ms (10K concepts)

### Network (@minecraft/server-net)

- POST `/api/memory/episode`: 50-150ms
- GET `/api/brain/poll`: 5-20ms

### LLM (llama.cpp)

- 7B Model (Q4_K_M): 1-3 seconds
- 13B Model (Q4_K_M): 3-8 seconds

### Tick Budget

- Fast Gear: 2-5ms per villager per event
- Target Load (10 villagers): ~10% of 50ms tick budget

---

## Scaling Limits

**Current stack supports:**

- 20-30 active villagers (limited by LLM sequential processing)
- 100-200 HTTP requests/sec
- 100-200 database writes/sec

**To scale beyond 30 villagers:**

- Use smaller/faster LLM model
- Reduce inference frequency (only on high-priority events)
- Batch LLM requests with shared context
- Distribute multiple llama.cpp instances

---

## Getting Started

### Prerequisites

- Minecraft Bedrock Dedicated Server 1.26+
- Node.js 18+
- PostgreSQL 18+ (14+ recommended)
- **pgvector extension** (required for cosine similarity)
- llama.cpp with compatible model (7B+ recommended)

### Setup

See `_docs_v2/tech-stack.md` for current setup notes (and update this README when adding a dedicated setup guide).

---

**Document Type:** Project README  
**Author:** KiwiQuan
**Version:** 1.0  
**Last Updated:** Feb 26, 2026
