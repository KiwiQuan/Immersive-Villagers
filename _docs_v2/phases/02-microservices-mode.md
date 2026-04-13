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

#### Implementation Spec
- **Files**:
  - Bedrock: `scripts/layers/layer2_perception/build_event_description.js`
  - Backend: `nodeDB/routes/vector_routes.js`, `nodeDB/brain/models/embedding_model.js`
- **Route contract**:
  - `POST /api/vector/embed` → `{ embedding: number[384], dimension: 384, cacheHit: boolean }`
- **Caching**:
  - key = `hash(description)`; bounded in-memory LRU first, optional DB cache second
- **Verify**:
  - responses include `cacheHit` and average latency drops after warmup

##### Step Guide
- **Step 1**: Implement `buildEventDescription(eventContext)`
  - **Do**: deterministic templates; no random phrasing.
  - **Verify**: identical inputs produce identical strings.
- **Step 2**: `POST /api/vector/embed`
  - **Example request**: `{ "text": "Steve placed a high-value block near home" }`
  - **Example response**: `{ "embedding": [0.12, ...], "dimension": 384, "cacheHit": false }`
  - **Verify**: dimension is always 384.
- **Step 3**: Add embedding caching
  - **Do**: bounded LRU by hash(description).
  - **Verify**: repeated requests flip `cacheHit: true`.
- **Step 4**: Emit `{ embedding, description }` to Layer 3
  - **Do**: Layer 3 accepts both shapes (5D or 384D) via discriminant.
  - **Verify**: no crashes when switching AI_MODE.
- **Step 5**: Enforce strict packet contracts
  - **Do**: validate before sending across layers; drop + log invalid.
  - **Verify**: invalid packets are counted and do not poison buffers.

### 2) Summarization for memory compression (Layer 5 write path)
- Add backend endpoint `POST /api/summarize/episode` (T5-small) returning a single-sentence summary.
- For MICROSERVICES mode, store summary text with episode writes (and keep dual vector columns as designed).
- Keep summaries short to preserve Layer 6 token budget.
- Add a fallback summarizer (simple template) when the model fails.
- Record model latency metrics for tuning.

#### Implementation Spec
- **Files**:
  - `nodeDB/routes/summarize_routes.js`
  - `nodeDB/brain/models/summarizer_model.js`
  - `nodeDB/queries/episodes_queries.js` (store summary)
- **Route contract**:
  - `POST /api/summarize/episode` → `{ summary: string, model: 't5-small'|'fallback', ms: number }`
- **Guards**:
  - clamp summary length (e.g., max 240 chars)
- **Verify**:
  - DB episode rows include summary; latency metrics logged

##### Step Guide
- **Step 1**: `POST /api/summarize/episode`
  - **Example request**: `{ "events": ["..."], "maxChars": 240 }`
  - **Verify**: returns a single sentence.
- **Step 2**: Store summary text for MICROSERVICES writes
  - **Do**: ensure summary is stored alongside embedding.
  - **Verify**: context retrieval uses summary, not raw logs.
- **Step 3**: Keep summaries short
  - **Do**: clamp length; truncate safely.
  - **Verify**: prompt sizes stabilize.
- **Step 4**: Fallback summarizer
  - **Do**: template-based fallback when model errors.
  - **Verify**: summarization never blocks episode writes.
- **Step 5**: Record latency metrics
  - **Do**: capture ms per call; log p50/p95 periodically.
  - **Verify**: you can see latency regressions quickly.

### 3) Fast Intent Router (Layer 3)
- Add backend endpoint `POST /api/intent/classify` returning `{ label, confidence }`.
- Implement routing rules (confidence > 0.8):
  - aggression → bypass LLM → Action packet (FLEE)
  - trading → bypass LLM → Action packet (trade start / approach + talk)
  - asking_question → do not bypass (LLM required)
- Log routing decisions for debug inspector.
- Ensure bypass still updates Working Memory (so memory stays coherent).

#### Implementation Spec
- **Files**:
  - `nodeDB/routes/intent_routes.js`
  - `nodeDB/brain/models/intent_model.js`
  - Bedrock: `scripts/layers/layer3_sequencer/fast_intent_router.js`
- **Route contract**:
  - `POST /api/intent/classify` → `{ label: string, confidence: number }`
- **Bypass contract**:
  - bypass returns a local `NarrativePacket` that still flows through Layer 7 and reports feedback to Layer 4
- **Verify**:
  - inspector shows `{ label, confidence, bypass }` for last N events

##### Step Guide
- **Step 1**: `POST /api/intent/classify`
  - **Example response**: `{ "label": "aggression", "confidence": 0.92 }`
  - **Verify**: confidence is numeric and bounded [0,1].
- **Step 2**: Implement bypass rules (> 0.8)
  - **Do**: aggression → FLEE; trading → approach+talk; questions → no bypass.
  - **Verify**: bypass reduces LLM calls in logs.
- **Step 3**: Log decisions
  - **Do**: include `{ label, confidence, bypass }` in debug stream.
  - **Verify**: inspector displays last decision.
- **Step 4**: Keep WM coherent on bypass
  - **Do**: still update Layer 4 (episode + mood), then execute Layer 7 action.
  - **Verify**: memory persists even when LLM skipped.
- **Step 5**: Add regression coverage
  - **Do**: test that aggression always results in flee packet under high confidence.
  - **Verify**: changes don’t silently disable bypass.

### 4) pgvector similarity search (concept matching)
- Add pgvector columns + indexes required for 384D (and 5D remains for MONOLITHIC).
- Implement `findNearestConcept({ villagerId, embedding })` with cosine distance and per-villager discovery enforcement.
- Enforce subjectivity: only concepts discovered by that villager can be used as labels.
- Add “unknown concept” flow that stores a discovery candidate without naming it (naming can remain LLM-assisted later).
- Expose a debug view of nearest matches + distances.

#### Implementation Spec
- **Files**:
  - `nodeDB/db/migrations/*` (dual vector columns + indexes)
  - `nodeDB/queries/concepts_queries.js` (nearest neighbor query)
- **Rules**:
  - all queries filtered by `villager_id`
  - enforce discovery gating (no label use without discovery record)
- **Verify**:
  - debug endpoint shows top-k matches + cosine distances

##### Step Guide
- **Step 1**: Add dual vector columns + indexes
  - **Do**: add vector(5) and vector(384) columns where required; create indexes.
  - **Verify**: migrations apply cleanly.
- **Step 2**: Implement nearest concept query (cosine)
  - **Do**: return top-k with distances.
  - **Verify**: query latency stays acceptable with indexes.
- **Step 3**: Enforce discovery gating
  - **Do**: filter by villager discoveries before labeling.
  - **Verify**: villagers don’t use undiscovered labels.
- **Step 4**: Unknown concept flow
  - **Do**: store candidate; defer naming.
  - **Verify**: system doesn’t spam LLM for naming.
- **Step 5**: Debug view
  - **Do**: expose nearest matches + distances (bounded).
  - **Verify**: inspector helps tune thresholds.

### 5) Layer 6 prompt shrink + responsibilities shift
- Update Layer 6 to consume summaries + intent classification output instead of raw vectors.
- Reduce prompt size (target 200–300 tokens equivalent content).
- Keep Layer 6 focused on dialogue + nuanced social reasoning + planning (as per Layer 6 doc).
- Preserve structured output + action dictionary restrictions.
- Add a regression test set for prompt → parse reliability.

#### Implementation Spec
- **Files**:
  - `nodeDB/brain/prompt_builder_microservices.js` (summary-based prompt)
  - `nodeDB/brain/narrative_parser.js` (unchanged, still strict)
- **Input rules**:
  - feed Layer 6: summaries + relationship + current WM focus (no raw vectors)
- **Verify**:
  - prompt length stays bounded; LLM calls/min drops vs MONOLITHIC
- **Failure handling**:
  - if microservices endpoints fail, degrade to MONOLITHIC behavior temporarily

##### Step Guide
- **Step 1**: Update Layer 6 inputs to summaries + intent output
  - **Do**: strip raw vectors/logs from prompt.
  - **Verify**: prompts shrink materially.
- **Step 2**: Enforce prompt budget
  - **Do**: cap history items; cap characters.
  - **Verify**: prompt size stable across long play sessions.
- **Step 3**: Preserve structured output + action dictionary
  - **Do**: parser remains strict.
  - **Verify**: invalid action keywords never execute.
- **Step 4**: Regression tests for prompt → parse
  - **Do**: snapshot tests for parser against expected formats.
  - **Verify**: prompt tweaks don’t break parsing.
- **Step 5**: Degrade when microservices are unavailable
  - **Do**: fallback path uses MONOLITHIC prompt/logic.
  - **Verify**: gameplay remains functional during partial outages.

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

