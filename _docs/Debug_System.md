# 🐛 Debug System — Enhanced DEBUG_MODE

## Overview

The Debug System provides real-time visualization and tracing of the AI pipeline. DEBUG_MODE is functional in **Phase 1 MVP** and can be toggled in-game without server restart.

**Toggle Commands:**
```
/scriptevent ai:toggle_debug true
/scriptevent ai:toggle_debug false
```

---

## DEBUG_MODE Components

### 1. Inference Logger (Brain Path Visualization)

Displays the AI's "thought process" in real-time via ActionBar.

**Purpose:**
- Show which models/layers are processing events
- Display confidence scores for classifications
- Visualize Fast Gear → Slow Gear transitions

**Implementation:**

```javascript
/**
 * Log inference trace to ActionBar (DEBUG_MODE only).
 * @param {string} layer - Layer name (e.g., "L3", "L6")
 * @param {string} modelName - Model identifier (e.g., "DistilBERT", "Llama.cpp")
 * @param {Object} result - Inference result
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @param {string} villagerID - Villager entity ID
 */
function logInferenceTrace(layer, modelName, result, confidence, villagerID) {
  const DEBUG_MODE = world.getDynamicProperty('DEBUG_MODE');
  if (!DEBUG_MODE) return;
  
  const villagerEntity = world.getEntity(villagerID);
  if (!villagerEntity || !villagerEntity.isValid()) return;
  
  // Format trace string
  const traceString = `§7${layer}: §e[${modelName}] §7→ §f${JSON.stringify(result)} §a(${(confidence * 100).toFixed(0)}%)`;
  
  // Display on ActionBar
  const nearbyPlayers = world.getAllPlayers().filter(p => 
    calculateDistance(p.location, villagerEntity.location) < 32
  );
  
  for (const player of nearbyPlayers) {
    player.onScreenDisplay.setActionBar(traceString, { duration: 100 });
  }
  
  // Also log to console
  console.warn(`[DEBUG] [${layer}] [${modelName}] Result:`, result, `Confidence: ${confidence}`);
}
```

**Example Output:**

```
L3: [DistilBERT] → Intent: Building (89%)
L6: [Llama.cpp] → Action: speak (95%)
L7: [Action Layer] → Executing: speak
```

---

### 2. Vector Similarity Highlighting (Particle Effects)

Visualizes structure recognition by spawning particles at recognized structures.

**Purpose:**
- Show which structures villagers can "see"
- Display cosine similarity scores for debugging
- Validate pattern matching accuracy

**Implementation:**

```javascript
/**
 * Highlight a recognized structure with particle effects (DEBUG_MODE only).
 * @param {Object} recognitionResult - { templateID, anchor, similarity }
 * @param {string} villagerID - Observer villager
 */
async function highlightRecognizedStructure(recognitionResult, villagerID) {
  const DEBUG_MODE = world.getDynamicProperty('DEBUG_MODE');
  if (!DEBUG_MODE) return;
  
  const { templateID, anchor, similarity } = recognitionResult;
  
  // Fetch template dimensions
  const template = await fetchTemplate(templateID);
  
  // Spawn particles at anchor point
  const dimension = world.getDimension('overworld');
  const particleType = similarity > 0.95 ? 'minecraft:totem_particle' : 'minecraft:villager_happy';
  
  dimension.spawnParticle(particleType, { 
    x: anchor.x + 0.5, 
    y: anchor.y + 0.5, 
    z: anchor.z + 0.5 
  });
  
  // Display similarity score in chat (nearby players only)
  const villagerEntity = world.getEntity(villagerID);
  const nearbyPlayers = world.getAllPlayers().filter(p => 
    calculateDistance(p.location, villagerEntity.location) < 32
  );
  
  for (const player of nearbyPlayers) {
    player.sendMessage(`§7[DEBUG] Villager recognized §e${template.label} §7at (${anchor.x}, ${anchor.y}, ${anchor.z}) — Similarity: §a${(similarity * 100).toFixed(1)}%`);
  }
  
  // Log to backend
  logger.debug({ 
    villagerID, 
    templateID, 
    templateLabel: template.label, 
    anchor, 
    similarity 
  }, '[Debug] Structure recognized');
}
```

**Particle Key:**
- **Green particles (totem):** High confidence (>95%)
- **Yellow particles (happy):** Medium confidence (92-95%)

---

### 3. Vector Visualization in UI (Modal Menu)

Players can view event vectors and their semantic meanings in a dedicated UI.

**UI Features:**
- List of recent events (last 20)
- Display vector components ([C, V, I, S, X] or 384D)
- Show matched concepts (with similarity scores)
- Timeline visualization (episodes with seal reasons)

**Example UI Data Payload:**

```json
{
  "villagerID": "villager-456",
  "recentEvents": [
    {
      "timestamp": 1709480325000,
      "description": "Steve placed diamond block",
      "vector": { "C": 0.8, "V": 0.9, "I": 0.3, "S": 0.7, "X": 0.1 },
      "matchedConcept": { "name": "Decorating", "similarity": 0.87 }
    },
    {
      "timestamp": 1709480330000,
      "description": "Steve broke dirt",
      "vector": { "C": -0.6, "V": 0.1, "I": 0.2, "S": 0.1, "X": 0.0 },
      "matchedConcept": null
    }
  ],
  "currentMood": { "C": 0.8, "V": 0.9, "I": 0.3, "S": 0.7, "X": 0.1 },
  "episodes": [
    {
      "id": 45,
      "duration": 30000,
      "eventCount": 5,
      "sealReason": "inactivity",
      "summary": "Steve decorated the area with valuable blocks"
    }
  ]
}
```

**Endpoint:**

```javascript
app.get('/api/debug/villager/:villagerID', async (req, res) => {
  const { villagerID } = req.params;
  
  // Fetch recent events (stored temporarily in-memory during DEBUG_MODE)
  const recentEvents = eventBuffer.get(villagerID) || [];
  
  // Fetch current mood
  const mood = await pool.query('SELECT * FROM working_memory WHERE villager_id = $1', [villagerID]);
  
  // Fetch recent episodes
  const episodes = await pool.query(
    'SELECT * FROM episodes WHERE villager_id = $1 ORDER BY timestamp DESC LIMIT 10',
    [villagerID]
  );
  
  res.json({
    villagerID,
    recentEvents,
    currentMood: mood.rows[0],
    episodes: episodes.rows
  });
});
```

---

### 4. Manual Concept Correction (Teacher UI)

Allows players to correct mislabeled concepts, triggering re-vectorization.

**Use Case:**
- Villager labels a structure "Tower" when it's actually a "Lighthouse"
- Player corrects the label
- System regenerates embedding with new label
- Villager learns the correct association

**Implementation:**

```javascript
/**
 * Correct a concept label and re-vectorize.
 * @param {number} conceptID - Concept to correct
 * @param {string} newLabel - Corrected label
 * @param {string} villagerID - Villager to teach
 */
app.post('/api/debug/correct_concept', async (req, res) => {
  const { conceptID, newLabel, villagerID } = req.body;
  
  try {
    // Fetch original concept
    const original = await pool.query('SELECT * FROM concepts WHERE concept_id = $1', [conceptID]);
    if (original.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Concept not found' });
    }
    
    // Re-vectorize with new label (MICROSERVICES mode only)
    if (getAIMode() === 'MICROSERVICES') {
      const newEmbedding = await generateEmbedding(newLabel);
      
      await pool.query(
        'UPDATE concepts SET name = $1, semantic_vector_minilm = $2 WHERE concept_id = $3',
        [newLabel, `[${newEmbedding.join(',')}]`, conceptID]
      );
    } else {
      // MONOLITHIC mode: Just update label
      await pool.query(
        'UPDATE concepts SET name = $1 WHERE concept_id = $2',
        [newLabel, conceptID]
      );
    }
    
    logger.info({ conceptID, oldLabel: original.rows[0].name, newLabel, villagerID }, '[Debug] Concept corrected');
    
    res.json({ 
      status: 'success', 
      message: `Concept relabeled: ${original.rows[0].name} → ${newLabel}` 
    });
  } catch (err) {
    logger.error({ error: err.message }, '[Debug] Concept correction failed');
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

**Script API Integration:**

```javascript
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === 'ai:correct_concept') {
    const [conceptID, newLabel] = event.message.split(':');
    const playerEntity = event.sourceEntity;
    
    // Find nearest villager
    const nearbyVillagers = getNearbyVillagers(playerEntity, radius = 32);
    if (nearbyVillagers.length === 0) return;
    
    const villagerID = nearbyVillagers[0].id;
    
    http.post('http://localhost:3000/api/debug/correct_concept', {
      body: JSON.stringify({ conceptID: parseInt(conceptID), newLabel, villagerID })
    })
    .then(() => {
      playerEntity.sendMessage(`§a[AI] Concept corrected: ${newLabel}`);
    })
    .catch(err => {
      playerEntity.sendMessage('§c[AI] Correction failed: ' + err.message);
    });
  }
});
```

---

### 5. Performance Benchmarking

Tracks latency for each layer and displays warnings when thresholds are exceeded.

**Metrics:**

| Gear | Target Latency | Warning Threshold |
|------|---------------|------------------|
| Fast Gear (MONOLITHIC) | <5ms | 10ms |
| Fast Gear (MICROSERVICES) | <20ms | 50ms |
| Slow Gear (LLM) | 1-4s | 8s |

**Implementation:**

```javascript
const performanceMetrics = {
  fastGear: [],
  slowGear: []
};

/**
 * Log gear latency and trigger warning if threshold exceeded.
 * @param {string} gear - 'fast' or 'slow'
 * @param {number} latency - Latency in milliseconds
 * @param {string} operation - Operation name
 */
function logGearLatency(gear, latency, operation) {
  const DEBUG_MODE = world.getDynamicProperty('DEBUG_MODE');
  if (!DEBUG_MODE) return;
  
  const threshold = gear === 'fast' 
    ? (getAIMode() === 'MONOLITHIC' ? 10 : 50)
    : 8000;
  
  // Store metric
  performanceMetrics[gear === 'fast' ? 'fastGear' : 'slowGear'].push({
    operation,
    latency,
    timestamp: Date.now()
  });
  
  // Trim old metrics (keep last 100)
  if (performanceMetrics.fastGear.length > 100) {
    performanceMetrics.fastGear.shift();
  }
  if (performanceMetrics.slowGear.length > 100) {
    performanceMetrics.slowGear.shift();
  }
  
  // Warning if threshold exceeded
  if (latency > threshold) {
    const warningMsg = `§c[PERFORMANCE WARNING] ${gear.toUpperCase()} Gear: ${operation} took ${latency}ms (threshold: ${threshold}ms)`;
    world.sendMessage(warningMsg);
    logger.warn({ gear, operation, latency, threshold }, '[Debug] Performance threshold exceeded');
  } else {
    logger.debug({ gear, operation, latency }, '[Debug] Gear latency logged');
  }
}
```

**Usage in Layers:**

```javascript
// Layer 2 (Vectorization)
const startTime = Date.now();
const vector = calculateVector(event);
const latency = Date.now() - startTime;
logGearLatency('fast', latency, 'Layer2:Vectorization');

// Layer 6 (LLM Inference)
const startTime = Date.now();
const intent = await callLLM(prompt);
const latency = Date.now() - startTime;
logGearLatency('slow', latency, 'Layer6:LLM');
```

---

### 6. Debug Endpoints

#### GET /api/debug/status

Returns comprehensive system health and performance metrics.

```javascript
app.get('/api/debug/status', async (req, res) => {
  const DEBUG_MODE = getDebugMode();
  
  if (!DEBUG_MODE) {
    return res.status(403).json({ status: 'error', message: 'DEBUG_MODE not enabled' });
  }
  
  // Gather metrics
  const dbStats = await pool.query('SELECT COUNT(*) as episode_count FROM episodes');
  const villagerCount = await pool.query('SELECT COUNT(*) as count FROM villagers WHERE is_active = TRUE');
  const queueSize = brainScheduler.queue.length;
  
  // Calculate average latencies
  const avgFastGear = performanceMetrics.fastGear.reduce((sum, m) => sum + m.latency, 0) / performanceMetrics.fastGear.length || 0;
  const avgSlowGear = performanceMetrics.slowGear.reduce((sum, m) => sum + m.latency, 0) / performanceMetrics.slowGear.length || 0;
  
  res.json({
    status: 'success',
    debug_mode: DEBUG_MODE,
    ai_mode: getAIMode(),
    system_health: {
      database_connected: true,
      llm_connected: await checkLLMHealth(),
      active_villagers: villagerCount.rows[0].count,
      total_episodes: dbStats.rows[0].episode_count,
      queue_size: queueSize
    },
    performance: {
      fast_gear_avg: avgFastGear.toFixed(2) + 'ms',
      slow_gear_avg: avgSlowGear.toFixed(2) + 'ms',
      fast_gear_threshold: getAIMode() === 'MONOLITHIC' ? '10ms' : '50ms',
      slow_gear_threshold: '8000ms'
    },
    recent_warnings: getRecentWarnings(),
    timestamp: Date.now()
  });
});
```

---

#### GET /api/debug/villager/:villagerID

Returns detailed state for a specific villager.

```javascript
app.get('/api/debug/villager/:villagerID', async (req, res) => {
  const { villagerID } = req.params;
  const DEBUG_MODE = getDebugMode();
  
  if (!DEBUG_MODE) {
    return res.status(403).json({ status: 'error', message: 'DEBUG_MODE not enabled' });
  }
  
  // Fetch working memory
  const wm = await pool.query('SELECT * FROM working_memory WHERE villager_id = $1', [villagerID]);
  
  // Fetch recent episodes
  const episodes = await pool.query(
    'SELECT * FROM episodes WHERE villager_id = $1 ORDER BY timestamp DESC LIMIT 10',
    [villagerID]
  );
  
  // Fetch relationships
  const relationships = await pool.query(
    'SELECT * FROM relationships WHERE villager_id = $1 ORDER BY trust_score DESC',
    [villagerID]
  );
  
  // Fetch known concepts
  const concepts = await pool.query(
    `SELECT c.name, vd.discovery_method FROM villager_discoveries vd
     JOIN concepts c ON vd.concept_id = c.concept_id
     WHERE vd.villager_id = $1`,
    [villagerID]
  );
  
  // Fetch active build tasks
  const buildTasks = await pool.query(
    'SELECT * FROM build_tasks WHERE villager_id = $1 AND status IN ($2, $3)',
    [villagerID, 'pending', 'in_progress']
  );
  
  // Fetch recent inference traces (if stored)
  const inferences = inferenceTraceBuffer.get(villagerID) || [];
  
  res.json({
    status: 'success',
    villager: {
      id: villagerID,
      working_memory: wm.rows[0],
      recent_episodes: episodes.rows,
      relationships: relationships.rows,
      known_concepts: concepts.rows,
      active_build_tasks: buildTasks.rows,
      inference_traces: inferences
    },
    timestamp: Date.now()
  });
});
```

---

#### POST /api/debug/simulate_event

Manually inject events for testing (bypasses Layer 1 filtering).

```javascript
app.post('/api/debug/simulate_event', async (req, res) => {
  const DEBUG_MODE = getDebugMode();
  
  if (!DEBUG_MODE) {
    return res.status(403).json({ status: 'error', message: 'DEBUG_MODE not enabled' });
  }
  
  const { villagerID, eventType, eventData } = req.body;
  
  // Inject event directly into Layer 2
  const vector = await calculateVector({ type: eventType, ...eventData });
  
  // Force processing through full pipeline
  const episodeSummary = await forceEpisodeSeal(villagerID, [vector]);
  
  logger.info({ villagerID, eventType, vector }, '[Debug] Simulated event injected');
  
  res.json({
    status: 'success',
    vector,
    episodeSummary,
    message: 'Event simulated successfully'
  });
});
```

---

## Debug UI Modal (Script API)

### Opening Debug Menu

**Command:**
```
/scriptevent ai:debug_menu <villagerID>
```

**Implementation:**

```javascript
import { ActionFormData } from '@minecraft/server-ui';

system.afterEvents.scriptEventReceive.subscribe(async (event) => {
  if (event.id === 'ai:debug_menu') {
    const villagerID = event.message;
    const playerEntity = event.sourceEntity;
    
    if (!playerEntity) return;
    
    // Fetch villager debug data
    const response = await http.get(`http://localhost:3000/api/debug/villager/${villagerID}`);
    const data = JSON.parse(response.body);
    
    // Build UI form
    const form = new ActionFormData()
      .title(`§l§eDebug Menu: Villager ${villagerID}`)
      .body(`§7Current Mood:\n§fC: ${data.villager.working_memory.current_mood_manual[0].toFixed(2)}\n§fV: ${data.villager.working_memory.current_mood_manual[1].toFixed(2)}\n\n§7Recent Episodes: §f${data.villager.recent_episodes.length}\n§7Known Concepts: §f${data.villager.known_concepts.length}`)
      .button('View Recent Events')
      .button('View Inference Traces')
      .button('View Known Structures')
      .button('Simulate Event')
      .button('Close');
    
    const result = await form.show(playerEntity);
    
    if (result.selection === 0) {
      showRecentEventsUI(playerEntity, data.villager.recent_episodes);
    } else if (result.selection === 1) {
      showInferenceTracesUI(playerEntity, data.villager.inference_traces);
    } else if (result.selection === 2) {
      showKnownStructuresUI(playerEntity, villagerID);
    } else if (result.selection === 3) {
      showSimulateEventUI(playerEntity, villagerID);
    }
  }
});
```

---

## Inference Trace Buffer

Stores recent inference results for display in debug UI.

**Backend (In-Memory Buffer):**

```javascript
const inferenceTraceBuffer = new Map();  // villagerID → traces[]

/**
 * Add inference trace to buffer (DEBUG_MODE only).
 * @param {string} villagerID - Villager ID
 * @param {Object} trace - Trace data
 */
function addInferenceTrace(villagerID, trace) {
  if (!getDebugMode()) return;
  
  if (!inferenceTraceBuffer.has(villagerID)) {
    inferenceTraceBuffer.set(villagerID, []);
  }
  
  const traces = inferenceTraceBuffer.get(villagerID);
  traces.push({
    ...trace,
    timestamp: Date.now()
  });
  
  // Keep last 50 traces only
  if (traces.length > 50) {
    traces.shift();
  }
}

// Usage in Layer 3 (Intent Router)
const intent = await classifyIntent(eventDescription);
addInferenceTrace(villagerID, {
  layer: 'L3',
  model: 'DistilBERT',
  input: eventDescription,
  output: intent.label,
  confidence: intent.confidence
});
```

---

## Performance Warning System

### Warning Types

1. **Fast Gear Threshold Exceeded:** Layer 1-4 processing took >50ms
2. **Slow Gear Timeout:** LLM took >8 seconds
3. **Database Connection Failed:** PostgreSQL unreachable
4. **LLM Offline:** llama.cpp not responding
5. **Memory Leak Detected:** Working Memory sync failed 10+ times

**Warning Display:**

```javascript
/**
 * Broadcast performance warning to all admins.
 * @param {string} warningType - Warning category
 * @param {Object} details - Additional context
 */
function broadcastPerformanceWarning(warningType, details) {
  const DEBUG_MODE = world.getDynamicProperty('DEBUG_MODE');
  if (!DEBUG_MODE) return;
  
  const message = `§c[PERFORMANCE WARNING] §f${warningType}: §7${JSON.stringify(details)}`;
  
  // Send to all players with admin tag
  const admins = world.getAllPlayers().filter(p => p.hasTag('admin'));
  for (const admin of admins) {
    admin.sendMessage(message);
  }
  
  // Log to backend
  logger.warn({ warningType, details }, '[Debug] Performance warning triggered');
}
```

---

## Debug Logging Format

### Console Logs (Script API)

```javascript
// Layer 1 - Sensory Filter
[2026-03-03 14:32:15] [DEBUG] [Layer 1] Event detected { type: 'placeBlock', proximity: 8, hasLOS: true }

// Layer 2 - Vectorization
[2026-03-03 14:32:15] [DEBUG] [Layer 2] Vector calculated { C: 0.8, V: 0.9, I: 0.3, S: 0.7, X: 0.1 }

// Layer 3 - Sequencer
[2026-03-03 14:32:15] [DEBUG] [Layer 3] Episode sealed { reason: 'inactivity', duration: 30000, eventCount: 5 }

// Layer 4 - Working Memory
[2026-03-03 14:32:15] [DEBUG] [Layer 4] Working Memory updated { villagerID: 'villager-456', needsSync: true }
```

---

### Backend Logs (Pino)

```json
{
  "level": "DEBUG",
  "time": 1709480325000,
  "msg": "[Layer 5] Episode written to PostgreSQL",
  "villagerID": "villager-456",
  "episodeID": 45,
  "duration": 125
}

{
  "level": "DEBUG",
  "time": 1709480328000,
  "msg": "[Intent Router] Intent classified",
  "intent": "building",
  "confidence": 0.89,
  "shouldBypassLLM": false
}

{
  "level": "WARN",
  "time": 1709480330000,
  "msg": "[Debug] Performance threshold exceeded",
  "gear": "fast",
  "operation": "Layer2:MiniLM",
  "latency": 52,
  "threshold": 50
}
```

---

## Debug Commands Reference

### In-Game Commands

```
/scriptevent ai:toggle_debug true           # Enable DEBUG_MODE
/scriptevent ai:toggle_debug false          # Disable DEBUG_MODE
/scriptevent ai:toggle_mode microservices   # Switch to MICROSERVICES mode
/scriptevent ai:toggle_mode monolithic      # Switch to MONOLITHIC mode
/scriptevent ai:debug_menu <villagerID>     # Open debug UI for villager
/scriptevent ai:correct_concept <id>:<label> # Correct concept label
/scriptevent ai:highlight_structures        # Show particles at all recognized structures
```

---

### Backend Endpoints

```
GET  /api/debug/status                      # System health and metrics
GET  /api/debug/villager/:villagerID        # Detailed villager state
POST /api/debug/simulate_event              # Inject test event
POST /api/debug/correct_concept             # Re-label concept
GET  /api/debug/performance                 # Performance metrics
GET  /api/debug/inference_traces            # Recent AI inference logs
```

---

## Debug Data Retention

### In-Memory Buffers

All debug buffers are **memory-only** and cleared when DEBUG_MODE is disabled:

```javascript
function clearDebugBuffers() {
  inferenceTraceBuffer.clear();
  performanceMetrics.fastGear = [];
  performanceMetrics.slowGear = [];
  eventBuffer.clear();
  
  logger.info('[Debug] All debug buffers cleared');
}

// Automatically clear when DEBUG_MODE is toggled off
app.post('/api/config/debug_mode', (req, res) => {
  const { enabled } = req.body;
  
  if (!enabled) {
    clearDebugBuffers();
  }
  
  // ... rest of toggle logic
});
```

---

### Log Retention

**DEBUG_MODE Logs:**
- Stored in `logs/debug-{date}.log`
- Rotated daily
- Compressed after 7 days
- Deleted after 30 days

**Production Logs:**
- Stored in `logs/villager-ai.log`
- Rotated at 10MB
- Compressed after 3 days
- Deleted after 90 days

---

## Performance Impact

### DEBUG_MODE Overhead

| Component | Overhead (Enabled) | Overhead (Disabled) |
|-----------|-------------------|-------------------|
| Inference Logger | 1-2ms per event | 0ms |
| Vector Highlighting | 5-10ms per structure | 0ms |
| Trace Buffering | 0.5ms per inference | 0ms |
| Performance Logging | 0.5ms per operation | 0ms |
| **Total** | **7-13ms per event** | **0ms** |

**Recommendation:** Only enable DEBUG_MODE during development or troubleshooting.

---

## Debugging Workflows

### Workflow 1: Villager Not Responding

**Symptoms:**
- Villager observes events but doesn't speak
- No ActionBar messages appear

**Debug Steps:**
1. Enable DEBUG_MODE: `/scriptevent ai:toggle_debug true`
2. Check Layer 1 logs: Are events being filtered?
3. Check Layer 4 logs: Is Working Memory updating?
4. Check Layer 5 logs: Are episodes being written to database?
5. Check Layer 6 logs: Is LLM returning intents?
6. Check Layer 7 logs: Is polling successful?
7. View debug status: `GET /api/debug/status`

**Common Causes:**
- LLM offline (check `http://localhost:8080/health`)
- Database connection lost (check pg-pool)
- Episode not sealing (check seal conditions)

---

### Workflow 2: Villager Mislabeling Structures

**Symptoms:**
- Villager calls a "Tower" a "House"
- Recognition confidence is low (<85%)

**Debug Steps:**
1. View recognized structure: Particle effect should appear at anchor point
2. Check similarity score in console logs
3. Correct label: `/scriptevent ai:correct_concept <conceptID>:Tower`
4. Re-observe structure (walk villager near it)
5. Verify new recognition with particle effect

---

### Workflow 3: Fast Gear Performance Degradation

**Symptoms:**
- Performance warnings in console
- Game TPS drops below 18

**Debug Steps:**
1. Check performance metrics: `GET /api/debug/performance`
2. Identify slowest operations (sort by latency)
3. If Layer 2 (MiniLM) is slow: Check if embeddings are being cached in concepts table (query count)
4. If Layer 3 (Intent Router) is slow: Reduce event frequency
5. Switch to MONOLITHIC mode temporarily: `/scriptevent ai:toggle_mode monolithic`

---

## Debug Configuration

### Environment Variables

```env
# Debug System Configuration
DEBUG_MODE=false              # Enable debug features
DEBUG_LOG_LEVEL=debug         # Pino log level when DEBUG_MODE=true
DEBUG_INFERENCE_TRACES=true   # Store inference traces in memory
DEBUG_PARTICLE_EFFECTS=true   # Show particle effects at recognized structures
DEBUG_ACTIONBAR_TRACES=true   # Display inference paths on ActionBar
DEBUG_PERFORMANCE_WARNINGS=true # Broadcast performance warnings
```

---

### In-Game HUD (ActionBar)

When DEBUG_MODE is enabled, ActionBar shows real-time AI activity:

**Format:**
```
[Layer X] [Model] → Result (Confidence%)
```

**Examples:**
```
§7L2: §e[MiniLM] §7→ §fEmbedding(384D) §a(100%)
§7L3: §e[DistilBERT] §7→ §fIntent: Building §a(92%)
§7L3: §e[Sequencer] §7→ §fEpisode Sealed: inactivity §a(100%)
§7L6: §e[Llama.cpp] §7→ §fAction: speak §a(95%)
§7L7: §e[Action Layer] §7→ §fExecuting: speak §a(100%)
```

---

## Testing & Validation

### Debug Test Suite

**Test 1: Inference Pipeline**
```javascript
// Simulate event and verify all layers process correctly
const testEvent = { type: 'placeBlock', blockType: 'diamond_block', actor: 'test-player' };
await simulateEvent('test-villager', testEvent);

// Expected output:
// - Layer 1 log: Event filtered
// - Layer 2 log: Vector calculated
// - Layer 3 log: Episode sealed
// - Layer 6 log: LLM inference complete
// - Layer 7 log: Intent executed
```

**Test 2: Structure Recognition**
```javascript
// Place known structure and verify recognition
await placeTestStructure('oak_wall_segment', { x: 100, y: 64, z: 0 });
await waitForRecognition('test-villager', 5000);

// Expected output:
// - Particle effect at (100, 64, 0)
// - Console log: "Structure recognized: oak_wall_segment (95%)"
// - villager_world_map entry created
```

**Test 3: Performance Benchmarking**
```javascript
// Generate 100 events in 1 second
for (let i = 0; i < 100; i++) {
  await simulateEvent('test-villager', { type: 'placeBlock', blockType: 'dirt' });
}

// Expected output:
// - Average Fast Gear latency: <20ms (MICROSERVICES) or <5ms (MONOLITHIC)
// - No performance warnings
// - TPS remains at 20
```

---

## Future Debug Features (Post-MVP)

1. **Visual Debugger:** 3D overlay showing villager's perceived world (ghost blocks, recognized structures)
2. **Brain Inspector:** Step-by-step visualization of LLM reasoning (internal monologue)
3. **Memory Browser:** Interactive UI to explore villager's subjective knowledge graph
4. **Time Travel:** Replay villager's past decisions (episode playback)
5. **A/B Testing:** Compare MONOLITHIC vs MICROSERVICES performance side-by-side

---

**Document Type:** Debug System Reference  
**Phase:** Phase 1 MVP (Functional)  
**Status:** Production Ready  
**Version:** 1.0  
**Last Updated:** Mar 3, 2026
