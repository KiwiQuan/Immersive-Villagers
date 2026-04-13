# Phase 02 — Microservices Mode (Speed + Smaller Models)

## Goal
Add the **MICROSERVICES AI mode** to reduce LLM load and improve responsiveness by offloading specific cognitive tasks to smaller models and vector search, while keeping the MVP product working end-to-end.

## Scope / Deliverables
- Runtime-switchable **AI_MODE** with both:
  - **MONOLITHIC** (existing MVP behavior)
  - **MICROSERVICES** (new behavior)
- Backend endpoints for:
  - MiniLM embeddings (384D)
  - DistilBERT intent classification
  - T5-small summarization
- pgvector-backed similarity search for concept matching in MICROSERVICES mode.
- Updated Layer 6 prompts (summary-based) and Layer 3 fast intent routing.

## Non-goals
- WebSocket streaming/push is still optional (kept HTTP-first).
- Structure learning/building remains deferred.

## Features (with actionable steps)

### 1) MICROSERVICES Perception pipeline (Layer 2)
- Implement `buildEventDescription(eventContext)` (deterministic, cacheable).
- Add backend endpoint `POST /api/vector/embed` returning `{ embedding, dimension: 384 }`.
- Add caching for embeddings (in-memory + optional DB cache keyed by description hash).
- Emit Layer 2 output as `{ embedding, description, ... }` in MICROSERVICES mode.
- Maintain strict packet contracts; Layer 3 must accept either 5D vector or 384D embedding.

### 2) Summarization for memory compression (Layer 5 write path)
- Add backend endpoint `POST /api/summarize/episode` (T5-small) returning a single-sentence summary.
- For MICROSERVICES mode, store summary text with episode writes (and keep dual vector columns as designed).
- Keep summaries short to preserve Layer 6 token budget.
- Add a fallback summarizer (simple template) when the model fails.
- Record model latency metrics for tuning.

### 3) Fast Intent Router (Layer 3)
- Add backend endpoint `POST /api/intent/classify` returning `{ label, confidence }`.
- Implement routing rules (confidence > 0.8):
  - aggression → bypass LLM → Action packet (FLEE)
  - trading → bypass LLM → Action packet (trade start / approach + talk)
  - asking_question → do not bypass (LLM required)
- Log routing decisions for debug inspector.
- Ensure bypass still updates Working Memory (so memory stays coherent).

### 4) pgvector similarity search (concept matching)
- Add pgvector columns + indexes required for 384D (and 5D remains for MONOLITHIC).
- Implement `findNearestConcept({ villagerId, embedding })` with cosine distance and per-villager discovery enforcement.
- Enforce subjectivity: only concepts discovered by that villager can be used as labels.
- Add “unknown concept” flow that stores a discovery candidate without naming it (naming can remain LLM-assisted later).
- Expose a debug view of nearest matches + distances.

### 5) Layer 6 prompt shrink + responsibilities shift
- Update Layer 6 to consume summaries + intent classification output instead of raw vectors.
- Reduce prompt size (target 200–300 tokens equivalent content).
- Keep Layer 6 focused on dialogue + nuanced social reasoning + planning (as per Layer 6 doc).
- Preserve structured output + action dictionary restrictions.
- Add a regression test set for prompt → parse reliability.

## Definition of Done (phase exit)
- You can toggle AI_MODE at runtime:
  - MONOLITHIC behaves as MVP
  - MICROSERVICES uses embedding + summarization + intent routing and shows lower average LLM calls per minute
- Debug inspector shows:
  - last embedding description
  - intent classification and bypass decisions
  - episode summaries stored in DB

## Notes (docs freshness)
- Validate current `@xenova/transformers` APIs and recommended caching strategy via **context7** before implementation.

