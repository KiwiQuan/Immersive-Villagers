# Phase 2: Enhancement — Rich Interactions & UI

**Status:** Feature Enhancement Phase  
**Goal:** Transform MVP into a feature-rich, polished experience  
**Deliverable:** Physical villager actions, in-game UI, gossip system, multi-event support  
**Duration Target:** 7-10 implementation sessions

---

## Overview

This phase builds upon the MVP by adding player-facing features, physical villager actions, interactive UI systems, and advanced memory capabilities. Villagers will move, build, and communicate through rich in-game menus.

**Success Criteria:**
- Villagers perform physical actions (pathfinding, building, animations)
- Interactive UI system (Hub, Gossip, Debug menus)
- Multi-event support (chat, damage, containers)
- Gossip and teaching mechanics functional
- Instinct fallback operational when LLM fails
- Identity tag generation working

---

## Feature 1: Physical Action Execution

**Goal:** Villagers execute pathfinding, building, and animation actions

### Steps:
1. Extend `scripts/layers/layer7_action.js` with physical action handlers
2. Implement pathfinding: Store target coordinates in DynamicProperties, teleport in increments
3. Implement building: Use `/setblock` command via `dimension.runCommand()`
4. Add animation triggers: Use villager component animations for gestures
5. Implement action state machine to prevent concurrent actions

**Files Modified:**
- `scripts/layers/layer7_action.js`

**Action Types:**
```javascript
function executeIntent(villager, intentPacket) {
  switch (intentPacket.action) {
    case 'speak':
      displaySpeech(villager, intentPacket.speechText);
      break;
    
    case 'pathfind':
      startPathfinding(villager, intentPacket.targetLocation);
      break;
    
    case 'build':
      placeBlock(villager, intentPacket.blockType, intentPacket.coordinates);
      break;
    
    case 'gesture':
      playAnimation(villager, intentPacket.animationType);
      break;
    
    case 'idle':
      // Do nothing
      break;
  }
}
```

**Pathfinding Implementation:**
```javascript
function startPathfinding(villager, targetLocation) {
  villager.setDynamicProperty('pathfind_target_x', targetLocation.x);
  villager.setDynamicProperty('pathfind_target_y', targetLocation.y);
  villager.setDynamicProperty('pathfind_target_z', targetLocation.z);
  villager.setDynamicProperty('is_pathfinding', true);
}

// Separate tick loop for movement
system.runInterval(() => {
  const villagers = world.getDimension('overworld').getEntities({ type: 'minecraft:villager_v2' });
  
  for (const villager of villagers) {
    if (!villager.isValid()) continue;
    
    const isPathfinding = villager.getDynamicProperty('is_pathfinding');
    if (!isPathfinding) continue;
    
    const targetX = villager.getDynamicProperty('pathfind_target_x');
    const targetY = villager.getDynamicProperty('pathfind_target_y');
    const targetZ = villager.getDynamicProperty('pathfind_target_z');
    
    const currentLoc = villager.location;
    const distance = Math.sqrt(
      Math.pow(targetX - currentLoc.x, 2) + 
      Math.pow(targetZ - currentLoc.z, 2)
    );
    
    if (distance < 1.0) {
      // Reached destination
      villager.setDynamicProperty('is_pathfinding', false);
      continue;
    }
    
    // Move incrementally
    const dx = (targetX - currentLoc.x) / distance;
    const dz = (targetZ - currentLoc.z) / distance;
    
    villager.teleport({
      x: currentLoc.x + dx * 0.2,
      y: targetY,
      z: currentLoc.z + dz * 0.2
    });
  }
}, 1); // Every tick for smooth movement
```

**Validation:**
- LLM returns pathfind intent → Villager walks to location
- LLM returns build intent → Block appears in world
- Villager reaches destination → Stops moving

---

## Feature 2: In-Game Speech Display

**Goal:** Display villager speech as on-screen text instead of console logs

### Steps:
1. Implement speech bubble using `player.onScreenDisplay.setActionBar()`
2. Add villager nameplate prefix: `§e[Villager Name]: §r{speechText}`
3. Store speech history in DynamicProperties (last 3 messages)
4. Add timeout: Clear speech after 5 seconds
5. Support multi-line speech with formatting

**Files Modified:**
- `scripts/layers/layer7_action.js`
- `scripts/utils/ui_helpers.js`

**Speech Display:**
```javascript
function displaySpeech(villager, speechText, targetPlayerID) {
  const targetPlayer = world.getEntity(targetPlayerID);
  if (!targetPlayer) return;
  
  const villagerName = villager.nameTag || `Villager ${villager.id.slice(-4)}`;
  const formattedMessage = `§e[${villagerName}]: §r${speechText}`;
  
  targetPlayer.onScreenDisplay.setActionBar(formattedMessage);
  
  // Store in history
  const history = JSON.parse(villager.getDynamicProperty('speech_history') || '[]');
  history.push({ text: speechText, timestamp: Date.now() });
  if (history.length > 3) history.shift();
  villager.setDynamicProperty('speech_history', JSON.stringify(history));
  
  // Clear after 5 seconds
  system.runTimeout(() => {
    targetPlayer.onScreenDisplay.setActionBar('');
  }, 100); // 5 seconds
}
```

**Validation:**
- Villager speaks → Text appears on player's screen
- Text auto-clears after 5 seconds
- Speech history stored and retrievable

---

## Feature 3: Interaction Hub UI

**Goal:** Custom UI for player-villager interaction

### Steps:
1. Create `scripts/ui/hub.js` with ActionFormData for main menu
2. Add interaction trigger: Right-click villager with empty hand opens menu
3. Implement menu options: "Chat", "View Memories", "Gossip", "Cancel"
4. Route selections to appropriate sub-menus
5. Add breadcrumb navigation for multi-level menus

**Files Created:**
- `scripts/ui/hub.js`
- `scripts/ui/state.js`
- `scripts/events/player_interact.js`

**Hub Menu:**
```javascript
import { ActionFormData } from '@minecraft/server-ui';

function showInteractionHub(player, villager) {
  const form = new ActionFormData()
    .title(`§6${villager.nameTag || 'Villager'}`)
    .body('§7What would you like to do?')
    .button('§eChat\n§7Start a conversation', 'textures/ui/chat_icon')
    .button('§bView Memories\n§7See what they remember', 'textures/ui/memory_icon')
    .button('§aGossip & Whisper\n§7Share knowledge', 'textures/ui/gossip_icon')
    .button('§cCancel', 'textures/ui/cancel_icon');
  
  form.show(player).then(response => {
    if (response.canceled) return;
    
    switch (response.selection) {
      case 0: // Chat
        handleChatMenu(player, villager);
        break;
      case 1: // View Memories
        handleMemoriesMenu(player, villager);
        break;
      case 2: // Gossip
        handleGossipMenu(player, villager);
        break;
      case 3: // Cancel
        return;
    }
  });
}
```

**Interaction Trigger:**
```javascript
world.afterEvents.playerInteractWithEntity.subscribe(event => {
  const { player, target } = event;
  
  if (target.typeId !== 'minecraft:villager_v2') return;
  if (player.getItemSlot('mainhand').typeId !== 'minecraft:air') return;
  
  showInteractionHub(player, target);
});
```

**Validation:**
- Right-click villager with empty hand → Menu opens
- Select option → Navigates to sub-menu
- Cancel → Menu closes without action

---

## Feature 4: Gossip & Whisper System

**Goal:** Players can share knowledge between villagers

### Steps:
1. Create `scripts/ui/gossip.js` with gossip menu interface
2. Implement "Whisper Fact" option: Player inputs text to teach villager
3. Store gossip in `gossip` database table (villagerID, fact, source, timestamp)
4. Implement "Request Gossip": Fetch rumors from database and display
5. Add LLM prompt enhancement: Include gossip in context

**Files Created:**
- `scripts/ui/gossip.js`
- `nodeDB/routes/gossip.js`
- `nodeDB/queries/gossip.js`

**Database Schema:**
```sql
CREATE TABLE gossip (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  source_type TEXT, -- 'player' or 'villager'
  source_id TEXT,
  confidence REAL DEFAULT 1.0,
  timestamp BIGINT NOT NULL
);

CREATE INDEX idx_gossip_villager ON gossip(villager_id, timestamp DESC);
```

**Whisper Menu:**
```javascript
import { ModalFormData } from '@minecraft/server-ui';

function showWhisperMenu(player, villager) {
  const form = new ModalFormData()
    .title(`§6Whisper to ${villager.nameTag}`)
    .textField('§eWhat do you want to tell them?', 'Type your message here...');
  
  form.show(player).then(response => {
    if (response.canceled) return;
    
    const fact = response.formValues[0];
    if (!fact || fact.length < 3) {
      player.sendMessage('§cMessage too short!');
      return;
    }
    
    // Send to backend
    http.post('http://localhost:3000/api/gossip/whisper', {
      body: JSON.stringify({
        villagerID: villager.id,
        fact,
        sourceType: 'player',
        sourceID: player.id
      })
    }).then(() => {
      player.sendMessage(`§aYou whispered to ${villager.nameTag}.`);
    });
  });
}
```

**LLM Context Enhancement:**
```javascript
// In nodeDB/brain/prompt_builder.js
async function buildPrompt(villagerContext) {
  const { villagerID, recentEpisodes, relationshipScore } = villagerContext;
  
  // Fetch recent gossip
  const gossip = await pool.query(
    'SELECT fact, source_type FROM gossip WHERE villager_id = $1 ORDER BY timestamp DESC LIMIT 5',
    [villagerID]
  );
  
  const gossipText = gossip.rows.map(g => `- ${g.fact} (heard from ${g.source_type})`).join('\n');
  
  return `You are Villager ${villagerID}.

Recent Activity:
${formatEpisodes(recentEpisodes)}

What You've Been Told:
${gossipText}

Your Relationship:
- Trust Score: ${relationshipScore}

Generate a JSON response:
...`;
}
```

**Validation:**
- Player whispers "Diamonds are north" → Stored in database
- Villager's next LLM prompt includes gossip
- Request gossip → Shows list of facts learned

---

## Feature 5: Multi-Event Support

**Goal:** Support chat messages, damage events, and container interactions

### Steps:
1. Add `playerChat` event listener in `scripts/events/chat_events.js`
2. Add `entityHurt` event listener for damage tracking
3. Add `playerInteractWithBlock` for chest/container interactions
4. Extend vector rules to support new event types
5. Update Layer 2 to handle diverse event contexts

**Files Created:**
- `scripts/events/chat_events.js`
- `scripts/events/entity_events.js`

**Chat Event Handling:**
```javascript
world.afterEvents.chatSend.subscribe(event => {
  const { sender, message } = event;
  
  const nearbyVillagers = world.getDimension('overworld')
    .getEntities({
      type: 'minecraft:villager_v2',
      location: sender.location,
      maxDistance: AWARENESS_RADIUS
    });
  
  for (const villager of nearbyVillagers) {
    if (!hasLineOfSight(villager.location, sender.location)) continue;
    
    // Create FilteredEventContext for chat
    const eventContext = {
      type: 'FilteredEventContext',
      eventName: 'playerChat',
      actorID: sender.id,
      villagerID: villager.id,
      chatMessage: message,
      proximity: distance(villager.location, sender.location),
      hasLOS: true,
      timestamp: Date.now()
    };
    
    // Pass to Layer 2
    processEvent(eventContext);
  }
});
```

**Vector Rules for Chat:**
```javascript
// In scripts/config/vector_rules.js
export const CHAT_VECTOR_RULES = {
  // Constructiveness
  greeting: { C: 0.5 },
  question: { C: 0.3 },
  insult: { C: -0.7 },
  
  // Sociality
  friendly_tone: { S: 0.8 },
  aggressive_tone: { S: -0.8 },
  
  // Intensity
  exclamation: { I: 0.6 },
  calm: { I: 0.2 }
};

function calculateChatVector(chatMessage) {
  // Simple keyword matching (can be enhanced with NLP)
  const lower = chatMessage.toLowerCase();
  
  let C = 0.3, V = 0.0, I = 0.3, S = 0.5, X = 0.2;
  
  if (lower.includes('hello') || lower.includes('hi')) {
    C = 0.5;
    S = 0.8;
  }
  
  if (lower.includes('!')) {
    I = 0.6;
  }
  
  if (lower.includes('stupid') || lower.includes('idiot')) {
    C = -0.7;
    S = -0.8;
  }
  
  return { C, V, I, S, X };
}
```

**Validation:**
- Player says "Hello!" near villager → Chat event vectorized
- Player hits villager → Damage event creates negative vector
- Player opens chest near villager → Container event captured

---

## Feature 6: Identity Tag Generation

**Goal:** Automatically generate personality tags based on episode patterns

### Steps:
1. Create `nodeDB/brain/identity_analyzer.js` with tag generation logic
2. Implement pattern detection: Analyze last 20 episodes for dominant vectors
3. Define tag rules: High C average → "loves_building", High V → "values_diamonds"
4. Update `identity_tags` table with confidence scores
5. Include tags in LLM prompts for personality consistency

**Files Created:**
- `nodeDB/brain/identity_analyzer.js`
- `nodeDB/queries/identity.js`

**Tag Generation Logic:**
```javascript
async function analyzeIdentity(villagerID) {
  // Fetch last 20 episodes
  const episodes = await pool.query(
    'SELECT vector_c, vector_v, vector_i, vector_s, vector_x FROM episodes WHERE villager_id = $1 ORDER BY timestamp DESC LIMIT 20',
    [villagerID]
  );
  
  if (episodes.rows.length < 5) return; // Not enough data
  
  // Calculate averages
  const avgC = average(episodes.rows.map(e => e.vector_c));
  const avgV = average(episodes.rows.map(e => e.vector_v));
  const avgI = average(episodes.rows.map(e => e.vector_i));
  const avgS = average(episodes.rows.map(e => e.vector_s));
  const avgX = average(episodes.rows.map(e => e.vector_x));
  
  const tags = [];
  
  if (avgC > 0.6) tags.push({ name: 'loves_building', confidence: avgC });
  if (avgC < -0.6) tags.push({ name: 'destructive', confidence: Math.abs(avgC) });
  if (avgV > 0.7) tags.push({ name: 'values_wealth', confidence: avgV });
  if (avgI > 0.6) tags.push({ name: 'energetic', confidence: avgI });
  if (avgS > 0.6) tags.push({ name: 'friendly', confidence: avgS });
  if (avgS < -0.6) tags.push({ name: 'hostile', confidence: Math.abs(avgS) });
  if (avgX > 0.6) tags.push({ name: 'technical_minded', confidence: avgX });
  
  // Upsert tags
  for (const tag of tags) {
    await pool.query(
      'INSERT INTO identity_tags (villager_id, tag_name, confidence, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (villager_id, tag_name) DO UPDATE SET confidence = $3',
      [villagerID, tag.name, tag.confidence, Date.now()]
    );
  }
  
  return tags;
}
```

**Trigger Analysis:**
```javascript
// In nodeDB/routes/memory.js
router.post('/episode', async (req, res) => {
  try {
    const result = await writeEpisodeWithRelationships(req.body.episodeSummary);
    
    // Trigger identity analysis every 5 episodes
    const episodeCount = await getEpisodeCount(req.body.villagerID);
    if (episodeCount % 5 === 0) {
      analyzeIdentity(req.body.villagerID);
    }
    
    res.json({ status: 'success', episodeID: result.episodeID });
  } catch (err) {
    // Error handling
  }
});
```

**Validation:**
- Villager observes 20 building actions → Tag "loves_building" appears
- Check database: `SELECT * FROM identity_tags WHERE villager_id = 'v456';`
- LLM prompt includes personality tags

---

## Feature 7: Instinct Fallback System

**Goal:** Hardcoded behaviors when LLM/network fails

### Steps:
1. Create `scripts/layers/layer8_instinct.js` with fallback logic
2. Detect failures: Track polling failures (>3 attempts = fallback)
3. Implement simple rules: If recent S > 0.6 → wave, If S < -0.6 → run away
4. Store fallback state in DynamicProperties: `instinct_mode`, `instinct_reason`
5. Retry LLM connection every 60 seconds

**Files Created:**
- `scripts/layers/layer8_instinct.js`

**Instinct Logic:**
```javascript
function applyInstinct(villager) {
  const moodS = villager.getDynamicProperty('wm_currentMood_S') || 0.5;
  const moodC = villager.getDynamicProperty('wm_currentMood_C') || 0.5;
  const moodI = villager.getDynamicProperty('wm_currentMood_I') || 0.5;
  
  // Friendly behavior
  if (moodS > 0.6 && moodC > 0.5) {
    playAnimation(villager, 'wave');
    return { action: 'gesture', animationType: 'wave' };
  }
  
  // Fearful behavior
  if (moodS < -0.6 || moodI > 0.8) {
    const escapeLocation = calculateEscapeVector(villager.location);
    startPathfinding(villager, escapeLocation);
    return { action: 'pathfind', targetLocation: escapeLocation };
  }
  
  // Neutral/idle
  return { action: 'idle' };
}
```

**Fallback Trigger:**
```javascript
// In scripts/layers/layer7_action.js
let pollingFailures = 0;

http.get(`http://localhost:3000/api/brain/poll?villagerID=${villager.id}`)
  .then(response => {
    pollingFailures = 0;
    const data = JSON.parse(response.body);
    if (data.status === 'ready') {
      executeIntent(villager, data.intentPacket);
    }
  })
  .catch(err => {
    pollingFailures++;
    
    if (pollingFailures >= 3) {
      console.warn(`[Layer 8] Falling back to instinct for ${villager.id}`);
      villager.setDynamicProperty('instinct_mode', true);
      const instinctAction = applyInstinct(villager);
      executeIntent(villager, instinctAction);
    }
  });
```

**Validation:**
- Stop backend → Villagers switch to instinct mode after 6 seconds
- Friendly villager waves when LLM offline
- Hostile context → Villager runs away

---

## Feature 8: View Memories Menu

**Goal:** Display villager's recent memories in UI

### Steps:
1. Create `scripts/ui/memories.js` with memory viewer
2. Implement HTTP GET to `/api/memory/recent?villagerID={id}&limit=10`
3. Parse episode data and format for display
4. Show: Episode summary, vector averages, timestamp, actor name
5. Add pagination for >10 memories

**Files Created:**
- `scripts/ui/memories.js`
- `nodeDB/routes/memory.js` (add GET endpoint)

**Memories Menu:**
```javascript
async function showMemoriesMenu(player, villager) {
  // Fetch recent memories
  const response = await http.get(
    `http://localhost:3000/api/memory/recent?villagerID=${villager.id}&limit=10`
  );
  
  const memories = JSON.parse(response.body).episodes;
  
  const form = new ActionFormData()
    .title(`§6${villager.nameTag}'s Memories`)
    .body('§7Recent experiences:');
  
  for (const memory of memories) {
    const timeAgo = formatTimeAgo(Date.now() - memory.timestamp);
    const summary = `§e${memory.actorName || 'Someone'} §7(${timeAgo})\n§7C:${memory.vector_c.toFixed(1)} V:${memory.vector_v.toFixed(1)} S:${memory.vector_s.toFixed(1)}`;
    form.button(summary);
  }
  
  form.button('§cBack to Hub');
  
  form.show(player).then(response => {
    if (response.canceled || response.selection === memories.length) {
      showInteractionHub(player, villager);
    } else {
      showMemoryDetail(player, villager, memories[response.selection]);
    }
  });
}
```

**Backend Endpoint:**
```javascript
router.get('/recent', async (req, res) => {
  const { villagerID, limit = 10 } = req.query;
  
  try {
    const result = await pool.query(
      'SELECT * FROM episodes WHERE villager_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [villagerID, parseInt(limit)]
    );
    
    res.json({ status: 'success', episodes: result.rows });
  } catch (err) {
    logger.error({ error: err.message }, '[Layer 5] Memory fetch failed');
    res.status(500).json({ status: 'error' });
  }
});
```

**Validation:**
- Open "View Memories" → Shows last 10 episodes
- Click episode → Shows detailed breakdown
- Back button → Returns to Hub

---

## Feature 9: DEBUG_MODE Enhancements

**Goal:** Advanced debugging tools for development

### Steps:
1. Create `scripts/ui/debug.js` with debug modal UI
2. Add "View Live State" option: Display current Working Memory values
3. Add "Force LLM Request" option: Manually trigger Layer 6 inference
4. Add "Seal Episode" option: Manually close current episode
5. Add "Clear Memory" option: Delete all episodes for villager (with confirmation)

**Files Created:**
- `scripts/ui/debug.js`
- `nodeDB/routes/debug.js`

**Debug Menu:**
```javascript
function showDebugMenu(player, villager) {
  if (!world.getDynamicProperty('DEBUG_MODE')) {
    player.sendMessage('§cDEBUG_MODE is disabled');
    return;
  }
  
  const form = new ActionFormData()
    .title(`§c[DEBUG] ${villager.nameTag}`)
    .body('§7Developer Tools')
    .button('§eView Live State\n§7Current vectors & properties')
    .button('§bForce LLM Request\n§7Trigger inference now')
    .button('§aSeal Episode\n§7Close current episode')
    .button('§cClear Memory\n§7Delete all episodes')
    .button('§7Back to Hub');
  
  form.show(player).then(response => {
    if (response.canceled) return;
    
    switch (response.selection) {
      case 0:
        showLiveState(player, villager);
        break;
      case 1:
        forceLLMRequest(player, villager);
        break;
      case 2:
        sealEpisode(player, villager);
        break;
      case 3:
        confirmClearMemory(player, villager);
        break;
      case 4:
        showInteractionHub(player, villager);
        break;
    }
  });
}
```

**Live State Display:**
```javascript
function showLiveState(player, villager) {
  const state = {
    moodC: villager.getDynamicProperty('wm_currentMood_C'),
    moodV: villager.getDynamicProperty('wm_currentMood_V'),
    moodI: villager.getDynamicProperty('wm_currentMood_I'),
    moodS: villager.getDynamicProperty('wm_currentMood_S'),
    moodX: villager.getDynamicProperty('wm_currentMood_X'),
    focus: villager.getDynamicProperty('wm_currentFocus'),
    shock: villager.getDynamicProperty('wm_shockState')
  };
  
  const form = new MessageFormData()
    .title('§eLive State')
    .body(`§7Current Mood:
§eC: §f${state.moodC?.toFixed(2) || 'N/A'}
§bV: §f${state.moodV?.toFixed(2) || 'N/A'}
§dI: §f${state.moodI?.toFixed(2) || 'N/A'}
§aS: §f${state.moodS?.toFixed(2) || 'N/A'}
§6X: §f${state.moodX?.toFixed(2) || 'N/A'}

§7Focus: §f${state.focus || 'None'}
§7Shock State: §f${state.shock ? 'Yes' : 'No'}`)
    .button1('§aRefresh')
    .button2('§cClose');
  
  form.show(player).then(response => {
    if (response.selection === 0) {
      showLiveState(player, villager); // Refresh
    } else {
      showDebugMenu(player, villager);
    }
  });
}
```

**Validation:**
- Enable DEBUG_MODE → Debug option appears in Hub
- View Live State → Shows current DynamicProperties
- Force LLM Request → Intent appears within 3 seconds
- Clear Memory → Database entries deleted

---

## Feature 10: Multi-Event LLM Prompts

**Goal:** LLM receives context from multiple event types

### Steps:
1. Update `nodeDB/brain/prompt_builder.js` to handle diverse episodes
2. Add event type descriptions: "building session", "chat conversation", "combat encounter"
3. Enhance prompt with recent event summaries (last 5 episodes, diverse types)
4. Test LLM responses to mixed event contexts
5. Validate contextual consistency across event types

**Enhanced Prompt:**
```javascript
function buildPrompt(villagerContext) {
  const { villagerID, recentEpisodes, relationshipScore, identityTags, gossip } = villagerContext;
  
  const episodeDescriptions = recentEpisodes.map(ep => {
    const type = classifyEpisode(ep);
    return `- ${type}: C=${ep.vector_c.toFixed(1)}, V=${ep.vector_v.toFixed(1)}, S=${ep.vector_s.toFixed(1)} (${formatDuration(ep.duration)})`;
  }).join('\n');
  
  return `You are Villager ${villagerID}. You are observing Player ${villagerContext.actorID}.

Recent Activity:
${episodeDescriptions}

What You've Been Told:
${gossip.map(g => `- ${g.fact}`).join('\n')}

Your Relationship with this Player:
- Trust Score: ${relationshipScore.toFixed(2)}
- Total Interactions: ${villagerContext.interactionCount}

Your Personality:
- ${identityTags.join(', ')}

Based on this context, generate a JSON response:
{
  "action": "speak|pathfind|build|gesture|idle",
  "speechText": "What you want to say (if speaking)",
  "targetLocation": { "x": 0, "y": 0, "z": 0 } (if pathfinding),
  "blockType": "minecraft:dirt" (if building),
  "internalMonologue": "What you're thinking"
}

Response (JSON only):`;
}

function classifyEpisode(episode) {
  if (episode.vector_c > 0.5) return 'Building session';
  if (episode.vector_c < -0.5) return 'Destruction';
  if (episode.vector_s > 0.6) return 'Friendly interaction';
  if (episode.vector_s < -0.6) return 'Hostile encounter';
  if (episode.vector_i > 0.7) return 'Intense event';
  return 'Observation';
}
```

**Validation:**
- Recent episodes include building + chat → LLM responds appropriately
- High trust score → LLM generates friendly responses
- Identity tags → LLM maintains personality consistency

---

## Performance Targets (Phase 2)

| Metric | Target | Notes |
|--------|--------|-------|
| Pathfinding smoothness | 20 updates/sec | Teleport every tick |
| Speech display latency | <100ms | ActionBar update |
| UI menu open time | <200ms | Form rendering |
| Gossip write latency | <150ms | HTTP POST + DB write |
| Identity analysis time | <500ms | Batch every 5 episodes |
| Memory fetch latency | <100ms | 10 episodes from DB |

---

## Testing Strategy

### Feature Tests
- Physical actions: Test pathfinding to 10 different locations
- Speech display: Verify multi-line messages render correctly
- UI navigation: Test all menu flows with back buttons
- Gossip system: Whisper 5 facts, verify in database
- Multi-event support: Trigger 3+ event types, verify vectors
- Identity tags: Generate tags from 20 diverse episodes
- Instinct fallback: Stop backend, verify fallback within 10 seconds

### Integration Tests
- Complete interaction flow: Hub → Gossip → Whisper → Back
- LLM with gossip: Verify gossip appears in prompt
- Memory viewer: Fetch 20 episodes, verify pagination

---

## Known Limitations (Post-Phase 2)

**Remaining Work for Phase 3:**
- No rate limiting on LLM requests
- No villager-to-villager gossip sharing
- No advanced pathfinding (uses simple teleportation)
- No performance optimizations for 20+ villagers
- No persistence of UI state across sessions

---

## Next Phase Preview

**Phase 3 (Polish & Optimization)** will add:
- Performance profiling and optimization
- Advanced pathfinding with A* algorithm
- Villager-to-villager gossip exchange
- Rate limiting and request throttling
- Comprehensive error recovery
- Production deployment guides

---

**Document Type:** Phase Plan  
**Phase:** 2 (Enhancement)  
**Status:** Ready for Implementation  
**Last Updated:** Feb 23, 2026
