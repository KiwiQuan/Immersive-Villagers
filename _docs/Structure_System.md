# 🏗️ Structure Learning & Building System

## Overview

Villagers can **learn** building patterns by observing players and **reproduce** those structures autonomously or on command. This system treats structures as **Grammar** (recipes) rather than static blueprints.

---

## Core Concepts

### 1. Recipe vs. Blueprint

- **Recipe (Template):** A small, repeatable building unit (e.g., "3-block vertical wall segment")
- **Blueprint:** A high-level assembly of multiple recipes (e.g., "House = 4 wall segments + 1 roof segment")

**Example:**
- **Recipe:** "Place 5x5 cobblestone floor"
- **Blueprint:** "Blacksmith = cobblestone floor + 4 stone walls + wooden roof + furnace + anvil"

---

### 2. The Two Learning Modes

#### Hybrid Learning System

**Real-Time Recipe Learning:**
- Villager observes player placing blocks in sequence
- Detects repeated patterns (e.g., 3 blocks vertical = wall segment)
- Auto-generates template when pattern repeats 3+ times
- Stores in `structure_templates` table

**Post-Construction Blueprint Analysis:**
- After player finishes building, system analyzes complete structure
- Identifies functional zones (resting, utility, entry)
- Saves high-level assembly guide in `structure_blueprints` table

---

### 3. Pattern Recognition Methods

#### MONOLITHIC Mode: Spatial Hashing

```javascript
/**
 * Generate a unique hash for a block arrangement.
 * @param {Object[]} blockSequence - Ordered list of blocks
 * @returns {string} Spatial hash
 */
function generateSpatialHash(blockSequence) {
  return blockSequence
    .map(b => `${b.type}:${b.x}:${b.y}:${b.z}`)
    .sort()
    .join('|');
}

// Example:
// Input: [oak_plank(0,0,0), oak_plank(0,1,0), oak_plank(0,2,0)]
// Output: "oak_plank:0:0:0|oak_plank:0:1:0|oak_plank:0:2:0"
```

**Recognition:**
- Exact match: Check if `pattern_hash` exists in database
- Instant recognition (<1ms)
- No generalization (stone ≠ cobblestone)

---

#### MICROSERVICES Mode: Semantic Vectors

```javascript
/**
 * Generate a semantic description of a structure.
 * @param {Object[]} blockSequence - Ordered list of blocks
 * @returns {string} Natural language description
 */
function generateStructureDescription(blockSequence) {
  const blockTypes = [...new Set(blockSequence.map(b => b.type))];
  const dimensions = calculateDimensions(blockSequence);
  const shape = inferShape(blockSequence);
  
  return `A ${shape} structure of ${dimensions.height} blocks high, made of ${blockTypes.join(' and ')}`;
}

// Example:
// Input: [oak_plank(0,0,0), oak_plank(0,1,0), oak_plank(0,2,0)]
// Output: "A vertical pillar structure of 3 blocks high, made of oak_plank"

/**
 * Recognize structure using semantic similarity.
 * @param {Object[]} blockSequence - Observed blocks
 * @returns {Promise<Object>} { recognized: boolean, template: {...}, similarity: number }
 */
async function recognizeStructure(blockSequence) {
  const description = generateStructureDescription(blockSequence);
  const embedding = await generateEmbedding(description);
  
  const result = await pool.query(
    'SELECT id, label, embedding <=> $1::vector(384) AS similarity FROM structure_templates ORDER BY embedding <=> $1::vector(384) LIMIT 1',
    [`[${embedding.join(',')}]`]
  );
  
  const threshold = 0.92;  // 92% similarity = confident match
  
  if (result.rows.length > 0 && (1 - result.rows[0].similarity) > threshold) {
    return { 
      recognized: true, 
      template: result.rows[0],
      similarity: 1 - result.rows[0].similarity
    };
  }
  
  return { recognized: false, similarity: 0 };
}
```

**Recognition:**
- Semantic match: 92%+ similarity = recognized
- Generalization: "stone wall" matches "cobblestone wall" at 93% similarity
- Rotation invariant (description ignores absolute orientation)

---

## Learning Flow

### Phase 1: Real-Time Observation (Recipe Learning)

```
Player places blocks → Villager within 32 blocks observes
                    ↓
                  Layer 1 filters event
                    ↓
                  Layer 2 vectorizes
                    ↓
         [Pattern Detection in Layer 3]
                    ↓
    Check: Has this sequence appeared 3+ times in last 60s?
                    ↓
                   YES → Create Recipe
                    ↓
         Save to structure_templates table
```

**Implementation (Layer 3 Enhancement):**

```javascript
/**
 * Tracks repeating block placement patterns.
 * @param {Object} event - Block placement event
 * @param {string} villagerID - Observer villager
 */
function detectRepeatingPattern(event, villagerID) {
  const patternKey = `${villagerID}:${event.blockType}`;
  
  if (!patternBuffer.has(patternKey)) {
    patternBuffer.set(patternKey, []);
  }
  
  const buffer = patternBuffer.get(patternKey);
  buffer.push({ x: event.x, y: event.y, z: event.z, type: event.blockType, timestamp: Date.now() });
  
  // Sliding window: Keep last 60 seconds only
  const cutoff = Date.now() - 60000;
  const recentBlocks = buffer.filter(b => b.timestamp > cutoff);
  patternBuffer.set(patternKey, recentBlocks);
  
  // Pattern detection: Check for repeated 3x3x3 units
  if (recentBlocks.length >= 9) {
    const clusters = clusterBlocks(recentBlocks, 3);
    
    for (const cluster of clusters) {
      const hash = generateSpatialHash(cluster);
      
      // Count occurrences of this hash in recent history
      const occurrences = countHashOccurrences(hash, recentBlocks);
      
      if (occurrences >= 3) {
        // Repeated pattern found!
        saveAsTemplate(villagerID, hash, cluster);
      }
    }
  }
}
```

---

### Phase 2: Post-Construction Analysis (Blueprint Saving)

```
Player finishes building → Villager explicitly taught or requests analysis
                         ↓
              Scan complete structure
                         ↓
              Identify functional zones (bed, door, chest)
                         ↓
              Break into known recipes (via template matching)
                         ↓
              Generate composition map
                         ↓
              Save to structure_blueprints table
```

**Implementation:**

```javascript
/**
 * Analyze a completed structure and save as blueprint.
 * @param {Object} anchorPoint - Starting coordinate { x, y, z }
 * @param {string} structureName - Player-provided name
 * @param {string} villagerID - Learning villager
 */
async function saveBlueprint(anchorPoint, structureName, villagerID) {
  // Step 1: Scan structure (flood fill algorithm)
  const blocks = floodFillStructure(anchorPoint, maxRadius = 32);
  
  // Step 2: Identify functional zones
  const zones = identifyFunctionalZones(blocks);
  // Returns: { resting: {bed_location}, utility: {chest_location, furnace_location}, entry: {door_location} }
  
  // Step 3: Break structure into known templates
  const composition = matchBlocksToTemplates(blocks);
  // Returns: [{ templateID: 5, offset: {x: 0, y: 0, z: 0} }, { templateID: 12, offset: {x: 5, y: 0, z: 0} }]
  
  // Step 4: Generate semantic embedding (MICROSERVICES mode)
  const description = generateBlueprintDescription(blocks, zones);
  const embedding = await generateEmbedding(description);
  
  // Step 5: Extract tags
  const tags = extractBlueprintTags(blocks, zones);
  // Returns: ['residential', 'wood', 'small', 'has_bed']
  
  // Step 6: Save to database
  await pool.query(
    'INSERT INTO structure_blueprints (name, embedding, composition, tags, functional_zones, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
    [structureName, `[${embedding.join(',')}]`, JSON.stringify(composition), JSON.stringify(tags), JSON.stringify(zones), villagerID]
  );
}
```

---

## Functional Zones

### Zone Types

1. **Resting Zone:** Contains bed (sleep/recovery)
2. **Utility Zone:** Contains chests, furnaces, crafting tables (work)
3. **Entry Zone:** Contains doors, gates (access points)
4. **Social Zone:** Open space near beds (gathering)
5. **Storage Zone:** Multiple chests (inventory)

**Why Zones Matter:**
- Villagers understand structures by **function**, not just shape
- A "house" isn't just walls + roof; it's a safe zone with a bed
- Enables intelligent building (villager knows where to place bed in their own house)

**Zone Detection:**

```javascript
/**
 * Identify functional zones in a structure.
 * @param {Object[]} blocks - List of all blocks in structure
 * @returns {Object} Functional zone map
 */
function identifyFunctionalZones(blocks) {
  const zones = {
    resting: null,
    utility: null,
    entry: null,
    social: null,
    storage: null
  };
  
  // Find beds (resting zone)
  const beds = blocks.filter(b => b.type.includes('bed'));
  if (beds.length > 0) {
    zones.resting = { x: beds[0].x, y: beds[0].y, z: beds[0].z, radius: 5 };
  }
  
  // Find doors (entry zone)
  const doors = blocks.filter(b => b.type.includes('door'));
  if (doors.length > 0) {
    zones.entry = { x: doors[0].x, y: doors[0].y, z: doors[0].z };
  }
  
  // Find utility blocks (furnace, chest, crafting table)
  const utilityBlocks = blocks.filter(b => ['furnace', 'chest', 'crafting_table'].some(type => b.type.includes(type)));
  if (utilityBlocks.length > 0) {
    const center = calculateCentroid(utilityBlocks);
    zones.utility = { x: center.x, y: center.y, z: center.z, radius: 3 };
  }
  
  // Social zone = open space near bed
  if (zones.resting) {
    const openSpaces = findOpenSpaces(blocks, zones.resting);
    if (openSpaces.length > 4) {
      zones.social = { x: openSpaces[0].x, y: openSpaces[0].y, z: openSpaces[0].z, radius: 4 };
    }
  }
  
  return zones;
}
```

---

## Building System

### Trigger System

Villagers can be triggered to build via:

1. **Player Commands** (with NER extraction)
2. **Autonomous Needs** (rain → shelter, no bed → house)

---

### Trigger 1: Player Commands

**Example Chat Commands:**
```
"Build a house"
"Make a wall out of cobblestone"
"Construct a blacksmith workshop here"
```

**NER Extraction (MICROSERVICES mode only):**

```javascript
/**
 * Parse player command and extract building intent.
 * @param {string} chatMessage - Player's command
 * @returns {Promise<Object>} { action, structure, material, location }
 */
async function parseBuildCommand(chatMessage) {
  const entities = await extractEntities(chatMessage);  // BERT NER
  
  const action = chatMessage.toLowerCase().includes('build') || chatMessage.toLowerCase().includes('make') || chatMessage.toLowerCase().includes('construct') 
    ? 'build' 
    : null;
  
  const structure = entities.structures[0] || null;  // "house", "wall", "tower"
  const material = entities.materials[0] || null;    // "cobblestone", "wood", "stone"
  
  return { action, structure, material, location: null };  // Location determined by player position or "here" keyword
}
```

---

### Trigger 2: Autonomous Needs

**Need Detection:**

```javascript
/**
 * Check if villager has autonomous building needs.
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object|null>} Build need or null
 */
async function checkBuildingNeeds(villagerID) {
  const villagerEntity = world.getEntity(villagerID);
  if (!villagerEntity || !villagerEntity.isValid()) return null;
  
  // Need 1: Shelter (when raining and no roof above)
  if (world.getWeather() === 'rain' && !hasBlockAbove(villagerEntity, 'roof')) {
    return { 
      need: 'shelter', 
      blueprintQuery: { tags: ['shelter', 'small'] },
      urgency: 'high'
    };
  }
  
  // Need 2: Bed (when night and no bed in vicinity)
  const timeOfDay = world.getTimeOfDay();
  if (timeOfDay > 13000 && !hasBedNearby(villagerEntity, radius = 32)) {
    return { 
      need: 'resting', 
      blueprintQuery: { tags: ['residential', 'has_bed'] },
      urgency: 'medium'
    };
  }
  
  // Need 3: Storage (when inventory full and no chest nearby)
  if (villagerEntity.getComponent('inventory').isFull() && !hasChestNearby(villagerEntity, radius = 16)) {
    return { 
      need: 'storage', 
      blueprintQuery: { tags: ['utility', 'has_chest'] },
      urgency: 'low'
    };
  }
  
  return null;
}
```

---

## Building Execution

### The "Ghost Block" System

Villagers don't constantly check the world; they build from a **mental map** stored in Working Memory.

**Process:**

1. Villager receives build task (player command or autonomous need)
2. Backend generates "Ghost Structure" (virtual blueprint in memory)
3. Villager pathfinds to first empty ghost block position
4. Places real block (4-block reach, just like players)
5. Marks ghost block as "realized"
6. Repeats until all ghost blocks are realized

**Implementation:**

```javascript
/**
 * Execute one step of a building task.
 * @param {string} villagerID - Builder villager
 * @param {number} taskID - Build task ID from database
 */
async function executeBuildStep(villagerID, taskID) {
  const villagerEntity = world.getEntity(villagerID);
  if (!villagerEntity || !villagerEntity.isValid()) return;
  
  // Fetch task from database
  const task = await pool.query('SELECT * FROM build_tasks WHERE id = $1', [taskID]);
  const { blueprint_id, template_id, anchor_x, anchor_y, anchor_z, current_step, total_steps } = task.rows[0];
  
  // Fetch instructions (either from blueprint or template)
  const instructions = await fetchInstructions(blueprint_id, template_id);
  const nextBlock = instructions[current_step];
  
  if (!nextBlock) {
    // Task complete
    await pool.query(
      'UPDATE build_tasks SET status = $1, completed_at = $2 WHERE id = $3',
      ['completed', Date.now(), taskID]
    );
    return;
  }
  
  // Calculate world position
  const worldPos = {
    x: anchor_x + nextBlock.x,
    y: anchor_y + nextBlock.y,
    z: anchor_z + nextBlock.z
  };
  
  // Check if villager is within 4 blocks (placement reach)
  const distance = calculateDistance(villagerEntity.location, worldPos);
  
  if (distance > 4) {
    // Pathfind to position (Layer 7 handles this)
    sendPathfindIntent(villagerID, worldPos);
    return;
  }
  
  // Place block
  const dimension = world.getDimension(villagerEntity.dimension.id);
  const blockType = nextBlock.type;
  
  try {
    dimension.setBlockType(worldPos, blockType);
    
    // Update task progress
    await pool.query(
      'UPDATE build_tasks SET current_step = $1 WHERE id = $2',
      [current_step + 1, taskID]
    );
    
    logger.info({ villagerID, taskID, step: current_step, totalSteps: total_steps }, '[Structure System] Block placed');
  } catch (err) {
    logger.error({ error: err.message, villagerID, taskID }, '[Structure System] Block placement failed');
    
    // Mark task as failed
    await pool.query(
      'UPDATE build_tasks SET status = $1 WHERE id = $2',
      ['failed', taskID]
    );
  }
}
```

---

### Placement Constraints

Villagers follow player-like building rules:

- **Reach:** 4 blocks maximum from villager position
- **Line of Sight:** Must have clear path to block position
- **Material Availability:** Check villager inventory for required blocks
- **Permissions:** Only build in "owned" territory (home radius or player-designated area)

**Inventory Check:**

```javascript
/**
 * Check if villager has required blocks in inventory.
 * @param {Entity} villagerEntity - Villager entity
 * @param {Object[]} instructions - Block placement instructions
 * @returns {boolean} True if villager has all materials
 */
function hasRequiredMaterials(villagerEntity, instructions) {
  const inventory = villagerEntity.getComponent('inventory').container;
  const requiredBlocks = {};
  
  // Count required blocks by type
  for (const step of instructions) {
    requiredBlocks[step.type] = (requiredBlocks[step.type] || 0) + 1;
  }
  
  // Check inventory
  for (const [blockType, count] of Object.entries(requiredBlocks)) {
    const available = countItemsInInventory(inventory, blockType);
    if (available < count) {
      return false;
    }
  }
  
  return true;
}
```

**Fallback:** If villager lacks materials, task enters `status: 'waiting_materials'` and villager requests items from player.

---

## Teaching System

### Explicit Teaching (High-Level Labels)

Players can teach villagers custom names for structures:

**In-Game Command:**
```
/scriptevent ai:teach_structure <structure_name>
```

**Flow:**
1. Player stands near structure they want to name
2. Player triggers teach command
3. System analyzes structure in 32-block radius
4. Player confirms structure bounds via UI
5. Villager saves structure with player-provided name

**Implementation:**

```javascript
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === 'ai:teach_structure') {
    const structureName = event.message;
    const playerEntity = event.sourceEntity;
    
    if (!playerEntity) return;
    
    // Find nearest AI villager
    const nearbyVillagers = world.getDimension(playerEntity.dimension.id)
      .getEntities({ 
        type: 'minecraft:villager_v2', 
        tags: ['ai_villager'],
        location: playerEntity.location,
        maxDistance: 32
      });
    
    if (nearbyVillagers.length === 0) {
      playerEntity.sendMessage('§c[AI] No AI villagers nearby');
      return;
    }
    
    const villagerID = nearbyVillagers[0].id;
    
    // Trigger blueprint analysis
    http.post('http://localhost:3000/api/structures/teach', {
      body: JSON.stringify({
        villagerID,
        structureName,
        scanOrigin: { x: playerEntity.location.x, y: playerEntity.location.y, z: playerEntity.location.z }
      })
    })
    .then(() => {
      playerEntity.sendMessage(`§a[AI] ${nearbyVillagers[0].nameTag} learned "${structureName}"`);
    })
    .catch(err => {
      playerEntity.sendMessage('§c[AI] Teaching failed: ' + err.message);
    });
  }
});
```

---

## Building Task Queue

### Task Lifecycle

```
1. Task Created      (status: 'pending')
   ↓
2. Villager Assigned (status: 'in_progress', started_at set)
   ↓
3. Block by Block    (current_step increments)
   ↓
4. Task Completed    (status: 'completed', completed_at set)
```

**Task Priority:**

| Priority | Trigger Source | Example |
|----------|---------------|---------|
| **High** | Autonomous + urgent | Building shelter during rain |
| **Medium** | Player command | "Build a house here" |
| **Low** | Autonomous + non-urgent | Building storage when inventory full |

**Task Scheduling (Layer 7 Enhancement):**

```javascript
/**
 * Fetch next build task for a villager.
 * @param {string} villagerID - Villager entity ID
 * @returns {Promise<Object|null>} Next task or null
 */
async function getNextBuildTask(villagerID) {
  const result = await pool.query(
    `SELECT * FROM build_tasks 
     WHERE villager_id = $1 AND status = 'pending'
     ORDER BY 
       CASE trigger_source 
         WHEN 'autonomous_urgent' THEN 1
         WHEN 'player_command' THEN 2
         WHEN 'autonomous_need' THEN 3
       END,
       created_at ASC
     LIMIT 1`,
    [villagerID]
  );
  
  if (result.rows.length === 0) return null;
  
  const task = result.rows[0];
  
  // Mark as in-progress
  await pool.query(
    'UPDATE build_tasks SET status = $1, started_at = $2 WHERE id = $3',
    ['in_progress', Date.now(), task.id]
  );
  
  return task;
}
```

---

## Shared Knowledge

### Knowledge Propagation

When one villager learns a structure, **all villagers can access it** via the shared `structure_templates` table.

**However:**
- Each villager must **discover** the template by either:
  1. Observing it themselves
  2. Being taught by a player
  3. Hearing about it via gossip (Phase 2+)

**Subjective Access Control:**

```javascript
/**
 * Check if a villager knows a specific template.
 * @param {string} villagerID - Villager entity ID
 * @param {number} templateID - Template ID
 * @returns {Promise<boolean>} True if villager has discovered this template
 */
async function villagerKnowsTemplate(villagerID, templateID) {
  // Check if template is in villager's subjective knowledge
  const result = await pool.query(
    `SELECT 1 FROM villager_discoveries vd
     JOIN concepts c ON vd.concept_id = c.concept_id
     WHERE vd.villager_id = $1 AND c.name = (SELECT label FROM structure_templates WHERE id = $2)`,
    [villagerID, templateID]
  );
  
  return result.rows.length > 0;
}

/**
 * Grant villager knowledge of a template.
 * @param {string} villagerID - Villager entity ID
 * @param {number} templateID - Template ID
 * @param {string} method - How knowledge was acquired
 */
async function grantTemplateKnowledge(villagerID, templateID, method = 'witnessed') {
  const template = await pool.query('SELECT label FROM structure_templates WHERE id = $1', [templateID]);
  if (template.rows.length === 0) return;
  
  const label = template.rows[0].label;
  
  // Create or fetch concept
  const concept = await pool.query(
    'INSERT INTO concepts (name, semantic_vector_manual, semantic_vector_minilm) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET discovery_count = concepts.discovery_count + 1 RETURNING concept_id',
    [label, null, null]
  );
  
  const conceptID = concept.rows[0].concept_id;
  
  // Grant discovery
  await pool.query(
    'INSERT INTO villager_discoveries (villager_id, concept_id, discovered_at, discovery_method) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    [villagerID, conceptID, Date.now(), method]
  );
}
```

---

## Example Scenarios

### Scenario 1: Auto-Detect Repeating Pattern

**Setup:**
- Player builds 3 identical wall segments (3 blocks vertical each)
- Villager "Barrel" observes within 16 blocks

**Flow:**
1. Player places oak_plank at (0, 0, 0)
2. Player places oak_plank at (0, 1, 0)
3. Player places oak_plank at (0, 2, 0)
   - **Pattern detected:** 3-block vertical cluster
4. Player places oak_plank at (5, 0, 0)
5. Player places oak_plank at (5, 1, 0)
6. Player places oak_plank at (5, 2, 0)
   - **Pattern repeated:** Same hash as first cluster
7. Player places oak_plank at (10, 0, 0)
8. Player places oak_plank at (10, 1, 0)
9. Player places oak_plank at (10, 2, 0)
   - **Pattern repeated 3x:** Save as template!

**Result:**
- `structure_templates` table gets new entry:
  - `label`: "oak_wall_segment"
  - `pattern_hash`: "oak_plank:0:0:0|oak_plank:0:1:0|oak_plank:0:2:0"
  - `instructions`: `[{"x":0,"y":0,"z":0,"type":"oak_plank"}, ...]`
- Villager "Barrel" can now build this segment on command

---

### Scenario 2: Explicit Teaching (Blueprint)

**Setup:**
- Player finishes building a small house (15 blocks)
- Wants to teach villager the complete structure

**Flow:**
1. Player stands near house
2. Player types: `/scriptevent ai:teach_structure cottage`
3. System scans 32-block radius from player
4. Identifies functional zones:
   - Resting: Bed at (5, 1, 3)
   - Entry: Door at (0, 1, 2)
   - Utility: Chest at (7, 1, 5)
5. Breaks structure into known templates:
   - 4x "oak_wall_segment" (learned earlier)
   - 1x "oak_floor_5x5" (learned earlier)
   - 1x "wooden_roof" (new pattern)
6. Saves as blueprint "cottage" with composition map
7. Villager can now build complete cottage from memory

---

### Scenario 3: Autonomous Building (Rain Shelter)

**Setup:**
- Raining in-game
- Villager "Fletcher" standing in open field (no roof above)

**Flow:**
1. Layer 3 detects: `checkBuildingNeeds(villagerID)` returns `{ need: 'shelter', urgency: 'high' }`
2. Query blueprints: `SELECT * FROM structure_blueprints WHERE tags @> '["shelter"]' ORDER BY build_count DESC LIMIT 1`
3. Backend creates build task:
   - `blueprint_id`: 5 (simple shelter)
   - `anchor_x/y/z`: Villager's current location
   - `status`: 'pending'
   - `trigger_source`: 'autonomous_urgent'
4. Layer 7 picks up task
5. Villager pathfinds to build site
6. Places blocks one by one (4-block reach)
7. Shelter complete (~30 seconds for 8-block roof)

---

## Data Storage Examples

### Example Template (Wall Segment)

```json
{
  "id": 1,
  "label": "oak_wall_segment",
  "pattern_hash": "oak_plank:0:0:0|oak_plank:0:1:0|oak_plank:0:2:0",
  "embedding": [0.12, 0.45, -0.32, ...],
  "instructions": [
    { "x": 0, "y": 0, "z": 0, "type": "oak_plank" },
    { "x": 0, "y": 1, "z": 0, "type": "oak_plank" },
    { "x": 0, "y": 2, "z": 0, "type": "oak_plank" }
  ],
  "dimensions": { "width": 1, "height": 3, "depth": 1 },
  "created_by": "villager-456",
  "observation_count": 7
}
```

---

### Example Blueprint (House)

```json
{
  "id": 1,
  "name": "Steve's Cozy Cottage",
  "embedding": [0.23, 0.67, -0.11, ...],
  "composition": [
    { "templateID": 1, "offset": { "x": 0, "y": 0, "z": 0 } },
    { "templateID": 1, "offset": { "x": 5, "y": 0, "z": 0 } },
    { "templateID": 1, "offset": { "x": 0, "y": 0, "z": 5 } },
    { "templateID": 1, "offset": { "x": 5, "y": 0, "z": 5 } },
    { "templateID": 2, "offset": { "x": 0, "y": 0, "z": 0 } },
    { "templateID": 3, "offset": { "x": 0, "y": 3, "z": 0 } }
  ],
  "tags": ["residential", "wood", "small", "has_bed"],
  "functional_zones": {
    "resting": { "x": 5, "y": 1, "z": 3, "radius": 5 },
    "entry": { "x": 0, "y": 1, "z": 2 },
    "utility": { "x": 7, "y": 1, "z": 5, "radius": 3 }
  },
  "created_by": "player-steve",
  "build_count": 3
}
```

---

## Performance Considerations

### Pattern Detection Overhead

**MONOLITHIC Mode:**
- Spatial hashing: <1ms per block
- Database lookup: 1-5ms
- **Total:** <5ms per block placement

**MICROSERVICES Mode:**
- Text description generation: <1ms
- MiniLM embedding: 15-20ms
- Database lookup: 1-5ms
- **Total:** ~20ms per block placement

**Optimization:** Only run pattern detection on structures with 3+ blocks (ignore single block placements).

---

### Building Speed

**Constraints:**
- Villagers place 1 block per 2 seconds (pathfinding + placement animation)
- Small structure (10 blocks): ~20 seconds
- Medium structure (50 blocks): ~100 seconds (~1.5 minutes)
- Large structure (200 blocks): ~400 seconds (~6.5 minutes)

**Parallelization:**
- Multiple villagers can work on same blueprint simultaneously (assign different sections)
- Requires collision detection (don't pathfind to occupied positions)

---

## UI Integration (Phase 2+)

### Structure Browser

Players can view learned structures via modal UI:

**Features:**
- Grid view of all blueprints (with thumbnail renders)
- Filter by tags (residential, utility, decorative)
- Preview functional zones
- Assign build tasks to specific villagers

**Command:**
```
/scriptevent ai:show_structures
```

---

### Build Progress Display

When villager is building, show progress in ActionBar:

```javascript
function displayBuildProgress(villagerID, taskID) {
  const task = getBuildTask(taskID);
  const progress = (task.current_step / task.total_steps) * 100;
  
  const message = `§e[Building] ${task.blueprint_name}: §a${progress.toFixed(0)}% §7(${task.current_step}/${task.total_steps})`;
  
  // Display to all nearby players
  const nearbyPlayers = getNearbyPlayers(villagerID, radius = 32);
  for (const player of nearbyPlayers) {
    player.onScreenDisplay.setActionBar(message);
  }
}
```

---

## Scalability

### Storage Efficiency

**Recipe-Based vs. Coordinate-Based:**

| Approach | Storage per House (200 blocks) | Storage for 100 Houses |
|----------|-------------------------------|----------------------|
| **Coordinate-Based** | 200 blocks × 50 bytes = 10KB | 1MB |
| **Recipe-Based** | 3 templates × 500 bytes = 1.5KB | 150KB |

**Savings:** 85% reduction in storage by using recipes.

---

### Shared Templates

All villagers access the same `structure_templates` pool:
- First villager learns "oak_wall_segment" → All villagers can use it (if taught)
- Reduces redundant learning
- Enables village-wide construction standards

---

## Future Enhancements (Post-MVP)

### Advanced Features

1. **Collaborative Building:** Multiple villagers work on same blueprint (assign sections)
2. **Adaptive Building:** Villagers modify blueprints based on terrain (build on hills)
3. **Blueprint Marketplace:** Villagers "gossip" about impressive structures (knowledge sharing)
4. **Building Styles:** Villagers develop preferences (some prefer stone, others wood)
5. **Structure Repair:** Villagers detect damaged structures and initiate repairs

---

**Document Type:** System Architecture  
**Phase:** Phase 2+  
**Status:** Ready for Implementation  
**Version:** 1.0  
**Last Updated:** Mar 3, 2026
