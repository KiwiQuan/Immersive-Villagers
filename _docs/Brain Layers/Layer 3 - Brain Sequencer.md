# Layer 3: Brain Sequencer (Temporal Learning)

## 1. Purpose

The Sequencer translates high-frequency math (vectors) from the Perception layer into a chronological "Story" of activities. It uses a two-tier buffer system to move from raw data to semantic labels (Sub-Concepts) and finally to complex patterns (Macro-Concepts).

## 2. Tier A: The Semantic Vectorizer (30s Window)

Tier A focuses on identifying a single, stable activity (a Sub-Concept).

- **Logic:** Calculates the moving average of incoming vectors.
- **Stability Check:** Monitors variance in **C (Constructiveness)** and **I (Intensity)**. When variance is low for >10 seconds, the "Episode" is considered stable.
- **Labeling Protocol:** 1. **Database Lookup:** Compare the stable Average Vector against the `concepts` table.

2. **LLM Intervention/Chat event:** If no match exists, send the vector + context to Layer 6 for a "Sub-Concept Labeling" (e.g., "The player is doing X, what is a 1-word name for this?") Or Ask the player what they are doing and use that to label the concept.

- **Output:** A semantic string (e.g., "Mining") pushed to Tier B.

## 3. Tier B: Macro-Episode Buffer (10m Window)

Tier B focuses on the "Story" by tracking the sequence of labels provided by Tier A.

- **Logic:** Stores a chronological list of Sub-Concept strings.
- **State Example:** `["Mining", "Falling", "Chatting", "Mining", "Falling", "Chatting"]`
- **Pattern Recognition:** \* Scans the list for repeating sequences (loops).
  - If a sequence like `[Mining + Falling]` repeats 3+ times, it flags a **Macro-Concept**.
  - **Social Identification:** If a Macro-Concept is new, it asks the player(s) or the LLM to help name the "Game" or "Ritual" (e.g., "Spleef").

## 4. Hierarchy of Data Flow

1. **Raw Vectors** (L2) -> **Tier A**
2. **Tier A** -> Check DB / LLM/Chat -> **Sub-Concept Label** (e.g., "Mining")
3. **Sub-Concept Label** -> **Tier B**
4. **Tier B Patterns** -> **Macro-Concept** (e.g., "Spleef")

## 5. Technical Rules for AI Agent

- **Vector Matching:** Use a "Nearest Neighbor" or simple Euclidean distance check to see if an Average Vector matches a known Concept in the DB.
- **Pattern Detection:** Use a basic string-matching algorithm to find repeating subarrays in Tier B.
- **Caching:** Once a Sub-Concept is labeled by the LLM, it MUST be cached in the database so Tier A doesn't ask the LLM for the same label twice.
