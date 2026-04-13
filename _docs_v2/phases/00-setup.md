# Phase 00 — Setup (Barebones, Runnable Skeleton)

## Goal
Stand up a **runnable end-to-end skeleton** (Behavior Pack scripts + Node backend + database/queue scaffolding) that proves the pipeline can move a minimal packet from **game → backend → game**. This phase is **not** feature-complete or “fun” yet; it’s infrastructure you can iterate on safely.

## Scope / Deliverables
- **Repo structure** aligned to `project-rules.md` (`scripts/` Fast Gear, `nodeDB/` Slow Gear, `_docs_v2/` docs).
- **Minimal Bedrock entrypoint** that can:
  - identify “AI villagers” (tag/DP)
  - produce a minimal **Layer 1 Retina Packet** sample
  - send it to backend over **HTTP** with safe timeouts + try/catch
- **Minimal backend** that can:
  - accept a packet (`POST /api/retina`)
  - respond with a deterministic “echo” **NarrativePacket** stub
  - expose health + version endpoints
- **PostgreSQL + migrations skeleton** (no full schema yet; just connectivity + one table to prove writes)
- **BullMQ + Redis skeleton** (one queue, one worker, no real scheduling yet)
- **Docs** for local dev boot (how to run BDS + backend + DB)

## Non-goals
- No real vector math, episode detection, saliency, or LLM calls yet.
- No WebSocket transport yet (HTTP only).
- No full UI/debug inspector; only minimal “is it running?” signals.

## Features (with actionable steps)

### 1) Workspace skeleton & conventions
- Create canonical directories: `scripts/`, `scripts/layers/`, `scripts/utils/`, `scripts/systems/`, `nodeDB/`, `nodeDB/routes/`, `nodeDB/db/`, `nodeDB/brain/`, `nodeDB/utils/`, `_docs_v2/phases/`.
- Add minimal entrypoints: `scripts/main.js`, `nodeDB/server.js`, `nodeDB/app.js`.
- Define a shared “packet” folder for JSON contracts (e.g., `nodeDB/contracts/` + `scripts/contracts/`) or a single source of truth in docs (pick one and stick to it).
- Add naming + file size guardrails to contribution docs (enforce the existing 500-line limit).
- Add a minimal `.env.example` covering DB, Redis, ports, AI mode.

### 2) Backend baseline (Express v5)
- Implement `GET /health` returning `{ ok: true, ts, version }`.
- Implement `POST /api/retina` that validates required fields (`v_id`, `timestamp`, `priority`) and returns an **echo**.
- Implement centralized error handler + 404 handler.
- Add structured logging (Pino) with request IDs.
- Add request validation (Joi) for the retina packet.

### 3) Database connectivity + first migration (Postgres + pgvector-ready)
- Create `nodeDB/db/pool.js` with a single `pg.Pool` instance.
- Add `nodeDB/db/migrations/` and a migration runner script (node-pg-migrate).
- Create a single “smoke” table (e.g., `ingest_events`) storing the raw retina packet as JSONB.
- Add a write path in `POST /api/retina` that inserts the packet asynchronously.
- Add a read path `GET /api/ingest/recent?limit=20` for basic verification.

### 4) Queue skeleton (BullMQ + Redis)
- Create a queue `brain_scheduler` with a single worker.
- On `POST /api/retina`, enqueue a job with the packet (keep payload small).
- Worker transforms the packet into a deterministic **NarrativePacket stub** (no LLM).
- Store last N processed job summaries in memory (dev-only).
- Expose `GET /api/scheduler/stats` (queue depth, processed count).

### 5) Bedrock-side baseline (HTTP + safety)
- Implement `scripts/main.js` with a startup banner + tick-safe interval.
- Implement “AI villager discovery” (tag or DP) without persisting `Entity` references across ticks (store `entity.id`).
- Generate a minimal **Retina Packet** (Layer 1 output shape) on a simple trigger (e.g., player chat near villager or periodic heartbeat).
- Post to backend via `@minecraft/server-net.http` wrapped in try/catch with a short timeout.
- Parse backend response into a **NarrativePacket stub** and emit a visible proof (chat message or debug log).

## Definition of Done (phase exit)
- You can start BDS + backend + DB + Redis and observe:
  - Bedrock script sends a retina packet over HTTP
  - backend persists it
  - backend returns a deterministic narrative stub
  - Bedrock displays the stub (chat/log)

## Notes (docs freshness)
- Any implementation that references external API details (Script API, `@minecraft/server-net`, BullMQ, node-pg-migrate) must be validated against current docs via **context7** before coding (per `document_rules.mdc`).

