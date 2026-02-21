# Layer 6: Language Cortex (The Executive Hub)

## 1. Purpose

Layer 6 is the Prefrontal Cortex of the villager. It translates mathematical vectors and memory into "Intent." It is responsible for decision-making, social interaction, and high-level goal synthesis. It turns a "Chatbot" into an "Agent."

## 2. Core Functions

- **Action Selection:** Choosing which physical script (Layer 7) to trigger (e.g., `ACTION: FLEE` vs `ACTION: TRADE`).
- **Semantic Labeling:** Giving human names to new vector clusters (e.g., "This math feels like 'Spleef'").
- **Memory Compression:** Summarizing raw interaction logs into single-sentence archives for Layer 5.
- **Dialogue:** Generating natural language responses based on personality tags and history.

## 3. The Context Packet (Input)

To "think," the LLM receives a formatted prompt containing:

- **Personality Tags:** (e.g., "Grumpy, Sarcastic, Protective of his anvil").
- **Active Working Memory:** (e.g., "Steve is currently breaking snow near me").
- **Subjective History:** (e.g., "Steve has a Trust Score of 0.8; we played Spleef yesterday").
- **Subjective Concepts:** Only the labels this specific villager has learned or been taught.

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
