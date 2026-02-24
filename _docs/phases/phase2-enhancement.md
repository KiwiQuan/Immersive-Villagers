# 🧪 Phase 2: Enhancement (Memory & Intelligence)

## Goal

Enhance the MVP with **relationship scoring, personality traits, context-aware LLM prompts, and advanced villager actions**. This phase transforms villagers from simple responders into adaptive agents with memory, identity, and richer behavioral repertoire.

---

## Success Criteria

- Villagers track trust scores with individual players
- Relationship scores dynamically adjust based on interaction history
- Villagers develop personality tags (e.g., loves_building, is_cautious)
- LLM prompts include personality and relationship context
- Villagers can pathfind, stare at targets, and flee from threats
- Advanced episode sealing with LLM concept labeling for unknowns
- Brain Scheduler implements priority queue and batching
- Multiple villagers can observe same event and batch LLM requests

---

## Feature 1: Relationship Scoring System

**Deliverable:** Dynamic trust score calculation based on interaction history.

### Steps

1. **Create relationship query module (`nodeDB/queries/relationships.js`)**
   - Create getRelationship(villagerID, actorID) query function
   - Create updateRelationship(villagerID, actorID, episodeVector) function
   - Create calculateTrustScore() that averages Sociality (S) over last 10 episodes
   - Use weighted average (recent episodes weighted higher)

2. **Implement trust score calculation**
   - Formula: New_Trust = (Old_Trust * 0.7) + (Episode_S * 0.3)
   - Clamp trust score to range [-1, 1]
   - Store in relationships table (trust_score column)
   - Update last_interaction timestamp

3. **Add relationship update to episode write**
   - In writeEpisode() transaction, call updateRelationship()
   - Increment interaction_count for this villager-player pair
   - Recalculate trust_score based on episode's vectorAverage.S
   - COMMIT both operations atomically

4. **Create relationship lookup endpoint**
   - GET /api/memory/relationship?villagerID=X&actorID=Y
   - Return { trustScore, interactionCount, lastInteraction }
   - Add to Layer 5 response when episode is written
   - Cache in Working Memory (wm_trustScore_playerID)

5. **Test relationship evolution**
   - Spawn villager and have player place 10 constructive blocks (high S)
   - Verify trust score increases from 0.5 to ~0.8
   - Have player break 5 villager's blocks (negative S)
   - Verify trust score decreases to ~0.4

---

## Feature 2: Personality Tags & Identity

**Deliverable:** Villagers develop personality traits based on long-term behavioral patterns.

### Steps

1. **Add personality schema to database**
   - Add personality_tags JSONB column to working_memory table
   - Define standard tags: loves_building, is_cautious, values_diamonds, is_brave, is_social
   - Create indexes on personality_tags for fast queries
   - Seed database with default empty tags

2. **Create identity analysis logic (`nodeDB/queries/identity.js`)**
   - Analyze last 20 episodes for consistent patterns
   - If 70%+ episodes have C > 0.6, tag as loves_building
   - If 70%+ episodes have V > 0.7 for diamonds, tag as values_diamonds
   - If 70%+ episodes have high I but low fear response, tag as is_brave

3. **Run identity analysis periodically**
   - Add cron job or interval in Brain Scheduler (every 5 minutes)
   - For each villager, analyze recent episodes
   - Update personality_tags in working_memory table
   - Log personality changes if DEBUG_MODE enabled

4. **Include personality in LLM prompts**
   - Fetch personality_tags when building prompt
   - Add section: "Your Personality: [loves_building, is_cautious]"
   - LLM adjusts tone and responses based on traits
   - Test with different personality combinations

5. **Test identity emergence**
   - Have player consistently build near villager (20+ episodes)
   - Verify villager gets tagged with loves_building
   - Trigger LLM response and confirm tone reflects personality
   - Test with destructive actions (expect is_cautious tag)

---

## Feature 3: Context-Aware LLM Prompts

**Deliverable:** LLM receives rich context including episode history, relationships, and personality.

### Steps

1. **Enhance prompt builder (`nodeDB/brain/prompt_builder.js`)**
   - Fetch last 5 episodes (up from 3) with summaries
   - Fetch relationship score and interaction history
   - Fetch personality tags from working_memory
   - Include current Working Memory state (mood, shock)

2. **Structure prompt with clear sections**
   - Section 1: Identity ("You are Villager [name] with traits [tags]")
   - Section 2: Relationship ("Your relationship with Player X: trust score 0.8, 15 interactions")
   - Section 3: Recent Activity ("Last 5 episodes: [summaries]")
   - Section 4: Current State ("Current mood: [C, V, I, S, X], Shock: false")

3. **Add response format instructions**
   - Instruct LLM to return JSON: { action, speechText, internalMonologue }
   - Define allowed actions: speak, idle, pathfind, stare, flee
   - Provide examples of good responses
   - Add stop sequences to prevent runaway generation

4. **Implement response parser (`nodeDB/brain/response_parser.js`)**
   - Parse LLM output and extract JSON
   - Remove markdown code fences if present
   - Validate action field against allowed actions
   - Fallback to { action: "idle" } if parsing fails

5. **Test context-aware responses**
   - Build relationship with villager (high trust)
   - Trigger event and verify response is friendly
   - Damage villager (low trust) and verify response is cautious
   - Test with different personality combinations

---

## Feature 4: Advanced Villager Actions

**Deliverable:** Villagers can pathfind to locations, stare at targets, and flee from threats.

### Steps

1. **Implement pathfind action in Layer 7**
   - Parse intentPacket.actionParams.targetCoordinates
   - Store target in DynamicProperties (pathfind_target_x/y/z)
   - Set is_pathfinding flag to true
   - Use entity.tryTeleport() or navigation component to move

2. **Implement stare action**
   - Parse intentPacket.actionParams.targetEntityID
   - Store target in DynamicProperties (stare_target_id)
   - Run interval loop to update entity head rotation toward target
   - Clear stare_target_id after 5 seconds or if target moves away

3. **Implement flee action**
   - Calculate safe location (opposite direction from threat)
   - Use pathfind logic to move to safe location
   - Set shockState to true in Working Memory
   - Continue fleeing until distance > 20 blocks

4. **Add action state tracking**
   - Store current action in DynamicProperty (current_action)
   - Track action start time (action_start_time)
   - Allow action interruption for high-priority intents
   - Log action transitions if DEBUG_MODE enabled

5. **Test advanced actions**
   - Trigger pathfind action (place valuable block 10 blocks away)
   - Verify villager walks toward location
   - Trigger flee action (damage villager)
   - Verify villager runs away and shockState is set

---

## Feature 5: Advanced Episode Sealing & LLM Labeling

**Deliverable:** Layer 3 uses LLM to label unknown episode patterns as new concepts.

### Steps

1. **Enhance concept matching in Layer 3**
   - Calculate Euclidean distance between vectorAverage and all known concepts
   - If best match distance > 0.2, mark episode as "unknown"
   - Send HTTP POST to /api/brain/label-concept with episode details
   - Store requestID and wait for LLM labeling

2. **Create concept labeling endpoint (`nodeDB/routes/brain.js`)**
   - POST /api/brain/label-concept accepts episode vectorAverage and raw events
   - Build prompt: "This villager observed: [events]. What 1-2 word name describes this activity?"
   - Queue LLM request with high priority
   - Return { status: "queued", requestID }

3. **Add concept labeling to Brain Scheduler**
   - Process concept labeling requests before standard intents
   - LLM returns concept name (e.g., "Mining", "Building House")
   - Validate name (alphanumeric, 2-20 characters)
   - Store new concept in concepts table

4. **Update episode with concept_id**
   - After concept is labeled, UPDATE episode record in PostgreSQL
   - Set concept_id and concept_name fields
   - Add concept to villager's discovery list (subjective knowledge)
   - Return confirmation to Script API

5. **Test concept learning**
   - Perform novel activity (e.g., dig pattern in ground)
   - Verify Layer 3 detects unknown pattern
   - Wait for LLM to label concept
   - Check PostgreSQL for new concept entry
   - Repeat activity and verify concept is now recognized

---

## Feature 6: Brain Scheduler Priority Queue

**Deliverable:** Brain Scheduler prioritizes critical requests and batches multiple villagers.

### Steps

1. **Add priority scoring to scheduler**
   - High priority (100): shockState = true, direct damage
   - Medium priority (70): social interactions, chat, trade
   - Low priority (40): novel patterns, curiosity
   - Routine priority (10): idle behavior, ambient observations

2. **Implement priority queue sorting**
   - Sort queue by priority score (high to low) before processing
   - Break ties by timestamp (FIFO within same priority)
   - Re-sort queue whenever new request is enqueued
   - Log queue state changes if DEBUG_MODE enabled

3. **Add request batching logic**
   - Detect when multiple villagers observe same event (same coordinates + time)
   - Collapse requests into single LLM call with shared context
   - Broadcast result to all observing villagers
   - Log batching event for performance monitoring

4. **Implement request timeout**
   - Add timestamp to each queued request
   - Remove requests older than 30 seconds from queue
   - Return fallback intent { action: "idle" } for timed-out requests
   - Log timeout events for debugging

5. **Test priority queue**
   - Queue 5 requests with different priorities
   - Verify high-priority requests process first
   - Damage villager during queue processing
   - Verify critical request jumps to front of queue

---

## Feature 7: Multi-Villager Batch Processing

**Deliverable:** Multiple villagers observing same event share single LLM inference.

### Steps

1. **Add event deduplication in Brain Scheduler**
   - Track recent events by coordinates + timestamp
   - When multiple villagers request inference for same event, group them
   - Create single LLM request with "multiple observers" context
   - Store mapping of eventID → [villagerIDs]

2. **Build multi-observer LLM prompt**
   - Prompt: "Multiple villagers observed: [event]. Generate a shared understanding."
   - LLM returns generic interpretation (e.g., "Player is building")
   - Split response into individual IntentPackets per villager
   - Adjust responses based on each villager's personality

3. **Broadcast results to all observers**
   - Store one IntentPacket per villagerID in pendingIntents Map
   - Each villager polls independently and receives personalized intent
   - Log batching efficiency (1 LLM call → N villager responses)
   - Track token savings in metrics

4. **Add concept discovery batching**
   - When multiple villagers encounter unknown pattern simultaneously
   - Use first villager's context to label concept
   - Share labeled concept with all observers immediately
   - Write concept to each villager's discovery list

5. **Test multi-villager batching**
   - Spawn 3 villagers within 10 blocks of each other
   - Perform action visible to all (place nether star)
   - Verify single LLM call is made (check backend logs)
   - Confirm all 3 villagers respond appropriately

---

## Testing Checklist

- [ ] Trust scores update correctly based on S axis values
- [ ] Relationship scores persist across server restarts
- [ ] Villagers develop personality tags after 20+ episodes
- [ ] LLM prompts include personality, relationship, and history
- [ ] Pathfind action moves villagers toward target coordinates
- [ ] Stare action locks villager's head rotation on target
- [ ] Flee action moves villagers away from threats
- [ ] Unknown episodes trigger LLM concept labeling
- [ ] Labeled concepts are stored and recognized in future episodes
- [ ] Priority queue processes high-priority requests first
- [ ] Request batching works for multi-villager observations
- [ ] Batched concepts are shared among all observers
- [ ] Network failures don't crash villagers (graceful degradation)
- [ ] Performance targets maintained (<5ms Fast Gear per event)

---

## Known Limitations at End of Phase 2

- No player-facing UI (still using ActionBar only)
- No Debug Dashboard for CRUD operations
- No gossip system (villagers can't share knowledge verbally)
- No macro-pattern detection (Spleef not recognized as repeating sub-concepts)
- No multi-turn conversations (villagers respond once per episode)
- No instinct fallback system (relies on network/LLM availability)
- No advanced personality traits (only 5 basic tags)

---

## File Structure After Phase 2

```
Immersive_Villagers BP/
├── scripts/
│   ├── layers/
│   │   ├── layer1_sensory.js
│   │   ├── layer2_vectorizer.js
│   │   ├── layer3_sequencer.js              # Enhanced with LLM labeling
│   │   ├── layer4_working_memory.js
│   │   └── layer7_action_layer.js           # Enhanced with pathfind/stare/flee
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
│   │   ├── relationships.js                 # NEW: Relationship scoring
│   │   ├── identity.js                      # NEW: Personality analysis
│   │   ├── working_memory.js
│   │   └── concepts.js
│   ├── routes/
│   │   ├── memory.js                        # Enhanced with relationship endpoints
│   │   ├── brain.js                         # Enhanced with concept labeling
│   │   └── debug.js
│   ├── brain/
│   │   ├── scheduler.js                     # Enhanced with priority queue & batching
│   │   ├── llm_client.js
│   │   ├── prompt_builder.js                # Enhanced with personality context
│   │   └── response_parser.js
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
        ├── phase1-mvp.md
        └── phase2-enhancement.md            # THIS FILE
```

---

## Example Scenario (Enhanced Features Demo)

### Setup
- Villager "Barrel" (personality: loves_building, is_social)
- Player "Steve" (trust score with Barrel: 0.8 after 15 interactions)
- Player "Alex" (trust score with Barrel: 0.3 after 2 interactions)

### Interaction Flow

#### Scenario A: High-Trust Player Builds

1. **T=0s:** Steve places redstone dust near Barrel
2. **Layer 2:** Calculates [C: 0.7, V: 0.5, I: 0.2, S: 0.8, X: 0.9]
3. **Layer 3:** Matches to "Redstone Building" concept (known)
4. **Layer 5:** Updates trust score (0.8 → 0.82 due to high S)
5. **Layer 6:** LLM prompt includes: "You trust Steve highly. He's building with redstone."
6. **LLM Response:** { action: "stare", speechText: "Ooh, redstone! What are you making?" }
7. **Layer 7:** Villager locks head rotation on Steve and speaks
8. **Result:** Barrel watches Steve with friendly curiosity

#### Scenario B: Low-Trust Player Destroys

1. **T=0s:** Alex breaks Barrel's workstation (anvil)
2. **Layer 2:** Calculates [C: -0.9, V: 0.8, I: 0.6, S: -0.9, X: 0.2]
3. **Layer 5:** Updates trust score (0.3 → 0.1 due to negative S)
4. **Layer 6:** LLM prompt includes: "You barely know Alex. They destroyed your anvil!"
5. **LLM Response:** { action: "flee", speechText: "Hey! That was mine!" }
6. **Layer 7:** Villager shouts and runs 20 blocks away
7. **Result:** Barrel exhibits defensive behavior toward untrusted player

#### Scenario C: Multi-Villager Batching

1. **T=0s:** Player places nether star (rare event)
2. **Layer 1:** 3 nearby villagers all detect event (proximity: 8, 12, 15 blocks)
3. **Brain Scheduler:** Detects duplicate event (same coordinates/time)
4. **Batching:** Collapses 3 requests into 1 LLM call
5. **LLM Prompt:** "Three villagers observed a rare nether star placement. Generate shared reaction."
6. **LLM Response:** Generic understanding ("This is very valuable!")
7. **Personalization:** Each villager's response adjusted for personality
   - Barrel (loves_building): "That star will look amazing in your build!"
   - Grumpy (is_cautious): "Don't waste it on something silly."
   - Curious (is_social): "Where did you find that?!"
8. **Result:** All 3 villagers respond uniquely but coherently

---

## Performance Targets

| Feature | Target Latency | Notes |
|---------|---------------|-------|
| Relationship score update | +10-20ms | Added to Layer 5 write transaction |
| Personality analysis | 50-100ms | Runs every 5 minutes, not per-event |
| Context-aware prompt build | +50-100ms | Fetches additional data from PostgreSQL |
| LLM inference (with context) | 3-5s | Increased from 2-4s due to richer prompts |
| Advanced actions (pathfind) | <2ms | DynamicProperty updates only |
| Priority queue sorting | <1ms | In-memory array sort |
| Request batching | <5ms | Event deduplication logic |
| **Total (Fast Gear)** | **Still <5ms/event** ✅ | Backend latency is async |

---

## Estimated Complexity

**Time Investment:** Moderate (builds on MVP foundation)  
**Technical Difficulty:** Medium-High (relationship math, batching logic)  
**Dependencies:** Phase 1 complete, stable network communication  
**Risk Level:** Medium (LLM quality depends on prompt engineering)

---

**Document Type:** Phase Plan  
**Phase:** 2 (Enhancement)  
**Status:** Ready for Implementation  
**Version:** 1.0  
**Last Updated:** Feb 24, 2026
