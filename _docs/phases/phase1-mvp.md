# 🚀 Phase 1: MVP (Minimal Viable Product)

## Goal

Build the **core perception-to-action loop** that allows villagers to observe player actions, convert them to semantic vectors, store memories, and respond with simple actions. This phase delivers a **working prototype** where a villager can "see" a player placing blocks, form a basic memory, ask the LLM for a response, and speak back.

---

## Success Criteria

- Villager detects player actions within 32-block radius
- Events are converted to [C, V, I, S, X] vectors accurately
- Vectors are grouped into episodes with basic sealing logic
- Working Memory updates in DynamicProperties in real-time
- Episodes are written to PostgreSQL via HTTP POST
- LLM generates simple responses (speak or idle)
- Villager speaks responses to players via ActionBar
- Basic concept matching works (DB lookup for known patterns)

---

## Feature 1: Layer 1 (Sensory Filter)

**Deliverable:** Event listener system that filters game events by proximity and Line of Sight.

### Steps

1. **Create event listeners (`scripts/events/player_events.js`)**
   - Subscribe to playerPlaceBlock, playerBreakBlock events
   - Subscribe to entityHurt, playerSpawn events
   - Extract event data (actor, location, block type)
   - Pass raw events to Layer 1 filter

2. **Implement proximity filter (`scripts/layers/layer1_sensory.js`)**
   - Get all AI-tagged villagers via dimension.getEntities()
   - Calculate distance between event location and each villager
   - Filter events beyond AWARENESS_RADIUS (32 blocks)
   - Create FilteredEventContext packet for nearby events

3. **Implement Line of Sight check**
   - Use entity.getBlockFromViewDirection() for LOS raycast
   - Check if blocks obstruct view between villager and event location
   - Mark events as hasLOS: true/false in FilteredEventContext
   - Skip LOS check for audio events (explosions, chat)

4. **Add priority classification**
   - Classify events as P0 (critical), P1 (high), P2 (low)
   - P0: entityHurt on villager, fire nearby, explosions
   - P1: player actions within 10 blocks, block changes
   - P2: player movement, ambient entity spawns

5. **Output FilteredEventContext to Layer 2**
   - Create JSON packet with event details
   - Include villagerID, actorID, coordinates, proximity, hasLOS
   - Pass to Layer 2 vectorizer function
   - Add debugLog() call for DEBUG_MODE

---

## Feature 2: Layer 2 (Vectorizer)

**Deliverable:** Mathematical conversion of events into 5-axis semantic vectors.

### Steps

1. **Create vector rules lookup (`scripts/config/vector_rules.js`)**
   - Define base C values for block place (+0.8) and break (-0.6)
   - Define V values for common blocks (diamond: 0.9, dirt: 0.1, etc.)
   - Define I values for event types (explosion: 0.9, slow place: 0.2)
   - Define X values for logic blocks (redstone: 0.8, dirt: 0.1)

2. **Implement vectorization logic (`scripts/layers/layer2_vectorizer.js`)**
   - Create calculateVector(eventContext) function
   - Extract C from event type (place vs. break)
   - Extract V from block type (lookup in vector_rules)
   - Extract I from event intensity (damage amount, speed)
   - Calculate S and X based on context and block type

3. **Add Sociality (S) calculation**
   - Check if event occurred in villager's home territory (25-block radius from spawn)
   - Positive S for building near home, negative S for destroying
   - High S for direct interaction (chat, trade), low S for distant actions
   - Adjust S based on trust score (if available)

4. **Create SemanticVector output packet**
   - Package vector { C, V, I, S, X } with metadata
   - Include rawEvent, blockType, actorID, villagerID, timestamp
   - Validate vector values are in range [-1, 1]
   - Add debugLog() call for DEBUG_MODE

5. **Output SemanticVector to Layer 3**
   - Pass vector packet to Layer 3 sequencer
   - Log vector to console if DEBUG_MODE enabled
   - Track vector count for performance monitoring
   - Handle errors gracefully (fallback to neutral vector)

---

## Feature 3: Layer 3 (Episode Sequencer - Basic)

**Deliverable:** Groups vectors into episodes with time-based and context-shift sealing.

### Steps

1. **Create episode buffer system (`scripts/layers/layer3_sequencer.js`)**
   - Maintain Map of villagerID → current Episode object
   - Episode object contains: episodeID, rawVectors[], vectorAverage, startTime, duration
   - Initialize empty episode on first vector for each villager
   - Append incoming vectors to current episode

2. **Implement vector averaging**
   - Calculate running average of [C, V, I, S, X] across all vectors
   - Update vectorAverage after each new vector append
   - Use incremental averaging formula to avoid recalculating entire array
   - Track vector count in episode

3. **Implement episode sealing logic**
   - Time-based seal: 30 seconds of inactivity (no new vectors)
   - Context-shift seal: New vector differs from average by >0.3 on any axis
   - Manual seal: High-intensity event (I > 0.8) forces immediate seal
   - Create EpisodeSummary packet with vectorAverage, duration, eventCount, sealReason

4. **Add basic concept matching (DB lookup)**
   - Calculate Euclidean distance between vectorAverage and known concepts in database
   - If distance < 0.2, tag episode with matching concept_id
   - If no match, tag as "unknown" for LLM labeling later
   - Query PostgreSQL via HTTP GET /api/memory/concepts

5. **Output EpisodeSummary to Layer 4**
   - Pass sealed episode to Layer 4 for Working Memory update
   - Clear episode buffer for this villager
   - Add debugLog() with episode details
   - Start new episode buffer immediately

---

## Feature 4: Layer 4 (Working Memory Management)

**Deliverable:** Real-time Working Memory updates in DynamicProperties with debounced PostgreSQL sync.

### Steps

1. **Implement Working Memory update (`scripts/layers/layer4_working_memory.js`)**
   - Receive EpisodeSummary from Layer 3
   - Update villager's currentMood to match vectorAverage
   - Update currentFocus to actorID from episode
   - Set shockState if episode has high Intensity (I > 0.8)

2. **Write to DynamicProperties**
   - Use setWorkingMemory() helper to write all WM properties
   - Set wm_needsSync flag to true
   - Update wm_lastUpdate timestamp
   - Verify entity.isValid() before writing

3. **Create debounced sync loop**
   - Run system.runInterval every 100 ticks (5 seconds)
   - For each villager, check wm_needsSync flag
   - If true, send HTTP POST to /api/memory/sync with Working Memory state
   - Clear wm_needsSync only after successful response

4. **Handle sync failures**
   - Catch network errors and retry on next interval
   - Track consecutive failures in wm_syncFailureCount
   - After 3 failures, log error and set wm_networkStatus to "offline"
   - Retry connection check every 60 seconds

5. **Output ActiveAttentionState to Layer 5**
   - Create packet with villagerID, currentMood, currentFocus, shockState
   - Send via HTTP POST (non-blocking)
   - Log sync success/failure if DEBUG_MODE enabled
   - Continue game loop regardless of sync status

---

## Feature 5: Layer 5 (Episode Storage)

**Deliverable:** Backend endpoints that write episodes and Working Memory to PostgreSQL.

### Steps

1. **Create episode write endpoint (`nodeDB/routes/memory.js`)**
   - POST /api/memory/episode accepts EpisodeSummary
   - Validate villagerID and episodeSummary structure
   - Call writeEpisode() query function
   - Return episodeID and timestamp in response

2. **Create episode write query (`nodeDB/queries/episodes.js`)**
   - Connect to pool and start transaction
   - INSERT episode data into episodes table
   - UPDATE relationships table (increment interaction_count)
   - COMMIT transaction and return result

3. **Create Working Memory sync endpoint**
   - POST /api/memory/sync accepts Working Memory state
   - Use UPSERT logic (INSERT ... ON CONFLICT DO UPDATE)
   - Update working_memory table with latest mood values
   - Return success status

4. **Create concepts lookup endpoint**
   - GET /api/memory/concepts returns all known concepts
   - Return concept_id, name, and vector_signature for matching
   - Cache results in memory for fast lookups (refresh every 60s)
   - Add pagination support (limit + offset)

5. **Add request validation middleware (`nodeDB/middleware/validate.js`)**
   - Check villagerID is present and valid string
   - Check episodeSummary has vectorAverage object
   - Validate vector values are numbers in range [-1, 1]
   - Return 400 error for invalid requests

---

## Feature 6: Layer 6 (Basic LLM Integration)

**Deliverable:** LLM generates simple IntentPackets (speak or idle) based on episode context.

### Steps

1. **Create Brain Scheduler (`nodeDB/brain/scheduler.js`)**
   - Initialize in-memory queue for LLM requests
   - Create enqueue(request) method that adds to queue and sorts by priority
   - Create processQueue() method that handles requests sequentially
   - Store pending intents in Map (villagerID → IntentPacket)

2. **Create brain request endpoint (`nodeDB/routes/brain.js`)**
   - POST /api/brain/request accepts villagerID, actorID, trigger
   - Enqueue request in Brain Scheduler
   - Return { status: "queued", requestID, estimatedWaitTime }
   - Don't wait for LLM response (immediate return)

3. **Create prompt builder (`nodeDB/brain/prompt_builder.js`)**
   - Fetch last 3 episodes for villagerID from PostgreSQL
   - Fetch relationship score with actorID
   - Build simple prompt: "You are Villager X. Player Y just [action]. Respond."
   - Keep prompt under 512 tokens for fast inference

4. **Integrate LLM inference in Brain Scheduler**
   - Call callLLM() with constructed prompt
   - Parse LLM response as JSON (extract action and speechText)
   - Create IntentPacket { action, speechText, targetPlayerID }
   - Store in pendingIntents Map with status: "ready"

5. **Create polling endpoint**
   - GET /api/brain/poll?villagerID=X checks pendingIntents Map
   - If intent is ready, return { status: "ready", intentPacket }
   - If not ready, return { status: "waiting" }
   - Remove intent from Map after it's consumed (single use)

---

## Feature 7: Layer 7 (Action Execution)

**Deliverable:** Villagers execute LLM-generated intents (speak or idle actions).

### Steps

1. **Create polling loop (`scripts/layers/layer7_action_layer.js`)**
   - Run system.runInterval every 40 ticks (2 seconds)
   - For each AI-tagged villager, send GET /api/brain/poll
   - Parse response and check if status is "ready"
   - If ready, extract intentPacket and execute

2. **Implement action dispatcher**
   - Create executeIntent(villagerEntity, intentPacket) function
   - Switch on intentPacket.action (speak, idle)
   - For "speak": display text via targetPlayer.onScreenDisplay.setActionBar()
   - For "idle": do nothing (villager continues current animation)

3. **Add speak action handler**
   - Get target player entity via world.getEntity(targetPlayerID)
   - Format message: `§e[VillagerName]: ${speechText}`
   - Display via onScreenDisplay.setActionBar() (5 second duration)
   - Log speech if DEBUG_MODE enabled

4. **Add timeout fallback**
   - Track polling attempts in DynamicProperty (wm_pollingAttempts)
   - After 10 failed polls (20 seconds), fall back to idle
   - Reset polling attempts counter on successful intent retrieval
   - Log timeout if DEBUG_MODE enabled

5. **Test action execution**
   - Trigger event near villager (place diamond block)
   - Wait 2-5 seconds for LLM response
   - Verify villager speaks response via ActionBar
   - Test with multiple villagers simultaneously

---

## Feature 8: End-to-End Integration Test

**Deliverable:** Complete loop from player action to villager response works seamlessly.

### Steps

1. **Setup test environment**
   - Start PostgreSQL database
   - Start Node.js backend (npm start)
   - Start llama.cpp server
   - Start Minecraft Bedrock server with behavior pack

2. **Spawn test villager**
   - Spawn villager_v2 in overworld
   - Tag with ai_villager tag
   - Initialize Working Memory via layer4_working_memory.js
   - Verify villager appears in logs if DEBUG_MODE enabled

3. **Trigger test event**
   - Player places diamond block within 10 blocks of villager
   - Verify Layer 1 detects event (check console logs)
   - Verify Layer 2 calculates vector (check DEBUG logs)
   - Verify Layer 3 appends vector to episode

4. **Wait for episode seal and LLM response**
   - Place 2-3 more blocks to trigger context shift seal
   - Verify Layer 4 updates Working Memory (check DynamicProperties)
   - Verify Layer 5 writes episode to PostgreSQL (check backend logs)
   - Wait 2-5 seconds for LLM inference

5. **Verify villager response**
   - Confirm Layer 7 polls and retrieves IntentPacket
   - Confirm villager speaks response via ActionBar
   - Check backend logs for complete request lifecycle
   - Test with different event types (break block, chat, etc.)

---

## Testing Checklist

- [ ] Layer 1 filters events by proximity (ignores events >32 blocks)
- [ ] Layer 1 filters events by Line of Sight (ignores occluded events)
- [ ] Layer 2 calculates accurate [C, V, I, S, X] vectors for common blocks
- [ ] Layer 3 seals episodes after 30s inactivity or context shift
- [ ] Layer 3 matches episodes to known concepts in database
- [ ] Layer 4 updates Working Memory in DynamicProperties
- [ ] Layer 4 syncs to PostgreSQL every 5 seconds
- [ ] Layer 5 writes episodes to database successfully
- [ ] Layer 6 generates valid IntentPackets with speak/idle actions
- [ ] Layer 7 executes speak actions via ActionBar
- [ ] Complete loop takes 2-10 seconds from event to response
- [ ] Multiple villagers can operate simultaneously without conflicts
- [ ] System handles network errors gracefully (no crashes)
- [ ] DEBUG_MODE shows full data flow in console logs

---

## Known Limitations at End of Phase 1

- No relationship scoring (trust always defaults to 0.5)
- No identity tags or personality traits
- No advanced actions (pathfind, stare, flee) implemented
- No macro-pattern detection (Spleef, etc.)
- No player-facing UI (all interactions via ActionBar)
- LLM context is minimal (last 3 episodes only, no personality)
- No gossip system (villagers don't share knowledge)
- No concept teaching (LLM can't label unknown patterns yet)

---

## File Structure After Phase 1

```
Immersive_Villagers BP/
├── scripts/
│   ├── layers/
│   │   ├── layer1_sensory.js
│   │   ├── layer2_vectorizer.js
│   │   ├── layer3_sequencer.js
│   │   ├── layer4_working_memory.js
│   │   └── layer7_action_layer.js
│   ├── events/
│   │   ├── player_events.js
│   │   ├── entity_events.js
│   │   └── chat_events.js
│   ├── config/
│   │   ├── constants.js
│   │   ├── vector_rules.js
│   │   └── dynamic_properties_schema.js
│   ├── utils/
│   │   ├── vector_math.js
│   │   ├── entity_helpers.js
│   │   ├── time_helpers.js
│   │   ├── debug_logger.js
│   │   ├── network_helpers.js
│   │   └── dynamic_properties_helpers.js
│   └── main.js
│
├── nodeDB/
│   ├── db/
│   │   ├── pool.js
│   │   └── schema.sql
│   ├── queries/
│   │   ├── episodes.js
│   │   ├── working_memory.js
│   │   └── concepts.js
│   ├── routes/
│   │   ├── memory.js
│   │   ├── brain.js
│   │   └── debug.js
│   ├── brain/
│   │   ├── scheduler.js
│   │   ├── llm_client.js
│   │   └── prompt_builder.js
│   ├── middleware/
│   │   ├── validate.js
│   │   ├── logger.js
│   │   └── error.js
│   ├── utils/
│   │   └── logger.js
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── _docs/
    └── phases/
        ├── phase0-setup.md
        └── phase1-mvp.md                    # THIS FILE
```

---

## Example Scenario (MVP Demo)

### Setup
- Villager "Barrel" spawned at (100, 64, 0)
- Player "Steve" at (105, 64, 5) — 6 blocks away
- Backend and LLM running, DEBUG_MODE enabled

### Interaction Flow

1. **T=0s:** Steve places diamond block at (103, 64, 3)
2. **T=0.01s:** Layer 1 detects event (proximity: 6 blocks, LOS: true)
3. **T=0.02s:** Layer 2 calculates vector [C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1]
4. **T=0.03s:** Layer 3 appends vector to current episode
5. **T=5s:** Steve places 2 more diamond blocks
6. **T=10s:** Steve walks away (inactivity timer starts)
7. **T=40s:** Layer 3 seals episode (seal reason: inactivity)
   - Episode: 3 vectors, average [C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1], duration: 40s
8. **T=40.1s:** Layer 4 updates Working Memory (mood matches episode average)
9. **T=40.2s:** Layer 5 writes episode to PostgreSQL (HTTP POST)
10. **T=40.3s:** Backend queues LLM request
11. **T=42s:** LLM returns: { action: "speak", speechText: "Those diamond blocks look great!" }
12. **T=44s:** Layer 7 polls and retrieves IntentPacket
13. **T=44.1s:** Villager displays: `§e[Barrel]: Those diamond blocks look great!`
14. **Result:** Steve sees villager's response ~44 seconds after first block placed

---

## Performance Targets

| Layer | Operation | Target Latency | Notes |
|-------|-----------|---------------|-------|
| Layer 1 | Event filtering | <2ms | Proximity + LOS check |
| Layer 2 | Vectorization | <1ms | Lookup + math operations |
| Layer 3 | Vector append | <0.5ms | Array push + averaging |
| Layer 4 | DynamicProperties update | <1ms | Single entity write |
| Layer 5 | Episode write (HTTP + DB) | 50-150ms | Non-blocking |
| Layer 6 | LLM inference | 2-4s | Async queue processing |
| Layer 7 | Polling + execution | 5-20ms | GET + ActionBar display |
| **Total (Fast Gear)** | **<5ms/event** | **Target met** ✅ |

---

## Estimated Complexity

**Time Investment:** Moderate (core system implementation)  
**Technical Difficulty:** High (multi-layer integration)  
**Dependencies:** Phase 0 complete, PostgreSQL + llama.cpp running  
**Risk Level:** Medium (network communication, async coordination)

---

**Document Type:** Phase Plan  
**Phase:** 1 (MVP)  
**Status:** Ready for Implementation  
**Version:** 1.0  
**Last Updated:** Feb 24, 2026
