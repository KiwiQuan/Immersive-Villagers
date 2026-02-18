# 📡 Layer 1: Sensory Input (The Retina)

**Purpose:** This layer acts as the interface between the Minecraft Script API and the AI Brain. It filters the massive stream of game events into a curated, prioritized "Retina Packet" that only contains what a specific villager could reasonably perceive.

---

### **1. Input Specifications**

The layer listens to two distinct data streams:

- **Passive Stream (Events):** Triggered by `world.afterEvents`.
  - _Examples:_ `playerBreakBlock`, `entityHurt`, `itemUsedOn`.
- **Active Stream (Polling):** Triggered by `system.runInterval`.
  - _Visual Scan:_ Raycasting to check what the villager is looking at.
  - _Proprioception:_ Checking internal stats (Health, Hunger, Burning, Location).

---

### **2. Processing Logic (The "Filters")**

Before data is sent to Layer 2, it must pass three gates:

1. **Proximity Gate:** The event must occur within a **32-block radius** of an AI-tagged villager.
2. **Transmission Check:**
   - **Audio (Omnidirectional):** Requires no Line-of-Sight (LOS). Includes sounds like explosions or block breaking.
   - **Visual (Directional):** Requires a clear LOS check (`entity.getBlockFromViewDirection`) and an angle check to ensure it's in the villager's field of view.
3. **Sensory Gating (Priority Filter):**
   - **P0 (Critical):** Damage, fire, nearby explosions. _Never throttled._
   - **P1 (High):** Player movement nearby, block changes. _Throttled if in "Panic" state._
   - **P2 (Low):** Ambient animals, weather changes. _Dropped if villager is "Busy" or "Stressed."_

---

### **3. Output Specification (The Retina Packet)**

All filtered sensations must be formatted into this standard JSON object to be sent to the **Perception Layer (L2)**:

JSON

```jsx
{
  "header": {
    "v_id": "villager_uuid_001",
    "timestamp": 16400,
    "channel": "visual" | "audio" | "internal",
    "priority": 0 | 1 | 2
  },
  "body": {
    "type": "block_break",
    "actor": "player_uuid",
    "subject": "minecraft:diamond_ore",
    "location": [102, 64, -205],
    "metadata": {
      "is_critical": false,
      "tool_used": "minecraft:iron_pickaxe"
    }
  }
}
```

---

### **4. Execution Frequency (The Heartbeat)**

- **Event Handling:** Immediate (Reactive).
- **Visual/Internal Polling:** Every 10 ticks (0.5 seconds).
- **Throttle Update:** Every 20 ticks (1.0 seconds) to recalculate "Stress/Focus" levels for filtering.

---

### **5. AI Agent Implementation Instructions**

- **Tagging:** Use the Dynamic Properties or Tags to identify `ai_villager` entities.
- **Efficiency:** Use `dimension.getEntities` with `maxDistance` to avoid looping through every entity in the world.
- **LOS Check:** Use the `Exapi` or `BlockRaycastOptions` to determine if a "Visual" event is occluded by walls.

---

### **Next Step**

**Layer 2 (Perception)** defines how these "Retina Packets" are converted into 5-axis vectors!
