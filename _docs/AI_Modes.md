# 🔀 AI Modes — MONOLITHIC vs. MICROSERVICES

## Overview

The Immersive Villager AI supports **two runtime-switchable architectures** that can be toggled in-game without server restart or schema changes. Both modes coexist in the codebase simultaneously.

**Toggle Command (In-Game):**
```
/scriptevent ai:toggle_mode microservices
/scriptevent ai:toggle_mode monolithic
```

**Backend Endpoint:**
```
GET  /api/config/ai_mode      (returns current mode)
POST /api/config/ai_mode      (sets mode: "MONOLITHIC" | "MICROSERVICES")
```

---

## Mode Comparison

| Aspect | MONOLITHIC | MICROSERVICES |
|--------|-----------|--------------|
| **Vector Dimension** | 5D [C, V, I, S, X] | 384D MiniLM embedding |
| **Vectorization** | Manual math lookup | `Xenova/all-MiniLM-L6-v2` |
| **Intent Classification** | LLM-based | `Xenova/distilbert-base-uncased-mnli` |
| **Entity Recognition** | LLM-based | `Xenova/bert-base-multilingual-cased-ner-slavic` |
| **Episode Summarization** | Manual labeling | `Xenova/t5-small` |
| **Structure Recognition** | Spatial hashing | MiniLM semantic vectors |
| **LLM Responsibilities** | Full reasoning + dialogue + labeling + planning | Dialogue + complex planning only |
| **Performance (Fast Gear)** | <5ms per event | <20ms per event |
| **Performance (Slow Gear)** | 2-4s (LLM) | 50-200ms (Transformers.js) + 2-4s (LLM) |
| **Memory Usage** | ~5GB (LLM only) | ~6-7GB (LLM + Transformers.js models) |
| **Complexity** | Simple, transparent | Modular, scalable |

---

## MONOLITHIC Mode (Current/MVP)

### Architecture

The LLM (llama.cpp) handles **all cognitive tasks**:
- Event labeling ("What is Steve doing?")
- Intent classification ("Is this aggression or trading?")
- Dialogue generation ("What should I say?")
- Episode summarization ("Summarize these 20 events")
- Structural pattern naming ("What kind of building is this?")

### Vector Flow (5D Manual)

```
Raw Event → Vector Rules Lookup → [C, V, I, S, X] → Episode Average → LLM Context
```

**Example:**
```javascript
// Player places diamond block
const event = { type: 'placeBlock', blockType: 'diamond_block', actor: 'Steve' };

// Manual vectorization (Layer 2)
const vector = {
  C: +0.8,  // Placing = constructive
  V: +0.9,  // Diamond = high value
  I: +0.3,  // Slow placement = low intensity
  S: +0.1,  // Solo activity = slightly social
  X: +0.1   // Simple block = low complexity
};

// LLM receives: "Steve placed a diamond block [C:0.8, V:0.9, I:0.3, S:0.7, X:0.1]. How do you respond?"
```

### Pros
- **Transparent:** Easy to debug (human-readable vectors)
- **Lightweight:** No model loading overhead (<5ms per event)
- **Deterministic:** Same input = same vector
- **Low Memory:** Only LLM loaded (~5GB)

### Cons
- **LLM Overload:** LLM handles too many responsibilities (slow inference)
- **Limited Semantics:** 5D vectors can't capture complex relationships
- **Manual Tuning:** Requires hand-tuning V/I/X values for every block type
- **No Generalization:** Can't infer "stone wall" is similar to "cobblestone wall"

---

## MICROSERVICES Mode (Post-MVP Enhancement)

### Architecture

Specialized small models ("Lego Parts") handle **specific cognitive tasks**, offloading work from the LLM:

| Task | Model | Input | Output | Latency |
|------|-------|-------|--------|---------|
| **Vectorization** | `Xenova/all-MiniLM-L6-v2` | Text description | 384D embedding | <20ms |
| **Intent Classification** | `Xenova/distilbert-base-uncased-mnli` | Event context | Intent label + confidence | <50ms |
| **Entity Recognition** | `Xenova/bert-base-multilingual-cased-ner-slavic` | Player chat | Extracted entities (block types, items) | <30ms |
| **Episode Summarization** | `Xenova/t5-small` | Raw event log | 1-sentence summary | <100ms |

**LLM (llama.cpp) responsibilities reduced to:**
- Complex social reasoning
- Personality-driven dialogue
- High-level planning

### Vector Flow (384D Semantic)

```
Raw Event → Text Description → MiniLM Embedding → Episode Average → LLM Context
```

**Example:**
```javascript
// Player places diamond block
const event = { type: 'placeBlock', blockType: 'diamond_block', actor: 'Steve' };

// Generate text description
const description = 'Steve placed a high-value decorative block near the villager home';

// MiniLM vectorization (Layer 2)
const embedding = await generateEmbedding(description);  // 384D vector: [0.12, 0.45, -0.32, ...]

// T5-small summarizes episode
const summary = await summarizeEpisode(['Steve placed 3 diamond blocks', 'Steve placed 2 gold blocks']);
// Output: "Steve decorated the area with valuable blocks"

// LLM receives: "Steve decorated the area with valuable blocks. Your trust with Steve is 0.8. How do you respond?"
```

### Pros
- **Semantic Understanding:** 384D vectors capture complex relationships
- **Generalization:** Recognizes "stone wall" ≈ "cobblestone wall" (92% similarity)
- **LLM Efficiency:** LLM only handles dialogue and complex reasoning
- **Fast Routing:** High-confidence intents (aggression, trading) bypass LLM entirely
- **NER Support:** Extracts block types from player commands ("Build a wall out of cobblestone")

### Cons
- **Higher Latency:** 20-50ms per event (vs. <5ms in MONOLITHIC)
- **More Memory:** +1-2GB for Transformers.js models
- **Model Loading:** 5-10 second startup delay
- **Less Transparent:** 384D vectors are not human-readable

---

## Layer-by-Layer Comparison

### Layer 2: Perception

**MONOLITHIC:**
```javascript
function calculateVector(event) {
  return {
    C: vectorRules[event.type].C,
    V: vectorRules[event.blockType].V,
    I: calculateIntensity(event),
    S: calculateSociality(event),
    X: vectorRules[event.blockType].X
  };
}
```

**MICROSERVICES:**
```javascript
async function calculateVector(event) {
  const description = buildEventDescription(event);
  const embedding = await vectorEngine.generateEmbedding(description);
  return { embedding, description };
}
```

---

### Layer 3: Brain Sequencer

**MONOLITHIC:**
- Groups vectors into episodes by averaging [C, V, I, S, X]
- Matches episodes to concepts via cosine similarity on 5D vectors
- Sends raw vector to LLM for labeling if no match found

**MICROSERVICES:**
- Groups vectors into episodes by averaging 384D embeddings
- **Fast Intent Routing:** `distilbert-base-uncased-mnli` classifies intent
  - Labels: `["aggression", "trading", "building", "asking_question", "idling"]`
  - High-confidence intents (>0.8) bypass LLM entirely
  - Low-confidence intents still go to LLM for reasoning
- Matches episodes via semantic similarity on 384D embeddings

**Fast Intent Routing Example:**
```javascript
const intent = await classifyIntent('Why are you following me?');
// Returns: { label: 'asking_question', confidence: 0.92 }

if (intent.confidence > 0.8) {
  if (intent.label === 'aggression') {
    return { action: 'flee', target: actorID };
  } else if (intent.label === 'trading') {
    return { action: 'open_trade', target: actorID };
  } else if (intent.label === 'asking_question') {
    // Route to LLM for dialogue
    sendToLLM(villagerID, actorID);
  }
}
```

---

### Layer 5: Long-Term Memory

**MONOLITHIC:**
- Stores episodes with `semantic_vector_manual` (5D)
- Queries use: `ORDER BY semantic_vector_manual <=> $1::vector(5)`

**MICROSERVICES:**
- Stores episodes with `semantic_vector_minilm` (384D) + `summary_text`
- Queries use: `ORDER BY semantic_vector_minilm <=> $1::vector(384)`
- T5-small generates summaries: `"Steve collected wood and began construction"`

---

### Layer 6: Language Cortex

**MONOLITHIC Responsibilities:**
- Event labeling ("Mining", "Building", "Spleef")
- Intent classification (aggression, trading, asking)
- Dialogue generation
- Episode summarization
- Structural pattern naming
- Complex social reasoning

**MICROSERVICES Responsibilities:**
- Dialogue generation (only)
- Complex social reasoning (only)
- High-level planning (only)

**Performance Impact:**
```
MONOLITHIC LLM call:
  - Context: 300-500 tokens (vectors + episodes + relationships)
  - Inference: 2-4 seconds

MICROSERVICES LLM call:
  - Context: 150-250 tokens (summaries + relationships)
  - Inference: 1-2 seconds (shorter context = faster)
```

---

## Structure Recognition Comparison

### MONOLITHIC Mode: Spatial Hashing

**Process:**
1. Villager observes block placement sequence
2. Generate spatial hash: `oak_plank:0:0:0|oak_plank:0:1:0|oak_plank:0:2:0`
3. Check `structure_templates` table for matching `pattern_hash`
4. If match: Recognize template (instant)
5. If no match: Create new template entry

**Pros:**
- Exact matching (100% accuracy)
- No model inference overhead
- Deterministic recognition

**Cons:**
- No generalization (stone wall ≠ cobblestone wall)
- Requires exact block type match
- Can't recognize rotated/mirrored structures without explicit variants

**Example:**
```javascript
function generateSpatialHash(blockSequence) {
  return blockSequence
    .map(b => `${b.type}:${b.x}:${b.y}:${b.z}`)
    .join('|');
}

// Villager sees: oak_plank at (0,0,0), (0,1,0), (0,2,0)
// Hash: "oak_plank:0:0:0|oak_plank:0:1:0|oak_plank:0:2:0"
```

---

### MICROSERVICES Mode: Semantic Vectors (MiniLM)

**Process:**
1. Villager observes block placement sequence
2. Generate text description: "A vertical pillar of 3 oak planks"
3. Generate MiniLM embedding (384D vector)
4. Check `structure_templates` table via cosine similarity
5. If similarity > 0.92: Recognize as variant of known template
6. If no match: Create new template with embedding

**Pros:**
- Generalization (stone wall 92% similar to cobblestone wall)
- Rotation/mirror invariant (description captures intent)
- Works with unknown block types (modded blocks)

**Cons:**
- Slower recognition (~20ms model inference)
- Approximate matching (may mis-classify rare structures)
- Requires text description generation

**Example:**
```javascript
async function recognizeStructure(blockSequence) {
  const description = generateStructureDescription(blockSequence);
  // "A vertical pillar of 3 oak planks"
  
  const embedding = await vectorEngine.generateEmbedding(description);
  
  // Query database for similar structures
  const result = await pool.query(
    'SELECT id, label, embedding <=> $1::vector(384) AS similarity FROM structure_templates ORDER BY embedding <=> $1::vector(384) LIMIT 1',
    [`[${embedding.join(',')}]`]
  );
  
  if (result.rows.length > 0 && result.rows[0].similarity > 0.92) {
    return { recognized: true, template: result.rows[0] };
  }
  
  return { recognized: false };
}
```

---

## Toggle Implementation

### Backend Configuration Router

**File:** `nodeDB/routes/config_router.js`

```javascript
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let currentAIMode = process.env.AI_MODE || 'MONOLITHIC';
let currentDebugMode = process.env.DEBUG_MODE === 'true';

/**
 * GET current AI_MODE configuration
 */
router.get('/ai_mode', (req, res) => {
  res.json({
    status: 'success',
    ai_mode: currentAIMode,
    timestamp: Date.now()
  });
});

/**
 * POST toggle AI_MODE between MONOLITHIC and MICROSERVICES
 */
router.post('/ai_mode', (req, res) => {
  const { mode } = req.body;
  
  if (!['MONOLITHIC', 'MICROSERVICES'].includes(mode)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid mode. Must be MONOLITHIC or MICROSERVICES'
    });
  }
  
  const previousMode = currentAIMode;
  currentAIMode = mode;
  
  logger.info({ previousMode, newMode: mode }, '[Config] AI_MODE toggled');
  
  res.json({
    status: 'success',
    previous_mode: previousMode,
    current_mode: currentAIMode,
    timestamp: Date.now()
  });
});

/**
 * GET current DEBUG_MODE configuration
 */
router.get('/debug_mode', (req, res) => {
  res.json({
    status: 'success',
    debug_mode: currentDebugMode,
    timestamp: Date.now()
  });
});

/**
 * POST toggle DEBUG_MODE
 */
router.post('/debug_mode', (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid value. enabled must be boolean'
    });
  }
  
  const previousState = currentDebugMode;
  currentDebugMode = enabled;
  
  // Update Pino log level dynamically
  if (enabled) {
    logger.level = 'debug';
  } else {
    logger.level = 'info';
  }
  
  logger.info({ previousState, newState: enabled }, '[Config] DEBUG_MODE toggled');
  
  res.json({
    status: 'success',
    previous_state: previousState,
    current_state: currentDebugMode,
    timestamp: Date.now()
  });
});

module.exports = { router, getAIMode: () => currentAIMode, getDebugMode: () => currentDebugMode };
```

---

### Script API Toggle Commands

**File:** `scripts/commands/config_commands.js`

```javascript
import { world, system } from '@minecraft/server';
import { http } from '@minecraft/server-net';

/**
 * Register in-game commands for toggling AI_MODE and DEBUG_MODE
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const { id, message, sourceEntity } = event;
  
  if (id === 'ai:toggle_mode') {
    const mode = message.toUpperCase();
    
    if (!['MONOLITHIC', 'MICROSERVICES'].includes(mode)) {
      world.sendMessage('§c[AI] Invalid mode. Use: monolithic or microservices');
      return;
    }
    
    http.post('http://localhost:3000/api/config/ai_mode', {
      body: JSON.stringify({ mode }),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
      const data = JSON.parse(response.body);
      world.sendMessage(`§a[AI] Mode switched: ${data.previous_mode} → ${data.current_mode}`);
    })
    .catch(err => {
      world.sendMessage('§c[AI] Failed to toggle mode: ' + err.message);
    });
  }
  
  if (id === 'ai:toggle_debug') {
    const enabled = message.toLowerCase() === 'true';
    
    http.post('http://localhost:3000/api/config/debug_mode', {
      body: JSON.stringify({ enabled }),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
      const data = JSON.parse(response.body);
      world.sendMessage(`§a[AI] DEBUG_MODE: ${data.current_state}`);
      world.setDynamicProperty('DEBUG_MODE', enabled);
    })
    .catch(err => {
      world.sendMessage('§c[AI] Failed to toggle debug: ' + err.message);
    });
  }
});
```

---

## Transformers.js Models (MICROSERVICES Mode)

### Model Initialization

**File:** `nodeDB/brain/model_loader.js`

```javascript
const { pipeline } = require('@xenova/transformers');
const logger = require('../utils/logger');

let embedder = null;
let intentClassifier = null;
let nerExtractor = null;
let summarizer = null;

/**
 * Initialize all Transformers.js models on server start
 */
async function initializeModels() {
  logger.info('[Model Loader] Loading Transformers.js models...');
  
  try {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    logger.info('[Model Loader] ✓ MiniLM-L6-v2 loaded');
    
    intentClassifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
    logger.info('[Model Loader] ✓ DistilBERT-MNLI loaded');
    
    nerExtractor = await pipeline('token-classification', 'Xenova/bert-base-multilingual-cased-ner-slavic');
    logger.info('[Model Loader] ✓ BERT-NER loaded');
    
    summarizer = await pipeline('summarization', 'Xenova/t5-small');
    logger.info('[Model Loader] ✓ T5-small loaded');
    
    logger.info('[Model Loader] All models ready');
  } catch (err) {
    logger.error({ error: err.message }, '[Model Loader] Failed to load models');
    throw err;
  }
}

module.exports = { initializeModels, embedder, intentClassifier, nerExtractor, summarizer };
```

---

### Vector Engine (MiniLM)

**File:** `nodeDB/brain/vector_engine.js`

```javascript
const { embedder } = require('./model_loader');
const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const { getAIMode } = require('../routes/config_router');

/**
 * Generate a 384D embedding from text using MiniLM.
 * Checks concepts table to avoid redundant inference.
 * @param {string} text - Text description to vectorize
 * @returns {Promise<number[]>} 384D embedding vector
 */
async function generateEmbedding(text) {
  if (getAIMode() !== 'MICROSERVICES') {
    throw new Error('generateEmbedding() only available in MICROSERVICES mode');
  }
  
  // Check if concept already exists (cache via concepts table)
  const cached = await pool.query(
    'SELECT semantic_vector_minilm FROM concepts WHERE name = $1',
    [text]
  );
  
  if (cached.rows.length > 0 && cached.rows[0].semantic_vector_minilm) {
    logger.debug({ text }, '[Vector Engine] Using cached embedding from concepts table');
    return JSON.parse(cached.rows[0].semantic_vector_minilm);
  }
  
  // Generate new embedding
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  const embedding = Array.from(result.data);
  
  logger.debug({ text, embeddingSize: embedding.length }, '[Vector Engine] Generated new embedding');
  
  return embedding;
}

module.exports = { generateEmbedding };
```

---

### Intent Router (DistilBERT)

**File:** `nodeDB/brain/intent_router.js`

```javascript
const { intentClassifier } = require('./model_loader');
const logger = require('../utils/logger');
const { getAIMode } = require('../routes/config_router');

const INTENT_LABELS = ['aggression', 'trading', 'building', 'asking_question', 'idling'];
const FAST_ROUTE_THRESHOLD = 0.8;

/**
 * Classify intent from event context.
 * High-confidence intents bypass LLM.
 * @param {string} eventDescription - Natural language description of event
 * @returns {Promise<Object>} { label, confidence, shouldBypassLLM }
 */
async function classifyIntent(eventDescription) {
  if (getAIMode() !== 'MICROSERVICES') {
    return { label: 'unknown', confidence: 0, shouldBypassLLM: false };
  }
  
  const result = await intentClassifier(eventDescription, INTENT_LABELS);
  
  const topIntent = result.labels[0];
  const confidence = result.scores[0];
  
  const shouldBypassLLM = confidence > FAST_ROUTE_THRESHOLD && 
                          ['aggression', 'trading'].includes(topIntent);
  
  logger.debug({ 
    intent: topIntent, 
    confidence, 
    shouldBypassLLM 
  }, '[Intent Router] Intent classified');
  
  return { label: topIntent, confidence, shouldBypassLLM };
}

module.exports = { classifyIntent };
```

---

### Episode Summarizer (T5-small)

**File:** `nodeDB/brain/episode_summarizer.js`

```javascript
const { summarizer } = require('./model_loader');
const logger = require('../utils/logger');
const { getAIMode } = require('../routes/config_router');

/**
 * Summarize a list of raw event strings into a 1-sentence memory.
 * @param {string[]} eventStrings - List of raw events
 * @returns {Promise<string>} Condensed summary
 */
async function summarizeEpisode(eventStrings) {
  if (getAIMode() !== 'MICROSERVICES') {
    return eventStrings.join(', ');
  }
  
  const rawText = eventStrings.join('. ');
  
  const result = await summarizer(rawText, {
    max_length: 30,
    min_length: 10,
    do_sample: false
  });
  
  const summary = result[0].summary_text;
  
  logger.debug({ rawEventCount: eventStrings.length, summary }, '[Episode Summarizer] Episode summarized');
  
  return summary;
}

module.exports = { summarizeEpisode };
```

---

### NER Extractor (BERT Slavic NER)

**File:** `nodeDB/brain/ner_extractor.js`

```javascript
const { nerExtractor } = require('./model_loader');
const logger = require('../utils/logger');
const { getAIMode } = require('../routes/config_router');

/**
 * Extract entities (block types, item names) from player chat.
 * Example: "Build a wall out of cobblestone" → ["wall", "cobblestone"]
 * @param {string} chatMessage - Player's chat message
 * @returns {Promise<Object>} { structures: [], materials: [] }
 */
async function extractEntities(chatMessage) {
  if (getAIMode() !== 'MICROSERVICES') {
    return { structures: [], materials: [] };
  }
  
  const entities = await nerExtractor(chatMessage);
  
  const structures = entities
    .filter(e => e.entity_group === 'MISC' || e.entity_group === 'LOC')
    .map(e => e.word.toLowerCase());
  
  const materials = entities
    .filter(e => e.entity_group === 'OBJ')
    .map(e => e.word.toLowerCase());
  
  logger.debug({ chatMessage, structures, materials }, '[NER Extractor] Entities extracted');
  
  return { structures, materials };
}

module.exports = { extractEntities };
```

---

## Performance Targets

### MONOLITHIC Mode

| Layer | Operation | Target Latency |
|-------|-----------|---------------|
| Layer 2 | Manual vectorization | <1ms |
| Layer 3 | Episode averaging | <0.5ms |
| Layer 6 | LLM inference | 2-4s |
| **Total Fast Gear** | **<5ms** |

---

### MICROSERVICES Mode

| Layer | Operation | Model | Target Latency |
|-------|-----------|-------|---------------|
| Layer 2 | Semantic vectorization | MiniLM | <20ms |
| Layer 3 | Intent classification | DistilBERT | <50ms |
| Layer 3 | Episode summarization | T5-small | <100ms |
| Layer 6 | LLM inference (reduced) | Llama.cpp | 1-2s |
| **Total Fast Gear** | | | **<20ms** |

**Key Insight:** Fast Gear is slightly slower in MICROSERVICES mode (+15ms), but Slow Gear is much faster (1-2s vs. 2-4s) due to reduced LLM context.

---

## When to Use Each Mode

### Use MONOLITHIC When:
- Debugging vector calculations (human-readable 5D vectors)
- Testing MVP without model dependencies
- Running on low-memory systems (<6GB RAM)
- Prioritizing Fast Gear performance (<5ms)
- Exact matching is sufficient (no need for generalization)

### Use MICROSERVICES When:
- Need semantic understanding (generalization across similar structures)
- Want fast intent routing (bypass LLM for simple actions)
- Have sufficient RAM (6-7GB) and CPU
- Building complex structures (rotation/mirror invariance)
- Need NER for player command parsing

---

## Migration Path

**Phase 0-1 (MVP):** Build with MONOLITHIC mode only  
**Phase 2:** Add MICROSERVICES mode support (dual vector columns)  
**Phase 3:** Default to MICROSERVICES, keep MONOLITHIC as fallback

---

## Dependencies

### MONOLITHIC Mode
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "pino": "^8.14.1",
    "axios": "^1.4.0",
    "dotenv": "^16.3.1"
  }
}
```

### MICROSERVICES Mode (Additional)
```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.0"
  }
}
```

**Model Download:** On first run, `@xenova/transformers` automatically downloads models (~500MB-1GB total) to `~/.cache/huggingface/`.

---

## Configuration File

**File:** `nodeDB/.env`

```env
# AI Mode Configuration
AI_MODE=MONOLITHIC          # MONOLITHIC | MICROSERVICES
DEBUG_MODE=false            # true | false

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=immersive_villagers
DB_USER=minecraft_ai
DB_PASSWORD=secure_password

# LLM
LLAMA_URL=http://localhost:8080
LLAMA_TIMEOUT=10000

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

---

**Document Type:** Architecture Reference  
**Phase:** Phase 2+  
**Status:** Ready for Implementation  
**Version:** 1.0  
**Last Updated:** Mar 3, 2026
