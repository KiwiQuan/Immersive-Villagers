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

#### Implementation Spec
- **Budgets**: define explicit per-layer budgets (time + frequency) and enforce via throttles.
- **Guards**: add runtime guard helpers to prevent storing `Entity` references in cache objects.
- **Verify**: profiling mode shows per-layer timings and buffer sizes remain bounded.

##### Step Guide
- **Step 1**: Add budgets + sampling
  - **Do**: measure per-layer work time; skip low-priority polls under load.
  - **Verify**: p95 tick work stays under your target budget.
- **Step 2**: Audit for persistent Entity refs
  - **Do**: enforce “store IDs only” with helper guards and code review checks.
  - **Verify**: long sessions produce no “Invalid Object” errors.
- **Step 3**: Bounded caches + eviction
  - **Do**: every Map/buffer has max size + eviction strategy.
  - **Verify**: memory usage stable over time.
- **Step 4**: Spread work across intervals
  - **Do**: replace per-tick loops with staggered intervals.
  - **Verify**: no periodic spikes.
- **Step 5**: Profiling mode
  - **Do**: toggleable profiling counters/timings.
  - **Verify**: profiling can be enabled/disabled live.

### 2) Slow Gear scalability (DB + queue + models)
- Finalize schema (all Layer 5 tables) and ensure all queries are indexed and parameterized.
- Tune pgvector indexes (`ivfflat` lists/probes) and document recommended settings.
- Add queue load shedding and backpressure (reject/deflect low-priority work under saturation).
- Add model lifecycle management (warmup, cache directory, worker threads where appropriate).
- Add structured rate limits per villager/player to prevent abuse.

#### Implementation Spec
- **DB**: parameterized queries only; pool-level error handling (`pool.on('error')`) + graceful shutdown (`pool.end()`).
- **Queue**: single priority mapping table; enforce concurrency caps and backpressure thresholds.
- **Models**: singleton load + warmup; bounded request queues (no unbounded promises).
- **Verify**: load testing shows stable p95 latencies at expected concurrency.

##### Step Guide
- **Step 1**: Finalize schema + indexes + parameterized queries
  - **Do**: ensure every hot query has an index and uses placeholders.
  - **Verify**: explain plans show index usage.
- **Step 2**: Tune pgvector indexes
  - **Do**: document lists/probes settings you actually run.
  - **Verify**: recall/latency meet targets.
- **Step 3**: Load shedding/backpressure
  - **Do**: reject ROUTINE work first under saturation.
  - **Verify**: CRITICAL/SOCIAL remain responsive.
- **Step 4**: Model lifecycle management
  - **Do**: warm models at boot; use bounded queues; consider worker threads.
  - **Verify**: no OOM under bursts.
- **Step 5**: Rate limits
  - **Do**: per-player/per-villager caps for expensive operations.
  - **Verify**: abuse doesn’t degrade server for others.

### 3) UX polish (debug + player experience)
- Expand server-ui inspector with consistent navigation and readable summaries (no deep nesting).
- Improve watch mode: event-based updates + smarter summarization, still capped at 1/2s.
- Add clear “villager personality” presentation driven by stored tags and relationship state.
- Add localized or configurable speech templates (optional) while preserving LLM output structure.
- Add an admin “safe mode” UI to disable heavy features live (WS streaming, microservices, building).

#### Implementation Spec
- **UI rules**: hub-and-spoke navigation; depth ≤ 3; always handle cancel.
- **Safety controls**: safe mode toggles are visible and apply immediately.
- **Verify**: watch mode stays ≤ 1 update / 2s / player.

##### Step Guide
- **Step 1**: Expand inspector UX
  - **Do**: keep navigation shallow; add clear headings and summaries.
  - **Verify**: users find WM/LTM/tasks in ≤ 3 clicks.
- **Step 2**: Improve watch mode
  - **Do**: event-based batching + summarization; preserve rate cap.
  - **Verify**: watch mode stays readable under load.
- **Step 3**: Personality presentation
  - **Do**: derive display from tags + relationships + recent episodes.
  - **Verify**: personality feels consistent across sessions.
- **Step 4**: Optional localized/configurable templates
  - **Do**: allow templates without breaking structured output parsing.
  - **Verify**: parser still valid.
- **Step 5**: Admin safe mode UI
  - **Do**: live toggles for WS/microservices/building.
  - **Verify**: toggles apply immediately.

### 4) Reliability + operations
- Add comprehensive error handling and retries with circuit-breaker behavior for model endpoints.
- Add health checks for DB, Redis, llama.cpp, and (optional) WS transport.
- Add automated backup/restore scripts for Postgres and config snapshots.
- Add CI checks (lint/tests) and a minimal test suite for packet contracts + parsers.
- Add release versioning + changelog workflow for behavior pack + backend.

#### Implementation Spec
- **Health**: `/health` returns dependency states (ok/degraded) for DB/Redis/LLM/WS.
- **CI gates**: packet contract tests + LLM parser tests are mandatory.
- **Verify**: “dependency down” drills degrade safely without crashing.

##### Step Guide
- **Step 1**: Circuit breaker for model endpoints
  - **Do**: after N failures, open breaker and use fallbacks briefly.
  - **Verify**: failures don’t cascade into retries storms.
- **Step 2**: Health checks
  - **Do**: report ok/degraded + last error per dependency.
  - **Verify**: operators can diagnose quickly.
- **Step 3**: Backup/restore automation
  - **Do**: scripts + documented restore steps.
  - **Verify**: restore rehearsal works.
- **Step 4**: CI checks + test suite
  - **Do**: contract tests and parser tests run in CI.
  - **Verify**: broken packets/parsers block merges.
- **Step 5**: Release versioning + changelog
  - **Do**: version tags for BP + backend.
  - **Verify**: you can bisect regressions by version.

### 5) Documentation & onboarding
- Add “Quickstart” for local dev (BDS + backend + DB + Redis).
- Document packet contracts and invariants (layer isolation, subjectivity, action dictionary).
- Document configuration knobs (AI_MODE, tick rates, queue concurrency, WS toggles).
- Add troubleshooting guide for common failures (timeouts, invalid entity, DB deadlocks).
- Add contribution guide aligned with file size limits and module boundaries.

#### Implementation Spec
- **Quickstart includes**:
  - required `permissions.json` settings for `@minecraft/server-net` (allowed URIs + conservative limits)
  - minimal `.env` and run order (DB → Redis → backend → BDS)
- **Verify**: a new contributor can reach Phase 01 DoD using only Quickstart.

##### Step Guide
- **Step 1**: Quickstart doc
  - **Do**: list prerequisites + exact run order.
  - **Verify**: fresh machine reaches Phase 01 DoD.
- **Step 2**: Packet contracts + invariants doc
  - **Do**: one page of canonical packet shapes and rules.
  - **Verify**: contributors don’t reinvent formats.
- **Step 3**: Config knobs doc
  - **Do**: list AI_MODE, tick rates, queue concurrency, WS toggles with defaults.
  - **Verify**: operators can tune safely.
- **Step 4**: Troubleshooting guide
  - **Do**: common failures (timeouts, invalid entity, DB issues) with fixes.
  - **Verify**: support questions decrease.
- **Step 5**: Contribution guide
  - **Do**: 500-line rule + layer boundaries + testing expectations.
  - **Verify**: PRs stay consistent and maintainable.

## Definition of Done (phase exit)
- Stable operation with multiple villagers active without TPS collapse (within defined budgets).
- Clear operator controls to degrade features safely under load.
- Docs sufficient for a new contributor to run and extend the system.

## Notes (docs freshness)
- Validate external dependencies’ current best practices (Express v5, pg, BullMQ, pgvector, Socket.IO) via **context7** before finalizing operational guidance.

