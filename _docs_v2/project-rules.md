# Immersive Villagers — Project Rules (AI‑First)
> **What this file is:** The single source of truth for **directory structure**, **naming conventions**, **documentation standards**, and **cross-cutting engineering constraints** for the Immersive Villagers Behavior Pack + Node.js backend.
>
> **Design goal:** Keep the codebase **modular, scalable, and AI-navigable**. Prefer small, focused modules with explicit contracts over “clever” abstractions.
>
> **Hard constraint:** **No file should exceed 500 lines.** Split by feature/layer when approaching 350–450 lines.
>
> **Docs freshness:** When documenting external APIs/libs (Script API, server-net, pgvector, etc.), validate details using **context7** (per `.cursor/rules/document_rules.mdc`).

---

## Core engineering principles
- **AI-first navigability**
  - Each file has a **clear, descriptive name** and a **short header** explaining:
    - what it owns (scope)
    - what it depends on (key imports)
    - what it exports (public surface)
- **Separation of concerns**
  - Keep Bedrock Script (Fast Gear) and Backend (Slow Gear) responsibilities distinct.
  - Prefer “thin orchestrators” and “pure helpers.”
- **DRY + KISS**
  - If logic repeats in 2+ places, extract a shared helper.
  - Avoid unnecessary layers of indirection.
- **Functional style**
  - Prefer pure functions and data transforms.
  - Avoid classes unless there’s a strong reason (rare in this codebase).
- **Errors**
  - Throw meaningful `Error` objects for critical failures.
  - Network/IO must be resilient: handle timeouts and failures explicitly.

---

## Architecture rules (7-layer brain + gears)
### Fast Gear vs Slow Gear
- **Fast Gear (Layers 1–4)**: runs in `scripts/` (Bedrock Script API). Must be **tick-efficient** and avoid heavy IO.
- **Slow Gear (Layers 5–7)**: runs in `nodeDB/` (Node.js). Owns **PostgreSQL**, **pgvector**, **LLM/scheduler**, and heavier processing.

### Layer isolation (non-negotiable)
- Code for one layer **must not directly mutate** another layer’s state.
- Cross-layer communication happens via **explicit JSON packets** (contracts), following `_docs_v2/interaction-flow.md` and `_docs_v2/Brain Layers/Layer Inputs and Outputs.md`.

### Canonical layer I/O contracts
- **L1 → L2**: `FilteredEventContext` (Retina Packet)
- **L2 → L3**: `SemanticVector` (MONOLITHIC 5D) or `embedding + description` (MICROSERVICES)
- **L3 → L4**: `EpisodeSummary`
- **L4 → L5**: `MemoryRecord` (when promoted by saliency)
- **L5 → L6**: `IdentityContext`
- **L6 → L7**: `NarrativePacket`

---

## Memory safety & tick safety (Bedrock Script API)
### Entity reference rule (non-negotiable)
- **Never store persistent references to `Entity` objects across ticks.**
  - Store `entity.id` and re-fetch via `world.getEntity(id)` when needed.
  - This prevents “Invalid Object” errors and memory leaks.

### Tick efficiency rule
- Heavy work (LLM inference, DB queries, embeddings, large JSON transforms) must be **offloaded** to the backend.
- Use `system.run()`, `system.runTimeout()`, and `system.runInterval()` to avoid blocking.

---

## Storage hierarchy (cache-first)
### Required hierarchy
1. **`trackedVillagers` Map** (primary runtime storage; proximity-independent; O(1))
2. **DynamicProperties** (backup persistence for script reloads; “save file,” not runtime truth)
3. **PostgreSQL** (authoritative long-term store; periodic sync)

### Dirty-flag sync pattern
- All state that must persist uses dirty flags (e.g., `needsDPSync`, `needsDBSync`).
- Sync cadence (from docs):
  - Cache → PostgreSQL: typically **every ~1s** (async)
  - Cache → DynamicProperties: **when entity in range** (proximity-based)

---

## Networking rules (Bedrock ↔ Backend)
### Transport selection (hybrid)
- **HTTP** (`@minecraft/server-net.http`) is the reliable default for:
  - database reads/writes (Layer 5)
  - large payloads
  - idempotent request/response flows
- **WebSocket** (`@minecraft/server-net.websocket`) is **EXPERIMENTAL (2026)** and should be used for:
  - streaming LLM tokens (Layer 6)
  - backend push notifications (e.g., working memory updates)

### Safety requirements for all external IO
- All network calls must be wrapped in **try/catch** to prevent server hangs.
- When using WebSockets:
  - implement **exponential backoff** reconnection
  - buffer failed sends (manual queueing)
  - always gate sends on `ws.isOpen`

---

## Brain scheduler rules (prevent LLM gridlock)
### Priority categories (score)
- **CRITICAL (100)**: damage, fire, imminent threat → fallback: **FLEE instinct**
- **SOCIAL (70)**: chat/trade → fallback: **IDLE + LookAt**
- **NOVELTY (40)**: new patterns → fallback: continue observing
- **ROUTINE (10)**: everyday behavior → fallback: standard NPC behavior

### Execution constraints
- FIFO queue with **re-sort** when CRITICAL arrives.
- **Concurrency cap** for LLM calls (default 1) to protect CPU.
- **Observer batching rule**:
  - If multiple villagers witness the same event (same time/coords), batch to **one** LLM request.
  - Broadcast insight to observers, but write results into each villager’s **private** memory independently (subjectivity preserved).

---

## Action layer rules (stability via restricted commands)
### Action dictionary (LLM is restricted)
Layer 6 output must translate into Layer 7 using a restricted action set (see `_docs_v2/Brain Layers/Layer 7 - Action Layer.md`):
- `TALK("msg")`
- `APPROACH(target)`
- `ANIMATE(id)`
- `STARE(target)`
- `FLEE()`
- `IDLE()`

### Non-blocking & safety gate
- Movement/actions are **non-blocking**; villager can “walk and talk.”
- Any P0 event (damage/threat) can **override** current action with immediate `FLEE()` until a higher-level decision arrives.
- Action execution reports **success/failure** back to Working Memory (Layer 4) for feedback/rethink triggers.

---

## UI/UX rules (debug tools via `@minecraft/server-ui` + chat)
### UI constraints (server-ui)
- Forms are modal snapshots; no real-time dashboards, charts, tabs, or HTML/CSS.
- Use forms for **exploration**, and chat commands/watch mode for **monitoring**.

### UX patterns
- **Hub-and-spoke navigation**: Main Menu → Category → Detail (max depth 3).
- Always handle `response.canceled` (ESC) gracefully.
- Watch mode:
  - max **1 update / 2s** per player (avoid chat spam)
  - clear start/stop messaging
  - auto-stop on disconnect (avoid leaks)

---

## Directory structure (authoritative)
### Behavior Pack root
```
Immersive_Villagers BP/
  scripts/                # Bedrock Script API (Fast Gear)
  nodeDB/                 # Node.js backend (Slow Gear)
  entities/               # BP entity definitions
  functions/              # BP functions (.mcfunction, etc.)
  loot_tables/            # BP loot tables
  builds/                 # Build outputs / artifacts (if applicable)
  _docs_v2/               # Architecture + rules documentation
  manifest.json           # BP manifest
  config.json             # Project config
```

### `scripts/` (Fast Gear)
```
scripts/
  main.js                 # BP script entrypoint
  layers/                 # L1–L4 implementations (Fast Gear)
  systems/                # Cross-cutting systems (debug, lifecycle, etc.)
  utils/                  # Pure helpers (network, geometry, batching, etc.)
  sandbox/                # Experiments/prototypes (must be isolated)
```

### `nodeDB/` (Slow Gear)
```
nodeDB/
  server.js               # Backend entrypoint
  app.js                  # Express app wiring
  routes/                 # Route definitions (thin)
  api/                    # API handlers/adapters (if separated from routes)
  brain/                  # Scheduler + LLM client + cognition services
  db/                     # Pool + schema + migrations
  queries/                # SQL query modules (parameterized)
  utils/                  # Logging, validation, shared helpers
```

### Placement rules
- **Bedrock-side layer logic** goes under `scripts/layers/`.
- **Networking helpers** go in `scripts/utils/` (no layer should “own” HTTP/WebSocket primitives).
- **DB access** belongs in `nodeDB/queries/` + `nodeDB/db/` only.
- **LLM + scheduling** belongs in `nodeDB/brain/` only.

---

## Naming conventions
### Files & folders
- **Directories**: `lower_snake_case/` (e.g., `villager_lifecycle/`, `layer4_working_memory/`)
- **JavaScript files**: `lower_snake_case.js` (e.g., `network_helpers.js`)
- **Markdown docs**: `kebab-case.md` for new docs. (Legacy docs may use Title Case and spaces, e.g. `_docs_v2/Brain Layers/`.)

### Code symbols
- **Functions/variables**: `camelCase`
- **Booleans**: auxiliary verbs (`isOpen`, `hasTarget`, `needsDBSync`)
- **Exported modules / grouped APIs**: `PascalCase` (e.g., `NetworkHelpers`)
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants; prefer config objects otherwise

---

## Documentation & JSDoc requirements
### File header requirement
Every non-trivial file should begin with a short comment block describing:
- ownership (what this file is responsible for)
- invariants/constraints (timeouts, tick budget, etc.)
- exports (what other modules should import)

### JSDoc requirement (all functions)
Every function must have a JSDoc block that includes:
- `@param` for every param (with types)
- `@returns` with type and meaning
- callouts for thrown errors (when relevant)

### Example JSDoc style
```js
/**
 * Convert a Layer 1 retina packet into the Layer 2 semantic frame (MONOLITHIC mode).
 * @param {{ header: { v_id: string, timestamp: number }, body: object }} retinaPacket - Filtered sensory input.
 * @returns {{ v_id: string, vector: { C: number, V: number, I: number, S: number, X: number }, timestamp: number }} Semantic frame for Layer 3.
 * @throws {Error} If the input packet is missing required fields.
 */
function buildSemanticFrameMonolithic(retinaPacket) {
  // implementation...
}
```

---

## Contribution checklist (for any new change)
- Keep modules small and single-purpose; split before 500 lines.
- Maintain layer boundaries; communicate via packets, not shared mutable state.
- No persistent `Entity` references across ticks; store IDs only.
- Cache-first reads, dirty-flag writes, periodic async persistence.
- Wrap all external IO in try/catch; prefer HTTP for DB; WebSocket only where it’s worth the complexity.
- Add/update docs when you add a new public packet shape, route, or persistent schema.

