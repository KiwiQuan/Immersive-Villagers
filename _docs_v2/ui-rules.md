# 🎨 UI Rules — Debug Interface Specifications

> **Purpose:** Technical specifications for all debug UI components, forms, and chat commands for the Immersive Villagers AI system.  
> **Last Updated:** March 15, 2026  
> **Module:** `@minecraft/server-ui`

---

## 1. Core UI Constraints

### Module Capabilities (@minecraft/server-ui)

**Available Form Types:**
- `ActionFormData` — Button list menus (navigation)
- `ModalFormData` — Input forms (settings, inspection)
- `MessageFormData` — Two-button confirmations

**Critical Limitations:**
- ❌ No real-time updates (forms are modal/blocking)
- ❌ No charts, graphs, or visualizations
- ❌ No tabbed layouts or multi-panel dashboards
- ❌ No custom HTML/CSS rendering
- ❌ No expandable sections or accordions
- ✅ Only static text, buttons, toggles, sliders, dropdowns, text fields

**Design Strategy:**
- **Forms** for static snapshots and configuration
- **Chat Commands** for real-time monitoring and live data streams

---

## 2. Form Architecture

### Hierarchy Pattern

```
Main Debug Menu (ActionFormData)
    ↓
Category Submenus (ActionFormData)
    ↓
Data Inspection Forms (ModalFormData)
    ↓
Configuration Settings (ModalFormData)
    ↓
Confirmation Dialogs (MessageFormData)
```

### Navigation Flow

```
!debug menu
    ↓
┌─────────────────────────────────────────────┐
│ 🧠 Villager Debug Menu                     │
│ ────────────────────────────────────────    │
│ [🧠 Brain Monitor]                          │
│ [💭 Working Memory]                         │
│ [🤖 LLM Context]                            │
│ [❤️ Relationships]                          │
│ [⚡ Performance]                            │
│ [🏗️ Structures]                             │
│ [⚙️ Settings]                               │
└─────────────────────────────────────────────┘
```

---

## 3. Form Specifications

### Form 1: Main Debug Menu

**Type:** `ActionFormData`  
**Trigger:** Chat command `!debug menu` or `/scriptevent debug:menu`  
**Purpose:** Top-level navigation hub

**Implementation:**

```javascript
/**
 * Main debug menu navigation
 * @param {Player} player - The player viewing the menu
 */
function showMainDebugMenu(player) {
  const form = new ActionFormData()
    .title("§l§6🧠 Villager Debug Menu")
    .body("§7Select a debug category:")
    .button("§l§b🧠 Brain Monitor\n§r§7Layer status & pipeline", "textures/icons/brain")
    .button("§l§d💭 Working Memory\n§r§7Current state & mood", "textures/icons/memory")
    .button("§l§a🤖 LLM Context\n§r§7Prompts & responses", "textures/icons/llm")
    .button("§l§c❤️ Relationships\n§r§7Trust scores & history", "textures/icons/heart")
    .button("§l§e⚡ Performance\n§r§7Tick budget & metrics", "textures/icons/graph")
    .button("§l§6🏗️ Structures\n§r§7Learned patterns & builds", "textures/icons/structure")
    .button("§l§8⚙️ Settings\n§r§7Configure debug options", "textures/icons/settings");
  
  form.show(player).then((response) => {
    if (response.canceled) return;
    
    const menuHandlers = [
      showBrainMonitor,
      showWorkingMemory,
      showLLMContext,
      showRelationships,
      showPerformance,
      showStructures,
      showSettings
    ];
    
    menuHandlers[response.selection]?.(player);
  });
}
```

**Design Rules:**
- Use color codes (`§l` bold, `§7` gray) for visual hierarchy
- Include icons via resource pack paths
- Two-line button format: Title + Description
- Always handle `response.canceled` (player pressed ESC)

---

### Form 2: Villager Selector

**Type:** `ModalFormData`  
**Purpose:** Select which villager to inspect (used across all submenus)

**Implementation:**

```javascript
/**
 * Villager selector form (used as first step in most debug flows)
 * @param {Player} player - The player viewing the menu
 * @param {Function} callback - Function to call with selected villager ID
 */
function showVillagerSelector(player, callback) {
  const trackedVillagers = getTrackedVillagersList(); // From cache
  
  if (trackedVillagers.length === 0) {
    player.sendMessage("§c⚠ No villagers are currently tracked");
    return;
  }
  
  const villagerLabels = trackedVillagers.map(v => 
    `${v.name || 'Unnamed'} (ID: ${v.id.substring(0, 8)}) - ${v.currentEpisode || 'Idle'}`
  );
  
  const form = new ModalFormData()
    .title("§l§6Select Villager")
    .dropdown("§bChoose a villager to inspect:", villagerLabels, 0);
  
  form.show(player).then((response) => {
    if (response.canceled) return;
    const selectedIndex = response.formValues[0];
    const selectedVillager = trackedVillagers[selectedIndex];
    callback(player, selectedVillager.id);
  });
}
```

**Data Source:** `trackedVillagers` Map (in-memory cache)

---

### Form 3: Brain Monitor

**Type:** `ModalFormData`  
**Purpose:** Display all 7 layers' current status and timing metrics

**Implementation:**

```javascript
/**
 * Brain monitor - shows layer pipeline status
 * @param {Player} player - The player viewing the menu
 */
function showBrainMonitor(player) {
  showVillagerSelector(player, (player, villagerId) => {
    const layerStatus = getLayerStatus(villagerId);
    const aiMode = getGlobalAIMode(); // MONOLITHIC or MICROSERVICES
    
    const form = new ModalFormData()
      .title(`§l§6🧠 Brain Monitor - ${getVillagerName(villagerId)}`)
      .header(`§7AI Mode: §b${aiMode}`)
      .divider()
      .label(`§aL1 (Sensory): §7${layerStatus.L1.status} - ${layerStatus.L1.eventsPerSec} events/sec`)
      .label(`§aL2 (Perception): §7${layerStatus.L2.status} - ${layerStatus.L2.avgLatency}ms avg`)
      .label(`§aL3 (Sequencer): §7${layerStatus.L3.status} - Buffer ${layerStatus.L3.bufferDepth}/20`)
      .label(`§aL4 (Working Memory): §7${layerStatus.L4.status} - ${layerStatus.L4.pendingWrites} pending writes`)
      .label(`§aL5 (Long-Term Memory): §7${layerStatus.L5.status} - Last query: ${layerStatus.L5.lastQueryTime}`)
      .label(`§aL6 (Language Cortex): §7${layerStatus.L6.status} - Queue: ${layerStatus.L6.queueDepth} requests`)
      .label(`§aL7 (Action Layer): §7${layerStatus.L7.status} - Current: ${layerStatus.L7.currentAction}`)
      .divider()
      .label(`§eTotal Latency: §7${layerStatus.totalLatency}ms (${aiMode === 'MICROSERVICES' ? 'Fast' : 'Standard'})`)
      .toggle("§bAuto-refresh every 2s", false);
    
    form.show(player).then((response) => {
      if (response.canceled) return;
      
      const autoRefresh = response.formValues[0];
      if (autoRefresh) {
        startAutoRefreshMonitor(player, villagerId);
      }
    });
  });
}
```

**Data Fields:**
- Layer status: `active` | `idle` | `processing` | `error`
- Timing metrics: `avgLatency`, `eventsPerSec`, `queueDepth`
- Current operations: `currentAction`, `bufferDepth`

---

### Form 4: Working Memory Inspector

**Type:** `ModalFormData`  
**Purpose:** Display current episode, mood vector, flashbulb events, and sync status

**Implementation:**

```javascript
/**
 * Working Memory inspector - Layer 4 state viewer
 * @param {Player} player - The player viewing the menu
 */
function showWorkingMemory(player) {
  showVillagerSelector(player, (player, villagerId) => {
    const wm = getWorkingMemoryFromCache(villagerId); // From trackedVillagers Map
    const aiMode = getGlobalAIMode();
    
    // Format mood vector based on AI mode
    const moodDisplay = aiMode === 'MONOLITHIC' 
      ? `C:${wm.C.toFixed(2)} V:${wm.V.toFixed(2)} I:${wm.I.toFixed(2)} S:${wm.S.toFixed(2)} X:${wm.X.toFixed(2)}`
      : `[384D Vector] Top 3: ${wm.embedding.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...`;
    
    // Format flashbulb events
    const flashbulbDisplay = wm.flashbulbEvents.length > 0
      ? wm.flashbulbEvents.map(e => `${e.type} (${e.decayTime}ms remaining)`).join('\n')
      : 'None';
    
    const form = new ModalFormData()
      .title(`§l§d💭 Working Memory - ${getVillagerName(villagerId)}`)
      .header("§l§6Current State")
      .textField("§bEpisode:", wm.currentEpisode || "Idle", wm.currentEpisode || "Idle")
      .textField("§bActive Focus:", JSON.stringify(wm.activeFocus), JSON.stringify(wm.activeFocus))
      .divider()
      .header("§l§6Emotional State")
      .textField("§bMood Vector:", moodDisplay, moodDisplay)
      .textField("§bMood Label:", deriveMoodLabel(wm), deriveMoodLabel(wm))
      .divider()
      .header("§l§6Flashbulb Events (Recent Shocks)")
      .textField("§bActive Events:", flashbulbDisplay, flashbulbDisplay)
      .divider()
      .header("§l§6Sync Status")
      .toggle("§aCache → DP Synced", !wm.needsDPSync)
      .toggle("§aCache → DB Synced", !wm.needsDBSync)
      .textField("§bLast Update:", `${Date.now() - wm.lastUpdate}ms ago`, "")
      .slider("§bMemorability Score:", 0, 100, 1, Math.round(calculateMemorabilityScore(wm) * 100));
    
    form.show(player).then((response) => {
      if (response.canceled) return;
      // Form is read-only (display only), no action needed
    });
  });
}

/**
 * Derive human-readable mood label from vector
 * @param {Object} wm - Working Memory object
 * @returns {string} Mood label
 */
function deriveMoodLabel(wm) {
  const { C, V, I, S, X } = wm;
  
  if (I > 0.7 && S < -0.3) return "Angry/Threatened";
  if (C > 0.6 && S > 0.6) return "Happy & Constructive";
  if (V > 0.7 && I < 0.3) return "Curious/Interested";
  if (S > 0.8) return "Friendly/Social";
  return "Neutral/Calm";
}
```

**Display Format Rules:**
- Use text fields for read-only data (prevent accidental edits with default value)
- Use toggles for boolean status (visual checkmarks)
- Use sliders for numeric ranges (0-100 scores)
- Format floats to 2 decimal places
- Truncate long strings to 50 characters + "..."

---

### Form 5: LLM Context Viewer

**Type:** `ModalFormData`  
**Purpose:** Show last LLM prompt, response, and inference metrics

**Implementation:**

```javascript
/**
 * LLM context viewer - Layer 6 debugging
 * @param {Player} player - The player viewing the menu
 */
function showLLMContext(player) {
  showVillagerSelector(player, (player, villagerId) => {
    const llmData = getLastLLMContext(villagerId); // From Layer 6 logs
    const aiMode = getGlobalAIMode();
    
    if (!llmData) {
      player.sendMessage("§c⚠ No LLM data available for this villager");
      return;
    }
    
    // Truncate prompt for display (max 500 chars)
    const promptPreview = llmData.prompt.length > 500 
      ? llmData.prompt.substring(0, 500) + "..."
      : llmData.prompt;
    
    const form = new ModalFormData()
      .title(`§l§a🤖 LLM Context - ${getVillagerName(villagerId)}`)
      .header(`§7AI Mode: §b${aiMode}`)
      .divider()
      .header("§l§6Last LLM Call")
      .textField("§bPrompt Preview:", promptPreview, promptPreview)
      .textField("§bToken Count:", `${llmData.tokenCount} tokens`, "")
      .textField("§bInference Time:", `${llmData.inferenceTime}s`, "")
      .divider()
      .header("§l§6LLM Response")
      .textField("§bThought:", llmData.thought, llmData.thought)
      .textField("§bSpeech:", llmData.speech, llmData.speech)
      .textField("§bAction:", llmData.action, llmData.action)
      .divider()
      .header("§l§6Scheduler Status")
      .slider("§bQueue Depth:", 0, 20, 1, llmData.queueDepth)
      .textField("§bPriority:", `${llmData.priority} (${getPriorityLabel(llmData.priority)})`, "")
      .toggle("§bBatched Request", llmData.wasBatched);
    
    // Add MICROSERVICES-specific data
    if (aiMode === 'MICROSERVICES' && llmData.intentClassification) {
      form
        .divider()
        .header("§l§6Fast Intent Router")
        .textField("§bIntent Label:", llmData.intentClassification.label, "")
        .slider("§bConfidence:", 0, 100, 1, Math.round(llmData.intentClassification.confidence * 100))
        .toggle("§bFast-Routed (Bypassed LLM)", llmData.intentClassification.fastRouted);
    }
    
    form.show(player).then((response) => {
      if (response.canceled) return;
    });
  });
}

/**
 * Convert priority score to human-readable label
 * @param {number} priority - Priority score (0-100)
 * @returns {string} Priority label
 */
function getPriorityLabel(priority) {
  if (priority >= 100) return "CRITICAL";
  if (priority >= 70) return "SOCIAL";
  if (priority >= 40) return "NOVELTY";
  return "ROUTINE";
}
```

---

### Form 6: Relationships Matrix

**Type:** `ActionFormData` (List of players) → `ModalFormData` (Details)  
**Purpose:** Display trust scores, interaction counts, and episode history per player

**Implementation:**

```javascript
/**
 * Relationships matrix - Layer 5 relationship viewer
 * @param {Player} player - The player viewing the menu
 */
function showRelationships(player) {
  showVillagerSelector(player, async (player, villagerId) => {
    const relationships = await fetchRelationships(villagerId); // From PostgreSQL
    
    if (relationships.length === 0) {
      player.sendMessage("§c⚠ This villager has no recorded relationships");
      return;
    }
    
    // First form: Select player
    const playerButtons = relationships.map(r => {
      const trustLevel = getTrustLevel(r.trust_score);
      const emoji = getTrustEmoji(r.trust_score);
      return `${emoji} ${r.actor_name}\n§7Trust: ${r.trust_score.toFixed(2)} (${trustLevel}) | ${r.interaction_count} interactions`;
    });
    
    const form = new ActionFormData()
      .title(`§l§c❤️ Relationships - ${getVillagerName(villagerId)}`)
      .body("§7Select a player to view detailed history:");
    
    playerButtons.forEach(label => form.button(label));
    
    form.show(player).then(async (response) => {
      if (response.canceled) return;
      
      const selectedRelationship = relationships[response.selection];
      showRelationshipDetails(player, villagerId, selectedRelationship);
    });
  });
}

/**
 * Relationship details form (second level)
 * @param {Player} player - The player viewing the menu
 * @param {string} villagerId - The villager ID
 * @param {Object} relationship - Relationship data
 */
async function showRelationshipDetails(player, villagerId, relationship) {
  const recentEpisodes = await fetchRecentEpisodesWithPlayer(villagerId, relationship.actor_id, 5);
  
  const episodeText = recentEpisodes.map((ep, i) => 
    `${i+1}. ${ep.concept_name} (${formatDuration(ep.duration)}) - ${formatTimestamp(ep.timestamp)}`
  ).join('\n');
  
  const form = new ModalFormData()
    .title(`§l§c❤️ ${relationship.actor_name} → ${getVillagerName(villagerId)}`)
    .header("§l§6Trust Metrics")
    .slider("§bTrust Score:", -100, 100, 1, Math.round(relationship.trust_score * 100))
    .textField("§bTrust Level:", getTrustLevel(relationship.trust_score), "")
    .textField("§bTotal Interactions:", `${relationship.interaction_count}`, "")
    .textField("§bLast Interaction:", formatTimestamp(relationship.last_interaction), "")
    .divider()
    .header("§l§6Recent Episodes")
    .textField("§bLast 5 Interactions:", episodeText, episodeText);
  
  form.show(player);
}

/**
 * Get trust level label from score
 * @param {number} score - Trust score (-1.0 to 1.0)
 * @returns {string} Trust level
 */
function getTrustLevel(score) {
  if (score > 0.8) return "Loyal";
  if (score > 0.5) return "Friendly";
  if (score > 0.0) return "Neutral";
  if (score > -0.5) return "Distrustful";
  return "Hostile";
}

/**
 * Get emoji based on trust score
 * @param {number} score - Trust score (-1.0 to 1.0)
 * @returns {string} Emoji
 */
function getTrustEmoji(score) {
  if (score > 0.8) return "💚";
  if (score > 0.5) return "💙";
  if (score > 0.0) return "💛";
  if (score > -0.5) return "🧡";
  return "❤️";
}
```

**Data Source:** PostgreSQL `relationships` table + `episodes` table

---

### Form 7: Performance Monitor

**Type:** `ModalFormData`  
**Purpose:** Show tick budget consumption, layer timing, and bottleneck detection

**Implementation:**

```javascript
/**
 * Performance monitor - tick budget and timing analysis
 * @param {Player} player - The player viewing the menu
 */
function showPerformance(player) {
  const perfData = getPerformanceMetrics(); // Global metrics
  const tickBudget = 50; // 50ms per tick (20 TPS)
  const fastGearBudget = 15; // 15ms budget for Fast Gear
  
  const form = new ModalFormData()
    .title("§l§e⚡ Performance Monitor")
    .header("§l§6Fast Gear (Layers 1-4)")
    .slider("§bTotal Tick Cost:", 0, tickBudget, 1, perfData.fastGearTotalMs)
    .textField("§bBudget Usage:", `${perfData.fastGearTotalMs}ms / ${fastGearBudget}ms (${Math.round(perfData.fastGearTotalMs/fastGearBudget*100)}%)`, "")
    .textField("§bTracked Villagers:", `${perfData.trackedVillagerCount}`, "")
    .textField("§bAvg Cost/Villager:", `${perfData.avgCostPerVillager.toFixed(2)}ms`, "")
    .divider()
    .header("§l§6Slow Gear (Layers 5-7)")
    .textField("§bLLM Queue Depth:", `${perfData.llmQueueDepth} requests`, "")
    .textField("§bAvg LLM Wait Time:", `${perfData.avgLLMWaitTime.toFixed(1)}s`, "")
    .textField("§bThroughput:", `${perfData.llmThroughput.toFixed(2)} req/sec`, "")
    .textField("§bBatch Efficiency:", `${perfData.batchEfficiency}% (requests saved)`, "")
    .divider()
    .header("§l§6Layer Breakdown")
    .slider("§bL1 (Sensory):", 0, 10, 1, Math.round(perfData.layers.L1))
    .slider("§bL2 (Perception):", 0, 25, 1, Math.round(perfData.layers.L2))
    .slider("§bL3 (Sequencer):", 0, 10, 1, Math.round(perfData.layers.L3))
    .slider("§bL4 (Working Memory):", 0, 5, 1, Math.round(perfData.layers.L4))
    .divider()
    .toggle("§c⚠ Budget Exceeded", perfData.fastGearTotalMs > fastGearBudget);
  
  form.show(player);
}
```

**Warning Thresholds:**
- Fast Gear > 15ms → Display red warning
- LLM Queue > 10 → Display yellow warning
- Batch efficiency < 30% → Suggest optimization

---

### Form 8: Structure Learning Inspector

**Type:** `ActionFormData` (Template list) → `ModalFormData` (Details)  
**Purpose:** Display learned structure templates, build tasks, and pattern observations

**Implementation:**

```javascript
/**
 * Structure learning inspector
 * @param {Player} player - The player viewing the menu
 */
function showStructures(player) {
  showVillagerSelector(player, async (player, villagerId) => {
    const templates = await fetchLearnedTemplates(villagerId); // From structure_templates table
    
    if (templates.length === 0) {
      player.sendMessage("§c⚠ This villager hasn't learned any structures yet");
      return;
    }
    
    // First form: Select template
    const templateButtons = templates.map(t => 
      `§l${t.label}\n§7${t.dimensions.x}x${t.dimensions.y}x${t.dimensions.z} | Seen ${t.observation_count}x`
    );
    
    const form = new ActionFormData()
      .title(`§l§6🏗️ Learned Structures - ${getVillagerName(villagerId)}`)
      .body("§7Select a structure template:");
    
    templateButtons.forEach(label => form.button(label, "textures/icons/structure"));
    form.button("§l§8📝 Active Build Tasks", "textures/icons/task");
    
    form.show(player).then(async (response) => {
      if (response.canceled) return;
      
      // Last button is "Active Build Tasks"
      if (response.selection === templates.length) {
        showActiveBuildTasks(player, villagerId);
      } else {
        const selectedTemplate = templates[response.selection];
        showTemplateDetails(player, villagerId, selectedTemplate);
      }
    });
  });
}

/**
 * Template details form
 * @param {Player} player - The player viewing the menu
 * @param {string} villagerId - The villager ID
 * @param {Object} template - Template data
 */
function showTemplateDetails(player, villagerId, template) {
  const form = new ModalFormData()
    .title(`§l§6🏗️ ${template.label}`)
    .header("§l§6Template Info")
    .textField("§bTemplate ID:", `${template.id}`, "")
    .textField("§bDimensions:", `${template.dimensions.x}x${template.dimensions.y}x${template.dimensions.z}`, "")
    .textField("§bPattern Hash:", template.pattern_hash.substring(0, 50) + "...", "")
    .textField("§bObservation Count:", `${template.observation_count}`, "")
    .textField("§bCreated By:", template.created_by || "Unknown", "")
    .divider()
    .header("§l§6Instructions Preview")
    .textField("§bBlock Count:", `${template.instructions.blocks.length} blocks`, "")
    .textField("§bMaterial Types:", template.instructions.materials.join(', '), "")
    .divider()
    .header("§l§6AI Mode Data")
    .toggle("§bHas Manual Vector (5D)", template.semantic_vector_manual !== null)
    .toggle("§bHas MiniLM Embedding (384D)", template.semantic_vector_minilm !== null);
  
  form.show(player);
}

/**
 * Active build tasks viewer
 * @param {Player} player - The player viewing the menu
 * @param {string} villagerId - The villager ID
 */
async function showActiveBuildTasks(player, villagerId) {
  const tasks = await fetchActiveBuildTasks(villagerId); // From build_tasks table
  
  if (tasks.length === 0) {
    player.sendMessage("§a✓ No active build tasks");
    return;
  }
  
  const task = tasks[0]; // Show first task only
  const progressPercent = Math.round((task.current_step / task.total_steps) * 100);
  
  const form = new ModalFormData()
    .title(`§l§6📝 Active Build Task`)
    .header("§l§6Task Info")
    .textField("§bTemplate:", task.template_name, "")
    .textField("§bStatus:", task.status, "")
    .slider("§bProgress:", 0, 100, 1, progressPercent)
    .textField("§bBlocks Placed:", `${task.current_step} / ${task.total_steps}`, "")
    .textField("§bAnchor Location:", `[${task.anchor_x}, ${task.anchor_y}, ${task.anchor_z}]`, "")
    .textField("§bTrigger Source:", task.trigger_source, "")
    .textField("§bStarted:", formatTimestamp(task.started_at), "");
  
  form.show(player);
}
```

---

### Form 9: Settings & Configuration

**Type:** `ModalFormData`  
**Purpose:** Configure debug settings, AI mode, and feature toggles

**Implementation:**

```javascript
/**
 * Debug settings configuration
 * @param {Player} player - The player viewing the menu
 */
async function showSettings(player) {
  const currentSettings = await fetchDebugSettings(); // From database or config
  const aiMode = getGlobalAIMode();
  
  const form = new ModalFormData()
    .title("§l§8⚙️ Debug Settings")
    .header("§l§6AI Configuration")
    .dropdown("§bAI Mode:", ["MONOLITHIC", "MICROSERVICES"], aiMode === 'MICROSERVICES' ? 1 : 0)
    .divider()
    .header("§l§6Debug Features")
    .toggle("§bVerbose Chat Logging", currentSettings.verboseLogging)
    .toggle("§bShow Layer Timings in Chat", currentSettings.showTimings)
    .toggle("§bAuto-Notify on Bottleneck", currentSettings.autoNotifyBottleneck)
    .toggle("§bLog LLM Prompts to Console", currentSettings.logLLMPrompts)
    .divider()
    .header("§l§6Performance Limits")
    .slider("§bMax LLM Queue Depth:", 1, 20, 1, currentSettings.maxLLMQueueDepth)
    .slider("§bFast Gear Budget (ms):", 5, 25, 1, currentSettings.fastGearBudget)
    .slider("§bChat Update Frequency (ticks):", 10, 100, 10, currentSettings.chatUpdateFrequency)
    .divider()
    .submitButton("§l§a✓ Apply Settings");
  
  form.show(player).then(async (response) => {
    if (response.canceled) return;
    
    const [newAIMode, verboseLogging, showTimings, autoNotify, logLLM, maxQueue, budget, frequency] = response.formValues;
    
    // Apply AI mode change
    const selectedMode = newAIMode === 0 ? 'MONOLITHIC' : 'MICROSERVICES';
    if (selectedMode !== aiMode) {
      await setAIMode(selectedMode);
      player.sendMessage(`§a✓ AI Mode switched to ${selectedMode}`);
    }
    
    // Apply other settings
    await updateDebugSettings({
      verboseLogging,
      showTimings,
      autoNotifyBottleneck: autoNotify,
      logLLMPrompts: logLLM,
      maxLLMQueueDepth: maxQueue,
      fastGearBudget: budget,
      chatUpdateFrequency: frequency
    });
    
    player.sendMessage("§a✓ Debug settings updated");
  });
}
```

---

## 4. Chat Command System

### Command Syntax Specification

**Base Command:** `!debug <category> [subcommand] [args]`

**Alternative Trigger:** `/scriptevent debug:<category>:<subcommand>` (for command blocks)

### Command Categories

| Category | Subcommands | Description | Output Type |
|----------|-------------|-------------|-------------|
| `brain` | `status`, `layers`, `timing` | Layer pipeline status | Chat (multi-line) |
| `memory` | `current`, `flashbulbs`, `sync` | Working Memory state | Chat (formatted) |
| `llm` | `last`, `queue`, `history` | LLM context and queue | Chat (JSON-like) |
| `perf` | `summary`, `layers`, `bottleneck` | Performance metrics | Chat (table) |
| `watch` | `mood`, `episode`, `focus` | Live state updates | Chat (streaming) |
| `villager` | `list`, `select <id>`, `info` | Villager management | Chat (list) |
| `menu` | - | Open main form menu | Form (ActionFormData) |

---

### Command Implementations

#### Command 1: Brain Status

**Syntax:** `!debug brain status`  
**Purpose:** Quick snapshot of all layer states

**Output Format:**

```javascript
/**
 * Display brain status in chat
 * @param {Player} player - The player requesting status
 */
function handleBrainStatus(player) {
  const villagerId = getPlayerFocusedVillager(player); // From player context
  const layerStatus = getLayerStatus(villagerId);
  const aiMode = getGlobalAIMode();
  
  player.sendMessage("§6═══ Brain Status ═══");
  player.sendMessage(`§7Villager: §b${getVillagerName(villagerId)}`);
  player.sendMessage(`§7AI Mode: §b${aiMode}`);
  player.sendMessage("");
  player.sendMessage(`§aL1 (Sensory)    : ${getStatusEmoji(layerStatus.L1.status)} ${layerStatus.L1.eventsPerSec} events/sec`);
  player.sendMessage(`§aL2 (Perception) : ${getStatusEmoji(layerStatus.L2.status)} ${layerStatus.L2.avgLatency}ms avg`);
  player.sendMessage(`§aL3 (Sequencer)  : ${getStatusEmoji(layerStatus.L3.status)} Buffer ${layerStatus.L3.bufferDepth}/20`);
  player.sendMessage(`§aL4 (Working Mem): ${getStatusEmoji(layerStatus.L4.status)} ${layerStatus.L4.pendingWrites} writes pending`);
  player.sendMessage(`§aL5 (Long-Term)  : ${getStatusEmoji(layerStatus.L5.status)} Last query: ${layerStatus.L5.lastQueryTime}`);
  player.sendMessage(`§aL6 (Language)   : ${getStatusEmoji(layerStatus.L6.status)} Queue: ${layerStatus.L6.queueDepth}`);
  player.sendMessage(`§aL7 (Action)     : ${getStatusEmoji(layerStatus.L7.status)} ${layerStatus.L7.currentAction}`);
  player.sendMessage("");
  player.sendMessage(`§eTPS: §7${perfData.currentTPS.toFixed(1)} | §eLatency: §7${layerStatus.totalLatency}ms`);
}

/**
 * Get emoji for status indicator
 * @param {string} status - Layer status
 * @returns {string} Status emoji
 */
function getStatusEmoji(status) {
  const emojiMap = {
    'active': '🟢',
    'idle': '⚪',
    'processing': '🟡',
    'error': '🔴',
    'waiting': '🔵'
  };
  return emojiMap[status] || '⚪';
}
```

**Best Practice:** Use aligned columns for readability (pad layer names)

---

#### Command 2: Working Memory

**Syntax:** `!debug memory current`  
**Purpose:** Display Layer 4 state snapshot

**Output Format:**

```javascript
/**
 * Display Working Memory in chat
 * @param {Player} player - The player requesting memory
 */
function handleMemoryCurrent(player) {
  const villagerId = getPlayerFocusedVillager(player);
  const wm = getWorkingMemoryFromCache(villagerId);
  const aiMode = getGlobalAIMode();
  
  player.sendMessage("§6═══ Working Memory ═══");
  player.sendMessage(`§7Villager: §b${getVillagerName(villagerId)}`);
  player.sendMessage("");
  player.sendMessage(`§l§dCurrent Episode:`);
  player.sendMessage(`§7${wm.currentEpisode || 'Idle'}`);
  player.sendMessage("");
  player.sendMessage(`§l§dActive Focus:`);
  player.sendMessage(`§7Type: ${wm.activeFocus.type} | ID: ${wm.activeFocus.id}`);
  player.sendMessage("");
  player.sendMessage(`§l§dMood Vector (${aiMode}):`);
  
  if (aiMode === 'MONOLITHIC') {
    player.sendMessage(`§7C: ${wm.C.toFixed(2)} §8(Constructiveness)`);
    player.sendMessage(`§7V: ${wm.V.toFixed(2)} §8(Value)`);
    player.sendMessage(`§7I: ${wm.I.toFixed(2)} §8(Intensity)`);
    player.sendMessage(`§7S: ${wm.S.toFixed(2)} §8(Sociality)`);
    player.sendMessage(`§7X: ${wm.X.toFixed(2)} §8(Complexity)`);
    player.sendMessage(`§7Mood: ${deriveMoodLabel(wm)}`);
  } else {
    player.sendMessage(`§7[384D Embedding] - Top 5 values:`);
    wm.embedding.slice(0, 5).forEach((val, i) => {
      player.sendMessage(`§7  [${i}]: ${val.toFixed(3)}`);
    });
  }
  
  player.sendMessage("");
  player.sendMessage(`§l§dFlashbulb Events:`);
  if (wm.flashbulbEvents.length === 0) {
    player.sendMessage(`§7None`);
  } else {
    wm.flashbulbEvents.forEach((event, i) => {
      player.sendMessage(`§7${i+1}. ${event.type} (${Math.round(event.decayTime/1000)}s remaining)`);
    });
  }
  
  player.sendMessage("");
  player.sendMessage(`§l§dSync Status:`);
  player.sendMessage(`§7Cache → DP: ${wm.needsDPSync ? '🟡 Pending' : '🟢 Synced'}`);
  player.sendMessage(`§7Cache → DB: ${wm.needsDBSync ? '🟡 Pending' : '🟢 Synced'}`);
  player.sendMessage(`§7Last Update: ${Date.now() - wm.lastUpdate}ms ago`);
}
```

**Formatting Rules:**
- Use section headers with bold formatting (`§l`)
- Indent sub-values with spaces
- Use color coding for status (green = good, yellow = pending, red = error)
- Include parenthetical explanations for technical terms

---

#### Command 3: Live Watch Mode

**Syntax:** `!debug watch <mood|episode|focus>`  
**Purpose:** Stream real-time updates to chat (polling-based)

**Output Format:**

```javascript
/**
 * Live watch mode - stream updates to chat
 * @param {Player} player - The player watching
 * @param {string} watchType - Type of data to watch ('mood', 'episode', 'focus')
 */
function handleWatchMode(player, watchType) {
  const villagerId = getPlayerFocusedVillager(player);
  
  // Check if already watching
  if (isPlayerWatching(player)) {
    player.sendMessage("§c⚠ Already in watch mode. Type !debug stop to exit.");
    return;
  }
  
  player.sendMessage(`§a✓ Started watching §b${watchType}§a for §b${getVillagerName(villagerId)}`);
  player.sendMessage("§7Type §b!debug stop§7 to exit watch mode");
  
  // Store watch state
  setPlayerWatchState(player, { villagerId, watchType, active: true });
  
  // Start polling interval
  const intervalId = system.runInterval(() => {
    const watchState = getPlayerWatchState(player);
    if (!watchState || !watchState.active) {
      system.clearRun(intervalId);
      return;
    }
    
    const wm = getWorkingMemoryFromCache(watchState.villagerId);
    
    switch (watchState.watchType) {
      case 'mood':
        player.sendMessage(`§7[${getCurrentTime()}] Mood: C=${wm.C.toFixed(2)} V=${wm.V.toFixed(2)} I=${wm.I.toFixed(2)} S=${wm.S.toFixed(2)} X=${wm.X.toFixed(2)}`);
        break;
      
      case 'episode':
        player.sendMessage(`§7[${getCurrentTime()}] Episode: ${wm.currentEpisode || 'Idle'}`);
        break;
      
      case 'focus':
        player.sendMessage(`§7[${getCurrentTime()}] Focus: ${wm.activeFocus.type} (${wm.activeFocus.id})`);
        break;
    }
  }, 40); // Every 2 seconds (40 ticks)
}

/**
 * Stop watch mode
 * @param {Player} player - The player to stop watching
 */
function handleWatchStop(player) {
  const watchState = getPlayerWatchState(player);
  if (!watchState) {
    player.sendMessage("§c⚠ Not in watch mode");
    return;
  }
  
  setPlayerWatchState(player, { ...watchState, active: false });
  player.sendMessage("§a✓ Watch mode stopped");
}
```

**Update Frequency:** Every 40 ticks (2 seconds) to avoid chat spam

---

#### Command 4: LLM Last Call

**Syntax:** `!debug llm last`  
**Purpose:** Show last LLM interaction details

**Output Format:**

```javascript
/**
 * Display last LLM call details
 * @param {Player} player - The player requesting LLM data
 */
function handleLLMLast(player) {
  const villagerId = getPlayerFocusedVillager(player);
  const llmData = getLastLLMContext(villagerId);
  
  if (!llmData) {
    player.sendMessage("§c⚠ No LLM data available");
    return;
  }
  
  player.sendMessage("§6═══ Last LLM Call ═══");
  player.sendMessage(`§7Villager: §b${getVillagerName(villagerId)}`);
  player.sendMessage(`§7Timestamp: §b${formatTimestamp(llmData.timestamp)}`);
  player.sendMessage("");
  player.sendMessage(`§l§aMetrics:`);
  player.sendMessage(`§7Token Count: ${llmData.tokenCount}`);
  player.sendMessage(`§7Inference Time: ${llmData.inferenceTime}s`);
  player.sendMessage(`§7Priority: ${llmData.priority} (${getPriorityLabel(llmData.priority)})`);
  player.sendMessage(`§7Batched: ${llmData.wasBatched ? 'Yes' : 'No'}`);
  player.sendMessage("");
  player.sendMessage(`§l§aThought:`);
  player.sendMessage(`§7"${llmData.thought}"`);
  player.sendMessage("");
  player.sendMessage(`§l§aSpeech:`);
  player.sendMessage(`§7"${llmData.speech}"`);
  player.sendMessage("");
  player.sendMessage(`§l§aAction:`);
  player.sendMessage(`§7${llmData.action} ${JSON.stringify(llmData.actionParams || {})}`);
  
  // MICROSERVICES mode additional data
  if (llmData.intentClassification) {
    player.sendMessage("");
    player.sendMessage(`§l§aIntent Classification:`);
    player.sendMessage(`§7Label: ${llmData.intentClassification.label}`);
    player.sendMessage(`§7Confidence: ${(llmData.intentClassification.confidence * 100).toFixed(1)}%`);
    player.sendMessage(`§7Fast-Routed: ${llmData.intentClassification.fastRouted ? '✓' : '✗'}`);
  }
}
```

---

#### Command 5: Performance Summary

**Syntax:** `!debug perf summary`  
**Purpose:** ASCII table showing per-layer performance

**Output Format:**

```javascript
/**
 * Display performance summary in table format
 * @param {Player} player - The player requesting performance data
 */
function handlePerfSummary(player) {
  const perfData = getPerformanceMetrics();
  
  player.sendMessage("§6═══ Performance Summary ═══");
  player.sendMessage("");
  player.sendMessage("§l§6Fast Gear (Per-Tick Budget):");
  player.sendMessage("§7┌─────────┬──────────┬──────────┐");
  player.sendMessage("§7│ Layer   │ Avg Cost │ Status   │");
  player.sendMessage("§7├─────────┼──────────┼──────────┤");
  player.sendMessage(`§7│ L1      │ ${padLeft(perfData.layers.L1.toFixed(1), 7)}ms │ ${getStatusEmoji(perfData.layers.L1 < 5 ? 'active' : 'warning')}       │`);
  player.sendMessage(`§7│ L2      │ ${padLeft(perfData.layers.L2.toFixed(1), 7)}ms │ ${getStatusEmoji(perfData.layers.L2 < 20 ? 'active' : 'warning')}       │`);
  player.sendMessage(`§7│ L3      │ ${padLeft(perfData.layers.L3.toFixed(1), 7)}ms │ ${getStatusEmoji(perfData.layers.L3 < 5 ? 'active' : 'warning')}       │`);
  player.sendMessage(`§7│ L4      │ ${padLeft(perfData.layers.L4.toFixed(1), 7)}ms │ ${getStatusEmoji(perfData.layers.L4 < 2 ? 'active' : 'warning')}       │`);
  player.sendMessage("§7└─────────┴──────────┴──────────┘");
  player.sendMessage(`§7Total Fast Gear: §b${perfData.fastGearTotalMs.toFixed(1)}ms §7/ 15ms`);
  player.sendMessage("");
  player.sendMessage("§l§6Slow Gear (Async Operations):");
  player.sendMessage(`§7LLM Queue Depth: §b${perfData.llmQueueDepth}`);
  player.sendMessage(`§7Avg Wait Time: §b${perfData.avgLLMWaitTime.toFixed(1)}s`);
  player.sendMessage(`§7Throughput: §b${perfData.llmThroughput.toFixed(2)} req/sec`);
  player.sendMessage(`§7Batch Efficiency: §b${perfData.batchEfficiency}%`);
  player.sendMessage("");
  player.sendMessage(`§7Current TPS: §${perfData.currentTPS >= 19 ? 'a' : 'c'}${perfData.currentTPS.toFixed(1)}§7/20`);
}

/**
 * Pad string to specific width (right-aligned)
 * @param {string} str - String to pad
 * @param {number} width - Target width
 * @returns {string} Padded string
 */
function padLeft(str, width) {
  return str.padStart(width, ' ');
}
```

**Table Rules:**
- Use box-drawing characters (─, │, ┌, ┐, ├, ┤, └, ┘)
- Right-align numeric values
- Color code warnings (green < threshold, red > threshold)

---

#### Command 6: Villager Selection

**Syntax:** `!debug villager <select|list|info> [id]`  
**Purpose:** Manage which villager is being debugged

**Output Format:**

```javascript
/**
 * List all tracked villagers
 * @param {Player} player - The player requesting list
 */
function handleVillagerList(player) {
  const villagers = getTrackedVillagersList();
  
  if (villagers.length === 0) {
    player.sendMessage("§c⚠ No villagers currently tracked");
    return;
  }
  
  player.sendMessage("§6═══ Tracked Villagers ═══");
  villagers.forEach((v, i) => {
    const isFocused = v.id === getPlayerFocusedVillager(player);
    const marker = isFocused ? '§a▶' : '§7 ';
    player.sendMessage(`${marker} §b${i+1}. §7${v.name || 'Unnamed'} §8(${v.id.substring(0, 8)})`);
    player.sendMessage(`   §7Episode: ${v.currentEpisode || 'Idle'}`);
    player.sendMessage(`   §7Status: ${v.activeFocus.type} | Mood: ${deriveMoodLabel(v)}`);
  });
  player.sendMessage("");
  player.sendMessage("§7Use §b!debug villager select <number>§7 to focus");
}

/**
 * Select villager to focus debug commands on
 * @param {Player} player - The player selecting villager
 * @param {string|number} identifier - Villager ID or list number
 */
function handleVillagerSelect(player, identifier) {
  const villagers = getTrackedVillagersList();
  let targetVillager;
  
  // Check if identifier is a number (list index)
  if (!isNaN(identifier)) {
    const index = parseInt(identifier) - 1;
    targetVillager = villagers[index];
  } else {
    // Assume it's a partial ID match
    targetVillager = villagers.find(v => v.id.startsWith(identifier));
  }
  
  if (!targetVillager) {
    player.sendMessage("§c⚠ Villager not found");
    return;
  }
  
  setPlayerFocusedVillager(player, targetVillager.id);
  player.sendMessage(`§a✓ Now debugging: §b${targetVillager.name || 'Unnamed'} §8(${targetVillager.id.substring(0, 8)})`);
}
```

**Context Management:**
- Store "focused villager" per player in cache
- Default to nearest villager if none selected
- Persist selection across commands

---

#### Command 7: Watch Mode (Live Streaming)

**Syntax:** `!debug watch <mood|episode|focus|all>`  
**Purpose:** Real-time updates streamed to chat

**Implementation Pattern:**

```javascript
/**
 * Watch mode state manager
 */
const playerWatchStates = new Map(); // player.id -> { villagerId, watchType, intervalId, active }

/**
 * Start watch mode with live updates
 * @param {Player} player - The player watching
 * @param {string} watchType - What to watch
 */
function startWatchMode(player, watchType) {
  const villagerId = getPlayerFocusedVillager(player);
  
  // Stop existing watch if any
  stopWatchMode(player);
  
  player.sendMessage(`§a✓ Watching §b${watchType}§a for §b${getVillagerName(villagerId)}`);
  player.sendMessage("§7Updates every 2s | Type §b!debug stop§7 to exit");
  player.sendMessage("§8" + "─".repeat(40));
  
  const intervalId = system.runInterval(() => {
    if (!isPlayerOnline(player)) {
      stopWatchMode(player);
      return;
    }
    
    const wm = getWorkingMemoryFromCache(villagerId);
    const timestamp = getCurrentTime();
    
    switch (watchType) {
      case 'mood':
        player.sendMessage(`§7[${timestamp}] §dMood: §7C=${wm.C.toFixed(2)} V=${wm.V.toFixed(2)} I=${wm.I.toFixed(2)} S=${wm.S.toFixed(2)} X=${wm.X.toFixed(2)}`);
        break;
      
      case 'episode':
        player.sendMessage(`§7[${timestamp}] §bEpisode: §7${wm.currentEpisode || 'Idle'}`);
        break;
      
      case 'focus':
        player.sendMessage(`§7[${timestamp}] §aFocus: §7${wm.activeFocus.type} → ${wm.activeFocus.id}`);
        break;
      
      case 'all':
        player.sendMessage(`§7[${timestamp}] §6Episode: §7${wm.currentEpisode} §8| §6Focus: §7${wm.activeFocus.type} §8| §6Mood: §7${deriveMoodLabel(wm)}`);
        break;
    }
  }, 40); // Every 2 seconds
  
  playerWatchStates.set(player.id, { villagerId, watchType, intervalId, active: true });
}

/**
 * Stop watch mode
 * @param {Player} player - The player to stop watching
 */
function stopWatchMode(player) {
  const watchState = playerWatchStates.get(player.id);
  if (!watchState) return;
  
  system.clearRun(watchState.intervalId);
  playerWatchStates.delete(player.id);
  player.sendMessage("§8" + "─".repeat(40));
  player.sendMessage("§a✓ Watch mode stopped");
}
```

**Rate Limiting:**
- Max 1 watch per player
- Update interval: 40 ticks (2 seconds)
- Auto-stop if player disconnects

---

## 5. UI Component Library

### Reusable Components

#### Component: Status Indicator

```javascript
/**
 * Generate colored status text with emoji
 * @param {string} status - Status value
 * @returns {string} Formatted status
 */
function formatStatus(status) {
  const statusMap = {
    'active': '§a🟢 Active',
    'idle': '§7⚪ Idle',
    'processing': '§e🟡 Processing',
    'error': '§c🔴 Error',
    'waiting': '§b🔵 Waiting'
  };
  return statusMap[status] || '§7⚪ Unknown';
}
```

---

#### Component: Timestamp Formatter

```javascript
/**
 * Format timestamp to relative time
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string} Relative time string
 */
function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}

/**
 * Get current time in HH:MM:SS format
 * @returns {string} Formatted time
 */
function getCurrentTime() {
  const date = new Date();
  return date.toTimeString().split(' ')[0]; // HH:MM:SS
}
```

---

#### Component: Duration Formatter

```javascript
/**
 * Format duration from ms to readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
```

---

#### Component: Vector Display

```javascript
/**
 * Format vector for display based on AI mode
 * @param {Object} vectorData - Vector data (5D or 384D)
 * @param {string} aiMode - Current AI mode
 * @returns {string} Formatted vector string
 */
function formatVectorDisplay(vectorData, aiMode) {
  if (aiMode === 'MONOLITHIC') {
    return `[${vectorData.C.toFixed(2)}, ${vectorData.V.toFixed(2)}, ${vectorData.I.toFixed(2)}, ${vectorData.S.toFixed(2)}, ${vectorData.X.toFixed(2)}]`;
  } else {
    // MICROSERVICES: Show top 5 dimensions
    const top5 = vectorData.embedding.slice(0, 5).map(v => v.toFixed(3)).join(', ');
    return `[384D] Top 5: ${top5}...`;
  }
}
```

---

## 6. Chat Command Routing System

### Command Parser

```javascript
/**
 * Main debug command handler
 * @param {ChatSendBeforeEvent} event - Chat event
 */
world.beforeEvents.chatSend.subscribe((event) => {
  const message = event.message;
  const player = event.sender;
  
  // Check for debug command prefix
  if (!message.startsWith("!debug ")) return;
  
  event.cancel = true; // Prevent chat message from showing
  
  const args = message.split(" ").slice(1); // Remove "!debug"
  const category = args[0];
  const subcommand = args[1];
  const extraArgs = args.slice(2);
  
  // Route to appropriate handler
  const commandMap = {
    'brain': handleBrainCommands,
    'memory': handleMemoryCommands,
    'llm': handleLLMCommands,
    'perf': handlePerfCommands,
    'watch': handleWatchCommands,
    'villager': handleVillagerCommands,
    'menu': showMainDebugMenu,
    'stop': handleWatchStop,
    'help': handleDebugHelp
  };
  
  const handler = commandMap[category];
  if (!handler) {
    player.sendMessage(`§c⚠ Unknown debug category: ${category}`);
    player.sendMessage("§7Type §b!debug help§7 for usage");
    return;
  }
  
  try {
    handler(player, subcommand, ...extraArgs);
  } catch (error) {
    player.sendMessage(`§c⚠ Error: ${error.message}`);
    console.error(`Debug command error:`, error);
  }
});
```

---

### Sub-Command Routers

```javascript
/**
 * Route brain-related commands
 * @param {Player} player - The player
 * @param {string} subcommand - Subcommand
 */
function handleBrainCommands(player, subcommand) {
  const subcommandMap = {
    'status': handleBrainStatus,
    'layers': handleBrainLayers,
    'timing': handleBrainTiming
  };
  
  const handler = subcommandMap[subcommand] || handleBrainStatus; // Default to status
  handler(player);
}

/**
 * Route memory-related commands
 * @param {Player} player - The player
 * @param {string} subcommand - Subcommand
 */
function handleMemoryCommands(player, subcommand) {
  const subcommandMap = {
    'current': handleMemoryCurrent,
    'flashbulbs': handleMemoryFlashbulbs,
    'sync': handleMemorySync
  };
  
  const handler = subcommandMap[subcommand] || handleMemoryCurrent;
  handler(player);
}

/**
 * Route watch-related commands
 * @param {Player} player - The player
 * @param {string} watchType - What to watch
 */
function handleWatchCommands(player, watchType) {
  const validTypes = ['mood', 'episode', 'focus', 'all'];
  
  if (!validTypes.includes(watchType)) {
    player.sendMessage(`§c⚠ Invalid watch type. Use: ${validTypes.join(', ')}`);
    return;
  }
  
  startWatchMode(player, watchType);
}
```

---

### Help System

```javascript
/**
 * Display help information
 * @param {Player} player - The player requesting help
 */
function handleDebugHelp(player) {
  player.sendMessage("§6═══ Debug Commands ═══");
  player.sendMessage("");
  player.sendMessage("§l§6Forms (GUI):");
  player.sendMessage("§b!debug menu §7- Open main debug menu");
  player.sendMessage("");
  player.sendMessage("§l§6Chat Commands:");
  player.sendMessage("§b!debug brain status §7- Layer pipeline status");
  player.sendMessage("§b!debug memory current §7- Working Memory state");
  player.sendMessage("§b!debug llm last §7- Last LLM call details");
  player.sendMessage("§b!debug perf summary §7- Performance metrics");
  player.sendMessage("");
  player.sendMessage("§l§6Live Monitoring:");
  player.sendMessage("§b!debug watch mood §7- Stream mood updates");
  player.sendMessage("§b!debug watch episode §7- Stream episode changes");
  player.sendMessage("§b!debug watch focus §7- Stream focus changes");
  player.sendMessage("§b!debug watch all §7- Stream all updates");
  player.sendMessage("§b!debug stop §7- Stop watch mode");
  player.sendMessage("");
  player.sendMessage("§l§6Villager Management:");
  player.sendMessage("§b!debug villager list §7- List tracked villagers");
  player.sendMessage("§b!debug villager select <id> §7- Focus on villager");
  player.sendMessage("§b!debug villager info §7- Current villager details");
}
```

---

## 7. Data Fetching Patterns

### Cache-First Strategy

```javascript
/**
 * Get Working Memory from cache (fast)
 * @param {string} villagerId - The villager ID
 * @returns {Object} Working Memory object
 */
function getWorkingMemoryFromCache(villagerId) {
  const cached = trackedVillagers.get(villagerId);
  
  if (!cached) {
    throw new Error(`Villager ${villagerId} not in cache`);
  }
  
  return cached;
}

/**
 * Get layer status (calculated from cache + recent logs)
 * @param {string} villagerId - The villager ID
 * @returns {Object} Layer status object
 */
function getLayerStatus(villagerId) {
  const wm = getWorkingMemoryFromCache(villagerId);
  const perfMetrics = getPerformanceMetrics();
  
  return {
    L1: { status: 'active', eventsPerSec: calculateEventRate(villagerId) },
    L2: { status: 'active', avgLatency: perfMetrics.layers.L2 },
    L3: { status: wm.sequencerBuffer.length > 0 ? 'processing' : 'idle', bufferDepth: wm.sequencerBuffer.length },
    L4: { status: wm.needsDBSync ? 'syncing' : 'idle', pendingWrites: getPendingWriteCount(villagerId) },
    L5: { status: 'idle', lastQueryTime: formatTimestamp(wm.lastDBQuery) },
    L6: { status: perfMetrics.llmQueueDepth > 0 ? 'processing' : 'idle', queueDepth: perfMetrics.llmQueueDepth },
    L7: { status: wm.currentTask ? 'executing' : 'idle', currentAction: wm.currentTask?.action || 'None' },
    totalLatency: calculateTotalLatency(villagerId)
  };
}
```

---

### Async Database Queries

```javascript
/**
 * Fetch relationships from database
 * @param {string} villagerId - The villager ID
 * @returns {Promise<Array>} Relationship data
 */
async function fetchRelationships(villagerId) {
  try {
    const response = await http.post("http://localhost:3000/api/debug/relationships", {
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: JSON.stringify({ villagerId }),
      timeout: 2000
    });
    
    const result = JSON.parse(response.body);
    return result.relationships;
  } catch (error) {
    console.error("Failed to fetch relationships:", error);
    return [];
  }
}

/**
 * Fetch recent episodes with specific player
 * @param {string} villagerId - The villager ID
 * @param {string} actorId - The player/actor ID
 * @param {number} limit - Max episodes to fetch
 * @returns {Promise<Array>} Episode data
 */
async function fetchRecentEpisodesWithPlayer(villagerId, actorId, limit = 5) {
  try {
    const response = await http.post("http://localhost:3000/api/debug/episodes", {
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: JSON.stringify({ villagerId, actorId, limit }),
      timeout: 2000
    });
    
    const result = JSON.parse(response.body);
    return result.episodes;
  } catch (error) {
    console.error("Failed to fetch episodes:", error);
    return [];
  }
}
```

**Error Handling Rules:**
- Always wrap network calls in `try/catch`
- Use 2-second timeout for non-critical queries
- Return empty array on failure (don't crash UI)
- Log errors to console for debugging

---

## 8. Color Code Standards

### Color Palette

| Color Code | Usage | Example |
|------------|-------|---------|
| `§0` | Black | Unused |
| `§1` | Dark Blue | - |
| `§2` | Dark Green | - |
| `§3` | Dark Aqua | - |
| `§4` | Dark Red | Errors, hostiles |
| `§5` | Dark Purple | - |
| `§6` | Gold | Headers, section titles |
| `§7` | Gray | Secondary text, labels |
| `§8` | Dark Gray | Metadata, IDs |
| `§9` | Blue | Values, highlights |
| `§a` | Green | Success, active status |
| `§b` | Aqua | Primary values, villager names |
| `§c` | Red | Errors, warnings |
| `§d` | Light Purple | Layer 4 (Working Memory) |
| `§e` | Yellow | Metrics, numbers |
| `§f` | White | Default text |

### Format Codes

| Code | Effect | Usage |
|------|--------|-------|
| `§l` | Bold | Headers, important text |
| `§o` | Italic | Notes, secondary info |
| `§n` | Underline | Links (not common) |
| `§r` | Reset | Clear all formatting |

### Naming Convention

```javascript
// ✅ Good: Descriptive with color coding
"§l§6🧠 Brain Monitor\n§r§7Real-time layer status"

// ❌ Bad: Too verbose
"§l§6§oBrain Monitor for Debugging the Seven Layer Cognitive Architecture"

// ❌ Bad: No formatting
"Brain Monitor - Layer status"
```

---

## 9. Error Handling & Edge Cases

### Form Cancellation

```javascript
form.show(player).then((response) => {
  // ALWAYS check for cancellation first
  if (response.canceled) {
    // Don't show error, just return silently
    return;
  }
  
  // Process form values
  processFormData(response.formValues);
});
```

### Network Timeout

```javascript
async function fetchDataWithFallback(villagerId) {
  try {
    const data = await fetchFromDatabase(villagerId);
    return data;
  } catch (error) {
    // Fallback to cache-only data
    console.warn("Database unavailable, using cache:", error.message);
    return getCacheOnlyData(villagerId);
  }
}
```

### Invalid Villager Selection

```javascript
function validateVillagerId(villagerId) {
  if (!trackedVillagers.has(villagerId)) {
    throw new Error(`Villager ${villagerId} is not tracked. Use !debug villager list to see available villagers.`);
  }
}
```

---

## 10. Performance Considerations

### Form Display Budget

**Constraints:**
- Forms are blocking (pause gameplay)
- Minimize data fetching before showing form
- Cache frequently accessed data
- Use lazy loading for nested forms

**Optimization Pattern:**

```javascript
// ❌ Bad: Fetch all data before showing form
async function showBadForm(player) {
  const data1 = await fetchLargeDataset1(); // 500ms
  const data2 = await fetchLargeDataset2(); // 300ms
  const data3 = await fetchLargeDataset3(); // 200ms
  // Player waits 1000ms before seeing anything
  showForm(player, data1, data2, data3);
}

// ✅ Good: Show form immediately, fetch on-demand
function showGoodForm(player) {
  const cachedData = getCacheData(); // <1ms
  showForm(player, cachedData); // Immediate
  // Fetch additional data only if player navigates deeper
}
```

### Chat Command Budget

**Guidelines:**
- Single-line commands: <5ms execution
- Multi-line commands: <10ms execution
- Watch mode: <2ms per update (background interval)
- Avoid synchronous database queries in command handlers

---

## 11. Accessibility Rules

### Text Readability

```javascript
// ✅ Good: Clear hierarchy with formatting
player.sendMessage("§l§6Section Title");
player.sendMessage("§7  Indented value: §b123");

// ❌ Bad: Wall of text, no structure
player.sendMessage("Section Title value: 123 another value: 456");
```

### Information Density

**Maximum Lines per Command:**
- Status commands: 15 lines max
- Detail commands: 30 lines max
- Watch mode: 1 line per update

**Pagination Pattern:**

```javascript
function showPaginatedList(player, items, page = 0, pageSize = 10) {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  
  player.sendMessage(`§6═══ Results (Page ${page+1}/${Math.ceil(items.length/pageSize)}) ═══`);
  pageItems.forEach((item, i) => {
    player.sendMessage(`§7${start + i + 1}. §b${item.name}`);
  });
  player.sendMessage("");
  player.sendMessage("§7Use §b!debug next§7 for more");
}
```

---

## 12. Icon Resource Pack Integration

### Required Icons

Create texture pack with icons at `textures/icons/`:

| Icon File | Usage | Size |
|-----------|-------|------|
| `brain.png` | Brain Monitor button | 32x32 |
| `memory.png` | Working Memory button | 32x32 |
| `llm.png` | LLM Context button | 32x32 |
| `heart.png` | Relationships button | 32x32 |
| `graph.png` | Performance button | 32x32 |
| `structure.png` | Structures button | 32x32 |
| `settings.png` | Settings button | 32x32 |
| `task.png` | Build tasks button | 32x32 |

**Design Guidelines:**
- Pixel art style (16x16 or 32x32)
- High contrast for visibility
- Match Minecraft aesthetic
- Avoid intricate details (will be scaled down)

---

## 13. Module Organization

### File Structure

```
scripts/
  debug/
    forms/
      mainMenu.js          → Main debug menu (Form 1)
      brainMonitor.js      → Brain Monitor form (Form 3)
      workingMemory.js     → Working Memory form (Form 4)
      llmContext.js        → LLM Context form (Form 5)
      relationships.js     → Relationships forms (Form 6)
      performance.js       → Performance form (Form 7)
      structures.js        → Structure forms (Form 8)
      settings.js          → Settings form (Form 9)
    
    commands/
      commandRouter.js     → Main chat command parser
      brainCommands.js     → Brain-related handlers
      memoryCommands.js    → Memory-related handlers
      llmCommands.js       → LLM-related handlers
      perfCommands.js      → Performance handlers
      watchCommands.js     → Watch mode handlers
      villagerCommands.js  → Villager management
    
    components/
      formatters.js        → Timestamp, duration, vector formatters
      statusIndicators.js  → Status emojis and labels
      dataFetchers.js      → Network calls to backend
      cacheAccessors.js    → trackedVillagers Map accessors
    
    debugMain.js           → Entry point, event subscriptions
```

---

## 14. Best Practices Summary

### ✅ DO

- Use `ActionFormData` for navigation (button lists)
- Use `ModalFormData` for data display (read-only inspection)
- Use chat commands for real-time monitoring
- Fetch from cache first, database second
- Handle `response.canceled` in all forms
- Use color codes for visual hierarchy
- Format numbers to 2 decimal places
- Truncate long strings to 50 characters
- Include timestamp in watch mode updates
- Use consistent emoji/icon mapping

### ❌ DON'T

- Don't fetch data synchronously before showing forms
- Don't spam chat with watch mode (max 1 update per 2s)
- Don't show raw JSON in forms (format for readability)
- Don't use `MessageFormData` for navigation (only confirmations)
- Don't create forms with >15 input elements (overwhelming)
- Don't store Entity objects in watch state (store entity.id)
- Don't show 384D vectors fully (show top 5 dimensions only)

---

**Document Version:** 1.0  
**Last Updated:** March 15, 2026  
**Related Docs:** `ux-rules.md`, `interaction-flow.md`
