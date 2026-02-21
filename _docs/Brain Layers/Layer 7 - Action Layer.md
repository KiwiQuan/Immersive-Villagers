# Layer 7: The Action Layer (The Body)

## 1. Purpose

The Action Layer is the bridge between the high-level reasoning of Layer 6 (Language Cortex) and the low-level Minecraft Bedrock Script API. It acts as a **Command Buffer**, translating keywords into physical movement, speech, and animation.

## 2. The Action Dictionary (Muscle Memory)

The AI Brain is restricted to the following keyword dictionary to ensure stability:

| Action Keyword       | Bedrock API Equivalent     | Result in Game                             |
| -------------------- | -------------------------- | ------------------------------------------ |
| **TALK("msg")**      | `world.sendMessage()`      | Sends text to the chat.                    |
| **APPROACH(target)** | `pathfinding.moveTo()`     | Paths toward a player or entity.           |
| **ANIMATE(id)**      | `entity.playAnimation()`   | Plays emotes (e.g., 'celebrate', 'shrug'). |
| **STARE(target)**    | `entity.lookAt()`          | Locks head rotation to a target.           |
| **FLEE()**           | `pathfinding.moveTo(safe)` | Paths away from the nearest threat.        |
| **IDLE()**           | `entity.stopMoving()`      | Stops all active pathfinding.              |

## 3. The Feedback Loop

The "Body" must report the status of its actions back to **Layer 4 (Working Memory)** so the brain can adjust its thoughts:

- **Success:** "Goal Reached" (e.g., The villager finished walking to the player).
- **Failure:** "Path Blocked" or "Target Lost" (e.g., The player teleported away or a wall was placed).
- **Brain Trigger:** If a failure occurs, it immediately triggers a new **Layer 6 Thought** to decide a workaround.

## 4. Micro-Expressions & Idle Behavior

To ensure the "Personality Tags" feel active, Layer 8 runs a background "Idle Controller":

- **The Grumpy Tag:** Occasionally triggers `look_away` or `cross_arms` when no player is nearby.
- **The Friendly Tag:** Maintains a 3-block proximity to the player and uses frequent `look_at` head tracking.

## 5. Timing & Performance (The Tick Cycle)

- **The Fast Gear (Action):** Executes at 20Hz (every tick). Handles pathfinding and head rotation.
- **The Slow Gear (Thinking):** Requests from Layer 6 return every 2–5 seconds.
- **The Buffer:** The villager will continue its current **APPROACH** or **STARE** command until the Slow Gear returns a new instruction.

## 6. Implementation Rules for AI Agent

- **Command Parsing:** Use a regex or string parser to extract `ACTION: KEYWORD(params)` from the LLM's output.
- **Non-Blocking:** Movement must be non-blocking. The villager should be able to walk and talk simultaneously.
- **Safety Gate:** If a villager takes damage (P0 event from Layer 1), Layer 7 should automatically override any current command with an immediate **FLEE()** until the brain decides otherwise.
