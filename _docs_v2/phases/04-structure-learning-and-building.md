# Phase 04 — Structure Learning + Autonomous Building (Templates → Blueprints → Tasks)

## Goal
Deliver the “builder brain” loop described in your architecture: villagers can **observe player building**, learn patterns as templates/blueprints, store them subjectively, and **execute build tasks** through Layer 7.

## Scope / Deliverables
- Structure learning data pipeline into Layer 5’s structure tables:
  - `pattern_observations` → `structure_templates` → `structure_blueprints`
  - `villager_world_map` + `build_tasks`
- Recognition + consolidation rules (N observations → template).
- Build execution engine in Layer 7 (tick-driven, safe, resumable).
- Minimal player interaction commands to request a build and monitor progress.

## Non-goals
- No “perfect” generative architecture; the system learns from observed templates first.
- No large-scale city planning; keep it scoped to small structures and incremental expansion.

## Features (with actionable steps)

### 1) Observation capture (Fast Gear)
- Capture block placement events near AI villagers (Layer 1) and tag them as “build-observation candidates.”
- Build a bounded “recent block placements” spatial buffer per villager (time + coords).
- Define a consolidation trigger (e.g., no placements for N seconds, or player moves away).
- Extract a block cluster snapshot (small radius / bounding box) as the observation payload.
- Send observation payload to backend (HTTP) for hashing + storage.

#### Implementation Spec
- **Files**:
  - Bedrock: `scripts/systems/structure_learning/placement_buffer.js`
  - Bedrock: `scripts/systems/structure_learning/observation_builder.js`
- **Payload contract**:
  - `{ v_id, actorID, dimensionId, observedAtMs, anchor:[x,y,z], blocks:[{typeId,x,y,z}] }`
- **Caps**:
  - max blocks (e.g. 512) + bounded bbox; drop oversized observations
- **Verify**:
  - backend receives observations; debug UI shows last observation size + anchor

##### Step Guide
- **Step 1**: Capture build-adjacent placement events
  - **Do**: only track placements within radius and when villager is observing.
  - **Verify**: placement buffer increments only in-scope.
- **Step 2**: Maintain bounded spatial buffer
  - **Do**: ring buffer with max blocks and time window.
  - **Verify**: buffer never exceeds cap.
- **Step 3**: Consolidation trigger
  - **Do**: trigger after N seconds idle or on explicit command.
  - **Verify**: you get exactly one observation payload per trigger.
- **Step 4**: Extract block cluster snapshot
  - **Do**: build a bounded bbox cluster anchored at a stable reference point.
  - **Verify**: snapshot size predictable.
- **Step 5**: Send to backend via HTTP
  - **Do**: timeout in seconds; retry bounded; drop oversized payloads.
  - **Verify**: backend stores observation reliably.

### 2) Pattern hashing + storage (Layer 5 structure tables)
- Implement spatial hash generation for observed block clusters (MONOLITHIC-friendly).
- Store raw observations in `pattern_observations` (JSONB sequence + metadata).
- Consolidate observations into `structure_templates` when repeated N times (per villager subjectivity).
- Generate a 384D embedding for templates (MICROSERVICES-friendly similarity) even if MONOLITHIC is active.
- Add indexes for hash lookups and embedding similarity.

#### Implementation Spec
- **Files**:
  - `nodeDB/routes/structure_routes.js` (`POST /api/structure/observe`)
  - `nodeDB/queries/structure_queries.js` (hash + consolidation)
- **Hash rules**:
  - normalize coords relative to anchor, sort deterministically, hash stable string
- **Subjectivity**:
  - consolidation is per villager; never “global template” without transfer event
- **Verify**:
  - repeated patterns increment observation count and eventually create a template row

##### Step Guide
- **Step 1**: Implement spatial hash
  - **Do**: normalize relative coords; sort; hash stable string.
  - **Verify**: hash same regardless of event ordering.
- **Step 2**: Store in `pattern_observations`
  - **Do**: JSONB store + metadata; per villager.
  - **Verify**: observation rows grow with activity.
- **Step 3**: Consolidate into templates
  - **Do**: after N observations of same hash, create/update `structure_templates`.
  - **Verify**: template row created once and increments count.
- **Step 4**: Generate embedding for templates
  - **Do**: create 384D embedding from a description or block list.
  - **Verify**: embedding stored and dimension correct.
- **Step 5**: Add indexes
  - **Do**: indexes on hash and embedding for lookups.
  - **Verify**: query remains fast as rows grow.

### 3) Template → blueprint assembly (Layer 5)
- Define a blueprint composition format (JSONB) referencing templates + offsets + tags.
- Implement blueprint creation rules (manual for v1: group templates into a blueprint when co-observed in proximity).
- Store blueprints in `structure_blueprints` with embedding and tags (shelter, decor, utility).
- Update `villager_world_map` when a recognized blueprint anchor is observed.
- Expose a debug endpoint to list templates/blueprints per villager.

#### Implementation Spec
- **Blueprint JSONB**:
  - `{ blueprintId, label, parts:[{ templateId, offset:[dx,dy,dz] }], tags:[...], dimensions:{...} }`
- **Routes**:
  - `GET /api/structure/templates?villager_id=...`
  - `GET /api/structure/blueprints?villager_id=...`
- **Verify**:
  - listing endpoints return only the requesting villager’s structures

##### Step Guide
- **Step 1**: Define blueprint composition JSONB
  - **Do**: reference templates + offsets; include tags.
  - **Verify**: schema supports round-tripping to build instructions.
- **Step 2**: v1 assembly rules
  - **Do**: group nearby templates into a blueprint; keep deterministic.
  - **Verify**: same observations yield same blueprint.
- **Step 3**: Store blueprints + embeddings
  - **Do**: store JSONB + embedding + tags.
  - **Verify**: list endpoints return expected rows.
- **Step 4**: Update world map
  - **Do**: store anchors + confidence.
  - **Verify**: recall can find nearby known structures.
- **Step 5**: Expose debug endpoints
  - **Do**: list templates/blueprints per villager only.
  - **Verify**: subjectivity enforced.

### 4) Build tasks (Layer 7 execution loop)
- Implement `build_tasks` lifecycle: create → in_progress → completed/failed with step counters.
- Expand blueprint/template into ordered “block placement instructions” (bounded batch size).
- Execute instructions tick-by-tick with non-blocking movement and placement.
- On missing materials or blocked placement, raise a failure reason and request Layer 6 rethink (ask player, switch plan, or abort).
- Persist progress to backend periodically so tasks can resume after reload.

#### Implementation Spec
- **Instruction batching contract**:
  - backend returns `{ taskId, totalSteps, steps:[{x,y,z,typeId}], batchIndex, isFinalBatch }`
- **Bedrock execution rules**:
  - non-blocking; bounded work per tick; progress sync interval (e.g. 1–2s)
- **Failure reasons**:
  - `missing_material`, `blocked`, `target_unloaded`, `timeout`
- **Verify**:
  - tasks resume after reload from DB progress

##### Step Guide
- **Step 1**: Implement build_tasks lifecycle
  - **Do**: create/in_progress/completed/failed; store progress counters.
  - **Verify**: status transitions recorded in DB.
- **Step 2**: Expand blueprint/template into instruction batches
  - **Do**: cap batch size; deterministic ordering.
  - **Verify**: batches cover all steps without duplication.
- **Step 3**: Tick-by-tick execution
  - **Do**: bounded placements per tick; non-blocking movement.
  - **Verify**: no TPS collapse during building.
- **Step 4**: Failure reasons + rethink
  - **Do**: classify failures; request Layer 6 response when needed.
  - **Verify**: villager reacts instead of stalling.
- **Step 5**: Persist progress for resume
  - **Do**: write progress every 1–2s.
  - **Verify**: reload resumes where it left off.

### 5) Player commands + UX
- Add chat commands:
  - “learn here” (force consolidation)
  - “list templates/blueprints”
  - “build <blueprint> here”
  - “cancel build”
- Add minimal server-ui page to inspect build queue and current progress.
- Rate-limit progress reporting to avoid spam.
- Store build completion as an episode so relationships and pride/traits can evolve.
- Add guardrails (max build size per task; max concurrent build tasks per villager).

#### Implementation Spec
- **Files**:
  - `scripts/systems/commands/chat_commands.js` (add build commands)
  - `scripts/systems/debug/build_task_modal.js` (minimal inspector page)
- **Guards**:
  - max concurrent build tasks per villager
  - max total steps per task
- **Verify**:
  - commands work end-to-end and progress reporting is rate-limited

##### Step Guide
- **Step 1**: Add chat commands
  - **Do**: parse subcommands; validate args; permission-gate if needed.
  - **Verify**: bad args return helpful message.
- **Step 2**: Add minimal server-ui page
  - **Do**: show current task + progress + cancel option.
  - **Verify**: UI cancels cleanly and doesn’t leak watchers.
- **Step 3**: Rate-limit progress reporting
  - **Do**: cap updates to chat/UI.
  - **Verify**: no spam during long builds.
- **Step 4**: Store completion as an episode
  - **Do**: write an episode record summarizing the build.
  - **Verify**: LTM includes build completion memory.
- **Step 5**: Guardrails
  - **Do**: max build size + max concurrent tasks.
  - **Verify**: prevents runaway building workloads.

## Definition of Done (phase exit)
- A villager can observe a small repeated pattern, consolidate it into a template, and later build it on request.
- Build tasks progress is visible (debug inspector / UI) and survives script reload via DB persistence.

## Notes (docs freshness)
- If using any Script API block placement or inventory APIs, validate specifics via **context7** before implementation.

