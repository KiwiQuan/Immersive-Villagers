# Phase 1: MVP — Core Cognitive Loop

**Status:** Minimum Viable Product  
**Goal:** Complete sensory-to-action loop functional  
**Deliverable:** Villagers observe player actions, store memories, and react with simple behaviors  
**Duration Target:** 5-7 implementation sessions

---

## Overview

This phase implements the core 7-layer cognitive architecture in its simplest form. Villagers will detect player actions, convert them to semantic vectors, store episodes in the database, and execute basic reactions (console output only for now, physical actions in Phase 2).

**Success Criteria:**
- Player places a block → Villager detects event (Layer 1)
- Event converted to [C, V, I, S, X] vector (Layer 2)
- Vectors grouped into episodes (Layer 3)
- Working Memory updated in DynamicProperties (Layer 4)
- Episode written to PostgreSQL (Layer 5)
- LLM generates basic intent (Layer 6)
- Intent logged to console (Layer 7 — minimal action)

---

## Feature 1: Sensory Layer (Layer 1)

**Goal:** Filter game events by proximity and line of sight

### Steps:
1. Create `scripts/layers/layer1_sensory.js` with event subscription setup
2. Implement proximity filter: check distance between event location and villager (<32 blocks)
3. Implement LOS (Line of Sight) raycast check to validate visibility
4. Subscribe to key events: `playerPlaceBlock`, `playerBreakBlock`, `playerDamageEntity`
5. Output `FilteredEventContext` packet when event passes filters

**Files Created:**
- `scripts/layers/layer1_sensory.js`
- `scripts/utils/raycast_helpers.js`
- `scripts/config/constants.js`

**Data Packet Output:**
```javascript
{
  type: "FilteredEventContext",
  eventName: "playerPlaceBlock",
  actorID: "player-uuid-123",
  villagerID: "villager-entity-456",
  coordinates: { x: 100, y: 64, z: -50 },
  blockType: "minecraft:diamond_block",
  proximity: 12.5,
  hasLOS: true,
  timestamp: Date.now()
}
```

**Validation:**
- Place block near villager → Console log shows filtered event
- Place block far from villager → No log (filtered out)
- Place block behind wall → No log (LOS failed)

---

## Feature 2: Vectorization Layer (Layer 2)

**Goal:** Convert filtered events into semantic vectors [C, V, I, S, X]

### Steps:
1. Create `scripts/layers/layer2_vectorizer.js` with vector calculation logic
2. Define `scripts/config/vector_rules.js` with block value mappings
3. Implement axis calculators: `calculateC()`, `calculateV()`, `calculateI()`, `calculateS()`, `calculateX()`
4. Apply mathematical rules to generate normalized vectors (-1.0 to +1.0)
5. Output `SemanticVector` packet with calculated values

**Files Created:**
- `scripts/layers/layer2_vectorizer.js`
- `scripts/config/vector_rules.js`
- `scripts/utils/vector_math.js`

**Vector Rules Example:**
```javascript
// Constructiveness (C)
PLACE_BLOCK: +0.8
BREAK_BLOCK: -0.6

// Value (V) by block type
'minecraft:diamond_block': +0.9
'minecraft:iron_block': +0.6
'minecraft:dirt': +0.1

// Intensity (I) by action speed
QUICK_PLACEMENT: +0.3
EXPLOSION: +0.9

// Sociality (S) by context
NEAR_VILLAGER_HOME: +0.7
BREAK_VILLAGER_BED: -0.9

// Complexity (X) by block type
REDSTONE_COMPONENTS: +0.8
SIMPLE_BLOCKS: +0.1
```

**Data Packet Output:**
```javascript
{
  type: "SemanticVector",
  villagerID: "villager-entity-456",
  actorID: "player-uuid-123",
  vector: {
    C: 0.8,
    V: 0.9,
    I: 0.3,
    S: 0.7,
    X: 0.1
  },
  rawEvent: "playerPlaceBlock",
  blockType: "minecraft:diamond_block",
  timestamp: Date.now()
}
```

**Validation:**
- Place diamond block → High V (0.9), High C (0.8)
- Break dirt → Low V (0.1), Negative C (-0.6)
- Place redstone → High X (0.8)

---

## Feature 3: Sequencer Layer (Layer 3)

**Goal:** Group vectors into coherent episodes

### Steps:
1. Create `scripts/layers/layer3_sequencer.js` with episode accumulation logic
2. Implement running average calculation for episode [C, V, I, S, X]
3. Define episode sealing triggers: context shift (vector difference >0.3), inactivity (30s), manual seal
4. Store open episodes in module-level Map (villagerID → episode data)
5. Output `EpisodeSummary` packet when episode is sealed

**Files Created:**
- `scripts/layers/layer3_sequencer.js`

**Data Packet Output:**
```javascript
{
  type: "EpisodeSummary",
  episodeID: "ep_1708718400_v456",
  villagerID: "villager-entity-456",
  actorID: "player-uuid-123",
  vectorAverage: {
    C: 0.75,
    V: 0.82,
    I: 0.35,
    S: 0.68,
    X: 0.15
  },
  rawVectors: [
    { C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1, timestamp: 1708718400000 },
    { C: 0.7, V: 0.74, I: 0.4, S: 0.66, X: 0.2, timestamp: 1708718405000 }
  ],
  duration: 5000,
  eventCount: 2,
  sealReason: "context_shift",
  timestamp: Date.now()
}
```

**Validation:**
- Place 3 blocks quickly → Single episode with averaged vector
- Wait 30 seconds → Episode auto-seals (inactivity)
- Switch from building to breaking → Episode seals (context shift)

---

## Feature 4: Working Memory (Layer 4)

**Goal:** Store villager's active state in DynamicProperties

### Steps:
1. Create `scripts/layers/layer4_working_memory.js` with DynamicProperties management
2. Define property schema: `wm_currentMood_{C,V,I,S,X}`, `wm_currentFocus`, `wm_shockState`
3. Implement `updateWorkingMemory()` that writes to DynamicProperties
4. Set `wm_needsSync` flag for database sync (debounced to every 5 seconds)
5. Verify properties persist across server restarts

**Files Created:**
- `scripts/layers/layer4_working_memory.js`
- `scripts/utils/entity_helpers.js`

**DynamicProperties Schema:**
```javascript
{
  wm_currentFocus: "player-uuid-123",
  wm_currentMood_C: 0.75,
  wm_currentMood_V: 0.82,
  wm_currentMood_I: 0.35,
  wm_currentMood_S: 0.68,
  wm_currentMood_X: 0.15,
  wm_shockState: false,
  wm_lastUpdate: 1708718405000,
  wm_needsSync: true
}
```

**Validation:**
```javascript
// Read Working Memory from a villager
const villager = world.getEntity('villager-id');
console.warn('Current Mood C:', villager.getDynamicProperty('wm_currentMood_C'));

// Restart server → Properties still exist
```

---

## Feature 5: Long-Term Memory Write (Layer 5)

**Goal:** Write episodes to PostgreSQL via HTTP

### Steps:
1. Create `nodeDB/routes/memory.js` with Express routes
2. Implement `POST /api/memory/episode` endpoint that accepts `EpisodeSummary`
3. Create `nodeDB/queries/episodes.js` with database write logic using transactions
4. Update `relationships` table: increment interaction_count, recalculate trust_score
5. Return `IdentityContext` response with relationship score

**Files Created:**
- `nodeDB/routes/memory.js`
- `nodeDB/queries/episodes.js`
- `nodeDB/queries/relationships.js`

**Endpoint Implementation:**
```javascript
// POST /api/memory/episode
router.post('/episode', validateEpisode, async (req, res) => {
  try {
    const { villagerID, actorID, episodeSummary } = req.body;
    
    // Write episode and update relationships in transaction
    const result = await writeEpisodeWithRelationships(episodeSummary);
    
    res.json({
      status: 'success',
      episodeID: result.episodeID,
      relationshipScore: result.trustScore,
      identityTags: result.tags
    });
  } catch (err) {
    logger.error({ error: err.message }, '[Layer 5] Episode write failed');
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

**Validation:**
```bash
# Test with curl
curl -X POST http://localhost:3000/api/memory/episode \
  -H "Content-Type: application/json" \
  -d '{
    "villagerID": "test-456",
    "actorID": "player-123",
    "episodeSummary": {
      "vectorAverage": { "C": 0.8, "V": 0.9, "I": 0.3, "S": 0.7, "X": 0.1 },
      "duration": 5000,
      "eventCount": 2
    }
  }'

# Check database
psql -U minecraft_ai -d villager_memory -c "SELECT * FROM episodes ORDER BY id DESC LIMIT 1;"
```

---

## Feature 6: Brain Scheduler (Infrastructure)

**Goal:** Queue and prioritize LLM requests

### Steps:
1. Create `nodeDB/brain/scheduler.js` with in-memory priority queue
2. Implement `enqueue()` method that adds requests to queue
3. Implement `processQueue()` that calls LLM sequentially (one at a time)
4. Add priority sorting: high (shocks) → medium (interactions) → low (idle)
5. Store completed intents in Map for polling

**Files Created:**
- `nodeDB/brain/scheduler.js`
- `nodeDB/routes/brain.js`

**Brain Scheduler Class:**
```javascript
class BrainScheduler {
  constructor() {
    this.queue = [];
    this.pendingIntents = new Map(); // villagerID → IntentPacket
    this.isProcessing = false;
  }

  enqueue(request) {
    const requestID = `req_${Date.now()}_${request.villagerID}`;
    this.queue.push({ requestID, ...request, timestamp: Date.now() });
    
    // Sort by priority
    this.queue.sort((a, b) => {
      const priorityMap = { high: 3, medium: 2, low: 1 };
      return priorityMap[b.priority] - priorityMap[a.priority];
    });
    
    if (!this.isProcessing) this.processQueue();
    return requestID;
  }

  async processQueue() {
    // Implementation in file
  }

  getPendingIntent(villagerID) {
    return this.pendingIntents.get(villagerID);
  }
}
```

**Validation:**
- Queue 3 requests → Processes sequentially
- High priority request jumps to front of queue
- Completed intents stored for polling

---

## Feature 7: LLM Integration (Layer 6)

**Goal:** Generate intent packets from LLM

### Steps:
1. Create `nodeDB/brain/llm_client.js` with llama.cpp HTTP client
2. Create `nodeDB/brain/prompt_builder.js` with prompt templates
3. Implement context fetching: recent episodes + relationship + personality tags
4. Call llama.cpp with constructed prompt (512 token context)
5. Parse LLM JSON response into `IntentPacket` format

**Files Created:**
- `nodeDB/brain/llm_client.js`
- `nodeDB/brain/prompt_builder.js`
- `nodeDB/brain/response_parser.js`

**Prompt Template:**
```plaintext
You are Villager #456. You are observing Player #123.

Recent Activity:
- Episode: C=0.75, V=0.82, I=0.35, S=0.68, X=0.15
- Duration: 5 seconds, 2 events

Your Relationship with Player #123:
- Trust Score: 0.78
- Past Episodes: 12 interactions, mostly constructive

Based on this, generate a JSON response:
{
  "action": "speak|idle",
  "speechText": "What you want to say",
  "internalMonologue": "What you're thinking"
}

Response (JSON only):
```

**IntentPacket Output:**
```javascript
{
  requestID: "req_1708718405_v456",
  villagerID: "villager-entity-456",
  intentPacket: {
    action: "speak",
    speechText: "That's a beautiful diamond block!",
    targetPlayerID: "player-uuid-123",
    priority: "medium"
  },
  timestamp: Date.now(),
  status: "ready"
}
```

**Validation:**
- Send test prompt → LLM returns valid JSON
- Malformed JSON → Parser returns fallback intent (action: "idle")
- Timeout (>10s) → Returns error

---

## Feature 8: Action Layer Polling (Layer 7)

**Goal:** Poll for intents and log to console (physical actions in Phase 2)

### Steps:
1. Create `scripts/layers/layer7_action.js` with polling loop
2. Implement HTTP GET to `/api/brain/poll?villagerID={id}` every 2 seconds
3. Parse `IntentPacket` response and execute based on action type
4. For MVP: Only implement "speak" action as console log
5. Clear intent from backend after consumption

**Files Created:**
- `scripts/layers/layer7_action.js`

**Polling Implementation:**
```javascript
system.runInterval(() => {
  const villagers = world.getDimension('overworld').getEntities({ type: 'minecraft:villager_v2' });
  
  for (const villager of villagers) {
    if (!villager.isValid()) continue;
    
    const requestID = villager.getDynamicProperty('pending_request_id');
    if (!requestID) continue;
    
    http.get(`http://localhost:3000/api/brain/poll?villagerID=${villager.id}`)
      .then(response => {
        const data = JSON.parse(response.body);
        if (data.status === 'ready') {
          executeIntent(villager, data.intentPacket);
          villager.setDynamicProperty('pending_request_id', undefined);
        }
      })
      .catch(err => {
        console.error('[Layer 7] Polling failed:', err.message);
      });
  }
}, 40); // Every 2 seconds
```

**MVP Action Execution:**
```javascript
function executeIntent(villager, intentPacket) {
  switch (intentPacket.action) {
    case 'speak':
      console.warn(`[Villager ${villager.id}] ${intentPacket.speechText}`);
      break;
    case 'idle':
      console.warn(`[Villager ${villager.id}] [thinking quietly]`);
      break;
    default:
      console.warn(`[Villager ${villager.id}] Unknown action: ${intentPacket.action}`);
  }
}
```

**Validation:**
- Villager observes player → Eventually logs speech to console
- Multiple villagers → Each polls independently
- Backend offline → Polling fails gracefully

---

## Feature 9: Working Memory Database Sync

**Goal:** Debounced sync from DynamicProperties to PostgreSQL

### Steps:
1. Create `nodeDB/routes/memory.js` endpoint: `POST /api/memory/sync`
2. Implement upsert query for `working_memory` table
3. Add debounced sync loop in `scripts/layers/layer4_working_memory.js` (every 5 seconds)
4. Only sync if `wm_needsSync` flag is true
5. Clear flag after successful sync

**Endpoint Implementation:**
```javascript
router.post('/sync', async (req, res) => {
  const { villagerID, currentMood, lastUpdate } = req.body;
  
  try {
    await pool.query(
      `INSERT INTO working_memory (villager_id, mood_c, mood_v, mood_i, mood_s, mood_x, last_update)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (villager_id) DO UPDATE SET
         mood_c = EXCLUDED.mood_c,
         mood_v = EXCLUDED.mood_v,
         mood_i = EXCLUDED.mood_i,
         mood_s = EXCLUDED.mood_s,
         mood_x = EXCLUDED.mood_x,
         last_update = EXCLUDED.last_update`,
      [villagerID, currentMood.C, currentMood.V, currentMood.I, currentMood.S, currentMood.X, lastUpdate]
    );
    
    res.json({ status: 'success' });
  } catch (err) {
    logger.error({ error: err.message }, '[Layer 5] Sync failed');
    res.status(500).json({ status: 'error' });
  }
});
```

**Validation:**
- DynamicProperties updated → Database syncs within 5 seconds
- Verify with: `SELECT * FROM working_memory WHERE villager_id = 'test-456';`

---

## Feature 10: End-to-End Integration

**Goal:** Complete loop from player action to villager reaction

### Steps:
1. Integrate all layers into `scripts/main.js` with proper initialization
2. Add layer-to-layer data flow: Layer 1 → Layer 2 → Layer 3 → Layer 4 → HTTP
3. Test full pipeline: Place block near villager → Check console for LLM response
4. Add DEBUG_MODE flag to enable detailed console logging
5. Verify data persists in PostgreSQL after test

**Integration Test Flow:**
1. Player places diamond block near villager
2. Layer 1 detects event (proximity + LOS pass)
3. Layer 2 calculates vector [C: 0.8, V: 0.9, ...]
4. Layer 3 accumulates vectors, seals episode after 30s
5. Layer 4 updates DynamicProperties
6. HTTP POST sends episode to Layer 5
7. Layer 5 writes to PostgreSQL
8. Brain Scheduler queues LLM request
9. Layer 6 generates intent: "That's a beautiful diamond block!"
10. Layer 7 polls and logs intent to console

**Validation Checklist:**
- [ ] Place block → Console shows Layer 1 filter log
- [ ] Layer 2 vector calculation logs appear
- [ ] Episode seals after 30 seconds or context shift
- [ ] Working Memory DynamicProperties updated
- [ ] Backend logs show HTTP POST from Script API
- [ ] Database contains new episode row
- [ ] LLM request queued and processed
- [ ] Console shows villager's speech output
- [ ] No errors in Content Log or backend logs
- [ ] No memory leaks after 10 minutes of testing

---

## Known Limitations (MVP Phase)

**Intentional Simplifications:**
- Only "speak" and "idle" actions (no pathfinding or building yet)
- Console output only (no in-game UI)
- Single event type tested (playerPlaceBlock)
- No instinct fallback (crashes if LLM fails)
- No rate limiting (LLM can get overwhelmed)
- No gossip or teaching features

**These will be addressed in Phase 2.**

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Layer 1-4 execution time | <5ms per event | Per villager |
| HTTP POST latency | <150ms | Layer 5 write |
| LLM inference time | 1-3 seconds | 7B Q4_K_M model |
| Polling interval | 2 seconds | Layer 7 |
| Database write time | 10-50ms | Single episode |

---

## Testing Strategy

### Unit Tests
- Layer 1: Proximity filter with known coordinates
- Layer 2: Vector calculation with predefined rules
- Layer 3: Episode sealing logic with manual triggers
- Layer 4: DynamicProperties read/write

### Integration Tests
- Script API → Backend communication
- Backend → PostgreSQL transactions
- LLM request → Response parsing

### End-to-End Tests
- Player places 10 blocks → 1 episode created
- Episode data matches expectations
- LLM generates contextually appropriate speech

---

## Next Phase Preview

**Phase 2 (Enhancement)** will add:
- Physical actions: Pathfinding, block placement, animations
- In-game UI: Interaction Hub, Gossip menu
- Multiple event types: Chat, damage, container interactions
- Instinct fallback for network/LLM failures
- Advanced memory queries: "What did I do yesterday?"
- Identity tag generation: "loves_building", "fears_explosions"

---

**Document Type:** Phase Plan  
**Phase:** 1 (MVP)  
**Status:** Ready for Implementation  
**Last Updated:** Feb 23, 2026
