# 🧠 Minecraft Bedrock Immersive Villager AI — Project Overview

## 1. Vision

The goal is to create Villagers that can truly adapt, chat and build. Each villager has their own subjective experiences. Every villager lives in their own reality, learning about the world through physical interactions (vectors) rather than hardcoded scripts. If a villager hasn't seen it or been told about it, they don't know it.

## 2. Core Concept: The 8-Layer Brain

This project implements a modular cognitive architecture for Minecraft Bedrock Edition Villagers:

1. **Sensory (Retina):** Filters game events based on proximity/ (Line Of Sight)
2. **Perception (Vectorizer):** Converts events into a 5-axis Semantic Vector [C, V, I, S, X]:
   - **Constructiveness (C):** Building (+) vs. Destroying (-).
   - **Value (V):** Economic/Survival importance. Diamonds (+) vs. Dirt (-).
   - **Intensity (I):** Energy/Arousal. Speed and violence (+) vs. Stillness (0).
   - **Sociality (S):** Intent. Friendly/Collaborative (+) vs. Hostile/Selfish (-).
   - **Complexity (X):** Logic. Systemic/Redstone (+) vs. Raw/Random (-).
3. **Sequencer (Temporal):** Groups vectors into "Episodes" (e.g., Mining, Spleef).
4. **Working Memory:** The "Conscious" state, tracking active focus and short-term shocks.
5. **Long-Term Memory:** A subjective PostgreSQL database of relationships and learned concepts.
6. **Language Cortex (Executive):** The LLM that handles "Internal Monologue" and decision-making.
7. **Brain Scheduler (Infrastructure):** Optimizes LLM calls via batching and prioritization.
8. **Action Layer (The Body):** Translates intent into Bedrock Script API commands.

## 3. Tech Stack

- **Environment:** Minecraft Bedrock Script API (JavaScript).
- **Intelligence: Local** LLM (llama.cpp ).
- **Storage:** PostgreSQL for long-term subjective memory.
- **Architecture:** Event-driven, non-blocking asynchronous loops.

## 4. Key Constraints

- **Performance:** The Minecraft tick cycle is 50ms. Heavy logic (LLM) must run in the "Slow Gear" (every 2-5 seconds), while movement runs in the "Fast Gear" (every tick).
- **Subjectivity:** Data queries must always be filtered by Villager ID. No shared global knowledge unless passed via "Gossip" or "Teaching."
- **Reliability:** The AI must fall back to "Instinct" (Layer 8) if the LLM is busy.
