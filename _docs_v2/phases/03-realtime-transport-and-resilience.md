# Phase 03 — Real-time Transport + Resilience (WebSocket, Fallbacks, Observability)

## Goal
Improve responsiveness and robustness without changing the core product: add **WebSocket streaming/push** where it clearly improves UX, while keeping **HTTP fallbacks** for reliability; harden error handling, backpressure, and observability.

## Scope / Deliverables
- Hybrid transport selection (HTTP default, WebSocket preferred for streaming/push when available).
- WebSocket reconnection + buffering strategy (manual, explicitly handled).
- LLM response streaming to Bedrock (token-by-token) for improved perceived latency.
- Backend-initiated Working Memory updates (push) for scheduled mood shifts and gossip hooks.
- Production-grade telemetry: structured logs, error capture, latency metrics.

## Non-goals
- No new gameplay features; this phase is infrastructure + UX latency.
- No assumption of WebSocket stability; it must fail safely to HTTP.

## Features (with actionable steps)

### 1) Transport selection layer (single abstraction)
- Define a single “network client” module on Bedrock side that exposes `postJson()` and `wsSend()` with consistent error objects.
- Implement “prefer WS if open, else HTTP” routing for eligible operations (LLM inference, push updates).
- Add request timeouts and bounded retries (no infinite retry loops).
- Add payload size guards (auto-route large payloads to HTTP).
- Ensure all calls are wrapped in try/catch per project rules.

#### Implementation Spec
- **Files**:
  - Bedrock: `scripts/utils/network_client.js` (single abstraction)
- **HTTP rules (context7-validated)**:
  - build `HttpRequest`, `setTimeout(seconds)`, `addHeader()`, `setBody(string)`
  - ensure `permissions.json` has `allowed_uris`, `max_body_bytes`, `max_concurrent_requests`
- **Verify**:
  - every outbound call returns a uniform `{ ok, status?, error? }`

##### Step Guide
- **Step 1**: Define a single Bedrock network client module
  - **Do**: centralize HTTP + WS; return consistent result objects.
  - **Verify**: no layer imports `@minecraft/server-net` directly except the client.
- **Step 2**: Prefer WS if open, else HTTP
  - **Do**: routing rules based on operation type + connection state.
  - **Verify**: when WS drops, requests continue via HTTP automatically.
- **Step 3**: Add timeouts + bounded retries
  - **Do**: never infinite retries; exponential backoff with max cap.
  - **Verify**: repeated failures don’t stall tick loop.
- **Step 4**: Payload size guards
  - **Do**: route large payloads to HTTP; block oversize sends.
  - **Verify**: no silent truncation.
- **Step 5**: try/catch everywhere
  - **Do**: errors become structured telemetry, not crashes.
  - **Verify**: failure counters increment and UI shows degraded mode.

### 2) WebSocket connection management (Bedrock + backend)
- Implement exponential backoff reconnect with max delay and jitter.
- Implement a send buffer queue (bounded) for messages attempted while disconnected.
- Implement heartbeat/keepalive (manual) and connection state monitoring.
- Implement graceful shutdown and cleanup to avoid listener leaks.
- Expose WS connection state in debug inspector (connected / degraded / HTTP-only).

#### Implementation Spec
- **Files**:
  - Bedrock: `scripts/utils/ws_manager.js`
  - Backend: `nodeDB/realtime/ws_server.js` (or `nodeDB/realtime/socket_server.js`)
- **Rules**:
  - bounded send queue + explicit drop policy
  - exponential backoff with jitter; max delay cap
- **Verify**:
  - inspector shows connection state + reconnect count

##### Step Guide
- **Step 1**: Exponential backoff reconnect (with jitter)
  - **Do**: cap max delay; reset backoff on stable connection.
  - **Verify**: reconnect attempts are spaced out and stop when stable.
- **Step 2**: Bounded send buffer queue
  - **Do**: drop policy (drop oldest low-priority first).
  - **Verify**: queue length never exceeds cap.
- **Step 3**: Heartbeat/keepalive
  - **Do**: detect half-open connections; mark degraded.
  - **Verify**: missing heartbeats flips state in inspector.
- **Step 4**: Cleanup on shutdown/disconnect
  - **Do**: unsubscribe listeners; clear timers.
  - **Verify**: reconnect doesn’t duplicate listeners.
- **Step 5**: Surface connection state
  - **Do**: expose connected/degraded/http-only.
  - **Verify**: state reflects reality during disconnect tests.

### 3) LLM streaming (Layer 6 UX)
- Add backend WebSocket endpoint for `llm_inference` streaming tokens.
- On Bedrock side, stream tokens into a buffer and update partial speech output (rate-limited).
- On completion, parse final structured output into NarrativePacket.
- If streaming fails mid-way, fall back to HTTP inference and replace partial output.
- Add metrics: first-token latency, total latency, stream error rates.

#### Implementation Spec
- **WS message contract**:
  - request: `{ type:'llm_inference', v_id, correlationId, prompt, stream:true }`
  - token: `{ type:'token', correlationId, token }`
  - complete: `{ type:'complete', correlationId, narrativePacket }`
- **Rate limits**:
  - Bedrock partial display updates are throttled (avoid chat spam)
- **Verify**:
  - track first-token latency and total latency per inference

##### Step Guide
- **Step 1**: Add backend WS inference endpoint
  - **Do**: accept prompt + correlationId; stream token events.
  - **Verify**: tokens arrive before completion under normal conditions.
- **Step 2**: Bedrock token accumulation + rate limiting
  - **Do**: buffer tokens; update UI/chat at a safe cadence.
  - **Verify**: no chat spam during long responses.
- **Step 3**: Parse final NarrativePacket on completion
  - **Do**: same strict parser as HTTP flow.
  - **Verify**: streamed and non-streamed results behave identically.
- **Step 4**: Mid-stream failure fallback
  - **Do**: abort stream and trigger HTTP inference.
  - **Verify**: villager completes response even if WS breaks.
- **Step 5**: Metrics
  - **Do**: record first-token ms + total ms + stream error rate.
  - **Verify**: regressions are visible.

### 4) Backend → Bedrock push for Working Memory (Layer 4)
- Define a push packet `{ type: "memory_update", v_id, data }` (contracted).
- Implement Bedrock handler that merges updates into `trackedVillagers` and sets `needsDPSync/needsDBSync`.
- Implement backend scheduled mood adjustments (time-of-day) as a simple first use-case.
- Add “gossip hook” pipeline (packet only; gameplay logic can evolve later).
- Rate-limit pushes per villager to avoid chat/CPU spam.

#### Implementation Spec
- **Contract**:
  - `{ type:'memory_update', v_id, correlationId, data:{ patch... } }`
- **Rules**:
  - merge into cache; set dirty flags; never require entity to be loaded
  - rate-limit per villager (config)
- **Verify**:
  - inspector shows last push time + last patch applied

##### Step Guide
- **Step 1**: Define push packet contract
  - **Example**: `{ "type":"memory_update", "v_id":"v-1", "correlationId":"c-1", "data":{ "currentEpisode":"Tired" } }`
  - **Verify**: schema validation rejects malformed pushes.
- **Step 2**: Merge into cache + set dirty flags
  - **Do**: merge patch; set `needsDPSync/needsDBSync`.
  - **Verify**: WM inspector reflects patch immediately.
- **Step 3**: Scheduled mood adjustment use-case
  - **Do**: backend sends periodic updates (rate-limited).
  - **Verify**: mood changes appear without player action.
- **Step 4**: Gossip hook packet
  - **Do**: define packet shape; keep gameplay logic minimal.
  - **Verify**: pipeline supports it without leaks.
- **Step 5**: Rate limit pushes
  - **Do**: cap per villager per minute.
  - **Verify**: no update storms.

### 5) Observability + hardening
- Add correlation IDs across HTTP + WS messages for tracing.
- Add structured error taxonomy (`NetworkError`, `ValidationError`, `ModelError`) mapped to safe fallbacks.
- Add Sentry (backend) for exceptions + performance sampling (bounded).
- Add load-shedding: if scheduler queue too deep, degrade low-priority requests.
- Add a “safe mode” switch: force HTTP-only and disable streaming if instability detected.

#### Implementation Spec
- **Correlation**:
  - correlationId propagated across HTTP, WS, and scheduler jobs
- **Metrics**:
  - HTTP p50/p95 latency, timeouts
  - WS reconnect count, stream failures
  - scheduler queue depth + avg wait per priority
- **Safe mode**:
  - force HTTP-only; disable streaming/push; reduce cadences
- **Verify**:
  - flipping safe mode keeps core gameplay functional

##### Step Guide
- **Step 1**: Correlation IDs everywhere
  - **Do**: carry correlationId across HTTP, WS, and queue jobs.
  - **Verify**: one request can be traced end-to-end.
- **Step 2**: Error taxonomy + safe fallbacks
  - **Do**: map error types to fallbacks (HTTP-only, IDLE, etc.).
  - **Verify**: errors don’t cascade into crashes.
- **Step 3**: Sentry + sampling (bounded)
  - **Do**: capture exceptions; keep sampling conservative.
  - **Verify**: high-volume errors don’t flood quota.
- **Step 4**: Load shedding
  - **Do**: when queue depth too high, drop ROUTINE first.
  - **Verify**: CRITICAL/SOCIAL still function under load.
- **Step 5**: Safe mode switch
  - **Do**: force HTTP-only, disable streaming/push, lower cadences.
  - **Verify**: system stays usable during incidents.

## Definition of Done (phase exit)
- The product remains fully functional if WebSocket is disabled/unavailable.
- With WebSocket enabled:
  - LLM speech begins streaming quickly (improved first-token time)
  - backend can push a mood update and it appears in Working Memory inspector
- Error rate and queue depth are visible and actionable via logs/metrics endpoints.

## Notes (docs freshness)
- Validate current `@minecraft/server-net` WebSocket capabilities and caveats via **context7** before implementation, because it’s explicitly marked **EXPERIMENTAL (2026)** in your docs.

