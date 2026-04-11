# 🔄 Interaction Flow — Villager Brain Journey

> **Purpose:** Defines the complete data and execution flow through the 7-layer villager brain architecture. This document serves as the blueprint for implementing the cognitive pipeline and designing UI debug modal elements.

---

## 1. High-Level Architecture Flow

### System Overview

The villager brain operates as a unidirectional data pipeline with two execution gears:

- **Fast Gear (Layers 1-4):** High-frequency operations running on the Bedrock Script API (every 0.5-1s)
- **Slow Gear (Layers 5-7):** Low-frequency operations running on Node.js backend (every 2-5s)

### Execution Modes

The system supports two runtime-switchable AI architectures:

- **MONOLITHIC Mode:** Manual 5-axis vectors [C, V, I, S, X], full LLM cognitive load
- **MICROSERVICES Mode:** 384D semantic embeddings, distributed cognition with small models

### Storage Hierarchy

Data flows through three persistence layers with decreasing access frequency:

1. **In-Memory Cache (`trackedVillagers` Map):** O(1) access, proximity-independent, primary runtime storage
2. **DynamicProperties:** Backup persistence for script reloads, write-only from cache
3. **PostgreSQL:** Authoritative source, synced periodically (1s intervals)

---

## 2. Layer-by-Layer Interaction Flow

### Layer 1: Sensory Input (The Retina)

**Purpose:** Filter the massive stream of game events into perceivable sensations.

**Input Sources:**
- **Passive Stream:** `world.afterEvents` (reactive event listeners)
- **Active Stream:** `system.runInterval` polling (visual scans, proprioception)

**Processing Pipeline:**

```
Raw Game Event
    ↓
[Proximity Gate] → Within 32 blocks of AI villager?
    ↓ YES
[Transmission Check] → Audio (omnidirectional) OR Visual (LOS + angle check)?
    ↓ PASS
[Priority Filter] → P0 (Critical) | P1 (High) | P2 (Low)
    ↓
Retina Packet (JSON) → Send to Layer 2
```

**Output Format (Retina Packet):**

```javascript
{
  header: {
    v_id: "villager_uuid_001",
    timestamp: 16400,
    channel: "visual" | "audio" | "internal",
    priority: 0 | 1 | 2
  },
  body: {
    type: "block_break",
    actor: "player_uuid",
    subject: "minecraft:diamond_ore",
    location: [102, 64, -205],
    metadata: {
      is_critical: false,
      tool_used: "minecraft:iron_pickaxe"
    }
  }
}
```

**Execution Frequency:**
- Event handling: Immediate (reactive)
- Visual/internal polling: Every 10 ticks (500ms)
- Priority throttle update: Every 20 ticks (1000ms)

**Debug Modal Data:**
- Last 10 filtered events per villager
- Dropped event count by priority level
- Current sensory load (events/second)

---

### Layer 2: Perception (The Vectorizer)

**Purpose:** Convert raw game data into semantic vectors representing the "meaning" of an event.

**Input:** `FilteredEventContext` (Retina Packet from Layer 1)

**Processing Pipeline (AI Mode Dependent):**

#### MONOLITHIC Mode: 5-Axis Manual Vector

```
Retina Packet
    ↓
[Lookup Base Values] → vectorRules[blockType] or default
    ↓
[Territory Calculation] → isNearHome? Apply 1.5x multiplier to V, I
    ↓
[Sociality Calculation] → Determine friendly vs hostile based on eventType
    ↓
5D Vector: { C, V, I, S, X }
    ↓
Semantic Frame → Send to Layer 3
```

**Performance:** <1ms per event

#### MICROSERVICES Mode: 384D Semantic Embedding

```
Retina Packet
    ↓
[Generate Description] → buildEventDescription(context)
    ↓
[Backend Call] → http.post('/api/vector/embed')
    ↓
[MiniLM Processing] → Xenova/all-MiniLM-L6-v2 generates 384D vector
    ↓
384D Embedding + Description
    ↓
Semantic Frame → Send to Layer 3
```

**Performance:** <20ms per event (including cache check and HTTP round-trip)

**Output Format (Semantic Frame):**

**MONOLITHIC:**
```javascript
{
  v_id: "villager-456",
  vector: { C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1 },
  timestamp: 1709480325000,
  context: "placeBlock",
  actorID: "player-steve"
}
```

**MICROSERVICES:**
```javascript
{
  v_id: "villager-456",
  embedding: [0.12, 0.45, -0.32, ...],  // 384D vector
  description: "Steve placed a high-value decorative block near the villager home",
  timestamp: 1709480325000,
  context: "placeBlock",
  actorID: "player-steve"
}
```

**Debug Modal Data:**
- Last 5 vectorized events per villager
- Current vector values (5D or 384D visualization)
- Backend API call latency (MICROSERVICES mode only)
- Description generation log (MICROSERVICES mode only)

---

### Layer 3: Sequencer (Temporal Learning)

**Purpose:** Group vectors into meaningful temporal patterns (Sub-Concepts) and detect repeating behaviors (Macro-Concepts).

**Input:** Stream of Semantic Frames from Layer 2

**Processing Pipeline (Two-Tier Buffer):**

#### Tier A: Sub-Concept Identification (30s Window)

```
Semantic Frame Stream
    ↓
[Moving Average Calculator] → Calculate avg vector over 30s window
    ↓
[Stability Check] → Variance in C and I low for >10s?
    ↓ YES (Stable Pattern Detected)
[AI Mode Branch]
    ↓
┌───────────────────────┬───────────────────────┐
│   MONOLITHIC Mode     │  MICROSERVICES Mode   │
├───────────────────────┼───────────────────────┤
│ [DB Lookup]           │ [Semantic Similarity] │
│ Cosine Similarity     │ Compare embedding to  │
│ against concepts      │ concepts table        │
│ table                 │                       │
│    ↓                  │    ↓                  │
│ Match Found?          │ Match Found?          │
│    ↓ NO               │    ↓ NO               │
│ [LLM Labeling]        │ [Fast Clustering]     │
│ "What is player       │ Automatic semantic    │
│ doing?"               │ label from embedding  │
│    ↓                  │    ↓                  │
│ Cache to DB           │ Cache to DB           │
└───────────────────────┴───────────────────────┘
    ↓
Sub-Concept Label (e.g., "Mining")
    ↓
Push to Tier B
```

**Performance:**
- MONOLITHIC: <1ms calculation + 2-4s LLM (if new concept)
- MICROSERVICES: <20ms calculation + <100ms clustering

#### Tier B: Macro-Concept Detection (10m Window)

```
Sub-Concept Label Stream
    ↓
[Chronological Buffer] → Store sequence: ["Mining", "Falling", "Chatting", ...]
    ↓
[Pattern Recognition] → Detect repeating sequences (3+ repetitions)
    ↓ PATTERN FOUND
[Macro-Concept Flagging] → New behavior identified
    ↓
[Social Identification] → Ask player or LLM to name the activity (e.g., "Spleef")
    ↓
Macro-Concept Label
    ↓
Store in concepts table + Episode Summary → Send to Layer 4
```

#### Fast Intent Routing (MICROSERVICES Mode Only)

When AI_MODE is MICROSERVICES, an Intent Router provides immediate responses for high-confidence simple intents:

```
Event Description (from Layer 2)
    ↓
[DistilBERT Classifier] → Xenova/distilbert-base-uncased-mnli
    ↓
Intent Classification: { label, confidence }
    ↓
[Confidence Check] → confidence > 0.8?
    ↓ YES
[Route Decision]
    ↓
┌─────────────┬─────────────┬─────────────┐
│ aggression  │  trading    │ questioning │
│ → FLEE      │  → TRADE    │ → LLM       │
│ (bypass)    │  (bypass)   │ (no bypass) │
└─────────────┴─────────────┴─────────────┘
    ↓
Fast Intent Packet OR Route to Layer 6
```

**Performance Impact:**
- Fast-routed intents: 50-150ms (bypass 2-4s LLM)
- Accuracy: 95%+ for simple intents
- Fallback: Low confidence → LLM

**Output Format (Episode Summary):**

```javascript
{
  v_id: "villager-456",
  episodeLabel: "Mining",
  avgVector: { C: 0.7, V: 0.8, I: 0.4, S: 0.6, X: 0.2 },  // MONOLITHIC
  embedding: [0.23, -0.45, ...],  // MICROSERVICES (384D)
  duration: 30000,  // milliseconds
  eventCount: 15,
  actorID: "player-steve",
  timestamp: 1709480325000
}
```

**Debug Modal Data:**
- Current Tier A buffer (moving average, stability status)
- Current Tier B sequence (last 20 Sub-Concept labels)
- Detected patterns (Macro-Concepts)
- Intent classification results (MICROSERVICES mode)
- Fast routing decisions (bypassed vs LLM-routed)

---

### Layer 4: Working Memory (The Conscious State)

**Purpose:** Track the villager's immediate context, active focus, and emotional state. Acts as the "conscious notepad" for real-time decision-making.

**Input:** Episode Summary from Layer 3

**Storage Architecture:**

```
Episode Summary
    ↓
[In-Memory Cache Update] → trackedVillagers.set(v_id, workingMemoryObj)
    ↓
[Sync Flags] → Mark needsDPSync + needsDBSync
    ↓
┌─────────────────────┬─────────────────────┐
│  In-Range Sync      │  Periodic DB Sync   │
│  → DynamicProperties│  → PostgreSQL       │
│  (when entity nearby)│ (every 1s)         │
└─────────────────────┴─────────────────────┘
```

**Working Memory Object Structure:**

```javascript
{
  v_id: "villager-456",
  currentEpisode: "Playing Spleef with Steve",
  activeFocus: { type: "entity", id: "player-steve" },
  flashbulbEvents: [
    { type: "entityHurt", damage: 5, timestamp: 1709480300000, decayTime: 600000 }
  ],
  currentMoodVector: { C: 0.3, V: 0.5, I: 0.7, S: 0.8, X: 0.4 },
  currentEmbedding: [0.12, 0.34, ...],  // MICROSERVICES mode
  lastUpdate: 1709480325000,
  needsDPSync: true,
  needsDBSync: true
}
```

**Processing Pipeline:**

```
Episode Summary
    ↓
[Update Working Memory] → Merge new episode with existing state
    ↓
[Decay Calculator] → Remove expired flashbulb events based on intensity
    ↓
[Saliency Filter] → Calculate Memorability Score (M)
    ↓
M = (w1 * |I|) + (w2 * |V|) + (w3 * |S|) + (w4 * X)
    ↓
[Promotion Decision] → M > threshold?
    ↓ YES
Memory Record → Queue for Layer 5 (Database Write)
    ↓ NO
Discard (Stay in Working Memory only)
```

**Saliency Rules (4 Promotion Triggers):**

1. **Impact Rule:** Intensity (I) or Value (V) > 0.8 or < -0.8
2. **Relationship Rule:** Sociality (S) shifts significantly (Δ > 0.3)
3. **Learning Rule:** New Macro-Concept identified by Layer 3
4. **Habit Rule:** Low-impact activity lasts >5 minutes → Save summary

**Decay System:**

- **Neutral/Positive Contexts:** 2-3 minute decay
- **High-Intensity/Negative Contexts:** 10+ minute decay

**Execution Frequency:**
- Cache updates: Every 1-2 seconds
- Decay calculations: Every 5 seconds
- Database sync: Every 1 second (if needsDBSync flag set)
- DynamicProperties sync: When entity in range + needsDPSync flag

**Debug Modal Data (Primary Focus):**
- **Current Working Memory State:**
  - Current episode label
  - Active focus (entity/block being observed)
  - Flashbulb events (with decay timers)
  - Current mood vector (5D or 384D)
  - Last update timestamp
- **Saliency Metrics:**
  - Current Memorability Score (M)
  - Promotion trigger history (which rules fired)
  - Pending database write queue
- **Sync Status:**
  - Cache → DP sync status
  - Cache → DB sync status
  - Last successful sync timestamps

---

### Layer 5: Long-Term Memory (The Personal Archive)

**Purpose:** Provide persistent, subjective memory storage for each villager. Enables relationship tracking, episode recall, and personality development.

**Input:** Memory Records from Layer 4 (post-Saliency Filter)

**Database Schema:**

```
villagers                  → Core identity (villager_id, name, home coordinates, profession)
concepts                   → Semantic signatures with dual vectors (5D manual + 384D MiniLM)
villager_discoveries       → Tracks which concepts each villager has learned
episodes                   → Historical events with dual vectors + summary_text
relationships              → Per-player trust scores and interaction counts
working_memory             → Current mood vectors (dual: manual + MiniLM) and focus state
structure_templates        → Building patterns (pattern_hash + 384D embedding + instructions)
structure_blueprints       → High-level assembly guides (composition + functional_zones)
villager_world_map         → Subjective spatial memory (known structure locations)
build_tasks                → Active building queue (status, progress, trigger)
pattern_observations       → Real-time structure learning (block sequences)
```

**Key Schema Features:**
- **Dual Vector Support:** All vector columns exist in pairs (`semantic_vector_manual` VECTOR(5) + `semantic_vector_minilm` VECTOR(384))
- **pgvector Indexes:** `ivfflat` indexes with `vector_cosine_ops` for fast similarity queries
- **Subjective Isolation:** All queries filtered by `villager_id` for strict knowledge separation
- **Structure System:** Three-tier architecture (observations → templates → blueprints)
- **Performance:** Indexed on timestamp DESC for efficient recent-episode queries

**Write Pipeline:**

```
Memory Record (from Layer 4)
    ↓
[Summarization] → T5-small (MICROSERVICES) or raw text (MONOLITHIC)
    ↓
[Reputation Update] → Calculate trust score delta based on Sociality (S)
    ↓
NewTrust = OldTrust + (EpisodeSociality * VillagerTraitModifier)
    ↓
[Database Write] → INSERT into episodes + UPDATE relationships
    ↓
Async Confirmation → Log write success/failure
```

**Read Pipeline (Context Retrieval Trigger):**

```
Player Enters Sensory Radius (Layer 1)
    ↓
[Memory Sweep Query]
    ↓
Step 1: Query relationships → Get trust_score, interaction_count, last_interaction
Step 2: Query episodes → Get 3 most recent interactions with player (ORDER BY timestamp DESC LIMIT 3)
Step 3: Query villager_discoveries → Get learned concepts for context
    ↓
[Package Context] → Assemble IdentityContext object
    ↓
IdentityContext → Send to Layer 6
```

**IdentityContext Format:**

```javascript
{
  villager_id: "villager-456",
  actorID: "player-steve",
  relationship: {
    trustScore: 0.75,
    interactionCount: 12,
    lastInteraction: 1709480000000
  },
  recentEpisodes: [
    { 
      conceptName: "Spleef",
      avgVectorManual: { C: 0.3, V: 0.5, I: 0.7, S: 0.8, X: 0.4 },
      avgVectorMiniLM: [0.12, 0.34, ...],  // 384D (MICROSERVICES mode)
      summaryText: "Played competitive mining game",  // T5-small summary
      duration: 300000,
      timestamp: 1709480000000
    },
    { conceptName: "Trading", duration: 60000, timestamp: 1709479000000 },
    { conceptName: "Building", duration: 180000, timestamp: 1709478000000 }
  ],
  discoveredConcepts: [
    { name: "Spleef", discoveredAt: 1709400000000, method: "observation" },
    { name: "Mining", discoveredAt: 1709300000000, method: "observation" }
  ]
}
```

**Implementation Rules:**
- **Subjectivity Filter:** All queries filtered by `villager_id` (strict isolation)
- **Async Operations:** Non-blocking database writes
- **Vector Similarity:** Use pgvector's Cosine Similarity (`<=>`) for concept matching via ivfflat indexes
- **Knowledge Isolation:** Villagers must have entry in `villager_discoveries` before using concept labels

**Execution Frequency:**
- Context retrieval: When player enters 32-block radius (triggered by Layer 1)
- Episode writes: After Saliency Filter passes (asynchronous)
- Relationship updates: After every significant social interaction

**Debug Modal Data:**
- **Relationship Matrix:**
  - All tracked players with trust scores
  - Interaction counts and last-seen timestamps
- **Episode History:**
  - Last 10 stored episodes with labels, vectors, durations
  - Concept discovery timeline
- **Query Performance:**
  - Database query latency
  - In-memory cache hit/miss rates (trackedVillagers Map)
  - Pending write queue depth

---

### Layer 6: Language Cortex (The Executive)

**Purpose:** High-level reasoning, dialogue generation, and decision-making. Responsibilities vary by AI mode.

**Input:** IdentityContext from Layer 5 + Active Working Memory from Layer 4

**Processing Pipeline (AI Mode Dependent):**

#### MONOLITHIC Mode: Full Cognitive Load

```
IdentityContext + Working Memory
    ↓
[Build LLM Prompt] → Include raw vectors, relationship data, personality
    ↓
[Scheduler Queue] → Submit to Brain Scheduler with priority score
    ↓
[LLM Inference] → llama.cpp processes request
    ↓
[Parse Response] → Extract THOUGHT, SPEECH, ACTION from structured output
    ↓
NarrativePacket → Send to Layer 7
```

**Prompt Structure (MONOLITHIC):**

```
You are Villager [Name]. You are observing Player [ActorID].

Recent Activity (Vectors):
- Episode 1: C=0.8, V=0.9, I=0.3, S=0.7, X=0.1 (duration: 30s, events: 5)
- Episode 2: C=-0.6, V=0.2, I=0.8, S=-0.3, X=0.0 (duration: 10s, events: 3)

Your Relationship with Player [ActorID]:
- Trust Score: 0.75
- Interaction Count: 12

Your Personality: Grumpy, Sarcastic, Protective

Based on this, generate a JSON response:
{
  "action": "speak|pathfind|build|idle",
  "speechText": "Your response",
  "internalMonologue": "Your thoughts"
}
```

**Token Count:** 400-500 tokens  
**Inference Time:** 2-4 seconds

---

#### MICROSERVICES Mode: Dialogue & Complex Reasoning Only

```
IdentityContext + Working Memory
    ↓
[Check Fast Intent Result] → Did Layer 3 bypass LLM?
    ↓ NO (Complex intent or dialogue needed)
[Build Simplified Prompt] → Include summaries (not raw vectors)
    ↓
[Scheduler Queue] → Submit with priority score
    ↓
[LLM Inference] → llama.cpp for dialogue only
    ↓
[Parse Response] → Extract SPEECH, THOUGHT
    ↓
NarrativePacket → Send to Layer 7
```

**Prompt Structure (MICROSERVICES):**

```
You are Villager [Name]. You are observing Player [ActorID].

Recent Activity (Summaries):
- "Steve decorated the area with valuable blocks" (30s ago)
- "Steve broke dirt blocks aggressively" (1m ago)

Your Relationship with Player [ActorID]:
- Trust Score: 0.75

Your Personality: Grumpy, Sarcastic, Protective

Respond naturally.
```

**Token Count:** 200-300 tokens  
**Inference Time:** 1-2 seconds

**Why MICROSERVICES is Faster:**
- Pre-summarized by T5-small (no raw vectors)
- Intent already classified by DistilBERT
- Reduced context size (250 tokens vs 500 tokens)

---

**Output Format (NarrativePacket):**

```javascript
{
  v_id: "villager-456",
  thought: "Steve is breaking my floor again, but he seems to be playing that 'Spleef' game. I'm not mad, just tired.",
  speech: "You're going to have to shovel all this back when we're done, Steve!",
  action: "speak",
  actionParams: { animation: "laugh", duration: 5000 },
  timestamp: 1709480325000,
  aiMode: "MICROSERVICES"
}
```

**Execution Frequency:**
- Request submission: When new episode detected or player interacts
- Scheduler processing: FIFO queue with priority re-sorting
- LLM execution: 1 concurrent call (configurable)
- Response delivery: 1-4 seconds after submission (mode dependent)

**Debug Modal Data:**
- **LLM Context:**
  - Current prompt sent to LLM
  - Token count
  - Inference time
- **Scheduler State:**
  - Queue depth (pending requests)
  - Current processing priority
  - Last 5 completed requests
- **Response Parsing:**
  - Raw LLM output
  - Parsed NarrativePacket
  - Parsing errors (if any)

---

### Layer 7: Action Layer (The Body)

**Purpose:** Execute physical actions in Minecraft based on Layer 6 decisions. Translates high-level intents into Script API commands.

**Input:** NarrativePacket from Layer 6

**Action Dictionary:**

| Keyword | Bedrock API | Result |
|---------|-------------|--------|
| `TALK(msg)` | `world.sendMessage()` | Sends chat message |
| `APPROACH(target)` | Pathfinding API | Paths toward entity |
| `ANIMATE(id)` | `entity.playAnimation()` | Plays animation |
| `STARE(target)` | `entity.lookAt()` | Locks head rotation |
| `FLEE()` | Pathfinding API | Paths away from threat |
| `IDLE()` | `entity.stopMoving()` | Stops all movement |
| `BUILD(structure)` | Structure API | Executes learned build |

**Processing Pipeline:**

```
NarrativePacket
    ↓
[Command Parser] → Extract ACTION keyword and parameters
    ↓
[In-Memory Task State Update] → Store current task in trackedVillagers
    ↓
{
  currentTask: { action: "approach", target: "player-steve", startTime: ... },
  isMoving: true,
  targetBlock: null,
  isBuilding: false
}
    ↓
[Script API Execution] → Execute corresponding Bedrock command
    ↓
[Feedback Loop] → Monitor task completion
    ↓
┌───────────┬───────────┐
│  Success  │  Failure  │
│  ↓        │  ↓        │
│  Update   │  Trigger  │
│  Layer 4  │  Layer 6  │
│  State    │  Rethink  │
└───────────┴───────────┘
```

**Task State Management:**

Task metadata stored in in-memory cache (not DynamicProperties) for instant access:

```javascript
taskState: {
  currentAction: "approach",
  targetEntity: "player-steve",
  startTime: 1709480325000,
  status: "in_progress" | "completed" | "failed",
  failureReason: null,
  pathBlocked: false
}
```

**Feedback Triggers:**

- **Success:** Goal reached → Update Layer 4 → Continue idle behavior
- **Failure:** Path blocked → Trigger Layer 6 rethink → Generate workaround
- **P0 Override:** Villager takes damage → Immediate FLEE, bypass current command

**Idle Behavior (Micro-Expressions):**

Runs in background when no active command:

- **Grumpy Trait:** `look_away` or `cross_arms` every 30s
- **Friendly Trait:** Maintain 3-block proximity, frequent `look_at` head tracking
- **Curious Trait:** Random head rotation toward nearby entities

**Execution Frequency:**
- Command execution: Immediate (upon receiving NarrativePacket)
- Pathfinding updates: Every tick (50ms)
- Feedback checks: Every 10 ticks (500ms)
- Idle behavior: Every 20-40 ticks (1-2s)

**Debug Modal Data:**
- **Current Task State:**
  - Active action keyword
  - Target entity/block
  - Task duration
  - Completion status
- **Command History:**
  - Last 10 executed actions
  - Success/failure rates
  - Failure reasons
- **Pathfinding Status:**
  - Current path (if moving)
  - Path blocked status
  - Distance to target

---

### Brain Scheduler (Infrastructure Layer)

**Purpose:** Manage LLM request queue to prevent gridlock and optimize processing for multiple villagers.

**Input:** "Intent to Think" requests from Layers 3, 6, or 7

**Request Priority Scoring:**

| Category | Score | Trigger | Fallback Behavior |
|----------|-------|---------|-------------------|
| CRITICAL | 100 | Damage, fire, explosion | Immediate FLEE (instinct) |
| SOCIAL | 70 | Player chat, trade | IDLE + LookAt |
| NOVELTY | 40 | New pattern detected | Continue observing |
| ROUTINE | 10 | Farming, walking, idle | Standard NPC behavior |

**Processing Pipeline:**

```
Intent Request { v_id, priority, context }
    ↓
[Queue Insertion] → Add to FIFO queue
    ↓
[Priority Re-Sort] → If Score 100, move to front
    ↓
[Batching Check] → Multiple villagers observing same event?
    ↓ YES
[Deduplication] → Collapse into single "Collective Perception" packet
    ↓
[LLM Execution] → Process 1 request at a time (configurable)
    ↓
[Broadcast] → Distribute result to all requesting villagers
    ↓
Response → Return to requesting layer
```

**Batching Rules:**

1. **Spatial Batching:** If 3+ villagers within 10 blocks observe same event
2. **Temporal Batching:** Events within 500ms window considered "same"
3. **Deduplication:** Hash event context to identify duplicates
4. **Individual Storage:** Broadcast result stored in each villager's private DB

**Execution Frequency:**
- Queue processing: Continuous (as requests arrive)
- Batching window: 500ms
- Concurrent LLM calls: 1 (default, configurable)
- Priority re-evaluation: Every 100ms

**Debug Modal Data:**
- **Queue Status:**
  - Current queue depth
  - Priority distribution (P0, P1, P2 counts)
  - Average wait time per priority
- **Batching Analytics:**
  - Batch efficiency (requests saved)
  - Active batches in progress
- **LLM Performance:**
  - Current inference time
  - Average inference time by mode
  - Request throughput (requests/second)

---

## 3. Feature-Specific Interaction Journeys

### Feature A: Player Dialogue System

**Trigger:** Player sends chat message near villager

**Complete Flow:**

```
1. [Layer 1: Sensory]
   Player types in chat → Chat event detected
   ↓
   Proximity check: Player within 32 blocks?
   ↓ YES
   Priority: P1 (SOCIAL)
   ↓
   Retina Packet → { type: "chat", actor: player_id, message: "Hello!" }

2. [Layer 2: Perception]
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Lookup chat vector: │ Generate embedding: │
   │ { C: 0, V: 0,       │ "Steve said: Hello!"│
   │   I: 0.2, S: 0.9,   │ → 384D vector       │
   │   X: 0 }            │                     │
   └─────────────────────┴─────────────────────┘
   ↓
   Semantic Frame

3. [Layer 3: Sequencer]
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Moving avg: High S  │ DistilBERT:         │
   │ → Label: "Greeting" │ Intent: "greeting"  │
   │                     │ Confidence: 0.92    │
   │                     │ → NO BYPASS (needs  │
   │                     │    dialogue)        │
   └─────────────────────┴─────────────────────┘
   ↓
   Episode: "Greeting from Steve"

4. [Layer 4: Working Memory]
   Update cache:
   {
     currentEpisode: "Greeting from Steve",
     activeFocus: { type: "entity", id: "player-steve" },
     currentMoodVector: { S: 0.9, I: 0.2, ... }
   }
   ↓
   Saliency Check: M = high S → PASS
   ↓
   Queue for Layer 5 write

5. [Layer 5: Long-Term Memory]
   Query relationships:
   - trust_score: 0.75 (existing)
   - interaction_count: 12
   - last_interaction: 2 hours ago
   ↓
   Query recent episodes (ORDER BY timestamp DESC LIMIT 3):
   - Last played Spleef together
   - Previous trade 3 days ago
   ↓
   Package IdentityContext

6. [Layer 6: Language Cortex]
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Full prompt:        │ Simplified prompt:  │
   │ - Raw vectors       │ - "Steve greeted"   │
   │ - Trust: 0.75       │ - Trust: 0.75       │
   │ - Personality       │ - Personality       │
   │ → LLM (2-4s)        │ → LLM (1-2s)        │
   └─────────────────────┴─────────────────────┘
   ↓
   NarrativePacket:
   {
     thought: "Steve hasn't visited in a while. Nice to see him.",
     speech: "Oh, it's you again. What do you want this time?",
     action: "speak"
   }

7. [Layer 7: Action Layer]
   Parse action: "speak"
   ↓
   Execute: world.sendMessage()
   ↓
   Update task state: { currentAction: "speak", status: "completed" }
   ↓
   Feedback to Layer 4: Success
```

**Total Latency:**
- MONOLITHIC: ~2.5-4.5 seconds (event → response)
- MICROSERVICES: ~1.5-2.5 seconds (event → response)

---

### Feature B: Structure Learning System

**Trigger:** Player builds near villager

**Complete Flow:**

```
1. [Layer 1: Sensory]
   Player places blocks → Multiple placeBlock events
   ↓
   Proximity: Within 32 blocks
   Visual check: LOS confirmed
   ↓
   Retina Packets → Stream of block placement events

2. [Layer 2: Perception]
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Each block:         │ Each block:         │
   │ { C: 0.8,           │ "Steve placed oak   │
   │   V: 0.5,           │  planks forming a   │
   │   I: 0.3,           │  vertical pillar"   │
   │   S: 0.6,           │ → 384D embedding    │
   │   X: 0.1 }          │                     │
   └─────────────────────┴─────────────────────┘
   ↓
   Semantic Frames (stream)

3. [Layer 3: Sequencer]
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Tier A:             │ Tier A:             │
   │ - High C stability  │ - Semantic cluster: │
   │ - Label: "Building" │   "Building"        │
   │ Tier B:             │ Tier B:             │
   │ - No repetition yet │ - Generate summary: │
   │                     │   "Steve built a    │
   │                     │   3x3x3 structure"  │
   └─────────────────────┴─────────────────────┘
   ↓
   Episode: "Building" + Block coordinates

4. [Structure Recognition Module] (Parallel to Layer 4)
   Collect block cluster → 3x3x3 region
   ↓
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Spatial Hash:       │ Semantic Vector:    │
   │ "oak:0:0:0|oak:0:1: │ "A vertical pillar  │
   │  0|oak:0:2:0"       │  of 3 oak planks"   │
   │ → Store as pattern  │ → Generate 384D     │
   │                     │   embedding         │
   └─────────────────────┴─────────────────────┘
   ↓
   Store observation:
   INSERT INTO pattern_observations (villager_id, pattern_hash, block_sequence, observation_timestamp)
   ↓
   When pattern confirmed (seen 3+ times):
   INSERT INTO structure_templates (label, pattern_hash, embedding, instructions, dimensions, created_by)

5. [Layer 4: Working Memory]
   Update cache:
   {
     currentEpisode: "Watching Steve Build",
     activeFocus: { type: "block_cluster", coords: [...] },
     learnedStructure: "template_001"
   }
   ↓
   Saliency: High C + Long duration → PASS
   ↓
   Queue for Layer 5

6. [Layer 5: Long-Term Memory]
   Write structure pattern to DB
   ↓
   UPDATE structure_templates SET observation_count = observation_count + 1 WHERE id = 1
   ↓
   Write to subjective world map:
   INSERT INTO villager_world_map (villager_id, structure_id, anchor_x, anchor_y, anchor_z, last_observed)
   VALUES ('villager-456', 1, 100, 64, -200, 1709480325000)
   ↓
   Update concepts: "Building" concept reinforced in episodes table

7. [Layer 6: Language Cortex] (Optional - if player asks)
   Player: "Did you see what I built?"
   ↓
   Query structure_templates table → Find template WHERE id = 1
   ↓
   LLM prompt: "Describe what Steve built based on: Oak Pillar (1x3x1 oak planks)"
   ↓
   Response: "I saw you build a nice pillar! Looks sturdy."

8. [Layer 7: Action Layer]
   Execute: TALK("I saw you build a nice pillar! Looks sturdy.")
   ↓
   Optional: ANIMATE("celebrate")
```

**Total Latency:**
- Structure recognition: <100ms (spatial hash or embedding generation)
- Database write: <50ms (async)
- Dialogue response (if triggered): 1-4s (mode dependent)

---

### Feature C: Autonomous Building Execution

**Trigger:** Villager decides to build (via Layer 6 planning) or player commands via chat

**Complete Flow:**

```
1. [Layer 6: Language Cortex] (Decision Point)
   Context: "I need to build shelter" or Player says "Build me a house"
   ↓
   LLM Decision:
   {
     action: "build",
     actionParams: { structureID: "pattern_005", location: [100, 64, -200] }
   }
   ↓
   NarrativePacket → Layer 7

2. [Layer 7: Action Layer]
   Parse: BUILD(template_id=5)
   ↓
   Query Layer 5: Fetch structure_templates WHERE id = 5
   ↓
   Response: { 
     label: "Oak Pillar",
     pattern_hash: "oak:0:0:0|oak:0:1:0|oak:0:2:0",
     instructions: { blocks: [...] },
     dimensions: { x: 1, y: 3, z: 1 }
   }
   ↓
   Create build task:
   INSERT INTO build_tasks (villager_id, template_id, anchor_x, anchor_y, anchor_z, status, total_steps, trigger_source)
   VALUES ('villager-456', 5, 100, 64, -200, 'in_progress', 3, 'ai_decision')

3. [Build Execution Module] (Layer 7 subsystem)
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ Spatial Hash Match: │ Semantic Match:     │
   │ Exact block coords  │ Flexible material   │
   │ Rigid materials     │ substitution        │
   └─────────────────────┴─────────────────────┘
   ↓
   For each block in instructions.blocks:
   {
     1. Pathfind to block location
     2. Place block via Script API
     3. Update progress:
        UPDATE build_tasks SET current_step = current_step + 1 WHERE id = [task_id]
     4. If material missing → Query inventory
        ↓ MISSING
        [Layer 6 Rethink] → "I need oak planks"
        ↓
        [Layer 7 Action] → APPROACH(player) + TALK("Do you have oak planks?")
   }

4. [Layer 4: Working Memory] (Progress Tracking)
   Update cache:
   {
     currentTask: "building",
     buildProgress: { currentStep: 5, totalSteps: 27, templateID: 5, taskID: 42 },
     isBuilding: true
   }

5. [Completion Feedback]
   All blocks placed
   ↓
   Update database:
   UPDATE build_tasks SET status = 'completed', completed_at = 1709480625000 WHERE id = 42
   ↓
   Increment build counter:
   UPDATE structure_templates SET observation_count = observation_count + 1 WHERE id = 5
   ↓
   Update Layer 4 cache: { isBuilding: false, currentTask: null }
   ↓
   [Layer 6 Trigger] → Generate completion dialogue
   ↓
   [Layer 7 Action] → TALK("Done! How does it look?") + ANIMATE("celebrate")
```

**Total Latency:**
- Template query: <50ms
- Build task creation: <20ms
- Per-block placement: 1-2 seconds (pathfinding + placement)
- Complete structure (27 blocks): 27-54 seconds
- Material shortage rethink: +2-4s (LLM inference)
- Database updates (async): <50ms per operation

---

### Feature D: Relationship & Trust Evolution

**Trigger:** Any significant social interaction (trade, gift, attack, promise)

**Complete Flow:**

```
1. [Layer 1-3: Standard Pipeline]
   Social event detected → Vectorized → Episode labeled
   ↓
   High Sociality (S) value detected (|S| > 0.7)

2. [Layer 4: Working Memory]
   Current mood updated:
   { currentMoodVector: { S: 0.9, ... } }  // Positive interaction
   ↓
   Saliency Filter: Relationship Rule triggered (|ΔS| > 0.3)
   ↓
   Promotion: PASS → Queue for Layer 5

3. [Layer 5: Long-Term Memory]
   Calculate trust delta:
   ↓
   NewTrust = OldTrust + (EpisodeSociality * TraitModifier)
   ↓
   Example:
   - OldTrust: 0.45
   - EpisodeSociality: +0.9 (gift received)
   - TraitModifier: 0.8 (friendly behavior pattern)
   - NewTrust: 0.45 + (0.9 * 0.8) = 1.17 → Capped at 1.0
   ↓
   Update relationships table (trust_score, interaction_count)
   ↓
   Insert episode record with summary and vectors

4. [Layer 6: Language Cortex] (Next Interaction)
   Query Layer 5 → Retrieve updated trust_score (1.0)
   ↓
   LLM Prompt:
   "Your relationship with Steve: Trust Score 1.0 (Max). Interaction count: 13. He recently gave you diamonds."
   ↓
   Generated Response:
   {
     thought: "Steve has been so kind. I trust him completely now.",
     speech: "Thank you so much, Steve! You're truly a friend.",
     action: "speak"
   }

5. [Layer 7: Action Layer]
   Execute: TALK("Thank you so much...") + ANIMATE("celebrate")
   ↓
   Optional: APPROACH(steve) to close distance (Friendly trait)
```

**Trust Score Boundaries:**
- Range: -1.0 (enemy) to +1.0 (best friend)
- Thresholds:
  - `< -0.5`: Hostile (villager may flee or call iron golem)
  - `-0.5 to 0.0`: Distrustful
  - `0.0 to 0.5`: Neutral
  - `0.5 to 0.8`: Friendly
  - `> 0.8`: Loyal (villager may gift items or defend player)

**Total Latency:**
- Trust calculation: <10ms
- Database update: <50ms (async)
- Dialogue response (next interaction): 1-4s (mode dependent)

---

### Feature E: Episode Recognition & Learning

**Trigger:** Player performs repetitive behavior (e.g., Spleef - mine, fall, mine, fall)

**Complete Flow:**

```
1. [Layer 3: Sequencer - Tier A] (First Observation)
   Vector stream: High C (mining) → Label: "Mining"
   ↓
   Store in Tier B buffer

2. [Layer 3: Sequencer - Tier A] (Second Event)
   Vector stream: High I, low C (falling) → Label: "Falling"
   ↓
   Store in Tier B buffer

3. [Layer 3: Sequencer - Tier B] (Pattern Detection)
   Buffer state: ["Mining", "Falling", "Mining", "Falling", "Mining", "Falling"]
   ↓
   Pattern Recognition: Sequence ["Mining", "Falling"] repeats 3 times
   ↓
   Macro-Concept Flag: NEW PATTERN DETECTED

4. [Layer 6: Language Cortex] (Labeling Request)
   ┌─────────────────────┬─────────────────────┐
   │   MONOLITHIC        │   MICROSERVICES     │
   ├─────────────────────┼─────────────────────┤
   │ LLM Prompt:         │ Alternative:        │
   │ "Player is doing:   │ Ask player directly │
   │  Mining, Falling,   │ via chat:           │
   │  Mining, Falling.   │ "What are you doing?"│
   │  What is this       │ Player: "Playing    │
   │  activity called?"  │  Spleef!"           │
   │ → LLM: "Spleef"     │ → Cache label       │
   └─────────────────────┴─────────────────────┘
   ↓
   Store in concepts table with semantic vectors
   ↓
   Record discovery in villager_discoveries table

5. [Layer 5: Long-Term Memory]
   Write episode record with new concept reference and summary

6. [Future Recognition]
   Player plays Spleef again (weeks later)
   ↓
   Layer 3: Pattern detected → Query concepts
   ↓
   Match found: "Spleef"
   ↓
   Layer 6: Use learned label in dialogue
   "Oh, are we playing Spleef again? I remember this!"
```

**Learning Persistence:**
- Concept permanently stored in villager's private DB
- Immediate recognition on future occurrences
- No LLM labeling needed after first discovery

---

## 4. Cross-Cutting Concerns

### A. Cache-First Pattern (Storage Hierarchy)

**Write Flow:**
1. Update in-memory cache (`trackedVillagers` Map)
2. Set sync flags (`needsDPSync`, `needsDBSync`)
3. Async handlers sync to DynamicProperties (if entity nearby) and PostgreSQL (every 1s)

**Read Flow:**
1. Check in-memory cache (O(1) access, <1ms)
2. If missing: Load from DynamicProperties → Populate cache
3. Background sync from PostgreSQL for authoritative data

**Benefits:** Proximity-independent access, no "Invalid Entity" errors, automatic persistence

---

### B. AI Mode Toggle Flow

**Trigger:** Player executes `/scriptevent ai:mode <monolithic|microservices>`

**Effect:**
- Backend updates AI_MODE environment variable
- Layer 2 switches embedding strategy (5D manual vs. 384D MiniLM)
- Layer 3 switches intent routing (DB lookup vs. DistilBERT)
- Layer 6 adjusts LLM prompt structure
- Hot-swap at runtime, no restart required (~100ms latency)

---

### C. Instinct Fallback System (Error Resilience)

**Trigger:** Backend unresponsive, LLM timeout, or network failure (>5s)

**Fallback Behaviors by Priority:**
- **P0 (Critical):** Immediate FLEE from danger
- **P1 (Social):** IDLE + STARE at player (active listening)
- **P2 (Routine):** Continue last successful action or wander

**Recovery:** Background retry every 10s until backend reconnects

---

## 5. Debug Modal Architecture

### Modal Structure (Recommended UI Layout)

```
┌─────────────────────────────────────────────────────┐
│ 🧠 Villager Brain Inspector                        │
│ [Villager Selector: dropdown ▼] [AI Mode: MICRO]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│ │ Working     │  │ Long-Term   │  │ Current     │ │
│ │ Memory      │  │ Memory      │  │ Task        │ │
│ └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [Layer Timeline Visualization]                      │
│  L1 → L2 → L3 → L4 → L5 → L6 → L7                  │
│  ✓    ✓    ⏳   ✓    -    ⏳   -                   │
└─────────────────────────────────────────────────────┘
```

### Panel 1: Working Memory (Layer 4) — PRIMARY FOCUS

**Data to Expose:**
- Current episode label
- Active focus (entity/location)
- Emotional state (mood vector + derived label)
- Flashbulb events (recent shocks with decay timers)
- Sync status (cache, DynamicProperties, database)

**Data Source:** Primary source is in-memory cache (`trackedVillagers` Map). Database used for verification or after script reload.

**UI Representation:**
- Current episode as large heading
- Mood vector as radar chart (5 axes for MONOLITHIC, 384D PCA projection for MICROSERVICES)
- Flashbulb events as timeline with decay bars
- Sync status as indicator lights (green = synced, yellow = pending, red = failed)

---

### Panel 2: Long-Term Memory (Layer 5) — PRIMARY FOCUS

**Data to Expose:**
- Relationships (trust scores, interaction counts, timestamps)
- Episode history (recent interactions with summaries)
- Learned concepts (discovered patterns and labels)
- Learned structures (observed building patterns)
- Known structure locations (subjective world map)

**UI Representation:**
- Relationship list with trust score bars (color-coded by trust level)
- Episode timeline (scrollable, last 20 episodes)
- Concept word cloud (size = usage frequency)
- Structure gallery (3D preview thumbnails)
- World map view (known structure locations)

---

### Panel 3: Current Task (Layer 7)

**Data to Expose:**
- Current action (type, target, status, timing)
- Pathfinding status (movement, path, distance)
- Building status (active pattern, progress)
- Action history (last 5 completed actions)

**UI Representation:**
- Current action as status badge with progress indicator
- Pathfinding visualization (2D minimap with path line)
- Action history as vertical timeline
- Building progress bar (if isBuilding with current_step/total_steps)

---

### Layer Status Indicators

Visual indicators for each layer's current state:

| Layer | Indicator | Meaning |
|-------|-----------|---------|
| **L1** | 🟢 Green pulse | Events being filtered (active) |
| **L2** | 🔵 Blue pulse | Vectors being calculated |
| **L3** | 🟡 Yellow pulse | Pattern detection in progress |
| **L4** | 🟣 Purple solid | Working Memory stable |
| **L5** | 🟠 Orange pulse | Database read/write |
| **L6** | 🔴 Red pulse | LLM inference running |
| **L7** | 🟢 Green solid | Action executing |

---

## 6. Data Flow Summary Diagrams

### Complete Event-to-Action Flow (Integrated View)

```
┌─────────────────────────────────────────────────────────────┐
│                    MINECRAFT GAME EVENT                     │
│              (Player breaks block near villager)            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 1: SENSORY (Fast Gear - 500ms)                      │
│ • Proximity check (32 blocks)                             │
│ • LOS validation                                           │
│ • Priority assignment (P0/P1/P2)                           │
│ → Retina Packet                                            │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 2: PERCEPTION (Fast Gear - <1ms MONO / <20ms MICRO) │
│ ┌─────────────────────┬────────────────────┐              │
│ │  MONOLITHIC         │  MICROSERVICES     │              │
│ │  5-axis vector      │  384D embedding    │              │
│ │  { C, V, I, S, X }  │  + description     │              │
│ └─────────────────────┴────────────────────┘              │
│ → Semantic Frame                                           │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 3: SEQUENCER (Fast Gear - 1-2s)                     │
│ • Tier A: Moving average → Sub-Concept label              │
│ • Tier B: Pattern detection → Macro-Concept               │
│ ┌─────────────────────┬────────────────────┐              │
│ │  MONOLITHIC         │  MICROSERVICES     │              │
│ │  Cosine similarity  │  DistilBERT intent │              │
│ │  DB lookup          │  Fast routing      │              │
│ └─────────────────────┴────────────────────┘              │
│ → Episode Summary (+ Fast Intent if MICRO)                │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 4: WORKING MEMORY (Fast Gear - <2ms)                │
│ • Update in-memory cache (trackedVillagers)               │
│ • Calculate Memorability Score (M)                         │
│ • Saliency Filter: Promote to Layer 5?                    │
│ • Set sync flags (needsDPSync, needsDBSync)               │
│ → Memory Record (if promoted)                              │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 5: LONG-TERM MEMORY (Slow Gear - <50ms async)       │
│ • Query relationships (trust score, interaction count)    │
│ • Query recent episodes (last 3 interactions)             │
│ • Write new episode (async, non-blocking)                 │
│ • Update trust score based on Sociality                    │
│ → IdentityContext                                          │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ BRAIN SCHEDULER (Infrastructure)                           │
│ • Priority queue management                                │
│ • Spatial batching (3+ villagers, same event)             │
│ • LLM concurrency control (1 active call)                 │
│ → Route to Layer 6                                         │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 6: LANGUAGE CORTEX (Slow Gear - 1-4s)               │
│ ┌─────────────────────┬────────────────────┐              │
│ │  MONOLITHIC         │  MICROSERVICES     │              │
│ │  Full prompt        │  Simplified prompt │              │
│ │  (500 tokens)       │  (250 tokens)      │              │
│ │  • Raw vectors      │  • Summaries       │              │
│ │  • Action planning  │  • Dialogue only   │              │
│ │  • Labeling         │  • Pre-routed      │              │
│ │  2-4s inference     │  1-2s inference    │              │
│ └─────────────────────┴────────────────────┘              │
│ → NarrativePacket                                          │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ LAYER 7: ACTION LAYER (Fast Gear - immediate execution)   │
│ • Parse action keyword (TALK, APPROACH, FLEE, etc.)       │
│ • Update task state in cache                              │
│ • Execute Script API command                               │
│ • Monitor completion → Feedback to Layer 4                │
│ → Physical Action in Game                                  │
└────────────────────────┬───────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                     VISIBLE BEHAVIOR                        │
│           (Villager speaks, moves, or animates)            │
└─────────────────────────────────────────────────────────────┘
```

### Total End-to-End Latency (Event → Action)

**MONOLITHIC Mode:**
- Fast path (cached concept): 2.5-3s
- Slow path (new concept): 4-6s

**MICROSERVICES Mode:**
- Fast path (intent bypassed): 0.5-1s
- Slow path (dialogue needed): 1.5-2.5s

---

## 7. Glossary

**Retina Packet:** JSON object containing filtered sensory input from Layer 1  
**Semantic Frame:** Vector representation of an event from Layer 2  
**Episode Summary:** Grouped vectors with temporal label from Layer 3  
**Working Memory Object:** In-memory cache state for Layer 4  
**Memory Record:** Promoted episode ready for database storage  
**IdentityContext:** Historical context retrieved from Layer 5  
**NarrativePacket:** LLM-generated intent and dialogue from Layer 6  
**Task State:** Current action execution status in Layer 7  
**Fast Gear:** Layers 1-4 (high-frequency, Bedrock Script API)  
**Slow Gear:** Layers 5-7 (low-frequency, Node.js backend)  
**Memorability Score (M):** Saliency calculation for promotion to LTM  
**Cosine Similarity:** Vector comparison metric for concept matching  
**Fast Intent Routing:** MICROSERVICES mode feature for bypassing LLM on simple intents

---

**Document Version:** 1.0  
**Last Updated:** March 14, 2026  
**Related Docs:** `project-overview.md`, `Brain Layers/*.md`
