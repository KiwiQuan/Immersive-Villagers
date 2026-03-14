# Infrastructure: Central Brain Scheduler

## 1. Purpose

To prevent "LLM Gridlock," this system manages all "Intent to Think" requests from every villager. It ensures that the most critical situations (Danger/Social) get processed first, while low-priority curiosity is queued or batched.

## 2. The Request Queue & Scoring

When a villager's Sequencer (Layer 3) or Action Layer (Layer 7) needs a "Thought," it sends a request to the Scheduler with a **Priority Score**:

| Category     | Score | Trigger Example                      | Fallback Behavior                   |
| ------------ | ----- | ------------------------------------ | ----------------------------------- |
| **CRITICAL** | 100   | Being hit, fire, Creeper nearby.     | Immediate "FLEE" (Instinct).        |
| **SOCIAL**   | 70    | Player spoke to them, Trade started. | "IDLE" & LookAt (Active Listening). |
| **NOVELTY**  | 40    | New pattern detected (e.g., Spleef). | Continue observing (Curiosity).     |
| **ROUTINE**  | 10    | Farming, walking, idle chatter.      | Execute standard NPC behavior.      |

## 3. Batching & Collective Learning

If multiple villagers (e.g., 4 villagers) are within a **10-block radius** and observe the same high-complexity event:

1. **Deduplication:** The Scheduler collapses their 4 requests into 1 "Collective Perception" packet.
2. **LLM Execution:** The LLM processes the event once.
3. **Broadcast:** The result (e.g., "The player is playing a game called Spleef") is written to the **Area Memory** table, which all 4 villagers instantly reference.
4. **The Observer Batching Rule:** If multiple villagers witness the same event (same coordinates/time), the Scheduler must batch their "Perception" into a single LLM request. The resulting "Label" or "Insight" must then be written into each observer's **private** database independently.

## 4. Implementation for AI Agent

- **The Queue:** Use a First-In-First-Out (FIFO) queue that re-sorts itself every time a Score 100 request enters.
- **The One-by-One Rule:** Only X number of LLM calls (default 1) are allowed to be active at any given time to preserve CPU/API limits.
