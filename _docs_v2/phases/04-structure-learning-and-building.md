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

### 2) Pattern hashing + storage (Layer 5 structure tables)
- Implement spatial hash generation for observed block clusters (MONOLITHIC-friendly).
- Store raw observations in `pattern_observations` (JSONB sequence + metadata).
- Consolidate observations into `structure_templates` when repeated N times (per villager subjectivity).
- Generate a 384D embedding for templates (MICROSERVICES-friendly similarity) even if MONOLITHIC is active.
- Add indexes for hash lookups and embedding similarity.

### 3) Template → blueprint assembly (Layer 5)
- Define a blueprint composition format (JSONB) referencing templates + offsets + tags.
- Implement blueprint creation rules (manual for v1: group templates into a blueprint when co-observed in proximity).
- Store blueprints in `structure_blueprints` with embedding and tags (shelter, decor, utility).
- Update `villager_world_map` when a recognized blueprint anchor is observed.
- Expose a debug endpoint to list templates/blueprints per villager.

### 4) Build tasks (Layer 7 execution loop)
- Implement `build_tasks` lifecycle: create → in_progress → completed/failed with step counters.
- Expand blueprint/template into ordered “block placement instructions” (bounded batch size).
- Execute instructions tick-by-tick with non-blocking movement and placement.
- On missing materials or blocked placement, raise a failure reason and request Layer 6 rethink (ask player, switch plan, or abort).
- Persist progress to backend periodically so tasks can resume after reload.

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

## Definition of Done (phase exit)
- A villager can observe a small repeated pattern, consolidate it into a template, and later build it on request.
- Build tasks progress is visible (debug inspector / UI) and survives script reload via DB persistence.

## Notes (docs freshness)
- If using any Script API block placement or inventory APIs, validate specifics via **context7** before implementation.

