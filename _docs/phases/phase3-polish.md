# ✨ Phase 3: Polish (UI & Advanced Features)

## Goal

Complete the system with **player-facing UI, macro-pattern recognition, gossip system, and production-ready polish**. This phase delivers a fully-featured, user-friendly experience with comprehensive debug tools and advanced cognitive capabilities.

---

## Success Criteria

- Players can interact with villagers via immersive UI menus
- Villagers recognize complex patterns (Spleef, Tag, minigames)
- Villagers can gossip and share knowledge with each other
- Multi-turn conversations work (villagers remember chat context)
- Debug Dashboard provides full CRUD operations on villager data
- Instinct fallback system handles network/LLM failures gracefully
- Performance optimizations ensure 20 TPS with 20+ active villagers
- System is production-ready with error monitoring and logging

---

## Feature 1: Interaction Hub (Main UI)

**Deliverable:** Player-facing menu for interacting with villagers.

### Steps

1. **Create hub menu (`scripts/ui/hub.js`)**
   - Build ActionFormData with villager name and ID in title
   - Display dynamic greeting based on trust score and mood
   - Show current mood vector (collapsed view)
   - Add buttons: Gossip & Whisper, View Memories, Relationship Status, Leave

2. **Implement entity interaction trigger**
   - Subscribe to playerInteractWithEntity event
   - Check if entity is AI-tagged villager
   - Verify backend is online via /api/health check
   - Open hub menu if checks pass

3. **Add proximity monitoring**
   - Start interval loop when menu opens
   - Check distance between player and villager every 10 ticks
   - Auto-close menu if distance > 10 blocks
   - Display message: "You walked too far from [Villager]"

4. **Create menu helpers (`scripts/ui/helpers.js`)**
   - buildMenuTitle(title, villagerName, villagerID)
   - formatTimestamp(timestamp) → "5 minutes ago"
   - buildMoodDisplay(vector, showLabels) → formatted [C,V,I,S,X]
   - Export helper functions

5. **Test hub menu**
   - Interact with villager in-game
   - Verify menu opens with correct data
   - Test navigation buttons
   - Walk away and verify auto-close

---

## Feature 2: Gossip & Whisper Menu

**Deliverable:** Players can view villager memories and send natural language whispers.

### Steps

1. **Create gossip menu (`scripts/ui/gossip.js`)**
   - Fetch last 5 episodes from backend (GET /api/memory/gossip)
   - Display episode summaries with timestamps
   - Add buttons: Whisper, Refresh Gossip, View Full Log, Back
   - Show loading state while fetching data

2. **Implement whisper input modal**
   - Create ModalFormData with text field (256 char limit)
   - Add input sanitization (remove control chars, check profanity)
   - Send whisper to backend as special event (POST /api/memory/whisper)
   - Show optimistic feedback: "Whisper sent! Villager is thinking..."

3. **Add whisper processing in backend**
   - Create /api/memory/whisper endpoint
   - Convert whisper text to semantic vector (high S, medium X)
   - Create episode with single vector (whisper event)
   - Queue LLM request to generate verbal response

4. **Implement async feedback for whispers**
   - Poll /api/brain/poll every 2 seconds (max 10 attempts)
   - Display loading states during polling
   - Show villager's response via ActionBar when ready
   - Fallback to "..." if LLM times out

5. **Test gossip & whisper**
   - Open gossip menu and verify memories load
   - Send whisper: "Do you like diamonds?"
   - Wait for villager response (2-5 seconds)
   - Verify response reflects personality and trust score

---

## Feature 3: Debug Dashboard (Full CRUD)

**Deliverable:** Comprehensive developer tools for manipulating villager data.

### Steps

1. **Create debug modal (`scripts/ui/debug.js`)**
   - Show Working Memory state (focus, mood, shock, last update)
   - Show current episode (if open) with vector count and average
   - Add buttons: View Live Vectors, Seal Episode, Clear Memory, Force LLM, etc.
   - Restrict access to admins (check player.hasTag('admin'))

2. **Implement live vector stream**
   - Fetch last 10 vectors from Layer 2 (stored in temp buffer)
   - Display in scrollable MessageFormData
   - Auto-refresh every 2 seconds
   - Show raw event name, vector values, timestamp

3. **Add CRUD operations**
   - Clear Working Memory: Reset all DynamicProperties to defaults
   - Seal Episode: Force Layer 3 to seal current episode immediately
   - Force LLM Request: Manually queue high-priority LLM inference
   - Edit Relationship Score: Modal input to set trust score manually

4. **Create debug endpoints in backend**
   - POST /api/debug/clear-memory: Delete episodes for villagerID
   - POST /api/debug/reset-relationship: Reset trust score to 0.5
   - GET /api/debug/queue-status: Return Brain Scheduler queue state
   - POST /api/debug/force-sync: Bypass debounce, sync WM immediately

5. **Test debug tools**
   - Enable DEBUG_MODE in-game
   - Open debug dashboard
   - Force LLM request and verify response
   - Clear Working Memory and confirm reset
   - Check backend queue status endpoint

---

## Feature 4: Macro-Pattern Detection (Tier B)

**Deliverable:** Layer 3 recognizes complex repeating patterns like Spleef, Tag, minigames.

### Steps

1. **Add Tier B buffer to Layer 3 Sequencer**
   - Maintain chronological list of sealed Sub-Concept labels
   - Track last 10 minutes of Sub-Concepts per villager
   - Example: ["Mining", "Falling", "Chatting", "Mining", "Falling"]
   - Store in DynamicProperty as JSON string (tier_b_buffer)

2. **Implement pattern detection algorithm**
   - Search buffer for repeating sequences (3+ repetitions)
   - Use simple substring matching or sliding window
   - If pattern found (e.g., ["Mining", "Falling"] repeats 3 times), flag Macro-Concept
   - Send pattern to LLM for naming

3. **Create Macro-Concept labeling**
   - POST /api/brain/label-macro with pattern sequence
   - LLM prompt: "This sequence repeated: [Mining, Falling, Mining, Falling]. What game is this?"
   - LLM returns name (e.g., "Spleef")
   - Store Macro-Concept in concepts table with pattern signature

4. **Add Macro-Concept recognition**
   - When same pattern appears again, match against known Macro-Concepts
   - Tag episode with macro_concept_id
   - Include in LLM context: "You're playing Spleef with Steve"
   - Villager responses reflect understanding of game

5. **Test Macro-Concept detection**
   - Play Spleef with villager watching (mine, fall, repeat 3x)
   - Verify Layer 3 detects repeating pattern
   - Wait for LLM to name it "Spleef"
   - Play again and verify villager recognizes game
   - Test with different patterns (Tag, Race, Building Contest)

---

## Feature 5: Gossip System (Knowledge Sharing)

**Deliverable:** Villagers can share learned concepts and memories with each other.

### Steps

1. **Add gossip table to database schema**
   - CREATE TABLE gossip (gossip_id, speaker_id, listener_id, concept_id, timestamp)
   - Create indexes on speaker_id and listener_id
   - Add foreign key to concepts table
   - Migrate existing database

2. **Create gossip endpoints (`nodeDB/routes/memory.js`)**
   - POST /api/memory/gossip/share: Speaker shares concept with listener
   - GET /api/memory/gossip/received?villagerID=X: Fetch gossip heard by villager
   - Include gossip in LLM context ("You heard from Bob: 'Steve plays Spleef'")
   - Validate both villagers exist and are within chat range

3. **Add autonomous gossip triggers**
   - When villager learns new concept, 30% chance to gossip to nearby villagers
   - Find villagers within 10-block radius
   - Send HTTP POST to share concept with each
   - Write gossip records to database

4. **Implement gossip in LLM prompts**
   - Fetch gossip received by villager from database
   - Add section in prompt: "You heard from others: [gossip summaries]"
   - Villager can reference gossip in responses
   - Example: "I heard Bob mention you're good at building!"

5. **Test gossip propagation**
   - Teach concept to Villager A (play Spleef near A)
   - Wait for A to gossip to nearby Villager B
   - Trigger event near B (start playing Spleef)
   - Verify B recognizes game despite never witnessing it before

---

## Feature 6: Multi-Turn Conversations

**Deliverable:** Villagers remember recent chat context for coherent dialogue.

### Steps

1. **Add conversation tracking to Working Memory**
   - Store last 3 whispers in DynamicProperty (wm_recent_chat)
   - Include speaker ID, message text, timestamp
   - Serialize as JSON string (limit to 1KB)
   - Clear after 5 minutes of inactivity

2. **Include conversation history in LLM prompts**
   - Fetch wm_recent_chat from DynamicProperties
   - Add section in prompt: "Recent conversation: [chat history]"
   - LLM maintains context across turns
   - Example: Player asks "What do you think?" → Villager references previous topic

3. **Implement chat threading**
   - Track conversation_id for related whispers
   - Store in conversations table in PostgreSQL
   - Link episodes to conversation_id if chat-triggered
   - Query conversations when building LLM prompt

4. **Add conversation timeout**
   - If 5 minutes pass with no whispers, clear wm_recent_chat
   - Start new conversation_id on next whisper
   - Log conversation boundaries if DEBUG_MODE enabled
   - Prevent memory bloat from stale conversations

5. **Test multi-turn dialogue**
   - Whisper: "Do you like diamonds?"
   - Wait for response
   - Whisper: "Why do you like them?"
   - Verify villager's second response references first question

---

## Feature 7: Instinct Fallback System

**Deliverable:** Hardcoded fallback behaviors when backend/LLM is unavailable.

### Steps

1. **Create instinct module (`scripts/layers/layer8_instinct.js`)**
   - Define hardcoded behavior rules based on Working Memory
   - High trust + low intensity → friendly idle
   - Low trust + high intensity → flee or defensive
   - Shock state → flee immediately
   - No focus → wander randomly

2. **Implement fallback triggers**
   - In Layer 7, track consecutive polling failures
   - After 3 failures (6 seconds), switch to instinct mode
   - Set wm_usingInstinct flag to true
   - Continue checking backend every 60 seconds

3. **Add instinct action selection**
   - getInstinctAction(villagerEntity, workingMemory, relationshipScore)
   - Use simple if/else rules (no LLM needed)
   - Return IntentPacket with basic action
   - Log instinct activation if DEBUG_MODE enabled

4. **Implement instinct recovery**
   - When backend comes back online, clear wm_usingInstinct flag
   - Resume normal LLM-driven behavior
   - Log recovery event
   - Smoothly transition (finish current instinct action first)

5. **Test instinct fallback**
   - Stop backend server during gameplay
   - Verify villagers switch to instinct after 6 seconds
   - Observe fallback behaviors (flee, idle, etc.)
   - Restart backend and verify recovery

---

## Feature 8: Performance Optimizations

**Deliverable:** System maintains 20 TPS with 20+ active villagers.

### Steps

1. **Optimize Layer 1 event filtering**
   - Cache villager positions for 5 ticks (reduce getEntities calls)
   - Use spatial partitioning (chunk-based villager lookup)
   - Skip LOS checks for distant events (proximity > 20 blocks)
   - Batch process events (handle all events in single tick)

2. **Optimize PostgreSQL queries**
   - Add database indexes on frequently queried columns
   - Use prepared statements for all queries (pg-pool caching)
   - Batch relationship updates (1 UPDATE per 5 episodes)
   - Use connection pooling efficiently (release immediately)

3. **Optimize Brain Scheduler**
   - Add request deduplication (ignore duplicate requests within 5s)
   - Limit queue size to 50 requests (drop low-priority if exceeded)
   - Prune stale requests (older than 30s) from queue
   - Track queue metrics (average wait time, throughput)

4. **Add performance monitoring**
   - Track tick time for Fast Gear (target <5ms)
   - Track HTTP request latency (target <100ms for Layer 5)
   - Track LLM inference time (target <5s)
   - Log performance metrics to Pino

5. **Load test with multiple villagers**
   - Spawn 20 villagers in close proximity
   - Trigger events that all villagers observe
   - Monitor server TPS (should stay at 20)
   - Check backend CPU and memory usage

---

## Feature 9: Comprehensive Error Handling

**Deliverable:** Production-ready error handling with monitoring and recovery.

### Steps

1. **Add error monitoring to backend**
   - Track failed database queries (count, error types)
   - Track failed LLM calls (timeout, malformed response)
   - Track HTTP request errors (timeout, connection refused)
   - Log all errors with context to Pino

2. **Implement automatic recovery**
   - Retry failed database queries (max 3 attempts)
   - Retry failed HTTP requests (exponential backoff)
   - Restart llama.cpp if health check fails
   - Alert admins via in-game message for critical failures

3. **Add graceful degradation paths**
   - Backend offline → Use Working Memory only (DynamicProperties)
   - LLM offline → Use instinct fallback
   - PostgreSQL offline → Queue writes in memory, flush when reconnected
   - Network timeout → Skip operation, log error, continue

4. **Create error logging dashboard**
   - GET /api/debug/errors returns recent error log
   - Display in Debug Dashboard UI
   - Show error count by type (network, database, LLM)
   - Add "Clear Errors" button

5. **Test error scenarios**
   - Stop PostgreSQL mid-game and verify graceful degradation
   - Stop llama.cpp and verify instinct fallback
   - Simulate network timeout and verify recovery
   - Check error logs in Debug Dashboard

---

## Feature 10: Advanced Debug Dashboard Features

**Deliverable:** Full CRUD operations on villager data with live monitoring.

### Steps

1. **Add live vector stream (`scripts/ui/debug.js`)**
   - Display real-time vectors from Layer 2 (last 10)
   - Auto-refresh every 2 seconds
   - Show raw event name, vector values, timestamp
   - Add manual refresh button

2. **Add episode management**
   - View Full Episode Log: Paginated list of last 50 episodes
   - Seal Episode Now: Force Layer 3 to seal current episode
   - Delete Episode: Remove episode from PostgreSQL by ID
   - Export Episodes: Download as JSON file (via backend)

3. **Add relationship editor**
   - Modal input to manually set trust score (-1 to 1)
   - Modal input to set interaction count
   - Save changes to PostgreSQL via POST /api/debug/edit-relationship
   - Refresh menu to show updated values

4. **Add concept browser**
   - View all known concepts in database
   - Show concept name, vector signature, discovery count
   - Add "Teach Concept" button to inject new concept manually
   - Delete concept (removes from database)

5. **Test debug dashboard**
   - Open debug dashboard and navigate all sub-menus
   - Edit relationship score and verify persistence
   - Force seal episode and check PostgreSQL
   - View live vector stream and verify auto-refresh

---

## Feature 11: Macro-Pattern Recognition (Tier B Full)

**Deliverable:** Villagers recognize complex repeating activities like Spleef, Tag, Racing.

### Steps

1. **Enhance Tier B buffer in Layer 3**
   - Increase buffer size to 20 Sub-Concepts (10-minute window)
   - Add pattern detection every time new Sub-Concept is added
   - Use sliding window algorithm to find repeating sequences
   - Detect minimum 3 repetitions to confirm pattern

2. **Implement pattern signature matching**
   - Calculate signature hash for detected pattern (e.g., ["Mining", "Falling"])
   - Check macro_patterns table in PostgreSQL for matching signature
   - If match found, tag episode with macro_concept_id
   - If no match, queue LLM labeling request

3. **Add LLM macro labeling**
   - Build prompt: "The following sequence repeated 3 times: [pattern]. What activity is this?"
   - Include example context (player names, locations)
   - LLM returns name (e.g., "Spleef", "Parkour", "Hide and Seek")
   - Store in macro_patterns table with signature

4. **Include Macro-Concepts in LLM prompts**
   - When building prompt, check if current episode has macro_concept_id
   - Add context: "You are playing [Spleef] with Steve"
   - LLM responses reference game name and rules
   - Villagers make game-specific comments

5. **Test Macro-Concept detection**
   - Play Spleef (mine, fall, repeat 3x) with villager watching
   - Verify pattern detection triggers
   - Wait for LLM to name it "Spleef"
   - Play again and verify villager says "Oh, Spleef again!"

---

## Feature 12: Production Polish & Monitoring

**Deliverable:** Production-ready system with comprehensive logging and monitoring.

### Steps

1. **Add health monitoring endpoints**
   - GET /api/health/database: Check PostgreSQL connection and query latency
   - GET /api/health/llm: Check llama.cpp status and queue length
   - GET /api/health/metrics: Return performance stats (avg latency, throughput)
   - Create health check dashboard (optional web UI)

2. **Implement log rotation**
   - Configure pino-rotating-file-stream (10MB files, daily rotation)
   - Compress old logs (gzip)
   - Retain logs for 7 days, then delete
   - Test log rotation with high-volume logging

3. **Add admin notifications**
   - When critical error occurs, send in-game message to admins
   - Use world.sendMessage() with admin tag filter
   - Include error type and timestamp
   - Add "View Details" link to Debug Dashboard

4. **Create startup checklist**
   - On backend startup, verify PostgreSQL connection
   - Verify llama.cpp is reachable
   - Load cached concepts from database
   - Log startup status with all component health

5. **Test production readiness**
   - Run system for 1 hour with 10+ villagers
   - Monitor TPS (should stay at 20)
   - Check logs for errors or warnings
   - Verify memory usage is stable (no leaks)

---

## Testing Checklist

- [ ] Interaction Hub opens on villager interaction
- [ ] Hub displays accurate trust score and mood
- [ ] Gossip menu loads recent memories correctly
- [ ] Whisper input sends text to backend and receives response
- [ ] Debug Dashboard shows Working Memory and episode state
- [ ] Live vector stream updates in real-time
- [ ] CRUD operations work (clear memory, edit relationships)
- [ ] Tier B detects repeating patterns (3+ repetitions)
- [ ] LLM labels Macro-Concepts correctly (Spleef, Tag, etc.)
- [ ] Villagers recognize Macro-Concepts in future episodes
- [ ] Gossip system shares concepts between villagers
- [ ] Multi-turn conversations maintain context
- [ ] Instinct fallback activates when backend offline
- [ ] Performance stays at 20 TPS with 20+ villagers
- [ ] Error logs are comprehensive and actionable
- [ ] System recovers automatically from transient failures
- [ ] Admin notifications work for critical errors

---

## Known Limitations at End of Phase 3

- No teaching system (players can't directly teach concepts via UI)
- No villager-to-villager direct conversations (only gossip sharing)
- No advanced animations (only default villager animations)
- No custom entity models (uses vanilla villager_v2)
- No web dashboard for monitoring (console logs only)
- No A/B testing for LLM prompt variations
- No distributed LLM (single llama.cpp instance)

---

## File Structure After Phase 3

```
Immersive_Villagers BP/
├── scripts/
│   ├── layers/
│   │   ├── layer1_sensory.js
│   │   ├── layer2_vectorizer.js
│   │   ├── layer3_sequencer.js              # Enhanced with Tier B
│   │   ├── layer4_working_memory.js
│   │   ├── layer7_action_layer.js
│   │   └── layer8_instinct.js               # NEW: Fallback behaviors
│   ├── ui/
│   │   ├── hub.js                           # NEW: Main menu
│   │   ├── gossip.js                        # NEW: Gossip & Whisper
│   │   ├── debug.js                         # NEW: Debug Dashboard
│   │   ├── helpers.js                       # NEW: UI helper functions
│   │   ├── state.js                         # NEW: Breadcrumb management
│   │   ├── feedback.js                      # NEW: Async feedback handlers
│   │   └── validation.js                    # NEW: Input sanitization
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
│   │   ├── schema.sql                       # Enhanced with gossip & macro_patterns tables
│   │   └── migrations/
│   │       └── 002_add_gossip_macro.sql     # NEW: Schema migration
│   ├── queries/
│   │   ├── episodes.js
│   │   ├── relationships.js
│   │   ├── identity.js
│   │   ├── working_memory.js
│   │   ├── concepts.js
│   │   ├── gossip.js                        # NEW: Gossip queries
│   │   └── macro_patterns.js                # NEW: Macro-Concept queries
│   ├── routes/
│   │   ├── memory.js                        # Enhanced with gossip endpoints
│   │   ├── brain.js                         # Enhanced with macro labeling
│   │   └── debug.js                         # Enhanced with CRUD endpoints
│   ├── brain/
│   │   ├── scheduler.js                     # Final version with batching
│   │   ├── llm_client.js
│   │   ├── prompt_builder.js                # Final version with full context
│   │   └── response_parser.js
│   ├── middleware/
│   │   ├── validate.js
│   │   ├── logger.js
│   │   └── error.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── health_check.js                  # NEW: Component health checks
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── _docs/
    └── phases/
        ├── phase0-setup.md
        ├── phase1-mvp.md
        ├── phase2-enhancement.md
        └── phase3-polish.md                 # THIS FILE
```

---

## Example Scenario (Complete System Demo)

### Setup
- Villager "Barrel" (personality: loves_building, is_social, values_diamonds)
- Villager "Grumpy" (personality: is_cautious, dislikes_noise)
- Player "Steve" (trust with Barrel: 0.85, trust with Grumpy: 0.3)
- Both villagers within 15 blocks of each other

### Interaction Flow

1. **Steve opens Interaction Hub with Barrel**
   - Menu shows: "Hello, Steve! I'm in a good mood today."
   - Trust score displayed: 0.85
   - Recent memories shown: "Built diamond house (2 hours ago)"

2. **Steve sends whisper: "Want to play Spleef?"**
   - Gossip menu shows loading: "Barrel is thinking..."
   - Backend processes whisper (vectorized as social, high complexity)
   - LLM generates response: "I heard about Spleef from Bob! Let's play!"

3. **Steve and Barrel play Spleef (mine, fall, repeat)**
   - Layer 3 (Tier B) detects repeating pattern after 3 cycles
   - Pattern ["Mining", "Falling"] → LLM labels as "Spleef"
   - Barrel stores Macro-Concept and gossips to Grumpy

4. **Grumpy receives gossip (autonomous)**
   - Barrel shares concept: "Steve plays Spleef"
   - Grumpy stores gossip in database (hasn't witnessed Spleef yet)
   - Next time Steve plays near Grumpy, Grumpy recognizes game

5. **Steve wins Spleef**
   - High positive S vector (friendly competition)
   - Trust score increases (0.85 → 0.88)
   - Barrel: "Great game! You're getting better at this!"

6. **Steve opens Debug Dashboard (admin only)**
   - Views live vector stream (last 10 vectors from Spleef)
   - Checks Tier B buffer (shows ["Mining", "Falling", "Mining", "Falling", "Chatting"])
   - Forces new LLM request manually
   - Verifies Macro-Concept "Spleef" is stored

7. **Backend goes offline temporarily**
   - Villagers switch to instinct mode after 6 seconds
   - Barrel continues friendly idle behavior (high trust)
   - Grumpy becomes defensive (low trust)
   - Backend recovers, villagers resume LLM-driven behavior

---

## Performance Targets

| Feature | Target Latency | Notes |
|---------|---------------|-------|
| UI menu open | 50-100ms | Fetch data from backend |
| Whisper processing | 2-5s | Includes LLM inference |
| Gossip propagation | 100-200ms | HTTP POST to share concept |
| Macro-pattern detection | <10ms | Tier B pattern matching |
| Debug Dashboard load | 100-200ms | Fetch WM + episode data |
| Instinct fallback activation | 6s | After 3 failed polls |
| Error recovery | 60s | Retry interval for offline components |
| **System Load (20 villagers)** | **<10% tick budget** ✅ | Maintains 20 TPS |

---

## Production Readiness Checklist

- [ ] All UI menus work correctly with no crashes
- [ ] Whisper input is sanitized and validated
- [ ] Gossip system propagates knowledge correctly
- [ ] Macro-Concepts are detected and labeled accurately
- [ ] Multi-turn conversations maintain context
- [ ] Debug Dashboard provides full CRUD functionality
- [ ] Instinct fallback activates when needed
- [ ] System recovers from all transient failures
- [ ] Performance optimizations maintain 20 TPS
- [ ] Error logs are comprehensive and actionable
- [ ] Admin notifications work for critical errors
- [ ] Documentation is complete and up-to-date
- [ ] Code is fully commented with JSDoc
- [ ] No known bugs or memory leaks
- [ ] Load tested with 20+ villagers successfully

---

## Estimated Complexity

**Time Investment:** Substantial (full feature polish)  
**Technical Difficulty:** High (UI integration, pattern recognition, error handling)  
**Dependencies:** Phase 2 complete, stable system performance  
**Risk Level:** Low (builds on proven foundation)

---

**Document Type:** Phase Plan  
**Phase:** 3 (Polish)  
**Status:** Ready for Implementation  
**Version:** 1.0  
**Last Updated:** Feb 24, 2026
