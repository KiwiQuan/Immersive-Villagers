# 🔄 User Flow: The Interaction Loop

## Overview

This document defines the complete interaction loop between:
- **The Player** (triggering world events)
- **The Villager** (The Agent — processing sensory data and executing actions)
- **The Backend** (The Brain — cognitive processing, memory, and LLM decisioning)

The loop is a continuous cycle where game events flow from the Minecraft world through a 7-layer cognitive pipeline, and resulting actions flow back into the game. All internal processing is **invisible telemetry** unless explicitly surfaced as villager speech or physical actions.

---

## The Complete Loop (High-Level)

```
Player Action
    ↓
[Layer 1: Sensory] ← Game Event Detected
    ↓
[Layer 2: Vectorizer] ← Convert to [C, V, I, S, X]
    ↓
[Layer 3: Sequencer] ← Group into Episodes
    ↓
[Layer 4: Working Memory] ← Update Active State (DynamicProperties)
    ↓
[Layer 5: Long-Term Memory] ← Write to PostgreSQL (via HTTP POST)
    ↓
[Brain Scheduler] ← Queue LLM Request (Infrastructure)
    ↓
[Layer 6: Language Cortex] ← LLM Generates Intent (llama.cpp)
    ↓
[Layer 7: Action Layer] ← Poll for IntentPacket & Execute
    ↓
Villager Executes Action (Pathfind, Speak, Build)
    ↓
Player Observes Result
    ↓
(Loop Repeats)
```

---

## Stage 1: Sensory Input (Layer 1 → Layer 2)

### Trigger
A player performs an action in the game world:
- Places a block
- Breaks a block
- Chats in the game
- Walks near a villager
- Hits an entity
- Opens a container

### Layer 1: Sensory (Retina) — Event Filtering

**Location:** Script API (Fast Gear)  
**Frequency:** Every tick (50ms)

**Process:**
1. Script API event listeners (e.g., `world.afterEvents.playerPlaceBlock.subscribe()`) capture raw game events.
2. **Spatial Filter:** Check if event occurred within the villager's awareness radius (e.g., 32 blocks).
3. **Line of Sight (LOS) Filter:** Raycast check to confirm the villager has direct visual access to the event location.
4. **Entity ID Filter:** Ensure the villager is tracking this specific player (not every player on the server).

**Output Packet:**
```json
{
  "type": "FilteredEventContext",
  "eventName": "playerPlaceBlock",
  "actorID": "player-uuid-123",
  "villagerID": "villager-entity-456",
  "coordinates": { "x": 100, "y": 64, "z": -50 },
  "blockType": "minecraft:diamond_block",
  "proximity": 12.5,
  "hasLOS": true,
  "timestamp": 1645564800000
}
```

**Telemetry:** Silent. No player-facing output.

---

## Stage 2: Vectorization (Layer 2 → Layer 3)

### Layer 2: Perception (Vectorizer) — Semantic Encoding

**Location:** Script API (Fast Gear)  
**Frequency:** Triggered by Layer 1 output

**Process:**
1. Receive `FilteredEventContext` from Layer 1.
2. Apply mathematical rules to calculate the 5-axis semantic vector `[C, V, I, S, X]`:
   - **Constructiveness (C):** Placing blocks = +0.8, Breaking blocks = -0.6
   - **Value (V):** Diamond block = +0.9, Dirt = +0.1
   - **Intensity (I):** Quick placement = +0.3, Explosion = +0.9
   - **Sociality (S):** Placing blocks near villager's home = +0.7, Breaking villager's bed = -0.9
   - **Complexity (X):** Placing redstone = +0.8, Placing dirt = +0.1

**Output Packet:**
```json
{
  "type": "SemanticVector",
  "villagerID": "villager-entity-456",
  "actorID": "player-uuid-123",
  "vector": {
    "C": 0.8,
    "V": 0.9,
    "I": 0.3,
    "S": 0.7,
    "X": 0.1
  },
  "rawEvent": "playerPlaceBlock",
  "blockType": "minecraft:diamond_block",
  "timestamp": 1645564800000
}
```

**Telemetry:** Silent. No player-facing output.

---

## Stage 3: Episode Formation (Layer 3 → Layer 4)

### Layer 3: Sequencer (Temporal) — Pattern Grouping

**Location:** Script API (Fast Gear)  
**Frequency:** Continuous accumulation, sealed by triggers

**Process:**
1. Receive `SemanticVector` stream from Layer 2.
2. Append each vector to the current open `Episode` object stored in memory.
3. Calculate running averages of `[C, V, I, S, X]` across all vectors in the episode.
4. Monitor for **Episode Sealing Triggers**:
   - **Context Shift:** New vector differs significantly from episode average (e.g., `C` shifts from +0.7 to -0.8).
   - **Inactivity Timer:** 30 seconds pass with no new vectors.
   - **Manual Seal:** High-intensity event (e.g., player hits villager) forces immediate seal.

5. When sealed, generate an `EpisodeSummary`.

**Output Packet (EpisodeSummary):**
```json
{
  "type": "EpisodeSummary",
  "episodeID": "ep_1645564800_v456",
  "villagerID": "villager-entity-456",
  "actorID": "player-uuid-123",
  "vectorAverage": {
    "C": 0.75,
    "V": 0.82,
    "I": 0.35,
    "S": 0.68,
    "X": 0.15
  },
  "rawVectors": [
    { "C": 0.8, "V": 0.9, "I": 0.3, "S": 0.7, "X": 0.1, "timestamp": 1645564800000 },
    { "C": 0.7, "V": 0.74, "I": 0.4, "S": 0.66, "X": 0.2, "timestamp": 1645564805000 }
  ],
  "duration": 5000,
  "eventCount": 2,
  "sealReason": "context_shift",
  "timestamp": 1645564805000
}
```

**Telemetry:** Silent. No player-facing output.

---

## Stage 4: Working Memory Update (Layer 3 → Layer 4)

### Layer 4: Working Memory — Active Attention State

**Location:** Script API (Fast Gear)  
**Storage:** `DynamicProperties` (instant read/write, survives server restarts)

**Process:**
1. Receive `EpisodeSummary` from Layer 3.
2. Update the villager's **Working Memory** in `DynamicProperties`:
   - `currentFocus`: The player ID the villager is currently attending to.
   - `currentMood`: A weighted average of recent `[C, V, I, S, X]` vectors (e.g., last 3 episodes).
   - `shockState`: Boolean flag for high-intensity events (e.g., taking damage).
   - `lastUpdateTimestamp`: When this state was last modified.

**DynamicProperties Schema:**
```javascript
{
  "wm_currentFocus": "player-uuid-123",
  "wm_currentMood_C": 0.75,
  "wm_currentMood_V": 0.82,
  "wm_currentMood_I": 0.35,
  "wm_currentMood_S": 0.68,
  "wm_currentMood_X": 0.15,
  "wm_shockState": false,
  "wm_lastUpdate": 1645564805000
}
```

**Output:** `ActiveAttentionState` (passed to Layer 5 via HTTP POST).

**Telemetry:** Silent. No player-facing output.

---

## Stage 5: Long-Term Memory Write (Layer 4 → Layer 5)

### Layer 5: Long-Term Memory (LTM) — Identity Storage

**Location:** Node.js Backend (Slow Gear)  
**Storage:** PostgreSQL database  
**Communication:** Script API sends HTTP POST to Node.js endpoint

**Process:**
1. **Script API** sends HTTP POST request to Node.js (e.g., `http://localhost:3000/api/memory/episode`):

```json
{
  "villagerID": "villager-entity-456",
  "actorID": "player-uuid-123",
  "episodeSummary": {
    "episodeID": "ep_1645564800_v456",
    "vectorAverage": { "C": 0.75, "V": 0.82, "I": 0.35, "S": 0.68, "X": 0.15 },
    "duration": 5000,
    "eventCount": 2,
    "sealReason": "context_shift"
  },
  "workingMemory": {
    "currentMood": { "C": 0.75, "V": 0.82, "I": 0.35, "S": 0.68, "X": 0.15 },
    "shockState": false
  }
}
```

2. **Node.js Backend** receives the request and:
   - Validates the villager ID (subjective data filtering).
   - Writes the `EpisodeSummary` to the `episodes` table in PostgreSQL.
   - Updates the `relationships` table (increments interaction count, recalculates trust score based on vector averages).
   - Updates the `villager_identity` table (e.g., if `C` values are consistently high, tag as `loves_building`).

3. **Node.js** returns an immediate HTTP response:

```json
{
  "status": "success",
  "episodeID": "ep_1645564800_v456",
  "relationshipScore": 0.78,
  "identityTags": ["loves_building", "values_diamonds"]
}
```

**Output:** `IdentityContext` (stored in PostgreSQL, returned to Script API).

**Telemetry:** Silent. No player-facing output. (DEBUG_MODE logs HTTP request/response to console.)

---

## Stage 6: LLM Processing (Layer 5 → Layer 6)

### Layer 6: Language Cortex (Executive) — AI Decisioning

**Location:** Node.js Backend (Slow Gear)  
**Intelligence:** llama.cpp (local LLM)  
**Orchestration:** Brain Scheduler (Infrastructure)

**Process:**

#### 6A: Triggering an LLM Request

The Script API can trigger an LLM request via HTTP POST to a dedicated endpoint (e.g., `http://localhost:3000/api/brain/request`):

```json
{
  "villagerID": "villager-entity-456",
  "actorID": "player-uuid-123",
  "trigger": "episode_complete",
  "priority": "medium"
}
```

**Brain Scheduler** receives this request and:
- Adds it to a priority queue (batching multiple requests to optimize LLM throughput).
- Does **not** hold the HTTP connection open (returns immediately with a `requestID`).

**Immediate Response:**
```json
{
  "status": "queued",
  "requestID": "req_1645564805_v456",
  "estimatedWaitTime": 2000
}
```

#### 6B: LLM Inference (Async)

The **Brain Scheduler** processes the queue:
1. Fetches the villager's `IdentityContext` from PostgreSQL:
   - Recent episodes (last 5-10).
   - Relationship score with the player.
   - Personality tags (e.g., `is_brave`, `loves_diamonds`).

2. Constructs an LLM prompt:

```plaintext
You are Villager #456. You have been observing Player #123.

Recent Activity:
- Episode: "Building Session" (C: 0.75, V: 0.82, I: 0.35, S: 0.68, X: 0.15)
- Duration: 5 seconds, 2 events

Your Relationship with Player #123:
- Trust Score: 0.78
- Past Episodes: 12 interactions, mostly constructive

Your Identity:
- Personality: loves_building, values_diamonds

Based on this context, generate a response:
1. Internal Monologue: What are you thinking?
2. Action Intent: What will you do next? (Options: speak, pathfind, build, idle)
3. Speech (if speaking): What will you say to the player?
```

3. Calls llama.cpp via subprocess or HTTP and receives the LLM's response:

```json
{
  "internalMonologue": "This player is building something valuable near me. They seem friendly.",
  "actionIntent": "speak",
  "speechText": "That's a beautiful diamond block! Are you building a house?",
  "actionParams": null
}
```

4. Packages this into an `IntentPacket` and stores it in a **pending queue** (in-memory or Redis):

```json
{
  "requestID": "req_1645564805_v456",
  "villagerID": "villager-entity-456",
  "intentPacket": {
    "action": "speak",
    "speechText": "That's a beautiful diamond block! Are you building a house?",
    "targetPlayerID": "player-uuid-123",
    "priority": "medium"
  },
  "timestamp": 1645564807000,
  "status": "ready"
}
```

**Output:** `IntentPacket` (stored in pending queue, awaiting polling).

**Telemetry:** Silent. No player-facing output. (DEBUG_MODE logs LLM prompt and response to console.)

---

## Stage 7: Action Execution (Layer 6 → Layer 7)

### Layer 7: Action Layer (The Body) — Physical Output

**Location:** Script API (Fast Gear)  
**Frequency:** Polls every 20-40 ticks (1-2 seconds)

**Process:**

#### 7A: Polling for Pending Intents

Every 1-2 seconds, the Script API runs a polling loop:

```javascript
system.runInterval(() => {
  const villagerID = entity.id;
  
  // HTTP GET request to check for pending intents
  http.get(`http://localhost:3000/api/brain/poll?villagerID=${villagerID}`)
    .then(response => {
      if (response.body.status === "ready") {
        executeIntent(response.body.intentPacket);
      }
    })
    .catch(err => {
      console.warn(`[Layer 7] Polling failed: ${err.message}`);
    });
}, 40); // Poll every 40 ticks (2 seconds)
```

**Node.js Response (if intent is ready):**
```json
{
  "status": "ready",
  "intentPacket": {
    "action": "speak",
    "speechText": "That's a beautiful diamond block! Are you building a house?",
    "targetPlayerID": "player-uuid-123"
  }
}
```

**Node.js Response (if no intent is ready):**
```json
{
  "status": "waiting",
  "message": "LLM still processing"
}
```

#### 7B: Intent Execution

When an `IntentPacket` is received, the Action Layer parses the `action` field and executes the corresponding Script API function:

**Action: Speak**
```javascript
const targetPlayer = world.getEntity(intentPacket.targetPlayerID);
if (targetPlayer) {
  targetPlayer.onScreenDisplay.setActionBar(
    `§e[Villager]: ${intentPacket.speechText}`
  );
}
```

**Action: Pathfind**
```javascript
const targetLocation = intentPacket.actionParams.targetCoordinates;
villagerEntity.setDynamicProperty("pathfind_target_x", targetLocation.x);
villagerEntity.setDynamicProperty("pathfind_target_y", targetLocation.y);
villagerEntity.setDynamicProperty("pathfind_target_z", targetLocation.z);
villagerEntity.setDynamicProperty("is_pathfinding", true);

// Pathfinding logic runs in a separate tick loop
```

**Action: Build**
```javascript
const targetBlock = intentPacket.actionParams.blockType;
const targetCoordinates = intentPacket.actionParams.coordinates;

world.getDimension("overworld").runCommand(
  `setblock ${targetCoordinates.x} ${targetCoordinates.y} ${targetCoordinates.z} ${targetBlock}`
);
```

**Action: Idle**
```javascript
// Do nothing; villager remains in current state
```

**Telemetry:** 
- **Visible:** Only `speak` actions surface to the player via on-screen text.
- **Invisible:** Pathfinding, building, and idle actions have no chat spam. Player observes physical changes in the world.

---

## Stage 8: Player Observation → Loop Restart

### Player Observes Result

The player sees:
- **Speech:** On-screen text from the villager (if action was `speak`).
- **Movement:** Villager walking toward a location (if action was `pathfind`).
- **Building:** A new block appearing in the world (if action was `build`).
- **Silence:** No visible change (if action was `idle` or still processing).

The player may react by:
- Placing more blocks → Triggers Layer 1 again.
- Chatting back → Triggers a new `playerChat` event.
- Walking away → Villager's LOS filter stops capturing events.

**The loop continues indefinitely.**

---

## Detailed Data Flow: A Complete Example

### Scenario: Player Places a Diamond Block Near a Villager

#### Timeline

| **Tick** | **Layer**              | **Action**                                                                 | **Telemetry**       |
| -------- | ---------------------- | -------------------------------------------------------------------------- | ------------------- |
| 0        | Player                 | Places diamond block at (100, 64, -50)                                     | Visible (in-game)   |
| 1        | Layer 1 (Sensory)      | Event captured, proximity = 12 blocks, LOS = true                          | Silent              |
| 1        | Layer 2 (Vectorizer)   | Calculates `[C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1]`                      | Silent              |
| 1        | Layer 3 (Sequencer)    | Appends vector to current Episode                                          | Silent              |
| 1        | Layer 4 (Working Mem)  | Updates `DynamicProperties` with new mood values                           | Silent              |
| 2        | Layer 5 (LTM)          | HTTP POST to Node.js → Writes Episode to PostgreSQL                        | Silent (DEBUG logs) |
| 2        | Node.js                | Returns `{ relationshipScore: 0.78, identityTags: ["loves_building"] }`   | Silent (DEBUG logs) |
| 3        | Script API             | HTTP POST to `/api/brain/request` → Requests LLM inference                 | Silent (DEBUG logs) |
| 3        | Brain Scheduler        | Queues request, returns `{ status: "queued", requestID: "req_123" }`      | Silent (DEBUG logs) |
| 4-50     | Brain Scheduler        | LLM processes prompt (llama.cpp)                                           | Silent              |
| 50       | Layer 6 (LLM)          | Generates `IntentPacket: { action: "speak", speechText: "Beautiful!" }`    | Silent (DEBUG logs) |
| 50       | Brain Scheduler        | Stores `IntentPacket` in pending queue                                     | Silent              |
| 80       | Layer 7 (Action Layer) | Polls `/api/brain/poll` → Receives `IntentPacket`                          | Silent (DEBUG logs) |
| 80       | Layer 7 (Action Layer) | Executes `speak` → Displays text to player                                 | **Visible**         |
| 80       | Player                 | Sees villager's speech: "That's a beautiful diamond block!"                | **Visible**         |

---

## Fast Gear vs. Slow Gear: Timing Breakdown

### Fast Gear (Layers 1-4: Script API)
- **Execution Frequency:** Every tick (50ms) or immediate event response.
- **Operations:** Event filtering, vector calculation, episode accumulation, DynamicProperties updates.
- **Goal:** Keep the game running at 20 TPS with zero lag.

### Slow Gear (Layers 5-6: Node.js + LLM)
- **Execution Frequency:** Async, triggered by Script API requests (every 2-5 seconds).
- **Operations:** Database writes, LLM inference, relationship scoring, identity tagging.
- **Goal:** Offload heavy computation to prevent game lag.

### Brain Scheduler (Infrastructure)
- **Role:** Middleware that manages the queue of LLM requests.
- **Optimization:** Batches multiple requests when possible, prioritizes high-intensity events (shocks), deprioritizes idle villagers.
- **Communication:** Does not hold HTTP connections open; uses async processing and polling.

---

## HTTP Communication Patterns

### Pattern 1: Immediate Response (Fast Operations)

**Use Case:** Writing episodes to PostgreSQL, querying recent memory.

**Flow:**
1. Script API sends `POST /api/memory/episode` with `EpisodeSummary`.
2. Node.js writes to PostgreSQL and returns response within 100-300ms.
3. Script API receives response and continues.

**Example:**
```javascript
const response = await http.post("http://localhost:3000/api/memory/episode", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(episodeSummary)
});

const identityContext = JSON.parse(response.body);
console.log(`Relationship Score: ${identityContext.relationshipScore}`);
```

---

### Pattern 2: Polling (Long-Running LLM Operations)

**Use Case:** Waiting for LLM to generate an `IntentPacket`.

**Flow:**
1. Script API sends `POST /api/brain/request` to queue an LLM request.
2. Node.js immediately returns `{ status: "queued", requestID: "req_123" }`.
3. Script API stores `requestID` in `DynamicProperties` and continues.
4. Every 20-40 ticks, Script API polls `GET /api/brain/poll?villagerID=<id>`.
5. When LLM finishes, Node.js returns `{ status: "ready", intentPacket: {...} }`.
6. Script API receives `IntentPacket` and executes the action.

**Example:**
```javascript
// Step 1: Request LLM inference
const queueResponse = await http.post("http://localhost:3000/api/brain/request", {
  body: JSON.stringify({ villagerID, actorID, trigger: "episode_complete" })
});

const { requestID } = JSON.parse(queueResponse.body);
entity.setDynamicProperty("pending_request_id", requestID);

// Step 2: Poll for result (runs every 2 seconds)
system.runInterval(() => {
  const requestID = entity.getDynamicProperty("pending_request_id");
  if (!requestID) return;

  http.get(`http://localhost:3000/api/brain/poll?villagerID=${entity.id}`)
    .then(response => {
      const data = JSON.parse(response.body);
      if (data.status === "ready") {
        executeIntent(data.intentPacket);
        entity.setDynamicProperty("pending_request_id", undefined); // Clear
      }
    });
}, 40);
```

---

## Invisible Telemetry: DEBUG_MODE Control

### Default Mode (DEBUG_MODE = false)
- **Player Experience:** Only sees villager speech (Layer 7 speak action) and physical actions (movement, building).
- **No Spam:** No logs, no debug messages, no system notifications.
- **Performance:** All HTTP requests, vector calculations, and database writes are silent.

### Debug Mode (DEBUG_MODE = true)
- **Console Logging:** Every HTTP request and response logged to Content Log:
  ```
  [DEBUG] [Layer 5] POST /api/memory/episode → 200 OK (125ms)
  [DEBUG] [Layer 6] LLM Inference Started (requestID: req_123)
  [DEBUG] [Layer 7] Polling... → Status: waiting
  [DEBUG] [Layer 7] Polling... → Status: ready
  [DEBUG] [Layer 7] Executing Intent: speak
  ```

- **Debug Modal (Custom UI):** Operator can interact with villager to open a modal showing:
  - **Live State View:** Current `[C, V, I, S, X]` vector and open Episode.
  - **CRUD Operations:** Edit, delete, or refresh database records.
  - **Knowledge Injection:** Manually add concepts/memories to Layer 5.
  - **Brain Control:** Force-trigger LLM inference or clear Working Memory.

---

## Error Handling and Fallback (Instinct)

### Network Failure
If the Script API cannot reach Node.js (timeout, network down):
1. **Layer 7** detects the failure after 3 failed polling attempts.
2. Falls back to **Hardcoded Instinct Logic**:
   - If player is nearby and hasn't been hostile, perform a generic "wave" animation.
   - If player recently dealt damage, run away.
   - If no clear pattern, remain idle.

3. Logs the failure in `DynamicProperties`:
   ```javascript
   entity.setDynamicProperty("network_status", "offline");
   entity.setDynamicProperty("last_network_error", Date.now());
   ```

4. Retries connection every 60 seconds.

### LLM Failure
If llama.cpp crashes or returns malformed JSON:
1. **Brain Scheduler** catches the error and returns a fallback `IntentPacket`:
   ```json
   {
     "action": "idle",
     "actionParams": null
   }
   ```

2. Logs the error to Node.js console (not visible to player).

---

## Key Architectural Principles

### 1. Subjectivity First
- All database queries are filtered by `villagerID`.
- Each villager has their own isolated memory and identity.
- No shared global knowledge unless explicitly "gossiped" or "taught."

### 2. Tick Efficiency
- Layers 1-4 execute in the game loop (Fast Gear, <10ms per cycle).
- Layers 5-6 run asynchronously in Node.js (Slow Gear, 500ms-5s per cycle).
- Layer 7 polls for results to avoid blocking the game thread.

### 3. Memory Safety
- Never store persistent Entity object references.
- Always use `entity.id` and fetch via `world.getEntity(id)` when needed.
- Use `DynamicProperties` for persistent state across server restarts.

### 4. Invisible by Default
- All internal processing is silent unless DEBUG_MODE is enabled.
- Only Layer 7 "speak" actions and physical behaviors are visible to players.
- No chat spam, no system messages, no telemetry leaks.

---

## Summary: The Four Phases of Interaction

| **Phase**           | **Layers Involved** | **Location**   | **Timing**    | **Visibility**           |
| ------------------- | ------------------- | -------------- | ------------- | ------------------------ |
| **Sensory Input**   | 1 → 2 → 3           | Script API     | Instant (1ms) | Silent                   |
| **Memory Write**    | 4 → 5               | Script + Node  | Fast (100ms)  | Silent (DEBUG logs)      |
| **AI Decisioning**  | 6                   | Node + LLM     | Slow (2-5s)   | Silent (DEBUG logs)      |
| **Physical Output** | 7                   | Script API     | Instant (1ms) | Visible (speech/actions) |

---

## Next Steps for Implementation

This flow serves as the architectural blueprint. When building:

1. **Start with Layers 1-3** (Sensory → Vectorizer → Sequencer) to establish the data pipeline.
2. **Build Layer 4 & 5** (Working Memory + LTM) to test HTTP communication and PostgreSQL writes.
3. **Implement Brain Scheduler** to manage the LLM request queue.
4. **Integrate Layer 6** (Language Cortex) with a simple test prompt.
5. **Complete Layer 7** (Action Layer) with polling and intent execution.
6. **Add DEBUG_MODE** toggle and logging system last.

---

## Glossary

- **[C, V, I, S, X]:** The 5-axis semantic vector (Constructiveness, Value, Intensity, Sociality, Complexity).
- **Episode:** A grouped sequence of vectors representing a coherent activity (e.g., "Building Session").
- **IntentPacket:** The LLM's decision output, containing an action and parameters.
- **DynamicProperties:** Bedrock's persistent key-value storage for entities, survives server restarts.
- **Fast Gear:** Layers 1-4, optimized for high-frequency execution in Script API.
- **Slow Gear:** Layers 5-6, asynchronous processing in Node.js.
- **Brain Scheduler:** Infrastructure middleware managing LLM request batching and prioritization.
- **Invisible Telemetry:** All internal processing that doesn't surface to the player unless DEBUG_MODE is enabled.
