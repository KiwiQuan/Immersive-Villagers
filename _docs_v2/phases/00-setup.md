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

#### Implementation Spec
- **Files**:
  - Bedrock: `scripts/main.js`, `scripts/utils/http_client.js`, `scripts/contracts/packets.js`
  - Backend: `nodeDB/app.js`, `nodeDB/server.js`, `nodeDB/routes/`, `nodeDB/db/`, `nodeDB/brain/`
- **Contracts**: choose one:
  - **Option A (preferred)**: shared docs as source of truth + lightweight runtime guards in `scripts/contracts/packets.js`
  - **Option B**: mirrored `scripts/contracts/` + `nodeDB/contracts/` (keep in sync via tests)
- **Config**:
  - `.env.example`: `PORT`, `DB_*`, `REDIS_*`, `AI_MODE`
- **Verify**:
  - `scripts/main.js` loads without error and prints a startup banner
  - backend starts and serves `GET /health`

##### Step Guide
- **Step 1**: Create canonical directories + entrypoints
  - **Do**: create folders listed in the step and add empty entrypoints that import/boot cleanly.
  - **Verify**: repo has the folder skeleton and both entrypoints exist.
- **Step 2**: Add minimal entrypoints (`scripts/main.js`, `nodeDB/server.js`, `nodeDB/app.js`)
  - **Do**: Bedrock entrypoint only registers intervals/events; backend entrypoints only wire app + start server.
  - **Verify**: backend process starts and exits gracefully (Ctrl+C) without errors.
- **Step 3**: Decide contract ownership (docs-only vs shared contracts folder)
  - **Do**: pick Option A or B; don’t mix.
  - **Verify**: you can point to exactly one “truth” for packet shapes.
- **Step 4**: Add naming + file size guardrails (500-line rule)
  - **Do**: ensure contributions/docs emphasize split before 500 lines.
  - **Verify**: new modules are structured per layer/system, not monolith files.
- **Step 5**: Add `.env.example`
  - **Do**: include DB + Redis + server port + AI mode defaults.
  - **Verify**: a fresh clone can copy `.env.example` → `.env` and boot backend.

### 2) Backend baseline (Express v5)
- Implement `GET /health` returning `{ ok: true, ts, version }`.
- Implement `POST /api/retina` that validates required fields (`v_id`, `timestamp`, `priority`) and returns an **echo**.
- Implement centralized error handler + 404 handler.
- Add structured logging (Pino) with request IDs.
- Add request validation (Joi) for the retina packet.

#### Implementation Spec
- **Files**:
  - `nodeDB/app.js`: middleware + routes + error handler
  - `nodeDB/routes/ingest_routes.js`: `/health`, `/api/retina`, `/api/ingest/*`
  - `nodeDB/utils/logger.js`: Pino instance (dev pretty optional)
  - `nodeDB/utils/validate.js`: Joi helper middleware
- **Routes**:
  - `GET /health` → `{ ok: true, ts, version }`
  - `POST /api/retina` → `{ ok: true, echo: <retinaPacketMinimal>, narrativeStub }`
- **Failure handling**:
  - validation errors return 400 with structured details
  - unexpected errors return 500; no stack traces in prod
- **Verify**:
  - request ID appears in logs for every request

##### Step Guide
- **Step 1**: Implement `GET /health`
  - **Example response**: `{ "ok": true, "ts": 1710000000000, "version": "phase00" }`
  - **Verify**: `GET /health` returns 200 consistently.
- **Step 2**: Implement `POST /api/retina` (validate + echo)
  - **Example request**:
    - `{ "header": { "v_id": "v-123", "timestamp": 1700, "channel": "audio", "priority": 1 }, "body": { "type": "chat", "actor": "player-steve" } }`
  - **Example response**:
    - `{ "ok": true, "narrativeStub": { "v_id": "v-123", "thought": "stub", "speech": "stub", "action": "idle", "timestamp": 1700 } }`
  - **Verify**: invalid payload returns 400; valid returns 200 + stub.
- **Step 3**: Central error handler + 404
  - **Do**: ensure error middleware is last; 404 before it.
  - **Verify**: unknown route returns 404 JSON.
- **Step 4**: Pino logging + request IDs
  - **Do**: add `requestId` to every log line (header or generated).
  - **Verify**: `/api/retina` logs include `requestId` and `v_id`.
- **Step 5**: Joi validation middleware
  - **Do**: validate minimal required fields; strip/ignore unknown optional keys.
  - **Verify**: malformed header/body is rejected early.

### 3) Database connectivity + first migration (Postgres + pgvector-ready)
- Create `nodeDB/db/pool.js` with a single `pg.Pool` instance.
- Add `nodeDB/db/migrations/` and a migration runner script (node-pg-migrate).
- Create a single “smoke” table (e.g., `ingest_events`) storing the raw retina packet as JSONB.
- Add a write path in `POST /api/retina` that inserts the packet asynchronously.
- Add a read path `GET /api/ingest/recent?limit=20` for basic verification.

#### Implementation Spec
- **Files** (context7-validated `pg` practices):
  - `nodeDB/db/pool.js`: one long-lived `Pool` + `pool.on('error', ...)`
  - `nodeDB/db/migrations/*`: create `ingest_events`
  - `nodeDB/queries/ingest_queries.js`: `insertIngestEvent()`, `listRecentIngestEvents()`
- **Schema (minimum)**:
  - `ingest_events(id bigserial, ts timestamptz default now(), payload jsonb not null)`
- **Rules**:
  - use `pool.query()` for single statements
  - release clients in `finally` if you ever use `pool.connect()`
- **Verify**:
  - `GET /api/ingest/recent?limit=20` returns newest rows

##### Step Guide
- **Step 1**: Create `nodeDB/db/pool.js` (single pool)
  - **Do**: export `pool` and/or `query()` helper; add `pool.on('error', ...)`.
  - **Verify**: backend boots even if an idle client errors (it logs, doesn’t crash-loop).
- **Step 2**: Add migrations scaffold (node-pg-migrate)
  - **Do**: add one migration creating `ingest_events`.
  - **Verify**: migrate up/down works locally.
- **Step 3**: Create `ingest_events` JSONB smoke table
  - **Do**: store `{ header, body }` payload as JSONB; keep schema minimal.
  - **Verify**: inserting a sample row succeeds.
- **Step 4**: Insert on `POST /api/retina`
  - **Do**: insert asynchronously in handler; return response even if insert is slow (bounded timeout).
  - **Verify**: DB count increases after requests.
- **Step 5**: Add `GET /api/ingest/recent`
  - **Do**: support `limit` with a hard cap (e.g., max 100).
  - **Verify**: returns newest-first rows.

### 4) Queue skeleton (BullMQ + Redis)
- Create a queue `brain_scheduler` with a single worker.
- On `POST /api/retina`, enqueue a job with the packet (keep payload small).
- Worker transforms the packet into a deterministic **NarrativePacket stub** (no LLM).
- Store last N processed job summaries in memory (dev-only).
- Expose `GET /api/scheduler/stats` (queue depth, processed count).

#### Implementation Spec
- **Files** (context7-validated BullMQ basics):
  - `nodeDB/brain/queue.js`: exports `brainQueue`
  - `nodeDB/brain/worker.js`: exports `brainWorker`
  - `nodeDB/routes/scheduler_routes.js`: `GET /api/scheduler/stats`
- **Priority**:
  - BullMQ uses **lower number = higher priority**
  - Phase 00 can default all jobs to the same priority
- **Job options**:
  - `attempts: 3`, `backoff` fixed/exponential, bounded `removeOnComplete/removeOnFail`
- **Verify**:
  - stats endpoint shows queue depth and processed count incrementing

##### Step Guide
- **Step 1**: Create queue + worker
  - **Do**: queue name `brain_scheduler`; one worker process in same service for Phase 00.
  - **Verify**: worker starts and can process a no-op job.
- **Step 2**: Enqueue job on retina ingest
  - **Do**: job payload includes minimal `v_id` + `type`; keep raw payload stored in DB, not queue.
  - **Verify**: queue depth increases then decreases as worker runs.
- **Step 3**: Produce deterministic NarrativePacket stub
  - **Do**: transform `RetinaPacket.body.type` into a stub message; no randomness.
  - **Verify**: same input yields same stub output.
- **Step 4**: Keep last-N job summaries (dev-only)
  - **Do**: in-memory ring buffer (bounded).
  - **Verify**: buffer never grows beyond N.
- **Step 5**: `GET /api/scheduler/stats`
  - **Do**: expose queue depth + processed count; optionally counts per status.
  - **Verify**: stats respond fast even under load.

### 5) Bedrock-side baseline (HTTP + safety)
- Implement `scripts/main.js` with a startup banner + tick-safe interval.
- Implement “AI villager discovery” (tag or DP) without persisting `Entity` references across ticks (store `entity.id`).
- Generate a minimal **Retina Packet** (Layer 1 output shape) on a simple trigger (e.g., player chat near villager or periodic heartbeat).
- Post to backend via `@minecraft/server-net.http` wrapped in try/catch with a short timeout.
- Parse backend response into a **NarrativePacket stub** and emit a visible proof (chat message or debug log).

#### Implementation Spec
- **Files**:
  - `scripts/main.js`: triggers + scheduling only
  - `scripts/utils/http_client.js`: builds `HttpRequest`, sets headers, `setTimeout(seconds)`
  - `scripts/contracts/packets.js`: minimal guards for retina + narrative stub
- **Packet contracts**:
  - Retina minimal: `header.{v_id,timestamp,channel,priority}` + `body.type`
  - Narrative stub: `{ v_id, thought, speech, action, timestamp }`
- **Permissions** (context7-validated):
  - configure `permissions.json` for `@minecraft/server-net` with:
    - `allowed_uris` (your backend URL)
    - `max_body_bytes`
    - `max_concurrent_requests`
- **Safety**:
  - try/catch around every request; never block tick loop
  - store `entity.id` only (no persistent Entity refs)
- **Verify**:
  - Bedrock emits a visible proof (chat/log) after a successful HTTP roundtrip

##### Step Guide
- **Step 1**: Bedrock startup banner + safe interval
  - **Do**: log once on boot; use an interval for a heartbeat (not every tick).
  - **Verify**: you see one boot message and periodic heartbeat logs.
- **Step 2**: AI villager discovery (tag/DP)
  - **Do**: find villagers by tag/DP; store `entity.id` only.
  - **Verify**: discovered villager IDs list stays bounded and updates when villagers despawn.
- **Step 3**: Generate minimal Retina Packet on trigger
  - **Example**: on player chat near villager → `{ header:{...}, body:{ type:'chat', actor:'playerId' } }`
  - **Verify**: packet builds without throwing.
- **Step 4**: POST via `@minecraft/server-net.http` (timeout in seconds)
  - **Do**: `HttpRequest.setTimeout(2)` (or similar) and try/catch.
  - **Verify**: failed requests don’t crash; success returns stub.
- **Step 5**: Parse stub + visible proof
  - **Do**: print `speech` to chat/log (rate-limited).
  - **Verify**: you see the stub response in-game.

## Definition of Done (phase exit)
- You can start BDS + backend + DB + Redis and observe:
  - Bedrock script sends a retina packet over HTTP
  - backend persists it
  - backend returns a deterministic narrative stub
  - Bedrock displays the stub (chat/log)

## Notes (docs freshness)
- Any implementation that references external API details (Script API, `@minecraft/server-net`, BullMQ, node-pg-migrate) must be validated against current docs via **context7** before coding (per `document_rules.mdc`).

