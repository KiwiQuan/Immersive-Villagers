# Layer 2: Perception (The Semantic Vectorizer)

> **Implementation Status:** 🟡 PLANNED - This doc describes future architecture. Not yet implemented.

## 1. Purpose

Converts raw game data and locations into semantic vectors. Behavior depends on **AI_MODE**:

- **MONOLITHIC Mode:** 5-axis manual vectors [C, V, I, S, X]
- **MICROSERVICES Mode:** 384-dimensional MiniLM embeddings

This allows the brain to understand the "vibe" of an action (e.g., "Harmful High-Energy Social" vs "Helpful Low-Energy Solo").

---

## 2. AI Mode Behavior

### MONOLITHIC Mode: 5-Axis Vector (C-V-I-S-X)

Every perception is mapped to these dimensions (Range: -1.0 to 1.0):

- **Constructiveness (C):** Building (+) vs. Destroying (-).
- **Value (V):** Economic/Survival importance. Diamonds (+) vs. Dirt (-).
- **Intensity (I):** Energy/Arousal. Speed and violence (+) vs. Stillness (0).
- **Sociality (S):** Intent. Friendly/Collaborative (+) vs. Hostile/Selfish (-).
- **Complexity (X):** Logic. Systemic/Redstone (+) vs. Raw/Random (-).

### MICROSERVICES Mode: 384D Semantic Embedding

Every perception is converted to natural language and vectorized by **Xenova/all-MiniLM-L6-v2**:

- **Input:** Text description (e.g., "Steve placed a high-value decorative block near home")
- **Output:** 384-dimensional embedding vector
- **Performance:** <20ms per event
- **Generalization:** Semantically similar events cluster together

## 3. Vector Factory Logic

### MONOLITHIC Mode Implementation

- **The Semantic Atlas:** A lookup table maps keywords (e.g., "ore", "sword", "redstone") to base V, I, and X values.
- **Sociality Pivot:**
  - **Direct:** Chat and Trading get high positive S. Attacks get high negative S.
  - **Indirect:** World changes (blocks) calculate S based on Territory.
  - _Logic:_ (C < 0) + Inside_Villager_Home = High Negative S.
- **Complexity Boost:** Logic-heavy items (Redstone, Comparators) or varied block-breaking patterns automatically spike the X axis.

**Implementation:**

```javascript
/**
 * Calculate 5D semantic vector (MONOLITHIC mode).
 * @param {Object} eventContext - Filtered event from Layer 1
 * @returns {Object} { C, V, I, S, X }
 */
function calculateVectorManual(eventContext) {
  const { eventType, blockType, actorID, villagerID, proximity } = eventContext;
  
  // Lookup base values
  const rules = vectorRules[blockType] || vectorRules.default;
  
  return {
    C: rules.C,
    V: rules.V * (isNearHome ? 1.5 : 1.0),
    I: rules.I * (isNearHome ? 1.5 : 1.0),
    S: calculateSociality(eventType, proximity),
    X: rules.X
  };
}
```

---

### MICROSERVICES Mode Implementation

Text description generation + MiniLM vectorization.

**Implementation:**

```javascript
/**
 * Generate semantic embedding (MICROSERVICES mode).
 * @param {Object} eventContext - Filtered event from Layer 1
 * @returns {Promise<Object>} { embedding: number[], description: string }
 */
async function calculateVectorSemantic(eventContext) {
  const { eventType, blockType, actorID, villagerID, proximity } = eventContext;
  
  // Generate natural language description
  const description = buildEventDescription(eventContext);
  // Example: "Steve placed a high-value decorative block near the villager home"
  
  // Check concepts table for cached embedding (deduplication)
  const cached = await checkConceptEmbedding(description);
  if (cached) {
    return { embedding: cached, description };
  }
  
  // Generate MiniLM embedding (backend call)
  const response = await http.post('http://localhost:3000/api/vector/embed', {
    body: JSON.stringify({ text: description })
  });
  
  const data = JSON.parse(response.body);
  return { embedding: data.embedding, description };
}

/**
 * Build natural language description of event.
 * @param {Object} eventContext
 * @returns {string}
 */
function buildEventDescription(eventContext) {
  const { eventType, blockType, actorID, proximity, isNearHome } = eventContext;
  
  const actionVerb = eventType === 'placeBlock' ? 'placed' : 'broke';
  const valueModifier = getValueModifier(blockType);  // "high-value", "common", "decorative"
  const locationContext = isNearHome ? 'near the villager home' : 'in the distance';
  
  return `${actorID} ${actionVerb} a ${valueModifier} ${blockType} ${locationContext}`;
}
```

**Backend Endpoint (Vector Engine):**

```javascript
app.post('/api/vector/embed', async (req, res) => {
  const { text } = req.body;
  
  if (getAIMode() !== 'MICROSERVICES') {
    return res.status(400).json({ status: 'error', message: 'MiniLM only available in MICROSERVICES mode' });
  }
  
  try {
    const embedding = await generateEmbedding(text);  // Calls MiniLM
    res.json({ status: 'success', embedding, dimension: 384 });
  } catch (err) {
    logger.error({ error: err.message }, '[Vector Engine] Embedding generation failed');
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

**Performance:**
- MONOLITHIC: <1ms (lookup + math)
- MICROSERVICES: <20ms (description + MiniLM + cache check)

---

## 4. Output Specification (Semantic Frame)

### MONOLITHIC Mode Output

```javascript
{
  "v_id": "villager-456",
  "vector": { C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1 },
  "timestamp": 1709480325000,
  "context": "placeBlock",
  "actorID": "player-steve"
}
```

### MICROSERVICES Mode Output

```javascript
{
  "v_id": "villager-456",
  "embedding": [0.12, 0.45, -0.32, ...],  // 384D vector
  "description": "Steve placed a high-value decorative block near the villager home",
  "timestamp": 1709480325000,
  "context": "placeBlock",
  "actorID": "player-steve"
}
```

**Both outputs sent to Layer 3 (Sequencer)**

---

## 5. Implementation Strategy

### MONOLITHIC: Lazy Lookup

Use a "Lazy Lookup" system. If a block or item ID is unknown, the system defaults to the base "Block Break" or "Block Place" vector, ensuring the villager always has a reaction even for modded items.

```javascript
const vectorRules = {
  diamond_block: { C: 0.8, V: 0.9, I: 0.3, X: 0.1 },
  dirt: { C: 0.8, V: 0.1, I: 0.2, X: 0.0 },
  tnt: { C: -0.9, V: 0.3, I: 0.9, X: 0.5 },
  default: { C: 0.5, V: 0.3, I: 0.2, X: 0.1 }
};
```

---

### MICROSERVICES: Semantic Description

Generate human-readable descriptions that MiniLM can understand.

```javascript
const descriptionTemplates = {
  placeBlock: (block) => `placed a ${getValueModifier(block)} ${block}`,
  breakBlock: (block) => `broke a ${getValueModifier(block)} ${block}`,
  entityHurt: (entity, damage) => `dealt ${damage} damage to ${entity}`,
  chat: (message) => `said: "${message}"`
};
```

**Value Modifiers:**
```javascript
function getValueModifier(blockType) {
  const highValue = ['diamond', 'emerald', 'netherite', 'gold'];
  const decorative = ['glass', 'stained_glass', 'terracotta'];
  const utility = ['furnace', 'chest', 'crafting_table'];
  
  if (highValue.some(v => blockType.includes(v))) return 'high-value';
  if (decorative.some(v => blockType.includes(v))) return 'decorative';
  if (utility.some(v => blockType.includes(v))) return 'utility';
  
  return 'common';
}
```

---

## 6. Structure Perception (Post-MVP)

Layer 2 also handles **structure recognition** for the building system.

### MONOLITHIC Mode: Spatial Hashing

```javascript
/**
 * Generate spatial hash for structure recognition.
 * @param {Object[]} blockCluster - 3x3x3 block cluster
 * @returns {string} Spatial hash
 */
function generateSpatialHash(blockCluster) {
  return blockCluster
    .map(b => `${b.type}:${b.x}:${b.y}:${b.z}`)
    .sort()
    .join('|');
}
```

---

### MICROSERVICES Mode: Semantic Structure Vectors

```javascript
/**
 * Generate semantic description of structure.
 * @param {Object[]} blockCluster - Observed blocks
 * @returns {Promise<number[]>} 384D embedding
 */
async function vectorizeStructure(blockCluster) {
  const description = generateStructureDescription(blockCluster);
  // "A vertical pillar of 3 oak planks"
  
  const embedding = await generateEmbedding(description);
  return embedding;
}
```

**Why This Works:**
- MiniLM understands spatial relationships from text
- "vertical pillar" vs. "horizontal plane" creates distinct clusters
- Material variations (oak vs. stone) create similar but distinct vectors
