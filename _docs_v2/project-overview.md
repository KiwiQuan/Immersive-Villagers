# 🧠 Minecraft Bedrock Immersive Villager AI — Project Overview

## 1. Vision

The goal is to create Villagers that can truly adapt, chat, and **build structures**. Each villager possesses subjective experiences and lives in their own reality, learning about the world through physical interactions (vectors) rather than hardcoded scripts. If a villager hasn't seen it or been told about it, they don't know it.

**Key Features:**

- **Adaptive AI:** Two runtime-switchable AI architectures (MONOLITHIC vs MICROSERVICES)
- **Structure Learning:** Villagers observe and learn building patterns from players
- **Autonomous Building:** Villagers can construct learned structures based on needs or commands
- **Subjective Memory:** Each villager has their own isolated PostgreSQL database filtered by villager_id

## 2. Core Concept: The 7-Layer Brain (Dual AI Architecture)

This project implements a modular cognitive architecture for Minecraft Bedrock Edition Villagers with **two runtime-switchable AI modes**:

### Layer Overview

1. **Sensory (Retina):** Filters game events based on proximity and Line of Sight (LOS).

2. **Perception (Vectorizer):** Converts events into semantic vectors:
   - **MONOLITHIC Mode:** Manual 5-axis **[C, V, I, S, X]** vectors (hardcoded rules)
     - **Constructiveness (C):** Building (+) vs. Destroying (-).
     - **Value (V):** Economic/Survival importance (e.g., Diamonds vs. Dirt).
     - **Intensity (I):** Energy/Arousal (Speed/Violence vs. Stillness).
     - **Sociality (S):** Intent (Friendly/Collaborative vs. Hostile/Selfish).
     - **Complexity (X):** Logic (Systemic/Redstone vs. Raw/Random).
   - **MICROSERVICES Mode:** 384D embeddings via **Xenova/all-MiniLM-L6-v2** (semantic understanding)

3. **Sequencer (Temporal):** Groups vectors into "Episodes" (e.g., Mining, Spleef, raids, building).
   - **MONOLITHIC Mode:** Basic episode grouping
   - **MICROSERVICES Mode:** Intent classification via **Xenova/distilbert-base-uncased-mnli** + "Fast Intent Routing" (bypasses LLM for high-confidence intents)

4. **Working Memory:** The "Conscious" state, tracking active focus, short-term shocks, and recent vector inputs using **in-memory cache (`trackedVillagers`)** for instant, proximity-independent access. DynamicProperties serve as backup persistence.

5. **Long-Term Memory:** A subjective **PostgreSQL** database with **dual vector columns** (`semantic_vector_manual` and `semantic_vector_minilm`) for both AI modes.
   - **MICROSERVICES Mode:** Episode summarization via **Xenova/t5-small** for compact storage

6. **Language Cortex (Executive):** The LLM (llama.cpp) that handles dialogue and complex reasoning.
   - **MONOLITHIC Mode:** Full planning, intent generation, dialogue
   - **MICROSERVICES Mode:** Dialogue only (intents handled by DistilBERT)
   - **(Infrastructure) Brain Scheduler:** Optimizes LLM calls via batching and prioritization

7. **Action Layer (The Body):** Translates intent into Bedrock Script API commands, using **in-memory cache metadata** to store current task states (e.g., `is_moving`, `target_block`, `is_building`). DynamicProperties serve as backup persistence.

### AI Mode Toggle

Players can switch between AI modes in-game:

- `/scriptevent ai:mode monolithic` - Predictable, low-latency, no external models
- `/scriptevent ai:mode microservices` - Semantic understanding, fast intent routing, reduced LLM load

**Trade-offs:** See `_docs/AI_Modes.md` for detailed comparison.

### Cache-First Pattern

**Actual Implementation** differs from theoretical design for performance and proximity-independence:

**Storage Hierarchy:**

1. **`trackedVillagers` Map** (PRIMARY) - In-memory cache, proximity-independent, O(1) access
2. **DynamicProperties** (BACKUP) - Persistence layer, local write-only storage for villager data
3. **PostgreSQL** (REMOTE BACKUP) - Authoritative source, syncs periodically

**Benefits:**

- ✅ Modify Working Memory from ANY distance (no entity required)
- ✅ Faster AI calculations (memory access vs entity API)
- ✅ No proximity constraints for decision-making
- ✅ DPs become "save file" not "runtime storage"

**Sync Flow:**

- Cache write → mark `needsDPSync` + `needsDBSync` → auto-sync when in range (DPs) + every 1s (DB)

See `_docs/Extra Info/Project_deviations.md` for detailed implementation.

---

## 3. Tech Stack (BDS Optimized)

- **Environment:** Minecraft Bedrock Dedicated Server (BDS).
- **Networking:** `@minecraft/server-net` for direct, silent HTTP/REST requests to the backend.
- **Outbound Data:** Script API sends JSON payloads directly to Node.js via `http.post()`.
- **Inbound Data:** Node.js responds to HTTP requests with data
- **Intelligence:**
  - **LLM:** Local `llama.cpp` for dialogue and complex reasoning
  - **Small Models (MICROSERVICES mode):** `@xenova/transformers` for:
    - Vectorization: `Xenova/all-MiniLM-L6-v2` (384D embeddings)
    - Intent Classification: `Xenova/distilbert-base-uncased-mnli` (fast routing)
    - Summarization: `Xenova/t5-small` (episode compression)
    - NER: `Xenova/bert-base-multilingual-cased-ner-slavic` (entity extraction)
- **Storage:** **PostgreSQL** with **pgvector** extension for long-term subjective memory, managed by Node.js.
- **State Management:** **In-memory cache (`trackedVillagers` Map)** for high-frequency data (Working Memory, task states, metadata). **`DynamicProperties`** serve as backup persistence layer for script reloads.
- **Structure Learning:** Dual-mode pattern recognition (spatial hashing vs semantic embeddings) with PostgreSQL storage.

---

## 4. Key Constraints

- **Performance:** The Minecraft tick cycle is **50ms**. Heavy logic (LLM/DB/Models) runs asynchronously via `@minecraft/server-net` in the "Slow Gear" (every 2-5 seconds).
  - **MONOLITHIC Mode:** <1ms vectorization, 2-4s LLM inference
  - **MICROSERVICES Mode:** 15-20ms vectorization, 50-150ms intent classification, 1-2s LLM inference (dialogue only)
- **Subjectivity:** Data queries are strictly filtered by **Villager ID**. No shared global knowledge unless passed via "Gossip" or "Teaching."
- **Reliability:** The AI must fall back to "Instinct" (Hardcoded fallback logic) if the network or LLM is unresponsive.
- **Persistence:** Persistent world state stored in **PostgreSQL** (source of truth). **In-memory cache** for runtime performance. **`DynamicProperties`** for backup persistence (write-only storage of data ).
- **Modularity:** AI architecture can be toggled in-game without server restart via `/scriptevent ai:mode <monolithic|microservices>`
