# Phase TODO Tracker (Progress + “Need Help” Flags)

## How to use
- Mark work complete by changing `- [ ]` → `- [x]`
- If you get stuck, tick the paired **Need help** box and add a short note under it.
- IDs (like `P01.L4.F2`) are stable “handles” you can reference when asking for help.

---

## Phase 00 — Setup
Source: `_docs_v2/phases/00-setup.md`

### P00.F1 — Workspace skeleton & conventions
- [ ] P00.F1.S1 Create canonical directories + entrypoints
- [ ] P00.F1.S2 Define packet contract source (docs-only vs shared contracts folder)
- [ ] P00.F1.S3 Add naming + file-size guardrails to contribution docs
- [ ] P00.F1.S4 Add `.env.example` (DB/Redis/ports/AI mode)
- [ ] P00.F1.S5 Verify folder layout matches `project-rules.md`
- [ ] P00.F1.NH **Need help**

### P00.F2 — Backend baseline (Express v5)
- [ ] P00.F2.S1 Implement `GET /health`
- [ ] P00.F2.S2 Implement `POST /api/retina` (validate + echo)
- [ ] P00.F2.S3 Add 404 + centralized error handler
- [ ] P00.F2.S4 Add Pino logging with request IDs
- [ ] P00.F2.S5 Add Joi request validation middleware
- [ ] P00.F2.NH **Need help**

### P00.F3 — DB connectivity + first migration
- [ ] P00.F3.S1 Create single `pg.Pool` module
- [ ] P00.F3.S2 Add migration runner scaffold
- [ ] P00.F3.S3 Create `ingest_events` JSONB smoke table
- [ ] P00.F3.S4 Insert packets on `POST /api/retina` (async-safe)
- [ ] P00.F3.S5 Add `GET /api/ingest/recent`
- [ ] P00.F3.NH **Need help**

### P00.F4 — Queue skeleton (BullMQ + Redis)
- [ ] P00.F4.S1 Create `brain_scheduler` queue + worker
- [ ] P00.F4.S2 Enqueue job on retina ingest (keep payload small)
- [ ] P00.F4.S3 Worker returns deterministic Narrative stub (no LLM)
- [ ] P00.F4.S4 Keep last-N summaries in memory (dev-only)
- [ ] P00.F4.S5 Add `GET /api/scheduler/stats`
- [ ] P00.F4.NH **Need help**

### P00.F5 — Bedrock baseline (HTTP + safety)
- [ ] P00.F5.S1 Implement `scripts/main.js` startup banner + safe interval
- [ ] P00.F5.S2 Implement AI villager discovery (store `entity.id` only)
- [ ] P00.F5.S3 Generate minimal Retina Packet on a simple trigger
- [ ] P00.F5.S4 HTTP post to backend (try/catch + timeout)
- [ ] P00.F5.S5 Display backend stub response (chat/log)
- [ ] P00.F5.NH **Need help**

---

## Phase 01 — MVP
Source: `_docs_v2/phases/01-mvp.md`

### P01.L1 — Layer 1 (Sensory / Retina Packet)
- [ ] P01.L1.S1 Subscribe to essential events + lightweight polling loop
- [ ] P01.L1.S2 Implement 3 gates (proximity 32 / transmission / priority)
- [ ] P01.L1.S3 Emit canonical Retina Packet (header/body)
- [ ] P01.L1.S4 Tick-safe entity querying + store `entity.id` only
- [ ] P01.L1.S5 Per-villager bounded event buffer
- [ ] P01.L1.NH **Need help**

### P01.L2 — Layer 2 (Perception, MONOLITHIC 5D)
- [ ] P01.L2.S1 Implement semantic atlas + rule functions for C/V/I/S/X
- [ ] P01.L2.S2 Territory-sensitive sociality adjustments
- [ ] P01.L2.S3 Emit canonical Semantic Frame for Layer 3
- [ ] P01.L2.S4 Keep fully Fast Gear (no backend call for MVP)
- [ ] P01.L2.S5 Wire AI_MODE flag (MONOLITHIC operational)
- [ ] P01.L2.NH **Need help**

### P01.L3 — Layer 3 (Sequencer / Episodes)
- [ ] P01.L3.S1 Tier A moving average + stability check (30s window)
- [ ] P01.L3.S2 Tier B macro buffer + repeat detection (10m window)
- [ ] P01.L3.S3 Emit EpisodeSummary on episode completion
- [ ] P01.L3.S4 Minimal known/unknown concept matching (optional)
- [ ] P01.L3.S5 Bound buffers and prune by time
- [ ] P01.L3.NH **Need help**

### P01.L4 — Layer 4 (Working Memory + sync flags)
- [ ] P01.L4.S1 Maintain `trackedVillagers` as primary runtime truth
- [ ] P01.L4.S2 Merge EpisodeSummaries into Working Memory object
- [ ] P01.L4.S3 Implement flashbulb events + simple decay timers
- [ ] P01.L4.S4 Set `needsDPSync/needsDBSync` on changes
- [ ] P01.L4.S5 Periodic (~1s) HTTP sync to backend with compact MemoryRecord
- [ ] P01.L4.NH **Need help**

### P01.L5 — Layer 5 (Long-Term Memory minimal slice)
- [ ] P01.L5.S1 Migrations: villagers/relationships/episodes/working_memory
- [ ] P01.L5.S2 Enforce subjectivity: every query/write scoped by `villager_id`
- [ ] P01.L5.S3 MemoryRecord write: insert episode + update relationship
- [ ] P01.L5.S4 Recall trigger: fetch IdentityContext on player enters radius
- [ ] P01.L5.S5 Return compact IdentityContext packet to Layer 6
- [ ] P01.L5.NH **Need help**

### P01.SCH — Scheduler (LLM gridlock prevention)
- [ ] P01.SCH.S1 Implement priority queue categories (100/70/40/10)
- [ ] P01.SCH.S2 Enforce concurrency cap (default 1)
- [ ] P01.SCH.S3 Observer batching (event hash + 10-block radius) first pass
- [ ] P01.SCH.S4 Implement fallbacks per category
- [ ] P01.SCH.S5 Expose scheduler metrics for debug
- [ ] P01.SCH.NH **Need help**

### P01.L6 — Layer 6 (Language Cortex via llama.cpp HTTP)
- [ ] P01.L6.S1 Build prompt from Working Memory + IdentityContext (small token budget)
- [ ] P01.L6.S2 Require structured output constrained to action dictionary
- [ ] P01.L6.S3 HTTP inference call (timeout + safe retry)
- [ ] P01.L6.S4 Parse into NarrativePacket and validate
- [ ] P01.L6.S5 Safe fallback on parse failure (IDLE/STARE) + log
- [ ] P01.L6.NH **Need help**

### P01.L7 — Layer 7 (Action dictionary + feedback)
- [ ] P01.L7.S1 Implement TALK/APPROACH/ANIMATE/STARE/FLEE/IDLE
- [ ] P01.L7.S2 Non-blocking execution + `taskState` tracking
- [ ] P01.L7.S3 Safety gate: P0 overrides to FLEE
- [ ] P01.L7.S4 Report completion/failure back to Layer 4
- [ ] P01.L7.S5 Minimal micro-expressions driven by personality tags
- [ ] P01.L7.NH **Need help**

### P01.UX — MVP debug UX (server-ui + chat)
- [ ] P01.UX.S1 server-ui inspector (hub → villager → panels)
- [ ] P01.UX.S2 Chat commands: watch on/off, debug toggles, AI mode toggle (mono only)
- [ ] P01.UX.S3 Watch mode rate limit (≤ 1 update / 2s / player)
- [ ] P01.UX.S4 Persist minimal user debug preferences safely (optional)
- [ ] P01.UX.S5 Status surfacing (backend connected, last sync, last error)
- [ ] P01.UX.NH **Need help**

---

## Phase 02 — Microservices Mode
Source: `_docs_v2/phases/02-microservices-mode.md`

### P02.F1 — MICROSERVICES perception (Layer 2 embeddings)
- [ ] P02.F1.S1 Implement deterministic `buildEventDescription`
- [ ] P02.F1.S2 Backend `POST /api/vector/embed` returns 384D embedding
- [ ] P02.F1.S3 Add embedding cache (memory + optional DB)
- [ ] P02.F1.S4 Emit `{ embedding, description }` outputs in MICROSERVICES mode
- [ ] P02.F1.S5 Ensure Layer 3 accepts 5D or 384D input
- [ ] P02.F1.NH **Need help**

### P02.F2 — Summarization (T5) for memory compression
- [ ] P02.F2.S1 Backend `POST /api/summarize/episode`
- [ ] P02.F2.S2 Store summary text for MICROSERVICES episode writes
- [ ] P02.F2.S3 Enforce short summaries (token budget)
- [ ] P02.F2.S4 Fallback summarizer template on model failure
- [ ] P02.F2.S5 Record latency metrics
- [ ] P02.F2.NH **Need help**

### P02.F3 — Fast Intent Router (Layer 3)
- [ ] P02.F3.S1 Backend `POST /api/intent/classify` returns label+confidence
- [ ] P02.F3.S2 Implement bypass rules (>0.8) for aggression/trading
- [ ] P02.F3.S3 Log routing decisions into debug streams
- [ ] P02.F3.S4 Ensure bypass updates Working Memory coherently
- [ ] P02.F3.S5 Add tests for routing outcomes
- [ ] P02.F3.NH **Need help**

### P02.F4 — pgvector similarity search (concept matching)
- [ ] P02.F4.S1 Add dual vector columns + indexes (5D + 384D)
- [ ] P02.F4.S2 Implement nearest concept query (cosine distance)
- [ ] P02.F4.S3 Enforce discovery gating per villager
- [ ] P02.F4.S4 Unknown concept flow (store candidate safely)
- [ ] P02.F4.S5 Debug view: nearest matches + distances
- [ ] P02.F4.NH **Need help**

### P02.F5 — Layer 6 prompt shrink (MICROSERVICES responsibilities)
- [ ] P02.F5.S1 Update prompts to summaries + intent output (no raw vectors)
- [ ] P02.F5.S2 Reduce prompt size target (200–300 token equivalent)
- [ ] P02.F5.S3 Keep structured output + action dictionary enforcement
- [ ] P02.F5.S4 Add regression tests for parse reliability
- [ ] P02.F5.S5 Track “LLM calls/min” improvement metric
- [ ] P02.F5.NH **Need help**

---

## Phase 03 — Real-time Transport + Resilience
Source: `_docs_v2/phases/03-realtime-transport-and-resilience.md`

### P03.F1 — Transport selection abstraction
- [ ] P03.F1.S1 Create Bedrock network client abstraction (HTTP+WS)
- [ ] P03.F1.S2 Prefer WS if open; fallback to HTTP for eligible ops
- [ ] P03.F1.S3 Add bounded retries + timeouts (no infinite loops)
- [ ] P03.F1.S4 Add payload size guards (route big payloads to HTTP)
- [ ] P03.F1.S5 Wrap all IO in try/catch with consistent error objects
- [ ] P03.F1.NH **Need help**

### P03.F2 — WebSocket connection management
- [ ] P03.F2.S1 Exponential backoff reconnect (with jitter)
- [ ] P03.F2.S2 Bounded send buffer queue
- [ ] P03.F2.S3 Heartbeat/keepalive + state monitoring
- [ ] P03.F2.S4 Cleanup listeners to avoid leaks
- [ ] P03.F2.S5 Expose WS state in debug inspector
- [ ] P03.F2.NH **Need help**

### P03.F3 — LLM streaming (Layer 6 UX)
- [ ] P03.F3.S1 Backend WS `llm_inference` token streaming
- [ ] P03.F3.S2 Bedrock token accumulation + rate-limited partial updates
- [ ] P03.F3.S3 Parse final structured output on completion
- [ ] P03.F3.S4 Fallback to HTTP if stream fails mid-way
- [ ] P03.F3.S5 Metrics: first-token + total latency + stream error rate
- [ ] P03.F3.NH **Need help**

### P03.F4 — Backend → Bedrock Working Memory push
- [ ] P03.F4.S1 Define/validate `memory_update` packet contract
- [ ] P03.F4.S2 Merge push updates into cache + set dirty flags
- [ ] P03.F4.S3 Add scheduled mood shift (time-of-day) first use-case
- [ ] P03.F4.S4 Add gossip hook packets (logic can evolve later)
- [ ] P03.F4.S5 Rate-limit pushes per villager
- [ ] P03.F4.NH **Need help**

### P03.F5 — Observability + hardening
- [ ] P03.F5.S1 Correlation IDs across HTTP+WS
- [ ] P03.F5.S2 Error taxonomy mapped to safe fallbacks
- [ ] P03.F5.S3 Sentry wiring (bounded sampling)
- [ ] P03.F5.S4 Load shedding when queue depth too high
- [ ] P03.F5.S5 Safe mode switch (force HTTP-only, disable streaming)
- [ ] P03.F5.NH **Need help**

---

## Phase 04 — Structure Learning + Autonomous Building
Source: `_docs_v2/phases/04-structure-learning-and-building.md`

### P04.F1 — Observation capture (Fast Gear)
- [ ] P04.F1.S1 Capture build-adjacent block placement events
- [ ] P04.F1.S2 Maintain bounded spatial buffer per villager
- [ ] P04.F1.S3 Define consolidation trigger (idle time / distance)
- [ ] P04.F1.S4 Extract cluster snapshot payload (small bounded bbox)
- [ ] P04.F1.S5 Send observation to backend for hashing/storage
- [ ] P04.F1.NH **Need help**

### P04.F2 — Pattern hashing + storage (Layer 5)
- [ ] P04.F2.S1 Implement spatial hash generation
- [ ] P04.F2.S2 Store in `pattern_observations` (JSONB + metadata)
- [ ] P04.F2.S3 Consolidate repeated observations into `structure_templates`
- [ ] P04.F2.S4 Generate/store template embeddings (384D)
- [ ] P04.F2.S5 Add required indexes (hash + embedding)
- [ ] P04.F2.NH **Need help**

### P04.F3 — Template → blueprint assembly
- [ ] P04.F3.S1 Define blueprint composition JSONB format
- [ ] P04.F3.S2 Implement v1 assembly rule (proximity co-observation)
- [ ] P04.F3.S3 Store `structure_blueprints` with tags + embedding
- [ ] P04.F3.S4 Update `villager_world_map` on recognized anchors
- [ ] P04.F3.S5 Add debug endpoint to list templates/blueprints per villager
- [ ] P04.F3.NH **Need help**

### P04.F4 — Build tasks (Layer 7 execution loop)
- [ ] P04.F4.S1 Implement build_tasks lifecycle + progress counters
- [ ] P04.F4.S2 Expand blueprint/template into bounded instruction batches
- [ ] P04.F4.S3 Execute tick-by-tick with non-blocking movement/placement
- [ ] P04.F4.S4 Failure → reason + Layer 6 rethink request
- [ ] P04.F4.S5 Persist progress to backend for resume
- [ ] P04.F4.NH **Need help**

### P04.F5 — Player commands + UX
- [ ] P04.F5.S1 Add build-related chat commands (learn/list/build/cancel)
- [ ] P04.F5.S2 Add server-ui build queue/progress view
- [ ] P04.F5.S3 Rate-limit progress reporting
- [ ] P04.F5.S4 Save build completion as an episode
- [ ] P04.F5.S5 Guardrails (max size, max concurrent tasks)
- [ ] P04.F5.NH **Need help**

---

## Phase 05 — Polish / Scale / Release
Source: `_docs_v2/phases/05-polish-scale-and-release.md`

### P05.F1 — Fast Gear performance hardening
- [ ] P05.F1.S1 Add adaptive throttling for polling under load
- [ ] P05.F1.S2 Audit/guard against persistent Entity refs across ticks
- [ ] P05.F1.S3 Add bounded caches + eviction policies everywhere
- [ ] P05.F1.S4 Batch/spread work across intervals to reduce spikes
- [ ] P05.F1.S5 Add profiling mode (timings per layer/villager)
- [ ] P05.F1.NH **Need help**

### P05.F2 — Slow Gear scalability (DB/queue/models)
- [ ] P05.F2.S1 Finalize full Layer 5 schema + indexes + parameterized queries
- [ ] P05.F2.S2 Tune pgvector settings and document recommended values
- [ ] P05.F2.S3 Backpressure + load shedding for low-priority work
- [ ] P05.F2.S4 Model lifecycle management (warmup/cache/workers)
- [ ] P05.F2.S5 Rate limits per villager/player to prevent abuse
- [ ] P05.F2.NH **Need help**

### P05.F3 — UX polish
- [ ] P05.F3.S1 Expand inspector with consistent navigation + summaries
- [ ] P05.F3.S2 Improve watch mode (event-based, still capped)
- [ ] P05.F3.S3 Strengthen personality presentation driven by tags/relationships
- [ ] P05.F3.S4 Configurable/localized speech templates (optional)
- [ ] P05.F3.S5 Admin safe-mode controls (disable heavy features live)
- [ ] P05.F3.NH **Need help**

### P05.F4 — Reliability + operations
- [ ] P05.F4.S1 Circuit-breaker behavior for model endpoints
- [ ] P05.F4.S2 Health checks for DB/Redis/llama/WS
- [ ] P05.F4.S3 Backup/restore scripts for Postgres + config snapshots
- [ ] P05.F4.S4 CI checks + packet contract/parser tests
- [ ] P05.F4.S5 Release versioning + changelog workflow
- [ ] P05.F4.NH **Need help**

### P05.F5 — Documentation & onboarding
- [ ] P05.F5.S1 Quickstart (BDS + backend + DB + Redis)
- [ ] P05.F5.S2 Document packet contracts + invariants (layer isolation, subjectivity, actions)
- [ ] P05.F5.S3 Document configuration knobs (AI_MODE, tick rates, queue concurrency, WS toggles)
- [ ] P05.F5.S4 Troubleshooting guide (timeouts, invalid entity, DB issues)
- [ ] P05.F5.S5 Contribution guide aligned with file-size + module boundaries
- [ ] P05.F5.NH **Need help**

