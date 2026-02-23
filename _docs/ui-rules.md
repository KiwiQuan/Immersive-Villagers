# 🎨 UI Rules: Features & Layout

## Overview

This document defines the **structure, features, and visual standards** for all player-facing UI menus in the Immersive Villager AI project. All menus are built using the `@minecraft/server-ui` library (ModalFormData, ActionFormData, MessageFormData) and follow modern web design principles (Breadcrumbs, Progressive Disclosure, Feedback) within Minecraft's constraints.

---

## Design Philosophy

### Core Principles

1. **Immersive & Contextual:** UI should feel natural to the villager's personality and current state.
2. **Progressive Disclosure:** Only show information relevant to the player's current action. Hide advanced features until needed.
3. **Breadcrumb Navigation:** Every sub-menu must have a clear path back to the Hub.
4. **Visual Consistency:** Use Minecraft formatting codes systematically for hierarchy and readability.
5. **Minimal Text:** Prioritize clarity over verbosity. Use 1-2 sentence descriptions.

### Minecraft Formatting Codes

| Code | Purpose | Example |
|------|---------|---------|
| `§l` | **Bold Headers** | Menu titles, section headers |
| `§r` | Reset formatting | After headers to prevent style bleed |
| `§7` | Gray metadata | Timestamps, IDs, technical info |
| `§8` | Dark gray labels | Field names, subtle text |
| `§e` | Yellow highlights | Player names, important values |
| `§a` | Green positive | Trust score (high), constructive actions |
| `§c` | Red negative | Trust score (low), destructive actions |
| `§b` | Cyan accents | Villager names, vector values |
| `§d` | Magenta special | LLM responses, internal monologue |
| `§6` | Gold actions | Actionable buttons, next steps |

---

## Menu 1: The Interaction Hub (Main Menu)

### Purpose
The **entry point** when a player interacts with a villager. Provides contextual options based on the villager's Working Memory and relationship score.

### Layout Structure

**Menu Type:** `ActionFormData` (Button-based selection)

**Title:**
```javascript
`§l${villagerName}§r\n§8Villager ID: §7${villagerID.slice(0, 8)}...`
```

**Body:**
```javascript
// Dynamic greeting based on trust score and mood
const trustScore = getRelationshipScore(villagerID, playerID);
const mood = getWorkingMemory(villagerID).currentMood;

let greeting = "";
if (trustScore > 0.7) {
  greeting = `§aHello, ${playerName}! I'm in a good mood today.`;
} else if (trustScore < 0.3) {
  greeting = `§c*The villager eyes you suspiciously.*`;
} else {
  greeting = `§eOh, hello there.`;
}

// Show current mood vector (collapsed by default, expand via "Show Details")
const moodSummary = `§8Current Mood: §7[C: ${mood.C.toFixed(1)}, V: ${mood.V.toFixed(1)}, I: ${mood.I.toFixed(1)}, S: ${mood.S.toFixed(1)}, X: ${mood.X.toFixed(1)}]`;

body = `${greeting}\n\n${moodSummary}\n§8Last Interaction: §7${formatTimestamp(lastInteraction)}`;
```

**Buttons:**
1. `§6💬 Gossip & Whisper` → Opens Gossip & Whisper Menu (Menu 2)
2. `§6📖 View Memories` → Shows recent episodes (read-only list)
3. `§6🤝 Relationship Status` → Shows trust score and interaction history
4. `§6❌ Leave` → Closes menu

**Conditional Button (DEBUG_MODE only):**
- `§c⚙️ Debug Tools` → Opens Debug Modal (Menu 3)

### Visual Example

```
┌─────────────────────────────────────┐
│ §lBarrel the Builder§r               │
│ §8Villager ID: §7e4d8c2b1...         │
├─────────────────────────────────────┤
│ §aHello, Steve! I'm in a good mood  │
│ today.                               │
│                                      │
│ §8Current Mood: §7[C: 0.8, V: 0.9,  │
│ I: 0.3, S: 0.7, X: 0.1]             │
│ §8Last Interaction: §75 minutes ago │
├─────────────────────────────────────┤
│ [ §6💬 Gossip & Whisper ]            │
│ [ §6📖 View Memories ]               │
│ [ §6🤝 Relationship Status ]         │
│ [ §6❌ Leave ]                        │
│ [ §c⚙️ Debug Tools ] §7(DEV ONLY)    │
└─────────────────────────────────────┘
```

---

## Menu 2: Gossip & Whisper

### Purpose
Allows players to **talk to villagers** using natural language ("Whisper") and view what the villager has learned about the world ("Gossip").

### Layout Structure

**Menu Type:** `ActionFormData` (Main) + `ModalFormData` (Whisper Input)

**Title:**
```javascript
`§l💬 Gossip & Whisper§r\n§8${villagerName}`
```

**Body:**
```javascript
const recentGossip = getRecentGossip(villagerID, 5); // Last 5 memories

let gossipText = "§8What I've learned recently:\n";
if (recentGossip.length === 0) {
  gossipText += "§7(Nothing noteworthy yet)";
} else {
  recentGossip.forEach((memory, index) => {
    gossipText += `\n§b${index + 1}.§r ${memory.summary}\n§8   ${formatTimestamp(memory.timestamp)}`;
  });
}

body = `${gossipText}\n\n§8Want to tell me something?`;
```

**Buttons:**
1. `§6✍️ Whisper to ${villagerName}` → Opens text input modal (ModalFormData)
2. `§6🔄 Refresh Gossip` → Reloads gossip log from Layer 5 (PostgreSQL)
3. `§6📜 View Full Memory Log` → Opens paginated episode list (advanced)
4. `§6⬅️ Back to Hub` → Returns to Main Menu (Menu 1)

### Whisper Input Modal

**Menu Type:** `ModalFormData` (Text field)

**Title:**
```javascript
`§lWhisper to ${villagerName}§r`
```

**Body:**
```javascript
"§8Type your message below. The villager will process it and respond based on their personality and memory.\n\n§7(Max 256 characters)"
```

**Input Field:**
```javascript
.textField("§8Your message:", "e.g., Do you remember building that house?", undefined)
```

**Buttons:**
- `§aSubmit` → Sends whisper to Layer 2 (Vectorizer) as a new event
- `§cCancel` → Returns to Gossip & Whisper menu

**Post-Submission Behavior:**
1. Show loading message: `§e${villagerName} is thinking...`
2. Send whisper text to Backend as a `playerChat` event
3. Layer 6 (LLM) processes the whisper and generates a response
4. Layer 7 polls for `IntentPacket` and displays speech via ActionBar or chat

### Visual Example (Main)

```
┌─────────────────────────────────────┐
│ §l💬 Gossip & Whisper§r              │
│ §8Barrel the Builder                 │
├─────────────────────────────────────┤
│ §8What I've learned recently:        │
│                                      │
│ §b1.§r Steve built a diamond house  │
│    §8   2 hours ago                  │
│ §b2.§r Alex destroyed some dirt      │
│    §8   1 hour ago                   │
│ §b3.§r Steve gave me an emerald      │
│    §8   30 minutes ago               │
│                                      │
│ §8Want to tell me something?         │
├─────────────────────────────────────┤
│ [ §6✍️ Whisper to Barrel ]           │
│ [ §6🔄 Refresh Gossip ]              │
│ [ §6📜 View Full Memory Log ]        │
│ [ §6⬅️ Back to Hub ]                 │
└─────────────────────────────────────┘
```

---

## Menu 3: Debug Modal (Developer-Only)

### Purpose
A **developer dashboard** for CRUD operations on villager data, vector monitoring, and manual episode sealing. Only accessible when `DEBUG_MODE = true`.

### Access Control

**Requirement:**
```javascript
const DEBUG_MODE = world.getDynamicProperty('DEBUG_MODE') || false;
if (!DEBUG_MODE) return; // Hide button in Hub
```

**Permission Check (Optional):**
```javascript
// Only allow players with admin tag
if (!player.hasTag('admin')) {
  player.sendMessage('§cAccess Denied: DEBUG_MODE requires admin permissions.');
  return;
}
```

### Layout Structure

**Menu Type:** `ActionFormData` (Multi-level navigation)

**Title:**
```javascript
`§l⚙️ Debug Dashboard§r\n§8${villagerName} | §7${villagerID.slice(0, 8)}...`
```

**Body:**
```javascript
const wm = getWorkingMemory(villagerID);
const episode = getCurrentEpisode(villagerID); // Open episode from Layer 3

let debugInfo = `§8=== Working Memory ===\n`;
debugInfo += `§7Focus: §e${wm.currentFocus || 'None'}\n`;
debugInfo += `§7Mood: §b[C: ${wm.currentMood.C.toFixed(2)}, V: ${wm.currentMood.V.toFixed(2)}, I: ${wm.currentMood.I.toFixed(2)}, S: ${wm.currentMood.S.toFixed(2)}, X: ${wm.currentMood.X.toFixed(2)}]\n`;
debugInfo += `§7Shock State: ${wm.shockState ? '§cActive' : '§aInactive'}\n`;
debugInfo += `§7Last Update: §7${formatTimestamp(wm.lastUpdate)}\n\n`;

debugInfo += `§8=== Current Episode ===\n`;
if (episode) {
  debugInfo += `§7Episode ID: §7${episode.episodeID}\n`;
  debugInfo += `§7Vector Count: §7${episode.rawVectors.length}\n`;
  debugInfo += `§7Average: §b[C: ${episode.vectorAverage.C.toFixed(2)}, V: ${episode.vectorAverage.V.toFixed(2)}, I: ${episode.vectorAverage.I.toFixed(2)}, S: ${episode.vectorAverage.S.toFixed(2)}, X: ${episode.vectorAverage.X.toFixed(2)}]\n`;
  debugInfo += `§7Duration: §7${episode.duration}ms\n`;
} else {
  debugInfo += `§7No active episode.`;
}

body = debugInfo;
```

**Buttons:**
1. `§6🔍 View Live Vectors` → Shows real-time vector stream (auto-updates every 2 seconds)
2. `§6✂️ Seal Episode Now` → Forces Layer 3 to seal the current episode immediately
3. `§6🗑️ Clear Working Memory` → Resets all DynamicProperties for this villager
4. `§6📊 Vector History` → Opens paginated list of last 50 vectors
5. `§6🧠 Force LLM Request` → Manually triggers Layer 6 inference (ignores rate limits)
6. `§6💾 Backup to PostgreSQL` → Writes current state to database (bypasses debounce)
7. `§6📝 Edit Relationship Score` → Opens modal to manually set trust score
8. `§6⬅️ Back to Hub` → Returns to Main Menu (Menu 1)

### Sub-Menu: View Live Vectors

**Menu Type:** `MessageFormData` (Auto-refreshing display)

**Title:**
```javascript
`§l🔍 Live Vector Stream§r\n§8${villagerName}`
```

**Body:**
```javascript
const recentVectors = getRecentVectors(villagerID, 10); // Last 10 vectors from Layer 2

let vectorLog = `§8Real-time vectors (Last 10):\n\n`;
recentVectors.forEach((v, index) => {
  vectorLog += `§7${index + 1}. §r[§bC: ${v.C.toFixed(2)}§r, §bV: ${v.V.toFixed(2)}§r, §bI: ${v.I.toFixed(2)}§r, §bS: ${v.S.toFixed(2)}§r, §bX: ${v.X.toFixed(2)}§r]\n`;
  vectorLog += `   §8${v.rawEvent} | ${formatTimestamp(v.timestamp)}\n`;
});

body = vectorLog;
```

**Buttons:**
- `§aRefresh` → Reloads data (re-displays form)
- `§cClose` → Returns to Debug Modal

### Sub-Menu: Seal Episode Now

**Menu Type:** `MessageFormData` (Confirmation dialog)

**Title:**
```javascript
`§l⚠️ Confirm Episode Seal§r`
```

**Body:**
```javascript
const episode = getCurrentEpisode(villagerID);

body = `§8Are you sure you want to seal the current episode?\n\n`;
body += `§7Episode ID: §7${episode.episodeID}\n`;
body += `§7Vector Count: §7${episode.rawVectors.length}\n`;
body += `§7Duration: §7${episode.duration}ms\n\n`;
body += `§cThis will trigger Layer 3 sealing logic and write to PostgreSQL.`;
```

**Buttons:**
- `§aSeal Episode` → Calls `sealEpisode(villagerID, 'manual_seal')` and shows success message
- `§cCancel` → Returns to Debug Modal

### Visual Example

```
┌─────────────────────────────────────┐
│ §l⚙️ Debug Dashboard§r               │
│ §8Barrel the Builder | §7e4d8c2b1... │
├─────────────────────────────────────┤
│ §8=== Working Memory ===             │
│ §7Focus: §eSteve                     │
│ §7Mood: §b[C: 0.75, V: 0.82, I: 0.35│
│ S: 0.68, X: 0.15]                    │
│ §7Shock State: §aInactive            │
│ §7Last Update: §72 minutes ago       │
│                                      │
│ §8=== Current Episode ===            │
│ §7Episode ID: §7ep_1645564800_v456   │
│ §7Vector Count: §712                 │
│ §7Average: §b[C: 0.78, V: 0.85, I:   │
│ 0.32, S: 0.71, X: 0.14]             │
│ §7Duration: §715,234ms               │
├─────────────────────────────────────┤
│ [ §6🔍 View Live Vectors ]           │
│ [ §6✂️ Seal Episode Now ]            │
│ [ §6🗑️ Clear Working Memory ]        │
│ [ §6📊 Vector History ]              │
│ [ §6🧠 Force LLM Request ]           │
│ [ §6💾 Backup to PostgreSQL ]        │
│ [ §6📝 Edit Relationship Score ]     │
│ [ §6⬅️ Back to Hub ]                 │
└─────────────────────────────────────┘
```

---

## Visual Standards Summary

### Text Hierarchy

1. **Menu Title:** `§l{Title}§r\n§8{Subtitle/Context}`
2. **Section Headers:** `§8=== {Section} ===`
3. **Labels:** `§8{Label}: §7{Value}`
4. **Highlighted Values:** `§e{PlayerName}`, `§b{VectorValue}`, `§a{PositiveValue}`, `§c{NegativeValue}`
5. **Metadata:** `§7{Timestamp}`, `§7{ID}`, `§7{Count}`
6. **Actions:** `§6{Button Label}` (Gold for actionable buttons)

### Button Naming Conventions

- **Navigation:** `⬅️ Back to {Menu}`, `❌ Leave`
- **Actions:** `✍️ Whisper`, `🔄 Refresh`, `💾 Backup`
- **Data Viewing:** `🔍 View`, `📖 View Memories`, `📊 Vector History`
- **Destructive Actions:** `🗑️ Clear`, `§c⚠️ Confirm`, `§c✂️ Seal`

### Spacing & Readability

- **Paragraph Breaks:** Use `\n\n` to separate sections.
- **List Items:** Use `\n` for single-line spacing.
- **Indentation:** Use spaces `   ` (3 spaces) for nested content.
- **Max Line Length:** 40 characters (Minecraft UI limitation).

### Error & Loading Messages

**Loading States:**
```javascript
// Show via MessageFormData (non-blocking)
const loadingForm = new MessageFormData()
  .title(`§e⏳ Loading...`)
  .body(`§8${villagerName} is processing your request...\n\n§7This may take 2-5 seconds.`)
  .button1(`§aOK`);

loadingForm.show(player);
```

**Error Messages:**
```javascript
// Show via ActionBar (temporary)
player.onScreenDisplay.setActionBar(`§c❌ Error: Unable to reach backend. Try again.`);
```

**Success Messages:**
```javascript
// Show via ActionBar (temporary)
player.onScreenDisplay.setActionBar(`§a✅ Whisper sent! ${villagerName} is thinking...`);
```

---

## Component Reusability

### Helper Function: Format Timestamp

```javascript
/**
 * Converts milliseconds timestamp to human-readable format.
 * @param {number} timestamp - Milliseconds since epoch
 * @returns {string} Formatted time (e.g., "5 minutes ago")
 */
function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
}
```

### Helper Function: Build Menu Title

```javascript
/**
 * Builds a consistent menu title with villager context.
 * @param {string} title - Main title (e.g., "Gossip & Whisper")
 * @param {string} villagerName - Villager display name
 * @param {string} villagerID - Villager entity ID (optional, shows truncated)
 * @returns {string} Formatted title
 */
function buildMenuTitle(title, villagerName, villagerID = null) {
  let titleText = `§l${title}§r\n§8${villagerName}`;
  if (villagerID) {
    titleText += ` | §7${villagerID.slice(0, 8)}...`;
  }
  return titleText;
}
```

### Helper Function: Build Mood Display

```javascript
/**
 * Formats a [C, V, I, S, X] vector for display.
 * @param {Object} vector - { C, V, I, S, X }
 * @param {boolean} showLabels - Include axis labels (default: false)
 * @returns {string} Formatted vector
 */
function buildMoodDisplay(vector, showLabels = false) {
  if (showLabels) {
    return `§bC: ${vector.C.toFixed(2)}§r | §bV: ${vector.V.toFixed(2)}§r | §bI: ${vector.I.toFixed(2)}§r | §bS: ${vector.S.toFixed(2)}§r | §bX: ${vector.X.toFixed(2)}`;
  }
  return `§b[C: ${vector.C.toFixed(1)}, V: ${vector.V.toFixed(1)}, I: ${vector.I.toFixed(1)}, S: ${vector.S.toFixed(1)}, X: ${vector.X.toFixed(1)}]`;
}
```

---

## Menu Flow Diagram

```
┌─────────────────────────────────────┐
│   Interaction Hub (Main Menu)       │ ← Entry Point
│   [Gossip & Whisper]                │
│   [View Memories]                   │
│   [Relationship Status]             │
│   [Leave]                           │
│   [Debug Tools] (DEV)               │
└─────────────────────────────────────┘
          │
          ├──────────────────┐
          │                  │
          ▼                  ▼
┌──────────────────┐   ┌──────────────────┐
│ Gossip & Whisper │   │ Debug Dashboard  │
│ [Whisper Input]  │   │ [View Vectors]   │
│ [Refresh]        │   │ [Seal Episode]   │
│ [Full Log]       │   │ [Clear Memory]   │
│ [Back]           │   │ [Force LLM]      │
└──────────────────┘   │ [Backup]         │
          │            │ [Edit Score]     │
          └────────────┤ [Back]           │
                       └──────────────────┘
```

---

## File Structure

**Recommended UI Module Organization:**
```
scripts/
├── ui/
│   ├── hub.js           # Main Menu (Interaction Hub)
│   ├── gossip.js        # Gossip & Whisper Menu
│   ├── debug.js         # Debug Modal
│   ├── helpers.js       # Shared formatting functions
│   └── index.js         # Entry point, routes to menus
└── main.js              # Registers entity interaction events
```

---

## Document Changelog

**Version 1.0 (Feb 23, 2026):**
- Initial UI features and layout specification
- Defined three main menus: Hub, Gossip & Whisper, Debug Modal
- Established visual standards using Minecraft formatting codes
- Added helper functions and component reusability guidelines

---

**Document Type:** UI Design Specification  
**Author:** Senior Minecraft Scripting Engineer  
**Status:** Approved (Ready for Implementation)  
**Version:** 1.0  
**Last Updated:** Feb 23, 2026
