# 🎮 UX Rules — Debug Interface User Experience

> **Purpose:** User experience design principles, navigation flows, and interaction patterns for the Immersive Villagers debug system.  
> **Last Updated:** March 15, 2026  
> **Companion Doc:** `ui-rules.md`

---

## 1. Core UX Principles

### Mental Model: Two Interaction Modes

The debug system operates in two distinct modes based on user intent:

**1. Exploration Mode (Forms)**
- **Use Case:** "I want to see what's happening with this villager"
- **Pattern:** Navigate → Select → Inspect → Return
- **Tools:** ActionFormData, ModalFormData
- **Pace:** User-controlled, blocking, static snapshots

**2. Monitoring Mode (Chat Commands)**
- **Use Case:** "I want to watch this system in real-time"
- **Pattern:** Command → Stream → Stop
- **Tools:** Chat commands, watch mode
- **Pace:** Continuous, non-blocking, live updates

**Design Philosophy:** Never force users to choose between modes - make both available and let context determine usage.

---

## 2. Primary User Journeys

### Journey A: First-Time Admin Inspection

**User Goal:** "I want to understand how my villagers' brains are working"

**Flow:**

```
User Action                     System Response                 Next State
────────────────────────────────────────────────────────────────────────────
1. Types "!debug menu"          Opens main menu (7 buttons)     → Menu open
2. Taps "Brain Monitor"         Shows villager selector         → Selecting
3. Selects "Villager #456"      Displays 7-layer status form    → Inspecting
4. Reads layer states           User processes info             → Understanding
5. Closes form (ESC)            Returns to game                 → Complete
6. (Optional) "!debug brain"    Quick chat version shown        → Satisfied
```

**User Satisfaction Criteria:**
- ✅ Found info in <30 seconds
- ✅ Understood layer status without documentation
- ✅ Didn't feel overwhelmed by data

**Common Failure Points:**
- ❌ Too many villagers → Can't find target (Solution: Add search/filter)
- ❌ Unknown terminology → Confused by "sequencer buffer" (Solution: Add tooltips in labels)
- ❌ Stale data → Form shows old state (Solution: Display timestamp)

---

### Journey B: Active Development Debugging

**User Goal:** "I'm testing a feature and need real-time feedback"

**Flow:**

```
User Action                     System Response                 Next State
────────────────────────────────────────────────────────────────────────────
1. Types "!debug villager list" Lists 8 tracked villagers       → Browsing
2. Types "!debug villager 3"    Focuses on Villager #456        → Selected
3. Types "!debug watch mood"    Starts streaming mood updates   → Monitoring
4. Performs test action         Updates appear in chat (2s lag) → Observing
5. Sees mood change             Validates behavior works        → Confirmed
6. Types "!debug stop"          Watch mode exits                → Complete
```

**User Satisfaction Criteria:**
- ✅ Real-time updates visible (max 2s latency)
- ✅ Can test without repeatedly opening forms
- ✅ Clear indication of watched data
- ✅ Easy exit mechanism

**Common Failure Points:**
- ❌ Chat spam → Can't read updates (Solution: Max 1 update per 2s)
- ❌ Forgot which villager selected (Solution: Show name in every update)
- ❌ Watch mode doesn't stop (Solution: Auto-stop on disconnect)

---

### Journey C: Performance Troubleshooting

**User Goal:** "My server is lagging, I need to find the bottleneck"

**Flow:**

```
User Action                     System Response                 Next State
────────────────────────────────────────────────────────────────────────────
1. Types "!debug perf summary"  Shows tick budget table         → Analyzing
2. Sees L2 at 23ms (red)        Identifies bottleneck           → Diagnosed
3. Types "!debug brain layers"  Confirms L2 processing load     → Confirmed
4. Opens "!debug menu"          Navigates to Settings           → Configuring
5. Toggles AI mode to MONO      Reduces L2 to <1ms              → Testing
6. Types "!debug perf summary"  Validates fix worked            → Resolved
```

**User Satisfaction Criteria:**
- ✅ Identified issue in <60 seconds
- ✅ Clear visual indication of problem (red color, warning)
- ✅ Actionable solution provided
- ✅ Can verify fix without external tools

**Common Failure Points:**
- ❌ No clear threshold → Can't tell what's "bad" (Solution: Color-code by budget)
- ❌ Too much data → Overwhelmed (Solution: Show only problematic layers)
- ❌ No suggestions → User doesn't know how to fix (Solution: Add "💡 Tip" messages)

---

### Journey D: Relationship Debugging

**User Goal:** "Why is this villager hostile to me?"

**Flow:**

```
User Action                     System Response                 Next State
────────────────────────────────────────────────────────────────────────────
1. Types "!debug menu"          Opens main menu                 → Menu
2. Taps "Relationships"         Shows villager selector         → Selecting
3. Selects hostile villager     Shows list of known players     → Viewing
4. Taps their player name       Shows trust: -0.6 (Distrustful)→ Inspecting
5. Scrolls to "Recent Episodes" Sees "Attacked villager (5m ago)"→ Understanding
6. Closes form                  Returns to game                 → Informed
```

**User Satisfaction Criteria:**
- ✅ Understood relationship status immediately
- ✅ Found root cause of hostility
- ✅ Can take corrective action (gift items, etc.)

**Common Failure Points:**
- ❌ No context → User sees "-0.6" but doesn't know scale (Solution: Add "Distrustful" label)
- ❌ Episodes too technical → "semantic_vector_manual: [...]" (Solution: Show human-readable summaries)

---

## 3. Navigation Patterns

### Pattern 1: Hub-and-Spoke (Form Navigation)

**Structure:**

```
                    Main Menu (Hub)
                         ↓
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   Brain Monitor    Working Memory   Relationships
        ↓                ↓                ↓
   [Villager         [Villager       [Villager
    Selector]         Selector]       Selector]
        ↓                ↓                ↓
   Layer Status     Memory Details  Player List
                                         ↓
                                  Trust Details
```

**User Flow Rules:**
1. **Always return to hub** after closing leaf form (no dead ends)
2. **Consistent selector pattern** (villager selector appears before detail view)
3. **Breadcrumb awareness** (title shows current location, e.g., "Brain Monitor - Villager #456")

**Implementation:**

```javascript
// Every leaf form should provide "Back to Menu" option
form.show(player).then((response) => {
  if (response.canceled) {
    // Option A: Return to parent menu
    showMainDebugMenu(player);
    
    // Option B: Return to game (let user decide)
    // (default behavior)
  }
});
```

**Depth Limit:** Max 3 levels deep (Hub → Category → Details)

---

### Pattern 2: Command-Line Interface (Chat Commands)

**Mental Model:** Similar to Unix command line

**Structure:**

```
!debug <noun> <verb> [args]
       ↓      ↓      ↓
    Category Action Parameters

Examples:
!debug brain   status         → Show brain status
!debug memory  current        → Show current memory
!debug watch   mood           → Stream mood updates
!debug villager select 3      → Focus on villager #3
```

**User Flow Rules:**
1. **Noun-first** (what) then **verb** (action) - matches natural language
2. **Sane defaults** (omit verb → use most common action)
3. **Forgiving parsing** (case-insensitive, partial matches)
4. **Immediate feedback** (response within 100ms)

**Progressive Disclosure:**

```javascript
// Level 1: Simple query
!debug brain
→ Shows basic status (5 lines)

// Level 2: Specific subcommand
!debug brain layers
→ Shows detailed per-layer breakdown (15 lines)

// Level 3: With parameters
!debug brain timing villager-456
→ Shows timing analysis for specific villager (30 lines)
```

---

## 4. Interaction Patterns

### Pattern A: Select-Then-Act

**Flow:** Choose target → Perform action → See result

**Example: Inspecting Villager Mood**

```
Step 1: Target Selection
  !debug villager list
  → Shows numbered list
  
Step 2: Focus
  !debug villager select 3
  → "Now debugging: Bob (villager-456)"
  
Step 3: Action
  !debug memory current
  → Shows Bob's Working Memory
```

**Why This Works:**
- Reduces cognitive load (one decision at a time)
- Reusable focus (don't re-select for every command)
- Predictable (same pattern across all categories)

---

### Pattern B: Quick-Access Commands

**Flow:** Single command → Immediate result

**Example: Quick Performance Check**

```
!debug perf
→ Instantly shows summary without selection
```

**When to Use:**
- Global metrics (performance, TPS)
- System-wide status (AI mode, total tracked villagers)
- Emergency commands (stop watch mode)

**When NOT to Use:**
- Villager-specific data (requires selection context)
- Multi-step operations (require confirmation)

---

### Pattern C: Streaming Watch Mode

**Flow:** Start stream → Observe → Stop stream

**Example: Watching Mood Changes**

```
Step 1: Start
  !debug watch mood
  → "✓ Watching mood for Bob"
  → "Updates every 2s | Type !debug stop to exit"
  → "─────────────────────────────"
  
Step 2: Stream (automatic every 2s)
  [12:34:56] Mood: C=0.70 V=0.80 I=0.40 S=0.90 X=0.20
  [12:34:58] Mood: C=0.71 V=0.81 I=0.42 S=0.89 X=0.21
  [12:35:00] Mood: C=0.68 V=0.82 I=0.55 S=0.85 X=0.19
  ...
  
Step 3: Stop
  !debug stop
  → "─────────────────────────────"
  → "✓ Watch mode stopped"
```

**UX Considerations:**
- **Clear entry/exit**: Visual separators (dashed lines)
- **Timestamp prefix**: User can see update frequency
- **Single watch limit**: Only one watch per player (avoid chat flood)
- **Auto-stop on disconnect**: Prevents memory leaks

---

## 5. Feedback Mechanisms

### Success Feedback

**Pattern:** Action → Confirmation → Context

```javascript
// Example: AI mode changed
player.sendMessage("§a✓ AI Mode switched to MICROSERVICES");
player.sendMessage("§7Vector generation will now use 384D embeddings");
player.sendMessage("§7Expected latency: §b1.5-2.5s§7 (improved from 3-4s)");
```

**Components:**
1. **Checkmark icon** (`✓`) for visual confirmation
2. **Green color** (`§a`) for success
3. **Contextual explanation** (what changed and why it matters)

---

### Error Feedback

**Pattern:** Warning → Reason → Action

```javascript
// Example: Villager not found
player.sendMessage("§c⚠ Villager not found");
player.sendMessage("§7Reason: ID 'xyz' is not currently tracked");
player.sendMessage("§7Action: Use §b!debug villager list§7 to see available villagers");
```

**Components:**
1. **Warning icon** (`⚠`) for attention
2. **Red color** (`§c`) for errors
3. **Actionable solution** (how to fix)

---

### Progress Feedback

**Pattern:** State → Progress → Estimate

```javascript
// Example: Fetching database data
player.sendMessage("§e⏳ Fetching relationship data...");
// After completion
player.sendMessage("§a✓ Loaded 12 relationships for Villager #456");
```

**For Long Operations:**
- Show spinner/hourglass emoji (`⏳`)
- Provide estimate if >1s expected
- Always confirm completion

---

### Real-Time Feedback (Watch Mode)

**Pattern:** Continuous updates with visual consistency

```javascript
// Good: Consistent format, easy to scan
[12:34:56] Mood: C=0.70 V=0.80 I=0.40 S=0.90 X=0.20
[12:34:58] Mood: C=0.71 V=0.81 I=0.42 S=0.89 X=0.21

// Bad: Inconsistent format, hard to parse
12:34:56 - The mood is: Constructiveness=0.70, Value=0.80...
12:34:58 Mood update C:0.71 V:0.81...
```

**Rules:**
- **Fixed-width timestamp** in brackets
- **Consistent label format** (key=value pairs)
- **Same line structure** every update
- **Minimal prose** (no "The villager is currently...")

---

## 6. User Flow Diagrams

### Flow 1: Form-Based Exploration

```
┌─────────────────────────────────────────────────────────┐
│ USER STARTS                                             │
│ (Wants to inspect villager AI)                          │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ DECISION: How many villagers am I tracking?             │
├────────────────────┬────────────────────────────────────┤
│ One or few (1-3)   │ Many (4+)                          │
└────────────────────┼────────────────────────────────────┘
          ↓                        ↓
┌─────────────────────┐  ┌─────────────────────────────┐
│ Type "!debug brain" │  │ Type "!debug menu"          │
│ (Quick command)     │  │ (Form navigation)           │
└──────────┬──────────┘  └────────────┬────────────────┘
           ↓                          ↓
┌──────────────────────┐   ┌──────────────────────────┐
│ See status in chat   │   │ Select from dropdown     │
│ (5 lines, instant)   │   │ (visual, searchable)     │
└──────────┬───────────┘   └────────────┬─────────────┘
           ↓                            ↓
           └────────────┬───────────────┘
                        ↓
         ┌──────────────────────────┐
         │ Review layer data        │
         │ - Understand bottlenecks │
         │ - Check mood state       │
         │ - Verify sync status     │
         └──────────────────────────┘
                        ↓
         ┌──────────────────────────┐
         │ USER SATISFIED           │
         │ (Goal achieved)          │
         └──────────────────────────┘
```

**Decision Point Optimization:**
- Default to command-line for power users (faster)
- Default to forms for casual inspection (visual)
- Allow switching between modes seamlessly

---

### Flow 2: Real-Time Testing & Validation

```
┌─────────────────────────────────────────────────────────┐
│ USER STARTS                                             │
│ (Made code change, testing behavior)                    │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ ACTION: Set up monitoring                               │
│ !debug villager select 1                                │
│ !debug watch all                                        │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ FEEDBACK: Continuous updates                            │
│ [12:34:56] Episode: Mining | Focus: block | Mood: Calm  │
│ [12:34:58] Episode: Mining | Focus: block | Mood: Calm  │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ ACTION: Trigger test event                              │
│ (User breaks diamond ore near villager)                 │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ OBSERVATION: State changes                              │
│ [12:35:00] Episode: Mining | Focus: diamond | Mood: Excited │
│ [12:35:02] Episode: Mining | Focus: player | Mood: Curious │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ VALIDATION: Expected behavior confirmed                 │
│ ✓ Value (V) increased for diamond                       │
│ ✓ Focus shifted to player                               │
│ ✓ Episode remained "Mining"                             │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ ACTION: Stop monitoring                                 │
│ !debug stop                                             │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌──────────────────────────┐
         │ USER SATISFIED           │
         │ (Feature validated)      │
         └──────────────────────────┘
```

**Critical UX Element:** Latency feedback
- Show "⏳ Waiting for backend..." if database query >500ms
- Display inference time in LLM viewer
- Indicate when Fast Intent Router bypassed LLM (MICROSERVICES mode)

---

### Flow 3: Error Recovery

```
┌─────────────────────────────────────────────────────────┐
│ USER ACTION                                             │
│ Opens form while backend is offline                     │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ SYSTEM RESPONSE                                         │
│ Form shows "⏳ Loading..." for 2 seconds                │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ ERROR DETECTED                                          │
│ Network timeout                                         │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ FALLBACK: Cache-Only Mode                               │
│ ────────────────────────────────────────────────────────│
│ ⚠ Backend unavailable - showing cache data only        │
│ [Displays cached Working Memory]                        │
│ [Relationships unavailable]                             │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ USER DECISION                                           │
│ - Accept limited data (cache sufficient)                │
│ - Retry (backend may be back online)                    │
│ - Exit (check backend logs)                             │
└─────────────────────────────────────────────────────────┘
```

**Recovery Strategies:**
1. **Graceful Degradation:** Show cache data with warning
2. **Retry Mechanism:** "Retry" button in error forms
3. **Clear Communication:** Explain what's unavailable and why

---

## 7. State Management

### Player Context State

Each player has persistent debug context:

```javascript
/**
 * Player debug context structure
 */
{
  playerId: "player-steve",
  focusedVillager: "villager-456",  // Current villager being debugged
  watchMode: {
    active: false,
    type: null,                      // 'mood', 'episode', 'focus', 'all'
    intervalId: null,
    startTime: null
  },
  preferences: {
    verboseOutput: false,            // Show detailed logs
    autoRefresh: false,              // Auto-refresh forms
    colorCodeEnabled: true           // Use color codes in chat
  },
  navigationHistory: [],             // Stack of forms visited
  lastCommand: {
    category: "brain",
    subcommand: "status",
    timestamp: 1710518400000
  }
}
```

**Persistence:**
- Store in `Map<player.id, context>` (in-memory only)
- Reset on player disconnect
- Restore defaults on player reconnect

---

### Form State Transitions

**State Machine:**

```
┌────────────┐
│   CLOSED   │ ← Initial state
└──────┬─────┘
       │ User triggers form
       ↓
┌────────────┐
│  LOADING   │ (Fetching data)
└──────┬─────┘
       │ Data ready
       ↓
┌────────────┐
│  VISIBLE   │ ← User interacting
└──────┬─────┘
       │ User action
       ↓
┌─────────────────────────┐
│ PROCESSING              │ (Submit clicked)
└──────┬──────────────────┘
       │
       ├─── Success → Feedback → CLOSED
       │
       └─── Error → Error Message → VISIBLE (allow retry)
```

**Transition Rules:**
- **LOADING → VISIBLE:** Max 2s wait (or show error)
- **PROCESSING → CLOSED:** Show success message before closing
- **ERROR → VISIBLE:** Keep form open, highlight error

---

## 8. Progressive Complexity

### Beginner → Intermediate → Advanced

**Beginner User (First 5 minutes):**

```
Goal: "Just see what's happening"

Recommended Flow:
1. !debug menu                    → Visual navigation
2. Tap "Brain Monitor"            → See layer status
3. Tap "Working Memory"           → See current mood
4. Close and return to game       → Satisfied

Avoid:
- Chat commands (intimidating)
- Watch mode (too much info)
- Raw vector data (confusing)
```

**Intermediate User (After 1 hour):**

```
Goal: "I want faster access"

Recommended Flow:
1. !debug brain                   → Quick status check
2. !debug memory                  → Fast memory lookup
3. !debug llm last                → LLM context review

Avoid:
- Forms (slower than commands)
- Watch mode (still learning)
```

**Advanced User (After 1 day):**

```
Goal: "I need real-time monitoring"

Recommended Flow:
1. !debug villager select 3       → Focus on specific villager
2. !debug watch all               → Stream all updates
3. (Perform test actions)         → Observe live changes
4. !debug stop                    → Exit when done

Mastery:
- Uses keyboard shortcuts (muscle memory)
- Combines commands in sequence
- Interprets raw vector values
- Identifies bottlenecks from timing data
```

---

## 9. Information Architecture

### Hierarchy of Importance

**Primary Information (Always Visible):**
- Current villager name/ID
- AI mode (MONOLITHIC or MICROSERVICES)
- Current episode
- Trust score (if viewing relationships)

**Secondary Information (One Tap/Command Away):**
- Layer status
- Mood vector
- Sync status
- Performance metrics

**Tertiary Information (Two Taps/Commands Away):**
- LLM prompt details
- Episode history
- Structure templates
- Flashbulb events

**Optimization Rule:** The more frequently accessed, the fewer interactions required.

---

### Visual Weight Distribution

**Form Layout Pattern:**

```
┌─────────────────────────────────────┐
│ §l§6[LARGE TITLE - Primary Focus]   │  ← 60% attention
│ §7[Secondary context]               │  ← 20% attention
├─────────────────────────────────────┤
│ §bKey Value 1: [Important Data]    │  ← 15% attention
│ §7Supporting detail                 │  ← 5% attention
└─────────────────────────────────────┘
```

**Chat Output Pattern:**

```
§6═══ [HEADER] ═══          ← 40% attention (scan target)
§7Context: §bValue           ← 30% attention (quick read)

§l§dSubsection               ← 20% attention (categorization)
§7  Detail: Value            ← 10% attention (if needed)
```

---

## 10. Accessibility Considerations

### Cognitive Load Management

**Chunking Strategy:**

```javascript
// ❌ Bad: Wall of text (high cognitive load)
player.sendMessage("Villager #456 current episode Mining with Steve mood vector C=0.7 V=0.8 I=0.4 S=0.9 X=0.2 trust score 0.85 interaction count 47");

// ✅ Good: Sectioned information (low cognitive load)
player.sendMessage("§6═══ Villager #456 ═══");
player.sendMessage("");
player.sendMessage("§l§dEpisode:");
player.sendMessage("§7Mining with Steve");
player.sendMessage("");
player.sendMessage("§l§dMood Vector:");
player.sendMessage("§7C=0.7 V=0.8 I=0.4 S=0.9 X=0.2");
```

**Maximum Items per View:**
- Form inputs: 10-12 max (ModalFormData limit)
- Button list: 8 max (ActionFormData limit)
- Chat lines per command: 20 max (before pagination)

---

### Visual Scanning Optimization

**F-Pattern Reading (Chat Commands):**

```
§6═══ Header (Scanned First) ═══
§l§6Important Section ←─────────── Eye tracks left edge
§7  Key: Value
§7  Key: Value
§l§6Another Section ←──────────── Eye jumps to next header
§7  Key: Value
```

**Z-Pattern Reading (Forms):**

```
┌─────────────────────────────────┐
│ §l§6TITLE ←─────────── Scan 1   │
│ §7Body text explaining... │      │
├────────────────┬────────────────┤
│ Input 1        │ Input 2 ←────── Scan 2 (left to right)
│ Input 3        │ Input 4 ←────── Scan 3 (left to right)
├────────────────┴────────────────┤
│ [Submit Button] ←────────── Scan 4 (bottom center)
└─────────────────────────────────┘
```

---

## 11. Context Switching & Multitasking

### Scenario: User Debugging Multiple Villagers

**Challenge:** User needs to compare behavior between two villagers

**Solution: Quick Context Switching**

```
Flow:
1. !debug villager select 1       → Focus on Villager A
2. !debug memory                  → Check Villager A's state
3. !debug villager select 2       → Quick switch to Villager B
4. !debug memory                  → Check Villager B's state
5. Compare mentally               → Make decision
```

**UX Enhancement: Comparison Mode (Future)**

```
!debug compare 1 2 mood
→ Side-by-side comparison in chat:

Villager #1 (Bob)        Villager #2 (Alice)
─────────────────        ───────────────────
C: 0.70                  C: 0.45
V: 0.80                  V: 0.60
I: 0.40                  I: 0.85  ← Difference highlighted
S: 0.90                  S: 0.30  ← Difference highlighted
X: 0.20                  X: 0.15
```

---

### Scenario: Monitoring While Building

**Challenge:** User is actively building but wants to observe AI learning

**Solution: Non-Blocking Watch Mode**

```
Flow:
1. !debug watch episode           → Starts streaming
2. User builds structure          → Continues playing (non-blocking)
3. Chat updates appear            → Peripheral vision monitoring
4. Sees "Episode: Building"       → Confirms AI detected action
5. Continues building             → No workflow interruption
6. !debug stop                    → Clean exit when done
```

**Why This Works:**
- Chat updates are non-modal (don't pause game)
- 2-second update interval (not distracting)
- Visual separator lines (easy to ignore if busy)

---

## 12. Confirmation & Destructive Actions

### When to Confirm

**Require Confirmation (MessageFormData):**
- Changing AI mode (affects all villagers)
- Resetting performance counters
- Clearing debug logs
- Force-syncing cache to database

**Skip Confirmation:**
- Opening forms (read-only)
- Executing chat commands (non-destructive)
- Selecting villagers (easily reversible)

**Implementation:**

```javascript
/**
 * Show confirmation dialog for AI mode change
 * @param {Player} player - The player
 * @param {string} newMode - Target AI mode
 */
async function confirmAIModeChange(player, newMode) {
  const currentMode = getGlobalAIMode();
  
  const form = new MessageFormData()
    .title("§l§e⚠ Confirm AI Mode Change")
    .body(
      `§7Current: §b${currentMode}\n` +
      `§7New: §b${newMode}\n\n` +
      `§cThis will affect all villagers.\n` +
      `§7Expected latency change: ${getLatencyComparison(currentMode, newMode)}`
    )
    .button1("§l§a✓ Confirm")
    .button2("§l§c✗ Cancel");
  
  const response = await form.show(player);
  
  if (response.selection === 0) {
    await setAIMode(newMode);
    player.sendMessage(`§a✓ AI Mode changed to ${newMode}`);
  } else {
    player.sendMessage("§7Cancelled");
  }
}
```

---

## 13. Onboarding & Discovery

### First-Time User Experience

**Goal:** User discovers debug system without documentation

**Strategy: Contextual Help**

```javascript
// When player first joins server
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    const player = event.player;
    
    // Check if player has admin permissions
    if (player.hasTag("admin") || player.isOp()) {
      system.runTimeout(() => {
        player.sendMessage("§6═══════════════════════════════");
        player.sendMessage("§l§6🧠 Villager Debug System");
        player.sendMessage("§7Type §b!debug menu§7 to get started");
        player.sendMessage("§7Type §b!debug help§7 for commands");
        player.sendMessage("§6═══════════════════════════════");
      }, 60); // 3 seconds after spawn
    }
  }
});
```

**Progressive Disclosure:**

```
First use: !debug menu
→ Shows main menu with 7 options
→ User explores visually

After 3 form uses: Tip appears
→ "§7💡 Tip: Use §b!debug brain§7 for faster access"

After first chat command: Advanced tip
→ "§7💡 Try §b!debug watch mood§7 for live monitoring"
```

---

### Help Command Discoverability

**Trigger Points:**
1. User types invalid command → "Type !debug help for usage"
2. User types "!debug" alone → Show quick help
3. User types "!debug ?" → Show full help

**Help Tiers:**

```javascript
// Tier 1: Quick reference (5 most common commands)
!debug
→ Shows: menu, brain, memory, llm, perf

// Tier 2: Full command list
!debug help
→ Shows all commands with descriptions (30 lines)

// Tier 3: Detailed documentation
!debug help <category>
→ Shows all subcommands for category with examples
```

---

## 14. Feedback Timing & Responsiveness

### Expected Response Times

| Action Type | Max Latency | User Perception |
|-------------|-------------|-----------------|
| Chat command (cache) | <100ms | Instant |
| Chat command (database) | <500ms | Fast |
| Form open (cache) | <200ms | Instant |
| Form open (database) | <1000ms | Acceptable |
| Watch mode update | 2000ms | Rhythmic |
| AI mode switch | <3000ms | Processing |

**User Expectation Management:**

```javascript
// Show loading indicator for >500ms operations
player.sendMessage("§e⏳ Loading relationship data...");

setTimeout(() => {
  // If still loading after 1s, show progress
  player.sendMessage("§7Still loading... (large dataset)");
}, 1000);

// After completion
player.sendMessage("§a✓ Loaded 47 episodes");
```

---

### Animation & Transitions

**Chat Command Animations (ASCII):**

```javascript
// Loading spinner for long operations
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frame = 0;

const loadingInterval = system.runInterval(() => {
  player.sendMessage(`§e${spinnerFrames[frame]} Processing...`);
  frame = (frame + 1) % spinnerFrames.length;
}, 2); // Every 100ms
```

**Form Transitions:**
- No custom animations (forms appear instantly)
- Use dividers (`form.divider()`) to create visual breaks
- Use headers (`form.header()`) to group related inputs

---

## 15. Error Handling User Experience

### Error Message Hierarchy

**Level 1: Soft Errors (User Mistake)**

```javascript
// Pattern: Friendly tone + Solution
player.sendMessage("§e⚠ No villager selected");
player.sendMessage("§7Use §b!debug villager list§7 to see available villagers");
```

**Level 2: Medium Errors (System Issue)**

```javascript
// Pattern: Technical explanation + Action
player.sendMessage("§c⚠ Backend connection timeout");
player.sendMessage("§7The Node.js server is not responding");
player.sendMessage("§7Showing cache data only (may be stale)");
```

**Level 3: Critical Errors (System Failure)**

```javascript
// Pattern: Clear problem + Escalation
player.sendMessage("§4⚠ CRITICAL: Memory cache corrupted");
player.sendMessage("§cDebug system unavailable");
player.sendMessage("§7Contact server admin - check console for errors");
```

---

### Retry Mechanisms

**Pattern: Automatic → Manual → Give Up**

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await http.post(url, { timeout: 2000 });
    } catch (error) {
      if (attempt < maxRetries - 1) {
        // Automatic retry (silent)
        await sleep(1000 * (attempt + 1)); // Exponential backoff
      } else {
        // Manual retry option (user-initiated)
        throw error;
      }
    }
  }
}

// Usage in form
try {
  const data = await fetchWithRetry("http://localhost:3000/api/data");
  showForm(player, data);
} catch (error) {
  const form = new MessageFormData()
    .title("§c⚠ Connection Error")
    .body("§7Failed to fetch data after 3 attempts.\n§7Show cached data instead?")
    .button1("§aShow Cache")
    .button2("§cCancel");
  
  const response = await form.show(player);
  if (response.selection === 0) {
    showForm(player, getCachedData());
  }
}
```

---

## 16. Keyboard & Command Efficiency

### Command Aliases (Shorter Versions)

```javascript
// Full command vs alias
!debug brain status    ↔  !dbg b s
!debug memory current  ↔  !dbg m c
!debug watch mood      ↔  !dbg w mood
!debug stop            ↔  !dbg stop
```

**Implementation:**

```javascript
world.beforeEvents.chatSend.subscribe((event) => {
  const message = event.message;
  
  // Support both "!debug" and "!dbg" prefix
  if (message.startsWith("!debug ") || message.startsWith("!dbg ")) {
    event.cancel = true;
    
    const args = message.split(" ").slice(1);
    
    // Expand aliases
    const categoryAliases = {
      'b': 'brain',
      'm': 'memory',
      'l': 'llm',
      'p': 'perf',
      'w': 'watch',
      'v': 'villager'
    };
    
    const category = categoryAliases[args[0]] || args[0];
    // Continue with normal routing...
  }
});
```

---

### Tab Completion (Simulated)

**User Types:** `!debug br` + `<tab>`  
**System Suggests:** `brain` (autocomplete)

```javascript
// Suggestion system for partial matches
function suggestCommand(partialInput) {
  const allCommands = ['brain', 'memory', 'llm', 'perf', 'watch', 'villager', 'menu', 'help'];
  const matches = allCommands.filter(cmd => cmd.startsWith(partialInput));
  
  if (matches.length === 1) {
    return matches[0]; // Single match - autocomplete
  } else if (matches.length > 1) {
    return matches; // Multiple matches - show suggestions
  }
  return null;
}

// Usage
if (args[0].length < 4) {
  const suggestions = suggestCommand(args[0]);
  if (Array.isArray(suggestions)) {
    player.sendMessage(`§7Did you mean: ${suggestions.join(', ')}?`);
    return;
  }
}
```

---

## 17. Multi-User Scenarios

### Scenario A: Multiple Admins Debugging Same Villager

**Behavior:** Each admin has independent context

```
Admin Steve:
- Focused on Villager #456
- Watching mood updates
- Sees: [12:34:56] Mood: C=0.70...

Admin Alex:
- Focused on Villager #789
- Watching episodes
- Sees: [12:34:56] Episode: Trading

Result: No interference, isolated contexts
```

**Implementation:** Use `Map<player.id, context>` for per-player state

---

### Scenario B: Coordinated Debugging Session

**Use Case:** Two admins collaborating on issue

**Recommended Flow:**

```
Admin 1 (Primary):
!debug villager select 456
!debug watch all
→ Observes behavior

Admin 2 (Secondary):
!debug villager select 456
!debug llm last
→ Reviews LLM decisions

Communication:
- Admin 1: "I see high Intensity spike"
- Admin 2: "LLM chose FLEE action - check Layer 3 buffer"
- Admin 1: "!debug brain layers" → Confirms trigger
```

**UX Consideration:** Forms are isolated per player (no "already open" conflicts)

---

## 18. Error Prevention

### Mistake-Proof Design

**Example 1: Preventing Invalid Villager ID**

```javascript
// ❌ Bad: Let user type arbitrary ID (prone to typos)
form.textField("Villager ID:", "villager-456");

// ✅ Good: Provide dropdown of valid options
const villagerIds = getTrackedVillagersList().map(v => v.name || v.id);
form.dropdown("Select Villager:", villagerIds, 0);
```

**Example 2: Preventing Out-of-Range Values**

```javascript
// ❌ Bad: Text field for numeric input (validation burden)
form.textField("Queue Depth (1-20):", "10");

// ✅ Good: Slider with enforced bounds
form.slider("Queue Depth:", 1, 20, 1, 10);
```

---

### Constraint Communication

**Pattern: Show limits in labels**

```javascript
// ✅ Good: User knows constraints before input
form.slider("§bLLM Queue Depth §7(1-20):", 1, 20, 1, 10);
form.textField("§bVillager Name §7(Max 16 chars):", "Bob", "Bob");
```

---

## 19. Notification System

### Push Notifications (Proactive Alerts)

**Trigger: Automatic bottleneck detection**

```javascript
/**
 * Monitor performance and notify admins automatically
 */
system.runInterval(() => {
  const perfData = getPerformanceMetrics();
  
  // Check if Fast Gear exceeds budget
  if (perfData.fastGearTotalMs > 15) {
    const admins = getOnlineAdmins();
    admins.forEach(admin => {
      if (getDebugSetting(admin, 'autoNotifyBottleneck')) {
        admin.sendMessage("§c⚠ ALERT: Fast Gear exceeding tick budget");
        admin.sendMessage(`§7Current: §c${perfData.fastGearTotalMs.toFixed(1)}ms§7 / 15ms`);
        admin.sendMessage("§7Type §b!debug perf§7 to investigate");
      }
    });
  }
  
  // Check if LLM queue is backing up
  if (perfData.llmQueueDepth > 10) {
    const admins = getOnlineAdmins();
    admins.forEach(admin => {
      if (getDebugSetting(admin, 'autoNotifyBottleneck')) {
        admin.sendMessage("§e⚠ WARNING: LLM queue depth high (${perfData.llmQueueDepth})");
        admin.sendMessage("§7Consider increasing concurrency or enabling batching");
      }
    });
  }
}, 100); // Check every 5 seconds
```

**Notification Throttling:**
- Max 1 notification per issue per 30 seconds
- Allow user to disable via settings
- Use different severity colors (yellow warning, red critical)

---

## 20. Mobile vs Desktop Considerations

### Chat-Based Mobile Optimization

**Challenge:** Mobile players use touch keyboard (slower typing)

**Solution: Voice-Command Pattern**

```javascript
// Shorter commands for mobile
!dbg b    → Brain status (6 characters vs 19)
!dbg m    → Memory current
!dbg w m  → Watch mood
!dbg x    → Stop watch
```

**Form Optimization:**
- Prefer dropdowns over text fields (no typing)
- Use toggles instead of yes/no text input
- Minimize form depth (max 2 levels)

---

## 21. User Preference Persistence

### Settings Storage

**Scope:** Per-player preferences stored in cache

```javascript
/**
 * User preference object
 */
{
  playerId: "player-steve",
  preferences: {
    // Output preferences
    verboseOutput: false,           // Show detailed explanations
    colorCodeEnabled: true,         // Use formatting codes
    useAliases: false,              // Prefer short commands
    
    // Notification preferences
    autoNotifyBottleneck: true,     // Alert on performance issues
    autoNotifyNewConcept: false,    // Alert when villager learns
    
    // Display preferences
    timestampFormat: "relative",    // "relative" or "absolute"
    vectorPrecision: 2,             // Decimal places for vectors
    maxChatLines: 20,               // Lines before pagination
    
    // Watch mode preferences
    watchUpdateInterval: 40,        // Ticks (default 2s)
    watchAutoStop: true,            // Stop on player disconnect
    
    // Form preferences
    defaultVillager: null,          // Pre-select villager
    rememberLastCategory: true      // Reopen last viewed category
  }
}
```

**Access Pattern:**

```javascript
// Settings form saves to cache
form.show(player).then((response) => {
  updatePlayerPreferences(player.id, {
    verboseOutput: response.formValues[0],
    colorCodeEnabled: response.formValues[1]
  });
  player.sendMessage("§a✓ Preferences saved");
});

// Commands respect preferences
function handleBrainStatus(player) {
  const prefs = getPlayerPreferences(player.id);
  
  if (prefs.verboseOutput) {
    showDetailedBrainStatus(player);
  } else {
    showCompactBrainStatus(player);
  }
}
```

---

## 22. Gamification & Engagement

### Progress Indicators

**Use Case:** Long operations feel faster with progress feedback

```javascript
// Example: Loading large relationship dataset
player.sendMessage("§e⏳ Loading relationships...");
player.sendMessage("§7[░░░░░░░░░░] 0%");

// Update every 200ms
player.sendMessage("§7[███░░░░░░░] 30%");
player.sendMessage("§7[██████░░░░] 60%");
player.sendMessage("§7[██████████] 100%");
player.sendMessage("§a✓ Loaded 47 relationships");
```

**Implementation Note:** Only use for >1s operations

---

### Easter Eggs & Delight

**Hidden Features:**

```javascript
// Special response for specific commands
if (message === "!debug status") {
  player.sendMessage("§6All systems nominal. Villagers are thinking... 🧠");
}

// Fun responses for help command
if (message === "!debug help me") {
  player.sendMessage("§7I'm here! Type §b!debug help§7 for commands 😊");
}

// Achievement-like feedback
if (isFirstTimeUsingCommand(player, "watch")) {
  player.sendMessage("§d✨ Achievement: Real-Time Watcher");
  player.sendMessage("§7You discovered watch mode!");
}
```

**Rule:** Keep it subtle - don't distract from core functionality

---

## 23. Accessibility Standards

### Color Blindness Support

**Primary Strategy:** Use symbols + color

```javascript
// ✅ Good: Color + emoji (works for color blind users)
§a🟢 Active    (green circle)
§c🔴 Error     (red circle)
§e🟡 Warning   (yellow circle)

// ❌ Bad: Color only
§aActive
§cError
§eWarning
```

**Alternative Mode:**

```javascript
// ASCII symbols (setting: colorCodeEnabled: false)
[✓] Active
[✗] Error
[!] Warning
```

---

### Screen Reader Compatibility

**Challenge:** Minecraft doesn't support screen readers natively

**Best Effort:**
- Use plain text labels (avoid ASCII art in critical info)
- Logical reading order (top to bottom, left to right)
- Avoid emoji-only communication

---

## 24. User Testing Scenarios

### Test Case 1: Speed Test

**Task:** Find which villager has the highest trust with player  
**Expected Time:** <60 seconds  
**Success Path:**
1. `!debug menu` (3s)
2. Tap "Relationships" (2s)
3. Select villager (5s)
4. Scan trust scores (10s)
5. Found (Total: 20s)

---

### Test Case 2: Bottleneck Detection

**Task:** Identify why AI is responding slowly  
**Expected Time:** <30 seconds  
**Success Path:**
1. `!debug perf` (5s)
2. See red indicator on L6 (5s)
3. `!debug llm last` (5s)
4. See inference time: 8.3s (5s)
5. Diagnosed (Total: 20s)

---

### Test Case 3: Live Testing

**Task:** Verify villager detects player building  
**Expected Time:** <45 seconds  
**Success Path:**
1. `!debug watch episode` (5s)
2. Build structure (10s)
3. See "Episode: Building" appear (5s)
4. Confirmed behavior (5s)
5. `!debug stop` (2s)
6. Complete (Total: 27s)

---

## 25. Best Practices Summary

### Navigation

- ✅ **Hub-and-spoke pattern** for forms (always return to main menu)
- ✅ **Consistent selector pattern** (villager selector → detail view)
- ✅ **Breadcrumb titles** (show current location)
- ✅ **Max 3 levels deep** (prevent getting lost)

### Commands

- ✅ **Noun-verb structure** (`!debug <category> <action>`)
- ✅ **Sane defaults** (omit verb → common action)
- ✅ **Immediate feedback** (<100ms response)
- ✅ **Progressive disclosure** (simple → detailed)

### Feedback

- ✅ **Success = Green + Checkmark** (`§a✓`)
- ✅ **Error = Red + Warning** (`§c⚠`)
- ✅ **Loading = Yellow + Hourglass** (`§e⏳`)
- ✅ **Contextual explanations** (tell user what to do next)

### Performance

- ✅ **Cache-first fetching** (minimize latency)
- ✅ **Lazy loading** (fetch on-demand)
- ✅ **Rate limiting** (max 1 watch update per 2s)
- ✅ **Graceful degradation** (fallback to cache on error)

### Accessibility

- ✅ **Color + symbol** (emoji for color blind support)
- ✅ **Chunked information** (sections with headers)
- ✅ **Clear language** (avoid jargon when possible)
- ✅ **Consistent formatting** (same pattern = easier parsing)

---

## 26. Future UX Enhancements

### Phase 2 Features (Post-MVP)

**1. Comparison Mode**
```
!debug compare 1 2 mood
→ Side-by-side villager comparison
```

**2. History Replay**
```
!debug history villager-456 5m
→ Show last 5 minutes of decisions
```

**3. Alert Subscriptions**
```
!debug alert trust-drop player-steve
→ Notify when trust score drops
```

**4. Persistent Dashboards**
```
!debug dashboard create mood-watch
→ Save watch configuration for quick reuse
```

**5. Export Functionality**
```
!debug export episodes villager-456 csv
→ Generate CSV file with episode history
```

---

## 27. Usability Heuristics Applied

### Heuristic 1: Visibility of System Status

**Application:** Always show which villager is being debugged

```javascript
// Every command output includes context
player.sendMessage("§6═══ Brain Status ═══");
player.sendMessage(`§7Villager: §b${getVillagerName(villagerId)} §8(#${villagerId.substring(0,8)})`);
// ... rest of output
```

---

### Heuristic 2: Match Between System and Real World

**Application:** Use human language, not code variables

```javascript
// ❌ Bad: Technical jargon
"semantic_vector_manual: [0.7, 0.8, 0.4, 0.9, 0.2]"

// ✅ Good: Human-readable
"Mood: Happy & Constructive (C=0.7, V=0.8, I=0.4, S=0.9, X=0.2)"
```

---

### Heuristic 3: User Control and Freedom

**Application:** Easy undo/exit from all modes

```javascript
// Watch mode: Clear exit
"Updates every 2s | Type !debug stop to exit"

// Forms: ESC key exits instantly
// Commands: No destructive actions without confirmation
```

---

### Heuristic 4: Consistency and Standards

**Application:** Same patterns across all categories

```javascript
// ✅ Consistent command structure
!debug brain status       → Category + Action
!debug memory current     → Category + Action
!debug llm last           → Category + Action

// ✅ Consistent form flow
Main Menu → Villager Selector → Detail View
(Used for: Brain, Memory, Relationships, Structures)
```

---

### Heuristic 5: Error Prevention

**Application:** Constrain inputs to valid ranges

```javascript
// ✅ Slider prevents invalid values
form.slider("Queue Depth:", 1, 20, 1, 10);
// User cannot enter 0 or 21

// ✅ Dropdown prevents typos
form.dropdown("AI Mode:", ["MONOLITHIC", "MICROSERVICES"], 0);
// User cannot type "MICROSERVICE" (missing S)
```

---

### Heuristic 6: Recognition Rather Than Recall

**Application:** Show options instead of requiring memory

```javascript
// ❌ Bad: User must remember command syntax
!debug llm
→ "Usage: !debug llm <last|queue|history>"

// ✅ Good: Show available options proactively
!debug llm
→ Shows:
  "§b!debug llm last§7    - Last LLM call details"
  "§b!debug llm queue§7   - Current queue status"
  "§b!debug llm history§7 - Recent LLM calls"
```

---

### Heuristic 7: Flexibility and Efficiency of Use

**Application:** Support both novice and expert flows

**Novice Flow (Forms):**
```
!debug menu → Visual navigation → Point and click
Time: ~30 seconds, but easy
```

**Expert Flow (Commands):**
```
!debug brain → Instant status
Time: ~3 seconds, but requires memory
```

**Accelerators for Experts:**
```
!dbg b s      → Aliased commands
!debug 3 m    → villager number + category (single command)
```

---

### Heuristic 8: Aesthetic and Minimalist Design

**Application:** Show only essential information

```javascript
// ❌ Bad: Verbose, redundant
player.sendMessage("The current status of Layer 1 (Sensory) is active with 12 events per second being processed");

// ✅ Good: Concise, scannable
player.sendMessage(`§aL1 (Sensory): 🟢 12 events/sec`);
```

---

### Heuristic 9: Help Users Recognize, Diagnose, and Recover from Errors

**Application:** Three-part error messages

```javascript
// Pattern: What happened → Why → What to do
player.sendMessage("§c⚠ Cannot open form");                    // What
player.sendMessage("§7Reason: Another form is already open");  // Why
player.sendMessage("§7Action: Close current form (ESC) and try again"); // Fix
```

---

### Heuristic 10: Help and Documentation

**Application:** Contextual help embedded in UI

```javascript
// Form includes help text in body
form.body(
  "§7This form shows Layer 4 (Working Memory) state.\n" +
  "§7Working Memory tracks the villager's current focus,\n" +
  "§7mood, and recent shocks (flashbulb events).\n\n" +
  "§8Tip: Use §b!debug memory§8 for faster chat-based access."
);
```

---

## 28. Interaction Timing & Rhythm

### Command Response Rhythm

**User Expectation:** Consistent response timing creates trust

```
User inputs command at T=0
System should respond by:
  T+50ms:  Acknowledge receipt (if processing)
  T+100ms: Show result (cache-based)
  T+500ms: Show result (database-based) OR show "loading"
  T+2000ms: Timeout → Show error with retry option
```

**Implementation:**

```javascript
async function handleCommandWithTiming(player, commandFn) {
  const startTime = Date.now();
  
  try {
    // Show loading if >100ms
    const loadingTimeout = setTimeout(() => {
      player.sendMessage("§e⏳ Processing...");
    }, 100);
    
    const result = await commandFn();
    clearTimeout(loadingTimeout);
    
    const elapsed = Date.now() - startTime;
    
    // Show timing in verbose mode
    if (getPlayerPreference(player, 'verboseOutput')) {
      player.sendMessage(`§8[Completed in ${elapsed}ms]`);
    }
    
    return result;
  } catch (error) {
    player.sendMessage(`§c⚠ Error after ${Date.now() - startTime}ms: ${error.message}`);
  }
}
```

---

### Watch Mode Update Rhythm

**Pattern: Predictable Updates**

```
User starts watch mode at T=0:

T+0s:   "✓ Started watching mood"
T+2s:   [12:34:56] Mood: ...
T+4s:   [12:34:58] Mood: ...
T+6s:   [12:35:00] Mood: ...
...     (Every 2 seconds exactly)
T+30s:  User types "!debug stop"
T+30s:  "✓ Watch mode stopped"
```

**Why 2 Seconds:**
- Fast enough to feel "real-time"
- Slow enough to not spam chat
- Matches human perception of "checking in"

---

## 29. Cognitive Load Optimization

### Information Layering Strategy

**Layer 1: Glanceable (0-3 seconds)**
- Status icons (🟢 active, 🔴 error)
- Single-line summaries
- Current state only

**Layer 2: Scannable (3-10 seconds)**
- Sectioned chat output with headers
- Key metrics highlighted
- Most recent data

**Layer 3: Deep Dive (10-60 seconds)**
- Full forms with multiple inputs
- Historical data
- Detailed explanations

**Application Example:**

```javascript
// Glanceable (chat command)
!debug brain
→ "🟢 All layers active | TPS: 19.8"

// Scannable (detailed command)
!debug brain status
→ 7-line table with per-layer status

// Deep dive (form)
!debug menu → Brain Monitor
→ Full form with timing, buffer depths, latencies
```

---

## 30. Contextual Awareness

### Location-Based Defaults

**Pattern:** Debug system knows where user is looking

```javascript
// If player is looking at a villager within 5 blocks
world.beforeEvents.chatSend.subscribe((event) => {
  if (event.message.startsWith("!debug ")) {
    const player = event.sender;
    const lookedAtVillager = getPlayerLookedAtEntity(player);
    
    // Auto-focus on looked-at villager
    if (lookedAtVillager && isVillager(lookedAtVillager)) {
      const prefs = getPlayerPreferences(player.id);
      if (!prefs.focusedVillager || prefs.autoFocusOnLook) {
        setPlayerFocusedVillager(player, lookedAtVillager.id);
        player.sendMessage(`§7(Auto-focused on ${getVillagerName(lookedAtVillager.id)})`);
      }
    }
  }
});
```

**Benefits:**
- Reduces manual selection steps
- Feels intuitive ("debug what I'm looking at")
- Can be disabled in preferences

---

### Temporal Context

**Pattern:** Recent activity informs UI behavior

```javascript
// If user just changed AI mode
if (wasRecentlyChanged('ai_mode', 10000)) { // Last 10 seconds
  // Add notification to next command
  player.sendMessage("§7Note: AI mode was recently changed to ${getGlobalAIMode()}");
}

// If user is repeatedly checking same metric
const recentCommands = getPlayerCommandHistory(player.id, 5);
if (recentCommands.every(cmd => cmd === 'perf')) {
  // Suggest watch mode
  player.sendMessage("§7💡 Tip: Use §b!debug watch§7 to monitor continuously");
}
```

---

## 31. Final UX Checklist

### Before Implementing Each Feature

- [ ] Can user complete task in <60 seconds?
- [ ] Is there a faster alternative for power users?
- [ ] Are errors explained with actionable solutions?
- [ ] Does it work for both 1 villager and 20 villagers?
- [ ] Is feedback immediate (<100ms) or explained (loading indicator)?
- [ ] Can user easily undo/exit?
- [ ] Is it consistent with other debug features?
- [ ] Does it work when backend is offline?
- [ ] Is text readable without color (accessibility)?
- [ ] Does it respect user preferences?

---

## 32. User Mental Models

### Model 1: "The Brain is a Pipeline"

**User Understanding:**
> "Data flows through 7 layers like a factory assembly line. If one layer is slow, the whole system backs up."

**UI Support:**
- Layer Timeline visualization (L1 → L2 → L3...)
- Status indicators per layer (🟢 active, 🔴 bottleneck)
- Timing metrics show where delays occur

---

### Model 2: "Each Villager is Independent"

**User Understanding:**
> "Villagers don't share knowledge. Each one has their own brain and memory."

**UI Support:**
- Always show which villager is being debugged
- Villager selector appears in every detail view
- Trust scores are per-villager, per-player pairs

---

### Model 3: "Two AI Modes, Different Trade-offs"

**User Understanding:**
> "MONOLITHIC is predictable but slower. MICROSERVICES is smarter but uses more resources."

**UI Support:**
- AI mode badge in all forms
- Timing comparison when switching modes
- Mode-specific data (5D vs 384D vectors)

---

### Model 4: "Cache is Faster Than Database"

**User Understanding:**
> "Some data is instant (cache), some takes time (database)."

**UI Support:**
- Instant commands show cache data
- Forms with "Loading..." fetch from database
- Sync status indicator (cache → DB)

---

## 33. Design Philosophy

### Core Tenets

1. **Transparency Over Abstraction**
   - Show raw data when requested
   - Don't hide complexity from admins
   - Provide both "simple" and "detailed" views

2. **Speed Over Beauty**
   - Optimize for fast access, not visual polish
   - Text-based UI is acceptable for admin tools
   - Prioritize information density

3. **Flexibility Over Opinionation**
   - Support multiple workflows (forms vs commands)
   - Allow customization (preferences)
   - Don't force one "right way"

4. **Reliability Over Features**
   - Degrade gracefully on errors
   - Always provide fallback data
   - Never crash the game from debug code

---

**Document Version:** 1.0  
**Last Updated:** March 15, 2026  
**Related Docs:** `ui-rules.md`, `interaction-flow.md`, `project-overview.md`
