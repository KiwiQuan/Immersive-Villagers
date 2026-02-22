**Overview:** A 7-layer modular pipeline designed for MVP.

| **Layer** | **Name**                    | **Primary Function**                                                                                                                     |
| --------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **1**     | **Sensory (Retina)**        | Spatial filtering. Uses Line of Sight (LOS) and distance to ignore irrelevant world noise.                                               |
| **2**     | **Perception (Vectorizer)** | Mathematical translation. Converts game events into the 5-axis [C, V, I, S, X] vector.                                                   |
| **3**     | **Sequencer (Temporal)**    | Pattern grouping. Batches vectors into "Episodes" (e.g., a "Building Session, Raid").                                                    |
| **4**     | **Working Memory**          | Active state. Tracks immediate focus and "shocks" (e.g., taking damage) via `DynamicProperties`.                                         |
| **5**     | **Long-Term Memory (LTM)**  | The Database. Stores historical Episodes, player relationship scores, and "Villager Identity" tags (e.g., `is_brave`, `loves_diamonds`). |
| **6**     | **Language Cortex**         | The Executive. The llama.cpp LLM that reads LTM context to generate monologue and speech.                                                |
| **7**     | **Action Layer (Body)**     | The Actuator. Translates AI "Intents" into physical Script API movements and tasks.                                                      |
