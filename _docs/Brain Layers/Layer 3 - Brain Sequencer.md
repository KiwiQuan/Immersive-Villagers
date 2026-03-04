# Layer 3: Brain Sequencer (Temporal Learning)

## 1. Purpose

The Sequencer translates high-frequency math (vectors) from the Perception layer into a chronological "Story" of activities. It uses a two-tier buffer system to move from raw data to semantic labels (Sub-Concepts) and finally to complex patterns (Macro-Concepts).

## 2. Tier A: The Semantic Vectorizer (30s Window)

Tier A focuses on identifying a single, stable activity (a Sub-Concept).

- **Logic:** Calculates the moving average of incoming vectors.
- **Stability Check:** Monitors variance in **C (Constructiveness)** and **I (Intensity)**. When variance is low for >10 seconds, the "Episode" is considered stable.
- **Labeling Protocol:** 1. **Database Lookup:** Compare the stable Average Vector against the `concepts` table.

2. **LLM Intervention/Chat event:** If no match exists, send the vector + context to Layer 6 for a "Sub-Concept Labeling" (e.g., "The player is doing X, what is a 1-word name for this?") Or Ask the player what they are doing and use that to label the concept.

- **Output:** A semantic string (e.g., "Mining") pushed to Tier B.

## 3. Tier B: Macro-Episode Buffer (10m Window)

Tier B focuses on the "Story" by tracking the sequence of labels provided by Tier A.

- **Logic:** Stores a chronological list of Sub-Concept strings.
- **State Example:** `["Mining", "Falling", "Chatting", "Mining", "Falling", "Chatting"]`
- **Pattern Recognition:** \* Scans the list for repeating sequences (loops).
  - If a sequence like `[Mining + Falling]` repeats 3+ times, it flags a **Macro-Concept**.
  - **Social Identification:** If a Macro-Concept is new, it asks the player(s) or the LLM to help name the "Game" or "Ritual" (e.g., "Spleef").

## 4. Hierarchy of Data Flow

1. **Raw Vectors** (L2) -> **Tier A**
2. **Tier A** -> Check DB / LLM/Chat -> **Sub-Concept Label** (e.g., "Mining")
3. **Sub-Concept Label** -> **Tier B**
4. **Tier B Patterns** -> **Macro-Concept** (e.g., "Spleef")

## 5. Fast Intent Routing (MICROSERVICES Mode Only)

When AI_MODE is set to MICROSERVICES, Layer 3 includes an **Intent Router** that can bypass the LLM for simple, high-confidence decisions.

### Supported Intents

- `aggression` (e.g., "Why are you attacking me?")
- `trading` (e.g., "Want to trade emeralds?")
- `building` (e.g., "I'm building a house")
- `asking_question` (e.g., "What's your name?")
- `idling` (e.g., player just walking around)

### Routing Logic

```javascript
/**
 * Classify intent and determine if LLM is needed (MICROSERVICES mode).
 * @param {string} eventDescription - Natural language event description
 * @returns {Promise<Object>} { label, confidence, shouldBypassLLM, fastIntent }
 */
async function classifyAndRoute(eventDescription) {
  if (getAIMode() !== 'MICROSERVICES') {
    return { shouldBypassLLM: false };
  }
  
  const intent = await classifyIntent(eventDescription);
  // Returns: { label: 'aggression', confidence: 0.92 }
  
  const HIGH_CONFIDENCE_THRESHOLD = 0.8;
  
  if (intent.confidence > HIGH_CONFIDENCE_THRESHOLD) {
    // Fast route: Bypass LLM for simple intents
    if (intent.label === 'aggression') {
      return {
        shouldBypassLLM: true,
        fastIntent: { action: 'flee', target: actorID, reason: 'perceived_threat' }
      };
    }
    
    if (intent.label === 'trading') {
      return {
        shouldBypassLLM: true,
        fastIntent: { action: 'open_trade', target: actorID, reason: 'trading_opportunity' }
      };
    }
    
    if (intent.label === 'asking_question') {
      // Route to LLM for dialogue (can't bypass)
      return { shouldBypassLLM: false, intent };
    }
  }
  
  // Low confidence or complex intent: Send to LLM
  return { shouldBypassLLM: false, intent };
}
```

**Performance Impact:**
- Fast-routed intents: 50ms (skip 2-4s LLM inference)
- Accuracy: 95%+ for simple aggression/trading detection
- Fallback: Low-confidence intents still go to LLM

---

## 6. Technical Rules for AI Agent

- **Vector Matching:** Use **Cosine Similarity** (via pgvector's `<=>` operator) to find the nearest neighbor concept in the database. Cosine Similarity measures directional alignment (semantic intent) rather than Euclidean distance (magnitude), making it more robust to intensity variations. A cosine distance < 0.2 (similarity > 0.8) indicates a strong conceptual match.
- **Pattern Detection:** Use a basic string-matching algorithm to find repeating subarrays in Tier B.
- **Caching:** Once a Sub-Concept is labeled by the LLM, it MUST be cached in the database so Tier A doesn't ask the LLM for the same label twice.
- **Fast Intent Routing (MICROSERVICES):** High-confidence simple intents (>0.8 confidence for aggression/trading) bypass LLM and return immediate IntentPackets.
