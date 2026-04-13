# Phase 05 — Polish, Scale, Release (Feature-Rich + Production Ready)

## Goal
Turn the feature set into a **polished, scalable, shippable** system: consistent UX, strong performance at scale, predictable operations, and clear documentation for contributors and users.

## Scope / Deliverables
- Performance + tick-budget hardening for Fast Gear.
- Scalability hardening for Slow Gear (DB, queue, model serving).
- Stronger debug/ops tooling (inspector UX, dashboards, metrics).
- Data hygiene (retention, migrations, indexing, backup/restore).
- Release packaging and “getting started” docs.

## Non-goals
- No major new brain layers; this phase refines what already exists.

## Features (with actionable steps)

### 1) Fast Gear performance hardening
- Add budgets and sampling for Layer 1 polling (adaptive throttling under load).
- Ensure no persistent `Entity` references are stored across ticks (audit + guard).
- Add bounded caches and eviction policies for all per-villager buffers.
- Reduce per-tick work by batching and spreading work over intervals.
- Add a lightweight profiling mode (timings per layer per villager).

### 2) Slow Gear scalability (DB + queue + models)
- Finalize schema (all Layer 5 tables) and ensure all queries are indexed and parameterized.
- Tune pgvector indexes (`ivfflat` lists/probes) and document recommended settings.
- Add queue load shedding and backpressure (reject/deflect low-priority work under saturation).
- Add model lifecycle management (warmup, cache directory, worker threads where appropriate).
- Add structured rate limits per villager/player to prevent abuse.

### 3) UX polish (debug + player experience)
- Expand server-ui inspector with consistent navigation and readable summaries (no deep nesting).
- Improve watch mode: event-based updates + smarter summarization, still capped at 1/2s.
- Add clear “villager personality” presentation driven by stored tags and relationship state.
- Add localized or configurable speech templates (optional) while preserving LLM output structure.
- Add an admin “safe mode” UI to disable heavy features live (WS streaming, microservices, building).

### 4) Reliability + operations
- Add comprehensive error handling and retries with circuit-breaker behavior for model endpoints.
- Add health checks for DB, Redis, llama.cpp, and (optional) WS transport.
- Add automated backup/restore scripts for Postgres and config snapshots.
- Add CI checks (lint/tests) and a minimal test suite for packet contracts + parsers.
- Add release versioning + changelog workflow for behavior pack + backend.

### 5) Documentation & onboarding
- Add “Quickstart” for local dev (BDS + backend + DB + Redis).
- Document packet contracts and invariants (layer isolation, subjectivity, action dictionary).
- Document configuration knobs (AI_MODE, tick rates, queue concurrency, WS toggles).
- Add troubleshooting guide for common failures (timeouts, invalid entity, DB deadlocks).
- Add contribution guide aligned with file size limits and module boundaries.

## Definition of Done (phase exit)
- Stable operation with multiple villagers active without TPS collapse (within defined budgets).
- Clear operator controls to degrade features safely under load.
- Docs sufficient for a new contributor to run and extend the system.

## Notes (docs freshness)
- Validate external dependencies’ current best practices (Express v5, pg, BullMQ, pgvector, Socket.IO) via **context7** before finalizing operational guidance.

