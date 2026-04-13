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

### 2) Layer 2 — Perception (MONOLITHIC 5D vectors)
- Implement manual [C, V, I, S, X] vector calculation using a **semantic atlas** lookup + small rule functions.
- Add territory-sensitive sociality (e.g., destructive actions near “home” shift S negative) per Perception doc.
- Produce canonical **Semantic Frame** output for Layer 3 (vector + context + timestamp + actor).
- Keep it purely in Fast Gear; do not call backend for MVP vectors.
- Add a minimal “AI_MODE” flag wiring (MONOLITHIC only implemented in MVP).

### 3) Layer 3 — Sequencer (episodes)
- Implement Tier A moving average + stability check (30s window, variance threshold).
- Implement Tier B macro buffer (10m window) with simple repeat detection (3+ repeats) for macro concepts.
- On stable episode completion, emit **EpisodeSummary** to Layer 4 (duration, counts, avg vector, actor).
- Implement concept matching against DB only as a simple “known vs unknown” (optional); naming new concepts can be a future enhancement.
- Keep memory bounded: cap buffer sizes and prune by time.

### 4) Layer 4 — Working Memory (cache-first + sync flags)
- Maintain `trackedVillagers` Map as the **primary runtime truth** (no persistent `Entity` references).
- Merge incoming EpisodeSummaries into a single **Working Memory Object** per villager (focus, mood vector, current episode).
- Implement “flashbulb events” for P0 (damage/fire) and decay rules (simple timers).
- Implement dirty-flag sync: `needsDPSync`, `needsDBSync` set on state changes.
- Implement periodic sync loop (e.g., every ~1s) to send a compact **MemoryRecord** to backend over HTTP.

### 5) Layer 5 — Long-Term Memory (minimal DB slice)
- Implement migrations for: `villagers`, `relationships`, `episodes`, `working_memory` (subset aligned to Layer 5 doc).
- Implement “subjectivity” invariant: every query/write is scoped by `villager_id`.
- On MemoryRecord write: insert an episode + update relationship trust/interaction counts.
- Implement recall trigger: when player enters radius, fetch `IdentityContext` (relationship + last 3 episodes).
- Return `IdentityContext` as a compact JSON packet for Layer 6.

### 6) Scheduler (LLM gridlock prevention)
- Implement a priority-scored queue (BullMQ) with categories: CRITICAL 100, SOCIAL 70, NOVELTY 40, ROUTINE 10.
- Enforce concurrency cap (default 1) for LLM jobs.
- Implement observer batching rule (10-block radius, same event hash) as a first pass.
- Provide fallback behavior per category (FLEE / IDLE+STARE / observe / routine).
- Emit simple scheduler metrics for debugging (queue depth, avg wait).

### 7) Layer 6 — Language Cortex (llama.cpp, HTTP)
- Build prompt from `IdentityContext` + Working Memory summary (keep token budget small).
- Require structured output: `THOUGHT`, `SPEECH`, `ACTION: <keyword>(params)` constrained to Layer 7 dictionary.
- Execute via llama.cpp HTTP endpoint with timeout + retries (safe limits).
- Parse output into canonical **NarrativePacket** (validated).
- On parse failure, degrade to safe fallback action (IDLE or STARE) and log.

### 8) Layer 7 — Action Layer (restricted actuator + feedback)
- Implement action dictionary: TALK, APPROACH, ANIMATE, STARE, FLEE, IDLE.
- Ensure non-blocking execution; keep an in-cache `taskState` for in-progress actions.
- Implement “safety gate”: P0 events override current action to immediate FLEE until cleared.
- Report completion/failure back to Layer 4 (success/failure packets).
- Implement “micro-expression” idle controller driven by basic personality tags (minimal set).

### 9) MVP Debug UX (server-ui + chat)
- Implement a hub-and-spoke server-ui inspector: select villager → panels (Working Memory, LTM summary, Current Task).
- Implement chat commands: start/stop watch mode, set AI mode (only MONOLITHIC functional), toggle debug verbosity.
- Rate-limit watch mode (max 1 update / 2s per player).
- Persist minimal user debug preferences (optional) without leaking memory.
- Provide clear “MVP status” messages (connected backend, last sync time, last error).

## Definition of Done (phase exit)
- A tagged AI villager near a player:
  - perceives events (Layer 1) → vectorizes (Layer 2) → sequences (Layer 3)
  - updates working memory and syncs to backend (Layer 4 → 5)
  - recalls recent context (Layer 5) and produces dialogue + action (Layer 6 → 7)
  - executes a restricted action and feeds back outcome (Layer 7 → 4)
- Debug inspector shows working memory + relationship + last episodes + current task.

## Notes (docs freshness)
- Before implementing any external API specifics (Script API methods, `@minecraft/server-net.http`, BullMQ, llama.cpp HTTP contract), validate via **context7** as required by `document_rules.mdc`.

