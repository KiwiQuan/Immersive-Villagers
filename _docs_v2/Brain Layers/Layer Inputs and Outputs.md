### Layer 1: Sensory

- **Input:** `world.afterEvents` (e.g., `playerPlaceBlock`, `entityHurt`).
- **Output:** `FilteredEventContext` (Type, ActorID, Coordinates, Proximity).

### Layer 2: Perception

- **Input:** `FilteredEventContext`.
- **Output:** `SemanticVector` (e.g., `{ C: 0.8, V: 0.5, I: 0.2, S: 0.9, X: 0.1 }`).

### Layer 3: Sequencer

- **Input:** `SemanticVector` stream.
- **Output:** `EpisodeSummary` (Calculated averages of vectors over a specific timeframe).

### Layer 4: Working Memory

- **Input:** `EpisodeObject`.
- **Output:** `ActiveAttentionState` (What is the villager looking at _right now_? What is their current mood value?).

### Layer 5: Long-Term Memory (LTM - The "Identity" Storage)

- **Input:** `EpisodeSummary` + `VillagerID`.
- **Output:** `IdentityContext` (The villager's history with the player + their "Personality Tags").

### Layer 6: Language Cortex (Slow Gear)

- **Input:** `ActiveAttentionState`+ `IdentityContext`.
- **Output:** `NarrativePacket` (The "Why" and "How" of the villager's next move).

### Layer 7: Action Layer

- **Input:** `NarrativePacket`.
- **Output:** Script API Executables (e.g., `entity.teleport`, `player.onScreenDisplay`, `container.addItem`).
