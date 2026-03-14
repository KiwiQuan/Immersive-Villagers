# Layer 6: Language Cortex (The Executive Hub)

> **Implementation Status:** 🟡 PLANNED - This doc describes future architecture. Not yet implemented.

## 1. Purpose

Layer 6 is the Prefrontal Cortex of the villager. It translates mathematical vectors and memory into "Intent." It is responsible for decision-making, social interaction, and high-level goal synthesis. It turns a "Chatbot" into an "Agent."

**Responsibilities vary by AI_MODE:**
- **MONOLITHIC:** Full cognitive load (labeling, summarization, dialogue, planning)
- **MICROSERVICES:** Reduced to dialogue and complex reasoning only

---

## 2. Core Functions (AI Mode Dependent)

### MONOLITHIC Mode (Full Responsibilities)

- **Action Selection:** Choosing which physical script (Layer 7) to trigger (e.g., `ACTION: FLEE` vs `ACTION: TRADE`).
- **Semantic Labeling:** Giving human names to new vector clusters (e.g., "This math feels like 'Spleef'").
- **Memory Compression:** Summarizing raw interaction logs into single-sentence archives for Layer 5.
- **Dialogue:** Generating natural language responses based on personality tags and history.
- **Intent Classification:** Determining if player is aggressive, trading, or friendly.
- **Structural Naming:** Labeling observed building patterns.

**Performance:** 2-4 seconds per inference (heavy LLM load)

---

### MICROSERVICES Mode (Reduced Responsibilities)

**LLM handles ONLY:**
- **Dialogue Generation:** Natural language responses with personality
- **Complex Social Reasoning:** Nuanced relationship decisions
- **High-Level Planning:** Multi-step goal synthesis

**Offloaded to Small Models:**
- **Semantic Labeling:** Handled by MiniLM vectors (no explicit labeling needed)
- **Memory Compression:** Handled by T5-small summarizer
- **Intent Classification:** Handled by DistilBERT (Fast Intent Router)
- **Structural Naming:** Handled by MiniLM semantic similarity

**Performance:** 1-2 seconds per inference (lighter LLM load)

**Why This Works:**
- LLM receives pre-processed summaries instead of raw vectors
- Context size reduced from 500 tokens → 250 tokens
- LLM focuses on what it does best (dialogue, personality, social nuance)

## 3. The Context Packet (Input)

### MONOLITHIC Mode Prompt

```
You are Villager [Name]. You are observing Player [ActorID].

Recent Activity (Vectors):
- Episode 1: C=0.8, V=0.9, I=0.3, S=0.7, X=0.1 (duration: 30s, events: 5)
- Episode 2: C=-0.6, V=0.2, I=0.8, S=-0.3, X=0.0 (duration: 10s, events: 3)

Your Relationship with Player [ActorID]:
- Trust Score: 0.75
- Interaction Count: 12

Your Personality: Grumpy, Sarcastic, Protective

Based on this, generate a JSON response:
{
  "action": "speak|pathfind|build|idle",
  "speechText": "Your response",
  "internalMonologue": "Your thoughts"
}
```

**Token Count:** ~400-500 tokens  
**Inference Time:** 2-4 seconds

---

### MICROSERVICES Mode Prompt

```
You are Villager [Name]. You are observing Player [ActorID].

Recent Activity (Summaries):
- "Steve decorated the area with valuable blocks" (30s ago)
- "Steve broke dirt blocks aggressively" (1m ago)

Your Relationship with Player [ActorID]:
- Trust Score: 0.75

Your Personality: Grumpy, Sarcastic, Protective

Respond naturally:
```

**Token Count:** ~200-300 tokens  
**Inference Time:** 1-2 seconds

**Why Shorter:**
- Pre-summarized by T5-small (no raw vectors)
- Intent already classified by DistilBERT (LLM only handles dialogue)
- No need for action selection (already determined by Fast Intent Router)

## 4. The Response Format (The "Internal Monologue")

The LLM must output a structured response to be parsed by the system:

- **THOUGHT:** "Steve is breaking my floor again, but he seems to be playing that 'Spleef' game he taught me. I'm not mad, just tired."
- **SPEECH:** "You're going to have to shovel all this back when we're done, Steve!"
- **ACTION:** `ANIMATE(laugh)` then `WAIT(5)`

## 5. Decision Logic: Math to Intent

The LLM uses the 5-axis vector from Layer 2/3 as a "Mood Filter":

- **High Intensity + Negative Sociality:** LLM prioritizes `ACTION: FLEE` or `ACTION: CALL_GOLEM`.
- **Low Intensity + High Sociality:** LLM prioritizes `ACTION: TRADE` or `ACTION: CHAT`.

## 6. Subjective Knowledge & Learning

If Layer 3 presents an "Unknown Pattern," Layer 6 handles the "Aha!" moment:

1. **Search:** Compares the pattern against "Hearsay" (things other villagers said).
2. **Naming:** If it’s totally new, it creates a name (e.g., "The Block-Dance").
3. **Storage:** Commands Layer 5 to save this new [C, V, I, S, X] signature to the villager's private database.

## 7. Implementation Rules for AI Agent

- **Async Processing:** LLM calls are slow. The villager must continue its last Layer 7 action (like walking or idling) while waiting for the LLM to return a result.
- **Token Efficiency:** Always use the "Summarization" function to keep the "History" section of the prompt short.
- **Action Dictionary:** The LLM is restricted to a specific list of `ACTION` keywords defined in Layer 7.
