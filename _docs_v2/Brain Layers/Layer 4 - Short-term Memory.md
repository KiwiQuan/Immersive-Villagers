# Layer 4: Working Memory & Saliency Filter

> **Implementation Status:** 🟢 PARTIALLY IMPLEMENTED - Working Memory fully implemented (Cache-First pattern). Saliency Filter planned for future.

## 1. Purpose

Working Memory is the villager's "Short-Term Notepad." It tracks active context in real-time. The Saliency Filter acts as the "Gatekeeper," deciding which parts of Working Memory are important enough to be saved to the Long-Term Database (Layer 5).

## 2. Working Memory Components (The Active State)

This object lives in the **in-memory cache (`trackedVillagers` Map)** and is backed up to **DynamicProperties** for persistence. Updates are proximity-independent and synced to the database periodically. It tracks:

- **Current Episode Label:** (e.g., "Playing Spleef with Steve")
- **Active Focus:** The specific entity or block the villager is currently interacting with.
- **Flashbulb Events:** High-intensity "shocks" (like being hit) that remain "fresh" even if they aren't part of a pattern.
- **Current Mood Vector:** 5-axis [C, V, I, S, X] emotional state

**Storage Hierarchy:**
1. **`trackedVillagers` Map** (PRIMARY) - In-memory, O(1) access, no proximity constraints
2. **DynamicProperties** (BACKUP) - Persists across script reloads
3. **PostgreSQL** (REMOTE BACKUP) - Authoritative source, syncs every 1s

## 3. The Decay System (Volatility)

Working Memory is temporary. Data decays based on its "vibe":

- **Neutral/Positive Contexts:** Decay after 2–3 minutes of inactivity.
- **High-Intensity/Negative Contexts:** Decay after 10+ minutes (e.g., staying "scared" after being hit).

## 4. The Saliency Filter (The "Save" Button)

When an activity ends, the villager calculates a **Memorability Score (M)** to decide if it should be sent to Layer 5 (PostgreSQL).

### The 4 Rules for Promotion:

1. **Impact Rule:** If **Intensity (I)** or **Value (V)** is > 0.8 or < -0.8 (e.g., finding diamonds or taking damage).
2. **Relationship Rule:** If the **Sociality (S)** axis shifts significantly (e.g., a stranger becomes a friend).
3. **Learning Rule:** If the Sequencer identifies a brand-new **Macro-Pattern** that was just named.
4. **Habit Rule:** If a low-impact activity (like farming) lasts a long time, save a single "Summary" instead of individual events.

## 5. The Memorability Formula

**M = (w1 _ |I|) + (w2 _ |V|) + (w3 _ |S|) + (w4 _ X)\***(Where 'w' represents weights. Default Recommendation: Give Sociality (w3) the highest weight for better NPC personality.)\*

- **If M > Threshold:** Save to Layer 5 (PostgreSQL).
- **If M < Threshold:** Discard the data to save space.

## 6. Output Specification (Memory Record)

Sent to Layer 5 if the Saliency Filter passes:
`{
"v_id": "string",
"summary": "Steve and I played Spleef for 5 minutes. I won.",
"final_vibe": [C, V, I, S, X],
"timestamp": "number",
"importance": "M_score"
}`
