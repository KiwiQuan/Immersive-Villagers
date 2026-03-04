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

- [ ] **1. Create event listeners (`scripts/events/player_events.js`)**
  - Subscribe to playerPlaceBlock, playerBreakBlock events
  - Subscribe to entityHurt, playerSpawn events
  - Extract event data (actor, location, block type)
  - Pass raw events to Layer 1 filter

- [ ] **2. Implement proximity filter (`scripts/layers/layer1_sensory.js`)**
  - Get all AI-tagged villagers via dimension.getEntities()
  - Calculate distance between event location and each villager
  - Filter events beyond AWARENESS_RADIUS (32 blocks)
  - Create FilteredEventContext packet for nearby events

- [ ] **3. Implement Line of Sight check**
  - Use entity.getBlockFromViewDirection() for LOS raycast
  - Check if blocks obstruct view between villager and event location
  - Mark events as hasLOS: true/false in FilteredEventContext
  - Skip LOS check for audio events (explosions, chat)

- [ ] **4. Add priority classification**
  - Classify events as P0 (critical), P1 (high), P2 (low)
  - P0: entityHurt on villager, fire nearby, explosions
  - P1: player actions within 10 blocks, block changes
  - P2: player movement, ambient entity spawns

- [ ] **5. Output FilteredEventContext to Layer 2**
  - Create JSON packet with event details
  - Include villagerID, actorID, coordinates, proximity, hasLOS
  - Pass to Layer 2 vectorizer function
  - Add debugLog() call for DEBUG_MODE

---

## Feature 2: Layer 2 (Vectorizer)

**Deliverable:** Mathematical conversion of events into 5-axis semantic vectors.

### Steps

- [ ] **1. Create vector rules lookup (`scripts/config/vector_rules.js`)**
  - Define base C values for block place (+0.8) and break (-0.6)
  - Define V values for common blocks (diamond: 0.9, dirt: 0.1, ore: 0.6-0.8, etc.)
  - Define I values for event types (explosion: 0.9, damage: 0.8, slow place: 0.2)
  - Define S values for interaction types (IMPORTANT: based on TYPE, not location):
    - Direct social: chat (+0.8), trade (+0.9), giveItem (+0.7)
    - Solo constructive: placeBlock (+0.1), craft (+0.1)
    - Solo destructive: breakBlock (-0.1), mining (-0.05)
    - Hostile: attack (-0.9), steal (-0.8), griefing (-0.7)
  - Define X values for logic blocks (redstone: 0.8, comparator: 0.9, dirt: 0.1)
  - NOTE: Home proximity modifies I and V (1.5x multiplier), NOT S

- [ ] **2. Implement vectorization logic (`scripts/layers/layer2_vectorizer.js`)**
  - Create calculateVector(eventContext) function
  - Extract C from event type (place vs. break)
  - Extract V from block type (lookup in vector_rules)
  - Extract I from event intensity (damage amount, speed)
  - Calculate S and X based on interaction type and block complexity

- [ ] **3. Add Sociality (S) calculation (Pure Social Intent)**
  - S represents inherent social nature of the interaction TYPE, not location
  - High S (+0.7 to +0.9): Direct social actions (chat, trade, giveItem, collaborate)
  - Neutral S (-0.2 to +0.2): Solo activities (placeBlock: +0.1, breakBlock: -0.1, mining: 0)
  - Negative S (-0.7 to -0.9): Hostile actions (attack, steal, griefing)
  - Location does NOT define S; a player breaking blocks alone is "solo work" regardless of proximity

- [ ] **4. Add Territory Proximity Multiplier (Home as Context)**
  - Check if event occurred within villager's home territory (25-block radius from home_x/y/z)
  - If near home: Apply 1.5x multiplier to Intensity (I) and Value (V)
  - Reasoning: Events near home feel MORE intense and MORE important, not more/less social
  - Example: Breaking dirt far away (I:0.2, V:0.1) vs. near home (I:0.3, V:0.15)
  - Hostile events (S < 0) near home feel more threatening due to higher I, not different S

- [ ] **5. Create SemanticVector output packet**
  - Package vector { C, V, I, S, X } with metadata
  - Include rawEvent, blockType, actorID, villagerID, timestamp
  - Include isNearHome flag in metadata for debugging
  - Validate vector values are in range [-1, 1]
  - Add debugLog() call for DEBUG_MODE

- [ ] **6. Output SemanticVector to Layer 3**
  - Pass vector packet to Layer 3 sequencer
  - Log vector to console if DEBUG_MODE enabled
  - Track vector count for performance monitoring
  - Handle errors gracefully (fallback to neutral vector)

- [ ] **7. Implement MICROSERVICES mode vectorization (Script API side)**
  - Create buildEventDescription(eventContext) function to generate text description
  - Send HTTP POST to /api/vector/embed with event description
  - Receive 384D embedding from backend
  - Create SemanticVector packet with embedding + description fields
  - Add AI_MODE check to route to correct vectorization method

- [ ] **8. Implement MiniLM vector endpoint (Backend side)**
  - Create POST /api/vector/embed endpoint in nodeDB/routes/vector.js
  - Call vectorEngine.generateEmbedding(text) function
  - Check concepts table before running MiniLM inference (deduplication)
  - Return 384D embedding array in response
  - Add error handling for model failures (fallback to MONOLITHIC mode)

- [ ] **9. Test dual mode vectorization**
  - Test in MONOLITHIC mode: Verify 5D vectors generated
  - Switch to MICROSERVICES: `/scriptevent ai:toggle_mode microservices`
  - Test same event: Verify 384D embedding generated
  - Check concepts/episodes tables for cached embeddings (deduplication)
  - Verify performance: MONOLITHIC <1ms, MICROSERVICES <20ms

---

## Feature 3: Layer 3 (Episode Sequencer - Basic)

**Deliverable:** Groups vectors into episodes with time-based and context-shift sealing.

### Steps

- [ ] **1. Create episode buffer system (`scripts/layers/layer3_sequencer.js`)**
  - Maintain Map of villagerID → current Episode object
  - Episode object contains: episodeID, rawVectors[], vectorAverage, startTime, duration
  - Initialize empty episode on first vector for each villager
  - Append incoming vectors to current episode

- [ ] **2. Implement vector averaging**
  - Calculate running average of [C, V, I, S, X] across all vectors
  - Update vectorAverage after each new vector append
  - Use incremental averaging formula to avoid recalculating entire array
  - Track vector count in episode

- [ ] **3. Implement episode sealing logic**
  - Time-based seal: 30 seconds of inactivity (no new vectors)
  - Context-shift seal: New vector differs from average by >0.3 on any axis
  - Manual seal: High-intensity event (I > 0.8) forces immediate seal
  - Create EpisodeSummary packet with vectorAverage, duration, eventCount, sealReason

- [ ] **4. Add basic concept matching (DB lookup using Cosine Similarity)**
  - Calculate Cosine Similarity between vectorAverage and known concepts in database using pgvector's `<=>` operator
  - If similarity > 0.8 (cosine distance < 0.2), tag episode with matching concept_id
  - Cosine Similarity focuses on directional alignment (intent) rather than magnitude (intensity)
  - If no match, tag as "unknown" for LLM labeling later
  - Query PostgreSQL via HTTP GET /api/memory/concepts with ORDER BY semantic_vector <=> $1 LIMIT 1

- [ ] **5. Output EpisodeSummary to Layer 4**
  - Pass sealed episode to Layer 4 for Working Memory update
  - Clear episode buffer for this villager
  - Add debugLog() with episode details
  - Start new episode buffer immediately

- [ ] **6. Implement Fast Intent Routing (MICROSERVICES mode only)**
  - After episode seal, send event description to /api/brain/classify_intent
  - Backend calls intentRouter.classifyIntent() using DistilBERT
  - If confidence >0.8 and intent is 'aggression' or 'trading': Create fast IntentPacket
  - Bypass LLM queue and send intent directly to Layer 7
  - Log fast route decision if DEBUG_MODE enabled

- [ ] **7. Implement episode summarization (MICROSERVICES mode only)**
  - When episode seals, collect all raw event strings
  - Send to /api/brain/summarize endpoint
  - Backend calls episodeSummarizer.summarizeEpisode() using T5-small
  - Store summary_text in episodes table (used for LLM context)
  - Verify summary is 1 sentence, <30 tokens

- [ ] **8. Test Fast Intent Routing**
  - Enable MICROSERVICES mode and DEBUG_MODE
  - Trigger aggressive event (player attacks villager)
  - Verify DistilBERT classifies as "aggression" with >80% confidence
  - Verify LLM is bypassed (check Brain Scheduler queue remains empty)
  - Verify villager responds immediately (<100ms instead of 2-4s)
  - Check ActionBar shows: "L3: [DistilBERT] → Intent: aggression (92%)"

---

## Feature 4: Layer 4 (Working Memory Management)

**Deliverable:** Real-time Working Memory updates in DynamicProperties with debounced PostgreSQL sync, including villager registration.

### Steps

- [ ] **1. Implement villager registration (`scripts/layers/layer4_working_memory.js`)**
  - Create registerVillager(villagerEntity) function
  - Extract villager location, profession, and entity ID
  - Send HTTP POST to /api/villagers/register with villager data
  - Only register if villager is AI-tagged and not already registered
  - Run registration check on world load for all AI villagers

- [ ] **2. Implement Working Memory update**
  - Receive EpisodeSummary from Layer 3
  - Update villager's currentMood to match vectorAverage
  - Update currentFocus to actorID from episode
  - Set shockState if episode has high Intensity (I > 0.8)

- [ ] **3. Write to DynamicProperties**
  - Use setWorkingMemory() helper to write all WM properties
  - Set wm_needsSync flag to true
  - Update wm_lastUpdate timestamp
  - Verify entity.isValid() before writing

- [ ] **4. Create debounced sync loop**
  - Run system.runInterval every 100 ticks (5 seconds)
  - For each villager, check wm_needsSync flag
  - If true, send HTTP POST to /api/memory/sync with Working Memory state
  - Clear wm_needsSync only after successful response

- [ ] **5. Handle sync failures**
  - Catch network errors and retry on next interval
  - Track consecutive failures in wm_syncFailureCount
  - After 3 failures, log error and set wm_networkStatus to "offline"
  - Retry connection check every 60 seconds

- [ ] **6. Output ActiveAttentionState to Layer 5**
  - Create packet with villagerID, currentMood, currentFocus, shockState
  - Send via HTTP POST (non-blocking)
  - Log sync success/failure if DEBUG_MODE enabled
  - Continue game loop regardless of sync status

---

## Feature 5: Layer 5 (Episode Storage)

**Deliverable:** Backend endpoints that write episodes, register villagers, and sync Working Memory to PostgreSQL.

### Steps

- [ ] **1. Create villager registration endpoint (`nodeDB/routes/memory.js`)**
  - POST /api/villagers/register accepts villager data (villagerID, home coordinates, profession)
  - Check if villager already exists (idempotent operation)
  - INSERT into villagers table with created_at timestamp
  - Return success status and villagerID

- [ ] **2. Create episode write endpoint**
  - POST /api/memory/episode accepts EpisodeSummary
  - Validate villagerID exists in villagers table (FK constraint)
  - Call writeEpisode() query function
  - Return episodeID and timestamp in response

- [ ] **3. Create episode write query (`nodeDB/queries/episodes.js`)**
  - Connect to pool and start transaction
  - INSERT episode data into episodes table
  - UPDATE relationships table (increment interaction_count, initialize if new)
  - COMMIT transaction and return result

- [ ] **4. Create Working Memory sync endpoint**
  - POST /api/memory/sync accepts Working Memory state
  - Use UPSERT logic (INSERT ... ON CONFLICT DO UPDATE)
  - Update working_memory table with latest mood values
  - Return success status

- [ ] **5. Create concepts lookup endpoint**
  - GET /api/memory/concepts returns all known concepts
  - Return concept_id, name, and vector_signature for matching
  - Cache results in memory for fast lookups (refresh every 60s)
  - Add pagination support (limit + offset)

- [ ] **6. Add request validation middleware (`nodeDB/middleware/validate.js`)**
  - Check villagerID is present and valid string
  - Check episodeSummary has vectorAverage object
  - Validate vector values are numbers in range [-1, 1]
  - Return 400 error for invalid requests

---

## Feature 6: Layer 6 (Basic LLM Integration)

**Deliverable:** LLM generates simple IntentPackets (speak or idle) based on episode context.

### Steps

- [ ] **1. Create Brain Scheduler (`nodeDB/brain/scheduler.js`)**
  - Initialize in-memory queue for LLM requests
  - Create enqueue(request) method that adds to queue and sorts by priority
  - Create processQueue() method that handles requests sequentially
  - Store pending intents in Map (villagerID → IntentPacket)

- [ ] **2. Create brain request endpoint (`nodeDB/routes/brain.js`)**
  - POST /api/brain/request accepts villagerID, actorID, trigger
  - Enqueue request in Brain Scheduler
  - Return { status: "queued", requestID, estimatedWaitTime }
  - Don't wait for LLM response (immediate return)

- [ ] **3. Create prompt builder (`nodeDB/brain/prompt_builder.js`)**
  - Fetch last 3 episodes for villagerID from PostgreSQL
  - Fetch relationship score with actorID
  - **MONOLITHIC mode:** Build prompt with raw [C, V, I, S, X] vectors (500 tokens)
  - **MICROSERVICES mode:** Build prompt with summary_text from episodes (250 tokens)
  - Check AI_MODE to determine which vector/summary column to use
  - Keep prompt under 512 tokens for fast inference

- [ ] **4. Integrate LLM inference in Brain Scheduler**
  - Call callLLM() with constructed prompt
  - Parse LLM response as JSON (extract action and speechText)
  - Create IntentPacket { action, speechText, targetPlayerID }
  - Store in pendingIntents Map with status: "ready"

- [ ] **5. Create polling endpoint**
  - GET /api/brain/poll?villagerID=X checks pendingIntents Map
  - If intent is ready, return { status: "ready", intentPacket }
  - If not ready, return { status: "waiting" }
  - Remove intent from Map after it's consumed (single use)

- [ ] **6. Test LLM with both AI modes**
  - **MONOLITHIC mode:** Send prompt with raw vectors, verify response includes action selection
  - **MICROSERVICES mode:** Send prompt with summaries, verify faster inference (1-2s vs 2-4s)
  - Compare context sizes (MICROSERVICES should be ~50% shorter)
  - Verify both modes produce valid IntentPackets

---

## Feature 7: Layer 7 (Action Execution)

**Deliverable:** Villagers execute LLM-generated intents (speak or idle actions).

### Steps

- [ ] **1. Create polling loop (`scripts/layers/layer7_action_layer.js`)**
  - Run system.runInterval every 40 ticks (2 seconds)
  - For each AI-tagged villager, send GET /api/brain/poll
  - Parse response and check if status is "ready"
  - If ready, extract intentPacket and execute

- [ ] **2. Implement action dispatcher**
  - Create executeIntent(villagerEntity, intentPacket) function
  - Switch on intentPacket.action (speak, idle)
  - For "speak": display text via targetPlayer.onScreenDisplay.setActionBar()
  - For "idle": do nothing (villager continues current animation)

- [ ] **3. Add speak action handler**
  - Get target player entity via world.getEntity(targetPlayerID)
  - Format message: `§e[VillagerName]: ${speechText}`
  - Display via onScreenDisplay.setActionBar() (5 second duration)
  - Log speech if DEBUG_MODE enabled

- [ ] **4. Add timeout fallback**
  - Track polling attempts in DynamicProperty (wm_pollingAttempts)
  - After 10 failed polls (20 seconds), fall back to idle
  - Reset polling attempts counter on successful intent retrieval
  - Log timeout if DEBUG_MODE enabled

- [ ] **5. Test action execution**
  - Trigger event near villager (place diamond block)
  - Wait 2-5 seconds for LLM response
  - Verify villager speaks response via ActionBar
  - Test with multiple villagers simultaneously

---

## Feature 8: Structure Learning (Basic Pattern Detection)

**Deliverable:** Villagers detect and save repeating building patterns as templates.

### Steps

- [ ] **1. Create pattern detection buffer (`scripts/layers/layer3_structure_detector.js`)**
  - Maintain Map of villagerID → observed blocks (last 60 seconds)
  - Track block placement sequences with timestamps
  - Cluster blocks into 3x3x3 spatial groups
  - Generate spatial hash or semantic description per cluster

- [ ] **2. Implement repeating pattern detection**
  - Scan buffer for identical hashes appearing 3+ times
  - When threshold met, mark as "Learned Recipe"
  - Send HTTP POST to /api/structures/template/create
  - Clear pattern from buffer after saving

- [ ] **3. Create template storage endpoint (`nodeDB/routes/structures.js`)**
  - POST /api/structures/template/create accepts pattern data
  - Generate both spatial hash (MONOLITHIC) and MiniLM embedding (MICROSERVICES)
  - Check for duplicates (if exists, increment observation_count)
  - INSERT into structure_templates table
  - Return templateID and confirmation

- [ ] **4. Implement structure recognition query**
  - GET /api/structures/recognize accepts block cluster
  - Query structure_templates using appropriate vector column (based on AI_MODE)
  - Return matched template if similarity > 92%
  - Return null if no match found

- [ ] **5. Test pattern learning**
  - Player builds 3 identical wall segments (3 blocks vertical)
  - Villager within 16 blocks observes
  - Verify pattern detected after 3rd repetition
  - Check structure_templates table for new entry
  - Verify template has both pattern_hash and embedding (dual mode support)

---

## Feature 9: Basic Building Execution (Single Template)

**Deliverable:** Villagers can place blocks to reproduce a learned template.

### Steps

- [ ] **1. Create build task system (`nodeDB/queries/build_tasks.js`)**
  - Create createBuildTask(villagerID, templateID, anchorPos) function
  - INSERT into build_tasks table with status: 'pending'
  - Calculate total_steps from template instructions
  - Return taskID

- [ ] **2. Implement build step executor (`scripts/layers/layer7_builder.js`)**
  - Run system.runInterval every 40 ticks (2 seconds)
  - For each villager, check for pending build tasks via GET /api/build/next_task
  - If task exists, execute one block placement
  - Update current_step after successful placement

- [ ] **3. Add pathfinding to build position**
  - Calculate world position: anchor + instruction offset
  - Check distance from villager
  - If >4 blocks: Use entity.pathfind() to move closer
  - If ≤4 blocks: Place block using dimension.setBlockType()

- [ ] **4. Add inventory checking**
  - Before starting task, verify villager has required materials
  - Query villager inventory via getComponent('inventory')
  - If insufficient materials: Set task status to 'waiting_materials'
  - Display message to nearby players: "Needs X cobblestone"

- [ ] **5. Test building execution**
  - Create simple template (3-block tower)
  - Assign task to test villager: `/scriptevent ai:build_template <templateID> <x> <y> <z>`
  - Give villager required blocks in inventory
  - Verify villager pathfinds to position
  - Verify villager places blocks one by one
  - Check build_tasks table shows status: 'completed'

---

## Feature 10: End-to-End Integration Test

**Deliverable:** Complete loop from player action to villager response works seamlessly, including structure learning.

### Steps

- [ ] **1. Setup test environment**
  - Start PostgreSQL database
  - Start Node.js backend (npm start)
  - Start llama.cpp server
  - Start Minecraft Bedrock server with behavior pack

- [ ] **2. Spawn test villager**
  - Spawn villager_v2 in overworld
  - Tag with ai_villager tag
  - Initialize Working Memory via layer4_working_memory.js
  - Verify villager appears in logs if DEBUG_MODE enabled

- [ ] **3. Trigger test event**
  - Player places diamond block within 10 blocks of villager
  - Verify Layer 1 detects event (check console logs)
  - Verify Layer 2 calculates vector (check DEBUG logs)
  - Verify Layer 3 appends vector to episode

- [ ] **4. Wait for episode seal and LLM response**
  - Place 2-3 more blocks to trigger context shift seal
  - Verify Layer 4 updates Working Memory (check DynamicProperties)
  - Verify Layer 5 writes episode to PostgreSQL (check backend logs)
  - Wait 2-5 seconds for LLM inference

- [ ] **5. Verify villager response**
  - Confirm Layer 7 polls and retrieves IntentPacket
  - Confirm villager speaks response via ActionBar
  - Check backend logs for complete request lifecycle
  - Test with different event types (break block, chat, etc.)

---

## Testing Checklist

**Core Perception & Memory:**
- [ ] Villagers register in database on first initialization (villagers table)
- [ ] Layer 1 filters events by proximity (ignores events >32 blocks)
- [ ] Layer 1 filters events by Line of Sight (ignores occluded events)
- [ ] Layer 2 calculates vectors correctly (both MONOLITHIC and MICROSERVICES modes)
- [ ] Layer 3 seals episodes after 30s inactivity or context shift
- [ ] Layer 3 matches episodes to known concepts in database
- [ ] Layer 4 updates Working Memory in DynamicProperties
- [ ] Layer 4 syncs to PostgreSQL every 5 seconds
- [ ] Layer 5 writes episodes to database successfully (foreign key to villagers)
- [ ] Layer 5 initializes relationships table entries on first interaction
- [ ] Layer 6 generates valid IntentPackets with speak/idle actions
- [ ] Layer 7 executes speak actions via ActionBar
- [ ] Complete loop takes 2-10 seconds from event to response
- [ ] Multiple villagers can operate simultaneously without conflicts
- [ ] Foreign key constraints prevent orphaned episodes
- [ ] System handles network errors gracefully (no crashes)

**AI_MODE Configuration:**
- [ ] AI_MODE toggle works via `/scriptevent ai:toggle_mode`
- [ ] MONOLITHIC mode uses semantic_vector_manual columns
- [ ] MICROSERVICES mode uses semantic_vector_minilm columns
- [ ] Fast Intent Routing bypasses LLM for high-confidence intents (MICROSERVICES)
- [ ] T5-small generates episode summaries (MICROSERVICES)
- [ ] MiniLM embeddings cache properly (MICROSERVICES)

**DEBUG_MODE Features:**
- [ ] DEBUG_MODE toggle works via `/scriptevent ai:toggle_debug`
- [ ] Inference traces display in ActionBar
- [ ] Performance metrics logged to console
- [ ] GET /api/debug/status returns health and metrics
- [ ] GET /api/debug/villager/:id returns detailed state
- [ ] Performance warnings broadcast when thresholds exceeded
- [ ] Debug buffers clear when DEBUG_MODE disabled

**Structure Learning:**
- [ ] Villagers detect repeating patterns (3+ identical clusters)
- [ ] Templates save with both pattern_hash and embedding
- [ ] Structure recognition works in both AI modes
- [ ] Build tasks can be created and assigned
- [ ] Villagers pathfind to build positions
- [ ] Villagers place blocks within 4-block reach
- [ ] Build progress updates in build_tasks table
- [ ] Inventory checking prevents building without materials

---

## Known Limitations at End of Phase 1

**Core AI:**
- No relationship scoring (trust always defaults to 0.5)
- No identity tags or personality traits
- No advanced actions (stare, gesture) implemented
- No macro-pattern detection (Spleef, etc.)
- LLM context is minimal (last 3 episodes only, no personality)
- No gossip system (villagers don't share knowledge)

**Structure System:**
- Only single-template building (no blueprints)
- No blueprint composition (can't combine multiple templates)
- No autonomous building triggers (player commands only)
- No collaborative building (multi-villager coordination)
- No functional zone detection (just pattern matching)
- No structure repair or modification
- Pattern detection limited to exact repetitions (3+ times)
- No rotation/mirror variant detection in MONOLITHIC mode

**UI:**
- No player-facing structure browser UI
- All interactions via ActionBar and chat commands
- No visual build progress indicators (beyond ActionBar text)

**Debug:**
- Inference traces stored in memory only (not persisted)
- No time-travel debugging (can't replay past decisions)
- Vector visualization only via particle effects (no 3D overlay)

---

## File Structure After Phase 1

```
Immersive_Villagers BP/
├── scripts/
│   ├── layers/
│   │   ├── layer1_sensory.js
│   │   ├── layer2_vectorizer.js             # Enhanced with dual mode support
│   │   ├── layer3_sequencer.js              # Enhanced with Fast Intent Routing
│   │   ├── layer3_structure_detector.js     # NEW: Pattern detection
│   │   ├── layer4_working_memory.js
│   │   ├── layer7_action_layer.js
│   │   └── layer7_builder.js                # NEW: Building execution
│   ├── events/
│   │   ├── player_events.js
│   │   ├── entity_events.js
│   │   └── chat_events.js
│   ├── commands/
│   │   ├── config_commands.js               # AI_MODE & DEBUG_MODE toggles
│   │   └── build_commands.js                # NEW: Building commands
│   ├── config/
│   │   ├── constants.js
│   │   ├── vector_rules.js                  # MONOLITHIC mode rules
│   │   └── dynamic_properties_schema.js
│   ├── utils/
│   │   ├── vector_math.js
│   │   ├── entity_helpers.js
│   │   ├── time_helpers.js
│   │   ├── debug_logger.js                  # Enhanced with inference tracing
│   │   ├── network_helpers.js
│   │   ├── dynamic_properties_helpers.js
│   │   └── structure_helpers.js             # NEW: Spatial hashing, clustering
│   └── main.js
│
├── nodeDB/
│   ├── db/
│   │   ├── pool.js
│   │   └── schema.sql                       # Updated with structure tables
│   ├── queries/
│   │   ├── episodes.js
│   │   ├── working_memory.js
│   │   ├── concepts.js
│   │   ├── structures.js                    # NEW: Template & blueprint queries
│   │   └── build_tasks.js                   # NEW: Build task management
│   ├── routes/
│   │   ├── memory.js
│   │   ├── brain.js
│   │   ├── debug.js                         # Enhanced debug endpoints
│   │   ├── config_router.js                 # NEW: AI_MODE & DEBUG_MODE toggles
│   │   └── structures.js                    # NEW: Structure endpoints
│   ├── brain/
│   │   ├── scheduler.js
│   │   ├── llm_client.js
│   │   ├── prompt_builder.js
│   │   ├── model_loader.js                  # NEW: Transformers.js loader
│   │   ├── vector_engine.js                 # NEW: MiniLM wrapper
│   │   ├── intent_router.js                 # NEW: DistilBERT classifier
│   │   ├── episode_summarizer.js            # NEW: T5-small summarizer
│   │   └── ner_extractor.js                 # NEW: BERT NER
│   ├── middleware/
│   │   ├── validate.js
│   │   ├── logger.js
│   │   └── error.js
│   ├── utils/
│   │   └── logger.js
│   ├── app.js
│   ├── server.js
│   ├── package.json                         # Updated with @xenova/transformers
│   └── .env                                 # Added AI_MODE config
│
└── _docs/
    ├── Database_Schema.md                   # NEW: Complete schema
    ├── AI_Modes.md                          # NEW: Architecture comparison
    ├── Structure_System.md                  # NEW: Learning & building
    ├── Debug_System.md                      # NEW: Debug features
    ├── Brain Layers/
    │   ├── Layer 2 - Perception Layer.md    # Updated with dual mode support
    │   ├── Layer 3 - Brain Sequencer.md     # Updated with Fast Intent Routing
    │   └── Layer 6 - Reasoning and Language.md  # Updated with reduced responsibilities
    ├── tech-stack.md                        # Updated with new dependencies
    └── phases/
        ├── phase0-setup.md                  # Updated with config toggles
        └── phase1-mvp.md                    # THIS FILE
```

---

## Example Scenario (MVP Demo)

### Setup
- Villager "Barrel" spawned at (100, 64, 0)
- Barrel registered in villagers table (villagerID, home coordinates stored)
- Barrel's Working Memory initialized in DynamicProperties
- Player "Steve" at (105, 64, 5) — 6 blocks away
- Backend and LLM running, DEBUG_MODE enabled

### Interaction Flow

1. **T=0s:** Steve places diamond block at (103, 64, 3) — 4 blocks from Barrel's home
2. **T=0.01s:** Layer 1 detects event (proximity: 6 blocks, LOS: true)
3. **T=0.02s:** Layer 2 calculates vector [C: 0.8, V: 1.0, I: 0.45, S: 0.1, X: 0.1]
   - Base: placeBlock (C:+0.8), diamond (V:0.9), slow placement (I:0.3), solo activity (S:+0.1), simple block (X:0.1)
   - Near home multiplier: V and I × 1.5 → V:1.0 (capped), I:0.45
4. **T=0.03s:** Layer 3 appends vector to current episode
5. **T=5s:** Steve places 2 more diamond blocks (similar vectors)
6. **T=10s:** Steve walks away (inactivity timer starts)
7. **T=40s:** Layer 3 seals episode (seal reason: inactivity)
   - Episode: 3 vectors, average [C: 0.8, V: 1.0, I: 0.45, S: 0.1, X: 0.1], duration: 40s
8. **T=40.1s:** Layer 4 updates Working Memory (mood matches episode average)
9. **T=40.2s:** Layer 5 writes episode to PostgreSQL (HTTP POST)
10. **T=40.3s:** Backend queues LLM request
11. **T=42s:** LLM returns: { action: "speak", speechText: "Those diamond blocks look great!" }
12. **T=44s:** Layer 7 polls and retrieves IntentPacket
13. **T=44.1s:** Villager displays: `§e[Barrel]: Those diamond blocks look great!`
14. **Result:** Steve sees villager's response ~44 seconds after first block placed

---

## Performance Targets

### MONOLITHIC Mode

| Layer | Operation | Target Latency | Notes |
|-------|-----------|---------------|-------|
| Layer 1 | Event filtering | <2ms | Proximity + LOS check |
| Layer 2 | Manual vectorization | <1ms | Lookup + math operations |
| Layer 3 | Vector append | <0.5ms | Array push + averaging |
| Layer 4 | DynamicProperties update | <1ms | Single entity write |
| Layer 5 | Episode write (HTTP + DB) | 50-150ms | Non-blocking |
| Layer 6 | LLM inference | 2-4s | Async queue processing |
| Layer 7 | Polling + execution | 5-20ms | GET + ActionBar display |
| **Total (Fast Gear)** | **<5ms/event** | **Target met** ✅ |

---

### MICROSERVICES Mode

| Layer | Operation | Target Latency | Notes |
|-------|-----------|---------------|-------|
| Layer 1 | Event filtering | <2ms | Proximity + LOS check |
| Layer 2 | MiniLM vectorization | <20ms | Text description + embedding |
| Layer 3 | Intent routing (DistilBERT) | <50ms | Classification (bypasses LLM if high confidence) |
| Layer 3 | Vector append | <0.5ms | Array push + averaging |
| Layer 4 | DynamicProperties update | <1ms | Single entity write |
| Layer 5 | Episode write + T5 summary | 100-250ms | Non-blocking (includes summarization) |
| Layer 6 | LLM inference (reduced) | 1-2s | Shorter context, dialogue only |
| Layer 7 | Polling + execution | 5-20ms | GET + ActionBar display |
| **Total (Fast Gear)** | **<20ms/event** | **Acceptable** ✅ |
| **Fast-Routed Intents** | **50ms total** | **Bypasses LLM entirely** ⚡ |

**Structure System:**
- Pattern detection (MONOLITHIC): <1ms per block
- Pattern detection (MICROSERVICES): ~20ms per block (MiniLM embedding)
- Build execution: 1 block per 2 seconds (pathfinding + placement)

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
