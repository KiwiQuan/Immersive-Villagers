# Layer 5: Long-Term Memory (The Personal Archive)

## 1. Purpose

This layer manages the PostgreSQL database with pgvector extension to ensure subjective persistence. Every villager possesses their own unique history, relationships, learned structures, and discovered concepts. If a player interacts with Villager A, Villager B remains unaware unless the information is shared through a "Gossip" event later.

## 2. Database Schema (The Complete Memory Architecture)

The system implements **11 interconnected tables** supporting both MONOLITHIC (5D vectors) and MICROSERVICES (384D embeddings) AI modes:

### Core Identity & Knowledge

| Table Name               | Primary Keys                | Key Features                                               |
| ------------------------ | --------------------------- | ---------------------------------------------------------- |
| **villagers**            | `villager_id`               | Name, Home Position (x,y,z), Profession, Activity Status   |
| **concepts**             | `concept_id`                | Dual vectors (manual 5D + miniLM 384D), Discovery Count    |
| **villager_discoveries** | `villager_id`, `concept_id` | Subjective knowledge tracking, Discovery Method, Timestamp |

### Memory & Relationships

| Table Name         | Primary Keys       | Key Features                                                       |
| ------------------ | ------------------ | ------------------------------------------------------------------ |
| **episodes**       | `id`               | Dual vectors, Summary Text (T5), Duration, Event Count             |
| **relationships**  | `id` (unique pair) | Trust Score, Interaction Count, Last Interaction Timestamp         |
| **working_memory** | `villager_id`      | Current Mood (dual vectors), Focus, Shock State, Synced from Cache |

### Structure Learning System

| Table Name               | Primary Keys  | Key Features                                                     |
| ------------------------ | ------------- | ---------------------------------------------------------------- |
| **structure_templates**  | `id`          | Pattern Hash, Embedding (384D), Build Instructions (JSONB)       |
| **structure_blueprints** | `id`          | Composition (JSONB), Tags, Functional Zones, Build Count         |
| **villager_world_map**   | `id` (unique) | Subjective spatial memory, Structure ID, Confidence Score        |
| **build_tasks**          | `id`          | Task Queue, Blueprint/Template refs, Status, Progress Tracking   |
| **pattern_observations** | `id`          | Real-time learning buffer, Block Sequence (JSONB), Consolidation |

## 3. Dual Vector Storage Architecture

All semantic data uses **dual vector columns** to support runtime-switchable AI modes:

- **`semantic_vector_manual`:** VECTOR(5) storing [C, V, I, S, X] for MONOLITHIC mode
- **`semantic_vector_minilm`:** VECTOR(384) storing embeddings for MICROSERVICES mode

**Tables with Dual Vectors:**

- `concepts` - Concept definitions
- `episodes` - Recorded memories
- `working_memory` - Current mood state

**Single Vector (384D only):**

- `structure_templates` - Building pattern embeddings
- `structure_blueprints` - Blueprint embeddings

## 4. The Memory Pipeline (Processing)

Data flows through multiple stages depending on AI mode:

### Episode Storage Flow

1. **Saliency Check** (Layer 4): Only episodes with high Intensity, Value, or Social impact are written
2. **Vector Generation:**
   - **MONOLITHIC:** Average [C, V, I, S, X] from episode events
   - **MICROSERVICES:** Generate 384D embedding + T5-small summary text
3. **Database Write:** Store in `episodes` table with both vector formats
4. **Relationship Update:** Adjust trust score in `relationships` table

### Structure Learning Flow

1. **Pattern Observation:** Block sequences captured in `pattern_observations`
2. **Hash Generation:** Spatial pattern → unique hash
3. **Consolidation:** Multiple observations → `structure_templates` with embedding
4. **Blueprint Assembly:** Templates → `structure_blueprints` with composition rules
5. **World Mapping:** Recognized structures → `villager_world_map` for spatial memory

### Concept Discovery Flow

1. **Unknown Vector:** New event doesn't match any known concept
2. **Cosine Similarity:** Compare against `concepts` table (uses appropriate vector column)
3. **Discovery Record:** Create entry in `villager_discoveries` for this villager
4. **Knowledge Isolation:** Other villagers cannot access until they discover it independently

## 5. Context Retrieval (The Recall Trigger)

### Cache-First Pattern (Actual Implementation)

The system uses a **3-tier storage hierarchy:**

1. **`trackedVillagers` Map** (PRIMARY) - In-memory cache, O(1) access
2. **DynamicProperties** (BACKUP) - Local persistence for script reloads
3. **PostgreSQL** (AUTHORITATIVE) - Remote long-term memory

**Benefits:**

- ✅ Modify Working Memory from ANY distance (no entity required)
- ✅ Faster queries (memory vs database)
- ✅ Auto-sync: Cache → DPs (when in range) + PostgreSQL (every 1s)

### Memory Sweep Query Pattern

When a player enters the Sensory Radius (Layer 1):

**Step 1:** Check `working_memory` cache for current mood/focus

**Step 2:** Query `relationships` table:

```sql
SELECT trust_score, interaction_count, last_interaction
FROM relationships
WHERE villager_id = ? AND actor_id = ?
```

**Step 3:** Query recent `episodes` (last 3 interactions):

```sql
SELECT semantic_vector_manual, semantic_vector_minilm, summary_text, timestamp
FROM episodes
WHERE villager_id = ? AND actor_id = ?
ORDER BY timestamp DESC
LIMIT 3
```

**Step 4:** Query `villager_discoveries` to check known concepts:

```sql
SELECT concept_id, discovered_at
FROM villager_discoveries
WHERE villager_id = ?
```

**Step 5:** Query `villager_world_map` for nearby structures:

```sql
SELECT structure_id, confidence
FROM villager_world_map
WHERE villager_id = ?
AND anchor_x BETWEEN ? AND ?
AND anchor_y BETWEEN ? AND ?
AND anchor_z BETWEEN ? AND ?
```

**Step 6:** Package into "Context Packet" for Layer 6 (Language Cortex)

## 6. Implementation Rules

### Subjectivity & Knowledge Isolation

- **Strict Filtering:** All queries MUST filter by `villager_id` - villagers cannot access other villagers' data
- **Discovery Enforcement:** Before using a concept label, check `villager_discoveries` table
- **Unknown Concepts:** If no discovery record exists, villager must describe as "Strange Activity" or similar
- **Gossip System:** Cross-villager knowledge transfer requires explicit "Gossip" event creating new discovery records

### Async Operations & Performance

- **Non-blocking I/O:** All database operations via Node.js backend using async/await
- **Batch Writes:** Episode storage and relationship updates batched every 1-2 seconds
- **Cache Priority:** Read from `trackedVillagers` cache first, fallback to database
- **Sync Strategy:** Cache dirty flags (`needsDPSync`, `needsDBSync`) trigger periodic syncs

### Vector Operations (Dual Mode Support)

**MONOLITHIC Mode:**

```sql
-- Query using 5D manual vectors
SELECT * FROM concepts
WHERE villager_id IN (SELECT villager_id FROM villager_discoveries WHERE concept_id = concepts.concept_id)
ORDER BY semantic_vector_manual <=> ?::vector(5)
LIMIT 5
```

**MICROSERVICES Mode:**

```sql
-- Query using 384D embeddings
SELECT * FROM concepts
ORDER BY semantic_vector_minilm <=> ?::vector(384)
LIMIT 5
```

**Cosine Similarity (`<=>` operator):**

- Measures directional alignment (intent) over magnitude (intensity)
- Example: "1 flower" and "64 diamonds" both match "gift-giving" concept
- Uses pgvector IVFFLAT indexes for fast approximate nearest neighbor search

### Structure Learning System

**Pattern Recognition Flow:**

1. Observe block placement → `pattern_observations` table
2. Generate spatial hash from 3D block sequence
3. After N observations, consolidate → `structure_templates`
4. Generate 384D embedding for semantic similarity
5. Assemble templates → `structure_blueprints` with composition rules

**Building Execution:**

1. Create `build_tasks` entry with blueprint/template reference
2. Query blueprint → get template list
3. Query templates → get block-by-block instructions (JSONB)
4. Execute via Layer 7 (Action Layer) tick-by-tick
5. Update `villager_world_map` when complete

### Working Memory Sync Pattern

**Write Flow:**

```
Cache Update → Mark needsDPSync + needsDBSync → Auto-sync:
  - DynamicProperties: When entity in range (proximity-based)
  - PostgreSQL: Every 1s via HTTP (proximity-independent)
```

**Read Flow:**

```
Check trackedVillagers cache → If missing, query PostgreSQL → Populate cache
```

### Index Strategy

The schema includes 19+ indexes optimized for:

- Villager-filtered queries (most common)
- Vector similarity searches (IVFFLAT)
- Timestamp-based episode retrieval
- Spatial queries for world map
- Pattern hash lookups
- Task status filtering
