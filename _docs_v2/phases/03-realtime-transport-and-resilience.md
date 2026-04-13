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

### 2) WebSocket connection management (Bedrock + backend)
- Implement exponential backoff reconnect with max delay and jitter.
- Implement a send buffer queue (bounded) for messages attempted while disconnected.
- Implement heartbeat/keepalive (manual) and connection state monitoring.
- Implement graceful shutdown and cleanup to avoid listener leaks.
- Expose WS connection state in debug inspector (connected / degraded / HTTP-only).

### 3) LLM streaming (Layer 6 UX)
- Add backend WebSocket endpoint for `llm_inference` streaming tokens.
- On Bedrock side, stream tokens into a buffer and update partial speech output (rate-limited).
- On completion, parse final structured output into NarrativePacket.
- If streaming fails mid-way, fall back to HTTP inference and replace partial output.
- Add metrics: first-token latency, total latency, stream error rates.

### 4) Backend → Bedrock push for Working Memory (Layer 4)
- Define a push packet `{ type: "memory_update", v_id, data }` (contracted).
- Implement Bedrock handler that merges updates into `trackedVillagers` and sets `needsDPSync/needsDBSync`.
- Implement backend scheduled mood adjustments (time-of-day) as a simple first use-case.
- Add “gossip hook” pipeline (packet only; gameplay logic can evolve later).
- Rate-limit pushes per villager to avoid chat/CPU spam.

### 5) Observability + hardening
- Add correlation IDs across HTTP + WS messages for tracing.
- Add structured error taxonomy (`NetworkError`, `ValidationError`, `ModelError`) mapped to safe fallbacks.
- Add Sentry (backend) for exceptions + performance sampling (bounded).
- Add load-shedding: if scheduler queue too deep, degrade low-priority requests.
- Add a “safe mode” switch: force HTTP-only and disable streaming if instability detected.

## Definition of Done (phase exit)
- The product remains fully functional if WebSocket is disabled/unavailable.
- With WebSocket enabled:
  - LLM speech begins streaming quickly (improved first-token time)
  - backend can push a mood update and it appears in Working Memory inspector
- Error rate and queue depth are visible and actionable via logs/metrics endpoints.

## Notes (docs freshness)
- Validate current `@minecraft/server-net` WebSocket capabilities and caveats via **context7** before implementation, because it’s explicitly marked **EXPERIMENTAL (2026)** in your docs.

