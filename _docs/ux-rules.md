# 🔄 UX Rules: User-Flow & Logic

## Overview

This document defines the **user experience flow, state management, and interaction logic** for all UI menus in the Immersive Villager AI project. It focuses on how menus respond to user actions, handle async operations, and gracefully degrade when systems fail.

---

## Design Philosophy

### Core Principles

1. **Breadcrumb Navigation:** Every sub-menu must provide a clear path back to the Interaction Hub.
2. **Async Feedback:** Since the Brain (Layer 6) is a "Slow Gear," users must receive immediate acknowledgment of actions.
3. **Contextual Triggers:** Menus must close or adjust based on world state (player distance, villager health, etc.).
4. **Input Sanitization:** All user input must be validated before being sent to the Backend as a vector.
5. **Graceful Degradation:** If the Backend or LLM is unresponsive, fallback to "Instinct" (hardcoded responses).

---

## 1. Breadcrumb Logic: Navigation Flow

### Rule: Every Menu Has a Back Button

**Requirement:** All sub-menus must include a `⬅️ Back to {ParentMenu}` button as the last button in the list.

**Implementation:**
```javascript
/**
 * Opens a menu with automatic breadcrumb tracking.
 * @param {Player} player - The player entity
 * @param {string} menuName - Name of the menu to open
 * @param {Object} context - Menu-specific data (villagerID, etc.)
 */
function openMenu(player, menuName, context) {
  // Store breadcrumb in player's DynamicProperties (persists across menu closures)
  const breadcrumbs = JSON.parse(player.getDynamicProperty('menu_breadcrumbs') || '[]');
  breadcrumbs.push(menuName);
  player.setDynamicProperty('menu_breadcrumbs', JSON.stringify(breadcrumbs));

  // Open the corresponding menu
  switch (menuName) {
    case 'hub':
      showInteractionHub(player, context.villagerID);
      break;
    case 'gossip':
      showGossipMenu(player, context.villagerID);
      break;
    case 'debug':
      showDebugModal(player, context.villagerID);
      break;
    default:
      console.error(`[UI] Unknown menu: ${menuName}`);
  }
}

/**
 * Navigates back to the previous menu in the breadcrumb stack.
 * @param {Player} player - The player entity
 * @param {Object} context - Menu-specific data (villagerID, etc.)
 */
function goBack(player, context) {
  const breadcrumbs = JSON.parse(player.getDynamicProperty('menu_breadcrumbs') || '[]');
  
  if (breadcrumbs.length <= 1) {
    // Already at root (Interaction Hub), close menu
    player.setDynamicProperty('menu_breadcrumbs', '[]');
    return;
  }

  // Remove current menu from stack
  breadcrumbs.pop();
  
  // Get parent menu
  const parentMenu = breadcrumbs[breadcrumbs.length - 1];
  player.setDynamicProperty('menu_breadcrumbs', JSON.stringify(breadcrumbs));

  // Open parent menu
  openMenu(player, parentMenu, context);
}
```

**Example Flow:**
```
Hub → Gossip & Whisper → Whisper Input
 └─ Breadcrumb: ['hub', 'gossip', 'whisper_input']

Player clicks "Back" in Whisper Input
 → Opens 'gossip'
 → Breadcrumb: ['hub', 'gossip']

Player clicks "Back" in Gossip & Whisper
 → Opens 'hub'
 → Breadcrumb: ['hub']

Player clicks "Leave" in Hub
 → Breadcrumb: []
 → Menu closes
```

### Rule: "Leave" vs. "Back"

- **Leave:** Closes all menus and clears breadcrumb stack (only on Hub).
- **Back:** Returns to parent menu and preserves breadcrumb stack.

**Implementation:**
```javascript
// In Interaction Hub (hub.js)
form.button(`§6❌ Leave`, () => {
  player.setDynamicProperty('menu_breadcrumbs', '[]'); // Clear stack
  // Menu auto-closes when form ends
});

// In Sub-Menus (gossip.js, debug.js, etc.)
form.button(`§6⬅️ Back to Hub`, () => {
  goBack(player, { villagerID });
});
```

---

## 2. Async Feedback: Handling Slow Gear Operations

### Rule: Immediate Acknowledgment for All Actions

**Problem:** Layer 6 (LLM) takes 1-5 seconds to process requests. Players must know their action was received.

**Solution:** Use **optimistic UI updates** and **loading states**.

### Pattern 1: Whisper Input (2-5 Second Delay)

**User Flow:**
1. Player submits whisper text
2. **Immediately** show success message: `§a✅ Whisper sent! The villager is thinking...`
3. Send HTTP POST to Backend (Layer 5) in background
4. Backend queues LLM request (Layer 6)
5. After 1-5 seconds, villager responds via ActionBar or chat

**Implementation:**
```javascript
/**
 * Handles whisper submission with async feedback.
 * @param {Player} player - The player entity
 * @param {string} villagerID - Villager entity ID
 * @param {string} whisperText - User input text
 */
async function handleWhisperSubmission(player, villagerID, whisperText) {
  // 1. Immediate feedback (optimistic UI)
  player.onScreenDisplay.setActionBar(`§a✅ Whisper sent! The villager is thinking...`);

  // 2. Validate and sanitize input
  const sanitizedText = sanitizeWhisper(whisperText);
  if (!sanitizedText) {
    player.onScreenDisplay.setActionBar(`§c❌ Invalid input. Please try again.`);
    return;
  }

  // 3. Send to Backend (non-blocking)
  try {
    const response = await http.post('http://localhost:3000/api/memory/whisper', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        villagerID,
        actorID: player.id,
        whisperText: sanitizedText,
        timestamp: Date.now()
      })
    });

    const data = JSON.parse(response.body);
    
    if (data.status === 'queued') {
      // LLM request is queued, poll for result
      pollForVillagerResponse(player, villagerID, data.requestID);
    } else {
      throw new Error('Unexpected backend response');
    }
  } catch (err) {
    console.error(`[UI] Whisper submission failed: ${err.message}`);
    player.onScreenDisplay.setActionBar(`§c❌ Failed to send whisper. Backend may be offline.`);
  }
}

/**
 * Polls the Backend for villager response.
 * @param {Player} player - The player entity
 * @param {string} villagerID - Villager entity ID
 * @param {string} requestID - LLM request ID
 */
function pollForVillagerResponse(player, villagerID, requestID) {
  let pollAttempts = 0;
  const maxAttempts = 10; // 20 seconds total (poll every 2 seconds)

  const pollInterval = system.runInterval(() => {
    pollAttempts++;

    http.get(`http://localhost:3000/api/brain/poll?villagerID=${villagerID}`)
      .then(response => {
        const data = JSON.parse(response.body);

        if (data.status === 'ready') {
          // LLM response is ready
          system.clearRun(pollInterval);
          
          if (data.intentPacket.action === 'speak') {
            player.onScreenDisplay.setActionBar(`§e[${getVillagerName(villagerID)}]: ${data.intentPacket.speechText}`);
          }
        } else if (pollAttempts >= maxAttempts) {
          // Timeout, fallback to instinct
          system.clearRun(pollInterval);
          player.onScreenDisplay.setActionBar(`§7[${getVillagerName(villagerID)}]: *stares blankly*`);
          console.warn(`[UI] Polling timeout for villager ${villagerID}`);
        }
      })
      .catch(err => {
        system.clearRun(pollInterval);
        console.error(`[UI] Polling failed: ${err.message}`);
      });
  }, 40); // Poll every 40 ticks (2 seconds)
}
```

### Pattern 2: Refresh Gossip (100-300ms Delay)

**User Flow:**
1. Player clicks "Refresh Gossip"
2. Show brief loading indicator (optional, only if delay > 300ms)
3. Fetch data from Backend (Layer 5)
4. Re-render menu with updated gossip log

**Implementation:**
```javascript
/**
 * Refreshes gossip log from Backend.
 * @param {Player} player - The player entity
 * @param {string} villagerID - Villager entity ID
 */
async function refreshGossip(player, villagerID) {
  // Show loading message (optional)
  player.onScreenDisplay.setActionBar(`§e⏳ Refreshing gossip...`);

  try {
    const response = await http.get(`http://localhost:3000/api/memory/gossip?villagerID=${villagerID}&limit=5`);
    const data = JSON.parse(response.body);

    if (data.status === 'success') {
      // Re-open menu with fresh data
      showGossipMenu(player, villagerID, data.gossip);
    } else {
      throw new Error('Failed to fetch gossip');
    }
  } catch (err) {
    console.error(`[UI] Gossip refresh failed: ${err.message}`);
    player.onScreenDisplay.setActionBar(`§c❌ Failed to refresh gossip. Backend may be offline.`);
  }
}
```

### Pattern 3: Force LLM Request (Debug, 1-5 Second Delay)

**User Flow:**
1. Developer clicks "Force LLM Request"
2. Show confirmation dialog
3. After confirmation, show loading message
4. Poll for result every 2 seconds (max 10 attempts)
5. Display result or timeout message

**Implementation:**
```javascript
/**
 * Forces an LLM request for a villager (DEBUG_MODE only).
 * @param {Player} player - The player entity
 * @param {string} villagerID - Villager entity ID
 */
async function forceLLMRequest(player, villagerID) {
  // Show confirmation dialog
  const confirmForm = new MessageFormData()
    .title(`§l⚠️ Confirm LLM Request§r`)
    .body(`§8This will queue an LLM inference request for ${getVillagerName(villagerID)}.\n\n§cThis may take 1-5 seconds.`)
    .button1(`§aConfirm`)
    .button2(`§cCancel`);

  confirmForm.show(player).then(response => {
    if (response.selection === 0) {
      // User confirmed, send request
      player.onScreenDisplay.setActionBar(`§e⏳ LLM request queued...`);

      http.post('http://localhost:3000/api/brain/request', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villagerID,
          actorID: player.id,
          trigger: 'manual_debug',
          priority: 'high'
        })
      }).then(res => {
        const data = JSON.parse(res.body);
        if (data.status === 'queued') {
          pollForVillagerResponse(player, villagerID, data.requestID);
        }
      }).catch(err => {
        player.onScreenDisplay.setActionBar(`§c❌ Failed to queue LLM request.`);
        console.error(`[UI] Force LLM failed: ${err.message}`);
      });
    }
  });
}
```

---

## 3. Contextual Triggers: Auto-Close & State Validation

### Rule: Close Menu if Player Walks Too Far

**Requirement:** If the player moves more than 10 blocks away from the villager, close the menu automatically.

**Implementation:**
```javascript
/**
 * Monitors player-villager proximity and closes menu if too far.
 * @param {Player} player - The player entity
 * @param {Entity} villagerEntity - The villager entity
 */
function monitorProximity(player, villagerEntity) {
  const proximityCheck = system.runInterval(() => {
    // Check if entities are still valid
    if (!player.isValid() || !villagerEntity.isValid()) {
      system.clearRun(proximityCheck);
      return;
    }

    // Calculate distance
    const distance = getDistance(player.location, villagerEntity.location);

    if (distance > 10) {
      // Player too far, close menu
      player.onScreenDisplay.setActionBar(`§7You walked too far from ${getVillagerName(villagerEntity.id)}.`);
      player.setDynamicProperty('menu_breadcrumbs', '[]'); // Clear breadcrumb stack
      system.clearRun(proximityCheck);
      
      // Force close any open UI (Minecraft auto-closes if player moves too far, but we log it)
      console.warn(`[UI] Menu auto-closed: Player too far from villager ${villagerEntity.id}`);
    }
  }, 10); // Check every 10 ticks (0.5 seconds)
}

/**
 * Calculates Euclidean distance between two locations.
 * @param {Object} loc1 - { x, y, z }
 * @param {Object} loc2 - { x, y, z }
 * @returns {number} Distance in blocks
 */
function getDistance(loc1, loc2) {
  const dx = loc1.x - loc2.x;
  const dy = loc1.y - loc2.y;
  const dz = loc1.z - loc2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
```

**Usage:**
```javascript
// In hub.js, when opening the Interaction Hub
function showInteractionHub(player, villagerID) {
  const villagerEntity = world.getEntity(villagerID);
  if (!villagerEntity || !villagerEntity.isValid()) {
    player.sendMessage('§cVillager no longer exists.');
    return;
  }

  // Start proximity monitoring
  monitorProximity(player, villagerEntity);

  // Build and show form
  const form = new ActionFormData()
    .title(buildMenuTitle('Interaction Hub', getVillagerName(villagerID), villagerID))
    .body(buildHubBody(villagerID, player.id))
    .button(`§6💬 Gossip & Whisper`)
    .button(`§6📖 View Memories`)
    .button(`§6🤝 Relationship Status`)
    .button(`§6❌ Leave`);

  form.show(player).then(response => {
    if (response.selection === 0) {
      openMenu(player, 'gossip', { villagerID });
    } else if (response.selection === 1) {
      openMenu(player, 'memories', { villagerID });
    } else if (response.selection === 2) {
      openMenu(player, 'relationship', { villagerID });
    } else if (response.selection === 3) {
      player.setDynamicProperty('menu_breadcrumbs', '[]');
    }
  });
}
```

### Rule: Close Menu if Villager Takes Damage

**Requirement:** If the villager takes damage or dies while the menu is open, immediately close the menu and notify the player.

**Implementation:**
```javascript
// Subscribe to entity damage event (in main.js)
world.afterEvents.entityHurt.subscribe(event => {
  const villager = event.hurtEntity;
  
  // Check if this is a villager with an active menu
  if (villager.typeId !== 'minecraft:villager_v2') return;

  // Find all players with this villager's menu open
  const players = world.getAllPlayers();
  for (const player of players) {
    const breadcrumbs = JSON.parse(player.getDynamicProperty('menu_breadcrumbs') || '[]');
    const activeVillagerID = player.getDynamicProperty('active_villager_menu');

    if (activeVillagerID === villager.id && breadcrumbs.length > 0) {
      // Villager is damaged and this player has their menu open
      player.onScreenDisplay.setActionBar(`§c⚠️ ${getVillagerName(villager.id)} was hurt! Menu closed.`);
      player.setDynamicProperty('menu_breadcrumbs', '[]');
      player.setDynamicProperty('active_villager_menu', undefined);
    }
  }
});
```

### Rule: Disable Menu if Backend is Offline

**Requirement:** If the Backend (Node.js) is unreachable, disable menu features that depend on Layer 5 or Layer 6.

**Implementation:**
```javascript
/**
 * Checks if the Backend is reachable.
 * @returns {Promise<boolean>} True if Backend is online
 */
async function isBackendOnline() {
  try {
    const response = await http.get('http://localhost:3000/api/health', { timeout: 2000 });
    return response.status === 200;
  } catch (err) {
    return false;
  }
}

/**
 * Shows the Interaction Hub with fallback logic if Backend is offline.
 * @param {Player} player - The player entity
 * @param {string} villagerID - Villager entity ID
 */
async function showInteractionHub(player, villagerID) {
  const backendOnline = await isBackendOnline();

  const form = new ActionFormData()
    .title(buildMenuTitle('Interaction Hub', getVillagerName(villagerID), villagerID));

  if (!backendOnline) {
    form.body(`§c⚠️ Backend is offline. Some features are unavailable.\n\n§8The villager can only use local memory (Working Memory).`);
    form.button(`§8💬 Gossip & Whisper §7(Offline)`); // Grayed out
    form.button(`§8📖 View Memories §7(Offline)`);
    form.button(`§6❌ Leave`);

    form.show(player).then(response => {
      if (response.selection === 0 || response.selection === 1) {
        player.onScreenDisplay.setActionBar(`§c❌ This feature requires Backend connection.`);
      } else if (response.selection === 2) {
        player.setDynamicProperty('menu_breadcrumbs', '[]');
      }
    });
  } else {
    // Normal flow (Backend online)
    form.body(buildHubBody(villagerID, player.id));
    form.button(`§6💬 Gossip & Whisper`);
    form.button(`§6📖 View Memories`);
    form.button(`§6🤝 Relationship Status`);
    form.button(`§6❌ Leave`);

    form.show(player).then(response => {
      if (response.selection === 0) {
        openMenu(player, 'gossip', { villagerID });
      } else if (response.selection === 1) {
        openMenu(player, 'memories', { villagerID });
      } else if (response.selection === 2) {
        openMenu(player, 'relationship', { villagerID });
      } else if (response.selection === 3) {
        player.setDynamicProperty('menu_breadcrumbs', '[]');
      }
    });
  }
}
```

---

## 4. Input Handling: Whisper Sanitization

### Rule: Sanitize All User Input

**Requirement:** Prevent SQL injection, XSS attacks, and profanity from entering the Backend.

**Implementation:**
```javascript
/**
 * Sanitizes whisper text before sending to Backend.
 * @param {string} whisperText - Raw user input
 * @returns {string|null} Sanitized text or null if invalid
 */
function sanitizeWhisper(whisperText) {
  // Remove leading/trailing whitespace
  let sanitized = whisperText.trim();

  // Check if empty
  if (sanitized.length === 0) {
    return null;
  }

  // Limit to 256 characters
  if (sanitized.length > 256) {
    sanitized = sanitized.slice(0, 256);
  }

  // Remove non-printable characters (control characters)
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Escape special characters for JSON safety
  sanitized = sanitized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // Optional: Profanity filter (basic word list)
  const profanityList = ['badword1', 'badword2', 'badword3'];
  const lowerCaseSanitized = sanitized.toLowerCase();
  for (const word of profanityList) {
    if (lowerCaseSanitized.includes(word)) {
      return null; // Reject if profanity detected
    }
  }

  return sanitized;
}
```

**Error Handling:**
```javascript
// In handleWhisperSubmission()
const sanitizedText = sanitizeWhisper(whisperText);
if (!sanitizedText) {
  player.onScreenDisplay.setActionBar(`§c❌ Invalid input. Please avoid special characters or profanity.`);
  return;
}
```

---

## 5. Graceful Degradation: Fallback Logic

### Rule: Always Provide Fallback Behavior

**Scenarios:**
1. **Backend Unreachable:** Use Working Memory (DynamicProperties) only.
2. **LLM Timeout:** Fall back to Instinct (hardcoded responses).
3. **PostgreSQL Down:** Skip memory writes, continue with current state.

### Scenario 1: Backend Unreachable

**Implementation:**
```javascript
/**
 * Fetches gossip with fallback to local Working Memory.
 * @param {Player} player - The player entity
 * @param {string} villagerID - Villager entity ID
 */
async function fetchGossipWithFallback(player, villagerID) {
  try {
    // Try to fetch from Backend (Layer 5)
    const response = await http.get(`http://localhost:3000/api/memory/gossip?villagerID=${villagerID}&limit=5`);
    const data = JSON.parse(response.body);

    if (data.status === 'success') {
      return data.gossip;
    }
  } catch (err) {
    console.warn(`[UI] Backend unreachable, using local Working Memory fallback`);
  }

  // Fallback: Use DynamicProperties (Layer 4)
  const villagerEntity = world.getEntity(villagerID);
  if (!villagerEntity || !villagerEntity.isValid()) {
    return [];
  }

  const workingMemory = getWorkingMemory(villagerEntity);
  return [
    {
      summary: `§7(Local Memory) Last interaction with ${workingMemory.currentFocus || 'Unknown'}`,
      timestamp: workingMemory.lastUpdate
    }
  ];
}
```

### Scenario 2: LLM Timeout

**Implementation:**
```javascript
// In pollForVillagerResponse()
if (pollAttempts >= maxAttempts) {
  // Timeout, fallback to instinct
  system.clearRun(pollInterval);
  
  const fallbackResponse = getInstinctResponse(villagerID, player.id);
  player.onScreenDisplay.setActionBar(`§7[${getVillagerName(villagerID)}]: ${fallbackResponse}`);
  
  console.warn(`[UI] LLM timeout for villager ${villagerID}, using instinct`);
}

/**
 * Generates a hardcoded fallback response based on Working Memory.
 * @param {string} villagerID - Villager entity ID
 * @param {string} playerID - Player entity ID
 * @returns {string} Fallback response text
 */
function getInstinctResponse(villagerID, playerID) {
  const villagerEntity = world.getEntity(villagerID);
  if (!villagerEntity || !villagerEntity.isValid()) {
    return '*stares blankly*';
  }

  const wm = getWorkingMemory(villagerEntity);
  const relationshipScore = getRelationshipScore(villagerID, playerID);

  // Simple rule-based responses
  if (relationshipScore > 0.7) {
    return 'Hello, friend! How are you today?';
  } else if (relationshipScore < 0.3) {
    return '*looks away suspiciously*';
  } else if (wm.shockState) {
    return '*breathing heavily*';
  } else {
    return 'Hmm...';
  }
}
```

### Scenario 3: PostgreSQL Down

**Implementation:**
```javascript
// In Backend (Node.js, routes/memory.js)
app.post('/api/memory/episode', async (req, res) => {
  try {
    const { villagerID, episodeSummary } = req.body;
    
    // Attempt to write to PostgreSQL
    const result = await writeEpisode(episodeSummary);
    
    res.json({ status: 'success', episodeID: result.id });
  } catch (err) {
    logger.error({ error: err.message }, '[Layer 5] PostgreSQL write failed');
    
    // Return success anyway (degraded mode)
    res.json({
      status: 'degraded',
      message: 'Episode saved to Working Memory only. PostgreSQL unavailable.',
      episodeID: null
    });
  }
});
```

---

## 6. Menu State Persistence

### Rule: Preserve Menu State Across Server Restarts

**Requirement:** If a player is viewing a menu when the server restarts, restore their breadcrumb stack on reconnect.

**Implementation:**
```javascript
// On player join (in main.js)
world.afterEvents.playerSpawn.subscribe(event => {
  const player = event.player;

  // Check if player had an active menu before disconnect
  const breadcrumbs = JSON.parse(player.getDynamicProperty('menu_breadcrumbs') || '[]');
  if (breadcrumbs.length > 0) {
    // Clear stale breadcrumbs (don't auto-reopen menus)
    player.setDynamicProperty('menu_breadcrumbs', '[]');
    player.setDynamicProperty('active_villager_menu', undefined);
  }
});
```

**Note:** Minecraft's UI library automatically closes menus on disconnect, so we clear stale breadcrumbs to prevent confusion.

---

## 7. Error Messages & User Feedback

### Standard Error Messages

| Scenario | Message | Display Method |
|----------|---------|----------------|
| Whisper submission failed | `§c❌ Failed to send whisper. Backend may be offline.` | ActionBar |
| Backend unreachable | `§c⚠️ Backend is offline. Some features are unavailable.` | Menu body |
| LLM timeout | `§7[Villager]: *stares blankly*` | ActionBar |
| Invalid whisper input | `§c❌ Invalid input. Please avoid special characters or profanity.` | ActionBar |
| Player too far | `§7You walked too far from [Villager].` | ActionBar |
| Villager damaged | `§c⚠️ [Villager] was hurt! Menu closed.` | ActionBar |

### Standard Success Messages

| Scenario | Message | Display Method |
|----------|---------|----------------|
| Whisper sent | `§a✅ Whisper sent! The villager is thinking...` | ActionBar |
| Gossip refreshed | `§a✅ Gossip refreshed!` | ActionBar |
| Episode sealed (DEBUG) | `§a✅ Episode sealed successfully.` | ActionBar |
| Memory cleared (DEBUG) | `§a✅ Working Memory cleared.` | ActionBar |

---

## 8. Performance Considerations

### Rule: Debounce Rapid Button Clicks

**Problem:** Players may spam buttons, causing multiple HTTP requests or menu re-renders.

**Solution:** Use cooldown timers stored in DynamicProperties.

**Implementation:**
```javascript
/**
 * Checks if player is on cooldown for a specific action.
 * @param {Player} player - The player entity
 * @param {string} actionName - Action identifier (e.g., 'whisper_submit')
 * @param {number} cooldownMs - Cooldown duration in milliseconds
 * @returns {boolean} True if on cooldown
 */
function isOnCooldown(player, actionName, cooldownMs) {
  const lastAction = player.getDynamicProperty(`cooldown_${actionName}`) || 0;
  const now = Date.now();

  if (now - lastAction < cooldownMs) {
    return true;
  }

  // Set new cooldown
  player.setDynamicProperty(`cooldown_${actionName}`, now);
  return false;
}

// Usage in handleWhisperSubmission()
if (isOnCooldown(player, 'whisper_submit', 3000)) {
  player.onScreenDisplay.setActionBar(`§c⏳ Please wait before sending another whisper.`);
  return;
}
```

---

## 9. Menu Flow Diagram (Complete)

```
┌────────────────────────────────────────────────────────────────┐
│                       Player Interacts with Villager            │
│                                 ↓                               │
│                    Check Backend Status                         │
│                  ┌─────────┴─────────┐                         │
│              Online                 Offline                     │
│                 ↓                       ↓                       │
│        Interaction Hub          Interaction Hub (Degraded)     │
│        [Full Features]          [Working Memory Only]          │
│                 ↓                       ↓                       │
│        ┌────────┴────────┐             │                       │
│        │                 │             └────────────────┐      │
│  Gossip & Whisper   Debug Modal                         │      │
│        ↓                 ↓                               │      │
│   Whisper Input      Seal Episode                       │      │
│        ↓                 ↓                               │      │
│   Sanitize Input    Confirm Action                      │      │
│        ↓                 ↓                               │      │
│   Send to Backend   Force LLM Request                   │      │
│        ↓                 ↓                               │      │
│   Poll for Response  Poll for Response                  │      │
│        ↓                 ↓                               │      │
│   [Success/Timeout] [Success/Timeout/Fallback]          │      │
│        ↓                 ↓                               │      │
│   Display Response   Display Result                     │      │
│        ↓                 ↓                               │      │
│        └─────────────────┴───────────────────────────────┘     │
│                               ↓                                 │
│                    Player Clicks "Back" or "Leave"             │
│                               ↓                                 │
│                         Menu Closes                             │
└────────────────────────────────────────────────────────────────┘

Contextual Triggers (Active During Menu):
- Player moves >10 blocks → Auto-close
- Villager takes damage → Auto-close
- Backend goes offline → Disable features
```

---

## 10. File Structure (UX Logic)

**Recommended UX Module Organization:**
```
scripts/
├── ui/
│   ├── hub.js           # Main Menu logic
│   ├── gossip.js        # Gossip & Whisper logic
│   ├── debug.js         # Debug Modal logic
│   ├── helpers.js       # Shared formatting functions
│   ├── state.js         # Breadcrumb & menu state management
│   ├── feedback.js      # Async feedback (polling, loading states)
│   └── validation.js    # Input sanitization & validation
└── main.js              # Entry point, event listeners
```

---

## Document Changelog

**Version 1.0 (Feb 23, 2026):**
- Initial UX flow and state management specification
- Defined breadcrumb navigation logic
- Established async feedback patterns for Slow Gear operations
- Added contextual trigger rules (proximity, damage, backend status)
- Defined input sanitization and graceful degradation patterns
- Added performance optimizations (cooldowns, debouncing)

---

**Document Type:** UX Design Specification  
**Author:** Senior Minecraft Scripting Engineer  
**Status:** Approved (Ready for Implementation)  
**Version:** 1.0  
**Last Updated:** Feb 23, 2026
