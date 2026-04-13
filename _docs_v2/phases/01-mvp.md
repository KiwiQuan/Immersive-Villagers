# Phase 01 — MVP (Minimal, Usable “Villager Brain”)

## Goal
Deliver a **minimal usable Immersive Villagers experience**: villagers perceive nearby player activity, form short episodes, update working memory, persist meaningful events, and respond with basic dialogue + a restricted set of actions. This is the first phase where the system provides its **primary value**: “villagers feel aware and reactive with memory.”

## Scope / Deliverables
- **Fast Gear (scripts, Layers 1–4)** implemented with strict layer I/O packets.
- **Slow Gear (nodeDB, Layers 5–7 + Scheduler)** implemented over **HTTP** (reliable default).
- **Cache-first working memory** (`trackedVillagers` Map) with DP backup and periodic DB sync.
- **Minimal Long-Term Memory**: episodes + relationships + working_memory tables (subset of full schema).
- **LLM-driven dialogue** via llama.cpp (HTTP) for Layer 6, using the action dictionary.
- **Action Layer** executes a restricted command set and reports success/failure back to Layer 4.
- **Debug UX**: server-ui “brain inspector” (MVP version) + chat commands to enable/disable watch mode.

## Non-goals
- MICROSERVICES mode (MiniLM/DistilBERT/T5) can be scaffolded but not required to ship MVP.
- WebSocket streaming/push (explicitly experimental) is deferred.
- Structure learning + autonomous building are deferred.

## Features (with actionable steps)

### 1) Layer 1 — Sensory filtering (Retina Packet)
- Subscribe to essential `world.afterEvents` (chat, block break/place, entity hurt) and add a lightweight polling loop for internal state.
- Implement the **3 gates**: proximity (32 blocks), transmission (audio/visual), priority (P0/P1/P2).
- Produce canonical **Retina Packet** shape (header + body) per `_docs_v2/interaction-flow.md`.
- Ensure tick safety: avoid scanning all entities; use `dimension.getEntities({ maxDistance })` and store only `entity.id`.
- Emit Layer 1 output into a per-villager event buffer (bounded).

#### Implementation Spec
- **Files**:
  - `scripts/layers/layer1_sensory/sensory_stream.js` (subscriptions + gating)
  - `scripts/layers/layer1_sensory/retina_packets.js` (packet builder)
- **Output contract**:
  - `RetinaPacket.header`: `{ v_id, timestamp, channel, priority }`
  - `RetinaPacket.body`: `{ type, actor, subject?, location?, metadata? }`
- **Config/caps**:
  - `SENSORY_RADIUS = 32`
  - `EVENT_BUFFER_MAX = 50` (per villager), drop-oldest
- **Verify**:
  - counters: received vs dropped (by gate) and last 10 accepted packets in inspector
- **Failure handling**:
  - if LOS checks are expensive/unreliable, degrade “visual” to “audio” conservatively (still bounded)

##### Step Guide
- **Step 1**: Subscribe to essential events + polling loop
  - **Do**: wire only high-signal events first (chat, hurt, place/break); keep polling ≤ 0.5–1s.
  - **Verify**: event counters increment; polling doesn’t spam logs.
- **Step 2**: Implement 3 gates (proximity/transmission/priority)
  - **Do**: proximity (32) first; add priority rules; add LOS only after baseline works.
  - **Verify**: dropped counters show gate reason (proximity vs priority vs LOS).
- **Step 3**: Emit canonical Retina Packet
  - **Example**:
    - `{ header:{ v_id:'v-1', timestamp:1700, channel:'audio', priority:1 }, body:{ type:'block_break', actor:'p-1', subject:'minecraft:stone', location:[0,64,0] } }`
  - **Verify**: Layer 2 accepts it without guards failing.
- **Step 4**: Tick safety entity lookup
  - **Do**: never loop whole dimension; query nearby with maxDistance; store IDs only.
  - **Verify**: no “Invalid Object” errors during longer runs.
- **Step 5**: Bounded per-villager buffer
  - **Do**: ring buffer, drop oldest.
  - **Verify**: buffer length never exceeds cap in inspector.

### 2) Layer 2 — Perception (MONOLITHIC 5D vectors)
- Implement manual [C, V, I, S, X] vector calculation using a **semantic atlas** lookup + small rule functions.
- Add territory-sensitive sociality (e.g., destructive actions near “home” shift S negative) per Perception doc.
- Produce canonical **Semantic Frame** output for Layer 3 (vector + context + timestamp + actor).
- Keep it purely in Fast Gear; do not call backend for MVP vectors.
- Add a minimal “AI_MODE” flag wiring (MONOLITHIC only implemented in MVP).

#### Implementation Spec
- **Files**:
  - `scripts/layers/layer2_perception/vector_rules.js` (atlas table)
  - `scripts/layers/layer2_perception/calculate_vector_manual.js` (pure function)
- **Input/Output**:
  - in: `RetinaPacket`
  - out: `SemanticFrame` `{ v_id, vector:{C,V,I,S,X}, context, actorID, timestamp }`
- **Rules**:
  - deterministic transforms; default rule for unknown subjects
  - clamp each axis to `[-1, 1]`
- **Verify**:
  - inspector shows latest vector and a sample of recent vectors

##### Step Guide
- **Step 1**: Implement semantic atlas + rule functions
  - **Do**: start with a small atlas (chat, hurt, place, break) + default rule.
  - **Verify**: unknown subjects still produce a vector (default).
- **Step 2**: Territory-sensitive sociality
  - **Do**: apply a simple multiplier/offset when destructive events happen “near home.”
  - **Verify**: same break event differs near-home vs far-away (S shifts).
- **Step 3**: Emit Semantic Frame
  - **Example**:
    - `{ v_id:'v-1', vector:{C:-0.6,V:0.1,I:0.3,S:-0.4,X:0}, context:'block_break', actorID:'p-1', timestamp:1700 }`
  - **Verify**: Layer 3 ingests frames continuously.
- **Step 4**: Ensure no backend calls
  - **Do**: keep perception pure; only Layer 4/5 sync uses HTTP.
  - **Verify**: no HTTP requests are triggered by Layer 2.
- **Step 5**: AI_MODE flag wiring
  - **Do**: config module returns `'monolithic'` and Layer 2 routes accordingly.
  - **Verify**: toggling mode doesn’t crash (even if only mono implemented).

### 3) Layer 3 — Sequencer (episodes)
- Implement Tier A moving average + stability check (30s window, variance threshold).
- Implement Tier B macro buffer (10m window) with simple repeat detection (3+ repeats) for macro concepts.
- On stable episode completion, emit **EpisodeSummary** to Layer 4 (duration, counts, avg vector, actor).
- Implement concept matching against DB only as a simple “known vs unknown” (optional); naming new concepts can be a future enhancement.
- Keep memory bounded: cap buffer sizes and prune by time.

#### Implementation Spec
- **Files**:
  - `scripts/layers/layer3_sequencer/tier_a_window.js` (moving avg + stability)
  - `scripts/layers/layer3_sequencer/tier_b_macro_buffer.js` (repeat detection)
- **Input/Output**:
  - in: `SemanticFrame` stream
  - out: `EpisodeSummary` `{ v_id, actorID, episodeLabel, durationMs, eventCount, avgVectorManual, timestampMs }`
- **Config/caps**:
  - `TIER_A_WINDOW_MS = 30_000`, `STABILITY_MIN_MS = 10_000`
  - `TIER_B_WINDOW_MS = 600_000`, `MACRO_BUFFER_MAX = 120`
- **Verify**:
  - inspector shows Tier A stability state + current label sequence (last N)

##### Step Guide
- **Step 1**: Tier A moving average
  - **Do**: keep a time-windowed list; compute avg; compute variance on C and I.
  - **Verify**: stability flips true after sustained consistent activity.
- **Step 2**: Tier B macro buffer + repeat detection
  - **Do**: append stable sublabels; search for repeated patterns (3+).
  - **Verify**: a repeated sequence triggers a macro flag once (no spam).
- **Step 3**: Emit EpisodeSummary on completion
  - **Example**:
    - `{ v_id:'v-1', actorID:'p-1', episodeLabel:'Mining', durationMs:30000, eventCount:15, avgVectorManual:{...}, timestampMs:1710 }`
  - **Verify**: Layer 4 receives summaries and updates WM.
- **Step 4**: Optional concept “known/unknown”
  - **Do**: return “unknown” if no match; don’t block sequencing on DB.
  - **Verify**: sequencing continues even if backend is down.
- **Step 5**: Bounding/pruning
  - **Do**: prune Tier A by time; cap Tier B by max length.
  - **Verify**: memory usage stable over time.

### 4) Layer 4 — Working Memory (cache-first + sync flags)
- Maintain `trackedVillagers` Map as the **primary runtime truth** (no persistent `Entity` references).
- Merge incoming EpisodeSummaries into a single **Working Memory Object** per villager (focus, mood vector, current episode).
- Implement “flashbulb events” for P0 (damage/fire) and decay rules (simple timers).
- Implement dirty-flag sync: `needsDPSync`, `needsDBSync` set on state changes.
- Implement periodic sync loop (e.g., every ~1s) to send a compact **MemoryRecord** to backend over HTTP.

#### Implementation Spec
- **Files**:
  - `scripts/layers/layer4_working_memory/working_memory_store.js` (owns `trackedVillagers`)
  - `scripts/systems/sync/working_memory_sync.js` (cadence + HTTP write)
- **Working Memory shape (minimum)**:
  - `{ v_id, currentEpisode, activeFocus, flashbulbEvents, currentMoodVectorManual, lastUpdateMs, needsDPSync, needsDBSync }`
- **Sync rules**:
  - use `HttpRequest.setTimeout(seconds)` and keep sync bounded (no per-tick IO)
  - clear `needsDBSync` only on success; keep it true on failure
- **Verify**:
  - inspector shows dirty flags + last sync result time
- **Failure handling**:
  - backend down → keep WM locally and fall back to safe behavior (no crash)

##### Step Guide
- **Step 1**: `trackedVillagers` as primary truth
  - **Do**: keyed by `v_id`; store only IDs, not entities.
  - **Verify**: WM updates occur even when villager entity is not in range.
- **Step 2**: Merge EpisodeSummaries
  - **Do**: update current episode + mood vector; set active focus.
  - **Verify**: inspector shows currentEpisode changes on player activity.
- **Step 3**: Flashbulb events + decay
  - **Do**: append P0 events with decayAt timestamps; prune periodically.
  - **Verify**: flashbulb list shrinks after decay.
- **Step 4**: Dirty flags
  - **Do**: any meaningful change sets `needsDPSync=true` and `needsDBSync=true`.
  - **Verify**: flags flip to true on change and clear only after sync success.
- **Step 5**: 1s sync loop to backend
  - **Do**: build compact MemoryRecord and POST with timeout (seconds).
  - **Verify**: backend receives periodic writes; timeouts don’t crash.

### 5) Layer 5 — Long-Term Memory (minimal DB slice)
- Implement migrations for: `villagers`, `relationships`, `episodes`, `working_memory` (subset aligned to Layer 5 doc).
- Implement “subjectivity” invariant: every query/write is scoped by `villager_id`.
- On MemoryRecord write: insert an episode + update relationship trust/interaction counts.
- Implement recall trigger: when player enters radius, fetch `IdentityContext` (relationship + last 3 episodes).
- Return `IdentityContext` as a compact JSON packet for Layer 6.

#### Implementation Spec
- **Files**:
  - `nodeDB/db/pool.js` (single Pool + `pool.on('error')`)
  - `nodeDB/queries/episodes_queries.js`, `relationships_queries.js` (parameterized SQL)
  - `nodeDB/routes/memory_routes.js`:
    - `POST /api/memory/write`
    - `GET /api/memory/context`
- **Contract**:
  - `IdentityContext` includes `{ relationship, recentEpisodes }` (bounded: last 3)
- **Verify**:
  - request context endpoint returns correct shape for a known villager_id/actor_id

##### Step Guide
- **Step 1**: Migrations (minimal set)
  - **Do**: create 4 tables first; don’t implement full 11-table schema yet.
  - **Verify**: backend boots and can write/read these tables.
- **Step 2**: Enforce subjectivity
  - **Do**: every query requires `villager_id` in WHERE clause.
  - **Verify**: queries never return other villagers’ rows.
- **Step 3**: MemoryRecord write path
  - **Do**: insert episode + update relationship (transaction if needed).
  - **Verify**: trust_score and interaction_count change as expected.
- **Step 4**: Recall trigger
  - **Do**: context endpoint returns relationship + last 3 episodes.
  - **Verify**: Layer 6 prompt shows the last 3 episodes only.
- **Step 5**: IdentityContext packet shape
  - **Do**: keep it compact and stable; validate before returning.
  - **Verify**: Layer 6 can consume it without conditional branches.

### 6) Scheduler (LLM gridlock prevention)
- Implement a priority-scored queue (BullMQ) with categories: CRITICAL 100, SOCIAL 70, NOVELTY 40, ROUTINE 10.
- Enforce concurrency cap (default 1) for LLM jobs.
- Implement observer batching rule (10-block radius, same event hash) as a first pass.
- Provide fallback behavior per category (FLEE / IDLE+STARE / observe / routine).
- Emit simple scheduler metrics for debugging (queue depth, avg wait).

#### Implementation Spec
- **Files**:
  - `nodeDB/brain/queue.js`, `nodeDB/brain/worker.js`
  - `nodeDB/brain/priority_map.js` (score → BullMQ priority number)
  - `nodeDB/routes/scheduler_routes.js` (metrics)
- **Priority note (context7-validated)**:
  - BullMQ: **lower priority number = higher priority**
  - keep a single mapping table to avoid drift
- **Verify**:
  - metrics endpoint shows counts per priority + queue depth
- **Failure handling**:
  - if queue is saturated, drop/deflect ROUTINE and prefer CRITICAL/SOCIAL

##### Step Guide
- **Step 1**: Priority mapping
  - **Do**: define one mapping file and reuse it everywhere.
  - **Verify**: CRITICAL jobs always execute before ROUTINE.
- **Step 2**: Concurrency cap
  - **Do**: set worker concurrency to protect CPU; default 1 for LLM.
  - **Verify**: only one LLM job runs at a time.
- **Step 3**: Observer batching (first pass)
  - **Do**: hash event (coords+type+time bucket); merge jobs if multiple observers.
  - **Verify**: batch reduces duplicate LLM calls in logs.
- **Step 4**: Fallback behaviors
  - **Do**: if scheduler/LLM unavailable: CRITICAL→FLEE, SOCIAL→IDLE+STARE, etc.
  - **Verify**: villager still behaves safely when backend is down.
- **Step 5**: Metrics endpoint
  - **Do**: expose queue depth and counts per priority.
  - **Verify**: metrics are stable under load.

### 7) Layer 6 — Language Cortex (llama.cpp, HTTP)
- Build prompt from `IdentityContext` + Working Memory summary (keep token budget small).
- Require structured output: `THOUGHT`, `SPEECH`, `ACTION: <keyword>(params)` constrained to Layer 7 dictionary.
- Execute via llama.cpp HTTP endpoint with timeout + retries (safe limits).
- Parse output into canonical **NarrativePacket** (validated).
- On parse failure, degrade to safe fallback action (IDLE or STARE) and log.

#### Implementation Spec
- **Files**:
  - `nodeDB/brain/llm_client.js` (HTTP wrapper + timeouts)
  - `nodeDB/brain/prompt_builder.js` (pure prompt build)
  - `nodeDB/brain/narrative_parser.js` (strict parse + validation)
- **Contract**:
  - output must map into Layer 7 action dictionary only
- **Verify**:
  - store last N prompt/response pairs in a bounded dev cache for debugging
- **Failure handling**:
  - parse fail → `IDLE`/`STARE`; never execute unknown actions

##### Step Guide
- **Step 1**: Build prompt from WM + IdentityContext
  - **Do**: include only bounded recent context (last 3 episodes).
  - **Verify**: prompt remains small and consistent.
- **Step 2**: Structured output requirement
  - **Do**: require `THOUGHT`, `SPEECH`, and `ACTION:<keyword>(params)` only.
  - **Verify**: parser rejects anything outside the dictionary.
- **Step 3**: HTTP inference call
  - **Do**: apply timeouts and bounded retries; capture latency metrics.
  - **Verify**: timeouts trigger fallback, not hangs.
- **Step 4**: Parse into NarrativePacket
  - **Do**: strict validation before passing to Layer 7.
  - **Verify**: invalid outputs don’t execute actions.
- **Step 5**: Degrade on parse fail
  - **Do**: emit safe fallback narrative.
  - **Verify**: villager doesn’t “freeze” on parse errors.

### 8) Layer 7 — Action Layer (restricted actuator + feedback)
- Implement action dictionary: TALK, APPROACH, ANIMATE, STARE, FLEE, IDLE.
- Ensure non-blocking execution; keep an in-cache `taskState` for in-progress actions.
- Implement “safety gate”: P0 events override current action to immediate FLEE until cleared.
- Report completion/failure back to Layer 4 (success/failure packets).
- Implement “micro-expression” idle controller driven by basic personality tags (minimal set).

#### Implementation Spec
- **Files**:
  - `scripts/layers/layer7_action/action_dispatch.js` (parses NarrativePacket action)
  - `scripts/layers/layer7_action/task_state.js` (in-cache task state, bounded history)
- **Feedback contract**:
  - `{ v_id, action, status: 'completed'|'failed', reason?, timestampMs }` → Layer 4
- **Safety**:
  - P0 overrides current task to `FLEE` immediately
- **Verify**:
  - inspector shows current task + last 5 action outcomes

##### Step Guide
- **Step 1**: Implement dictionary actions
  - **Do**: one handler per action; keep handlers small.
  - **Verify**: each action changes observable state (chat/move/animate).
- **Step 2**: Non-blocking task state
  - **Do**: store taskState in cache; update over time; don’t await long ops.
  - **Verify**: villager can “walk and talk.”
- **Step 3**: Safety gate (P0 override)
  - **Do**: override to FLEE immediately on damage/fire; clear when safe.
  - **Verify**: taking damage always triggers flee regardless of current task.
- **Step 4**: Feedback loop to Layer 4
  - **Do**: completion/failure packets update WM so Layer 6 can rethink.
  - **Verify**: “failed” actions result in a new thought request.
- **Step 5**: Micro-expressions
  - **Do**: small idle controller that triggers occasional animations.
  - **Verify**: idle behavior doesn’t spam (rate-limited).

### 9) MVP Debug UX (server-ui + chat)
- Implement a hub-and-spoke server-ui inspector: select villager → panels (Working Memory, LTM summary, Current Task).
- Implement chat commands: start/stop watch mode, set AI mode (only MONOLITHIC functional), toggle debug verbosity.
- Rate-limit watch mode (max 1 update / 2s per player).
- Persist minimal user debug preferences (optional) without leaking memory.
- Provide clear “MVP status” messages (connected backend, last sync time, last error).

#### Implementation Spec
- **Files**:
  - `scripts/systems/debug/inspector_menu.js` (hub-and-spoke navigation)
  - `scripts/systems/debug/watch_mode.js` (rate-limited periodic updates)
  - `scripts/systems/commands/chat_commands.js` (command parsing + dispatch)
- **Constraints** (per project rules):
  - server-ui is modal/snapshot UX; keep depth ≤ 3
  - watch mode: ≤ 1 update / 2s / player
- **Verify**:
  - inspector shows WM + relationship + last episodes + current task
  - watch mode can be started/stopped without leaks

##### Step Guide
- **Step 1**: Hub-and-spoke inspector
  - **Do**: main menu → villager select → panel view (max depth 3).
  - **Verify**: ESC/cancel returns safely to prior menu.
- **Step 2**: Chat commands
  - **Do**: `/watch on|off`, debug toggles, AI mode toggle (mono only).
  - **Verify**: commands work for non-op player (as designed) or are permission-gated.
- **Step 3**: Rate limit watch mode
  - **Do**: enforce ≤ 1 update / 2s / player.
  - **Verify**: chat isn’t spammed during heavy activity.
- **Step 4**: Optional prefs persistence
  - **Do**: store small prefs keyed by playerId; bounded map.
  - **Verify**: prefs don’t leak memory after disconnect.
- **Step 5**: MVP status messages
  - **Do**: show backend connection + last sync + last error.
  - **Verify**: status updates reflect real failures (timeouts, 500s).

## Definition of Done (phase exit)
- A tagged AI villager near a player:
  - perceives events (Layer 1) → vectorizes (Layer 2) → sequences (Layer 3)
  - updates working memory and syncs to backend (Layer 4 → 5)
  - recalls recent context (Layer 5) and produces dialogue + action (Layer 6 → 7)
  - executes a restricted action and feeds back outcome (Layer 7 → 4)
- Debug inspector shows working memory + relationship + last episodes + current task.

## Notes (docs freshness)
- Before implementing any external API specifics (Script API methods, `@minecraft/server-net.http`, BullMQ, llama.cpp HTTP contract), validate via **context7** as required by `document_rules.mdc`.

