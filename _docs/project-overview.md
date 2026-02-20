# 🧠 Minecraft Bedrock Immersive Villager AI — Project Overview

## 1. Vision

The goal is to create Villagers that can truly adapt, chat, and build. Each villager possesses subjective experiences and lives in their own reality, learning about the world through physical interactions (vectors) rather than hardcoded scripts. If a villager hasn't seen it or been told about it, they don't know it.

## 2. Core Concept: The 8-Layer Brain

This project implements a modular cognitive architecture for Minecraft Bedrock Edition Villagers:

1. **Sensory (Retina):** Filters game events based on proximity and Line of Sight (LOS).
2. **Perception (Vectorizer):** Converts events into a 5-axis Semantic Vector **[C, V, I, S, X]**:
   - **Constructiveness (C):** Building (+) vs. Destroying (-).
   - **Value (V):** Economic/Survival importance (e.g., Diamonds vs. Dirt).
   - **Intensity (I):** Energy/Arousal (Speed/Violence vs. Stillness).
   - **Sociality (S):** Intent (Friendly/Collaborative vs. Hostile/Selfish).
   - **Complexity (X):** Logic (Systemic/Redstone vs. Raw/Random).
3. **Sequencer (Temporal):** Groups vectors into "Episodes" (e.g., Mining, Spleef, raids, building).
4. **Working Memory:** The "Conscious" state, tracking active focus, short-term shocks, and recent vector inputs using **DynamicProperties** for instant access.
5. **Long-Term Memory:** A subjective **PostgreSQL** database of relationships and learned concepts.
6. **Language Cortex (Executive):** The LLM (llama.cpp) that handles "Internal Monologue" and decision-making.
7. **Brain Scheduler (Infrastructure):** Optimizes LLM calls via batching and prioritization to prevent server lag.
8. **Action Layer (The Body):** Translates intent into Bedrock Script API commands, using **DynamicProperties** to store current task states (e.g., `is_moving`, `target_block`).

---

## 3. Tech Stack (BDS Optimized)

- **Environment:** Minecraft Bedrock Dedicated Server (BDS).
- **Networking:** `@minecraft/server-net` for direct, silent HTTP/REST requests to the backend.
- **Outbound Data:** Script API sends JSON payloads directly to Node.js via `http.post()`.
- **Inbound Data:** Node.js responds to HTTP requests with data, or uses `/scriptevent` for server-initiated triggers.
- **Intelligence:** Local LLM (llama.cpp) accessed via the Node.js bridge.
- **Storage:** **PostgreSQL** for long-term subjective memory, managed by Node.js.
- **State Management:** **`DynamicProperties**` for high-frequency data (health tracking, emotional volatility, connection status).

---

## 4. Key Constraints

- **Performance:** The Minecraft tick cycle is **50ms**. Heavy logic (LLM/DB) runs asynchronously via `@minecraft/server-net` in the "Slow Gear" (every 2-5 seconds).
- **Subjectivity:** Data queries are strictly filtered by **Villager ID**. No shared global knowledge unless passed via "Gossip" or "Teaching."
- **Reliability:** The AI must fall back to "Instinct" (Hardcoded Layer 8 logic) if the network or LLM is unresponsive.
- **Persistence:** Persistent world state and "connection status" are stored in **`DynamicProperties**` to survive server reboots.
