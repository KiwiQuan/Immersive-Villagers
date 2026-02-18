# Layer 2: Perception (The Semantic Vectorizer)

## 1. Purpose

Converts raw game IDs and locations into a 5-axis Emotional/Social vector. This allows the brain to understand the "vibe" of an action (e.g., "Harmful High-Energy Social" vs "Helpful Low-Energy Solo").

## 2. The 5-Axis Vector (C-V-I-S-X)

Every perception is mapped to these dimensions (Range: -1.0 to 1.0):

- **Constructiveness (C):** Building (+) vs. Destroying (-).
- **Value (V):** Economic/Survival importance. Diamonds (+) vs. Dirt (-).
- **Intensity (I):** Energy/Arousal. Speed and violence (+) vs. Stillness (0).
- **Sociality (S):** Intent. Friendly/Collaborative (+) vs. Hostile/Selfish (-).
- **Complexity (X):** Logic. Systemic/Redstone (+) vs. Raw/Random (-).

## 3. Vector Factory Logic

- **The Semantic Atlas:** A lookup table maps keywords (e.g., "ore", "sword", "redstone") to base V, I, and X values.
- **Sociality Pivot:**
  - **Direct:** Chat and Trading get high positive S. Attacks get high negative S.
  - **Indirect:** World changes (blocks) calculate S based on Territory.
  - _Logic:_ (C < 0) + Inside_Villager_Home = High Negative S.
- **Complexity Boost:** Logic-heavy items (Redstone, Comparators) or varied block-breaking patterns automatically spike the X axis.

## 4. Output Specification (Semantic Frame)

```jsx
Sent to Layer 3 (Sequencer):
```

```jsx

{
"v_id": "string",
"vector": [C, V, I, S, X],
"timestamp": "number",
"context": "string_label"
}
```

## 5. Implementation Strategy

Use a "Lazy Lookup" system. If a block or item ID is unknown, the system defaults to the base "Block Break" or "Block Place" vector, ensuring the villager always has a reaction even for modded items.
