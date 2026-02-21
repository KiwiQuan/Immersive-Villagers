# Layer 5: Long-Term Memory (The Personal Archive)

## 1. Purpose

This layer manages the PostgreSQL database to ensure subjective persistence. Every villager possesses their own unique history and opinions. If a player interacts with Villager A, Villager B remains unaware unless the information is shared through a "Gossip" event later.

## 2. Database Schema (The Relational Social Graph)

The AI Agent should implement the following tables:

| Table Name        | Primary Keys         | Key Columns                                            |
| ----------------- | -------------------- | ------------------------------------------------------ |
| **villagers**     | `v_id`               | Name, Home_Pos, Personality_Trait_ID                   |
| **relationships** | `v_id`, `player_id`  | Trust_Score, Personal_Nickname, Loyalty_Level          |
| **episodes**      | `v_id`, `episode_id` | Concept_ID (Spleef/Mining), Avg_Vector, Duration       |
| **conversations** | `episode_id`         | Raw_Text_Summary, Speaker_ID, Sentiment_Score          |
| **concepts**      | `concept_id`         | Semantic Signature [C, V, I, S, X] (e.g., Spleef, Tag) |
| **personality**   | `trait_id`           | Description, Weight_Modifiers (e.g., Grudge_Factor)    |

## 3. The Memory Pipeline (Processing)

Data enters the archive through three stages:

1. **Saliency Check:** (From Layer 4) Only episodes with high Intensity, Value, or Social impact are written to the database.
2. **Reputation Adjustment (Trust Math):** _ **Formula:** New_Trust = Old_Trust + (Episode_Sociality _ Personality_Weight)
   - _Note:_ A "Grumpy" villager has a high multiplier for negative sociality and a low one for positive.
3. **Summarization:** Before storage, raw chat logs are passed through the LLM to be compressed into a single-sentence summary (e.g., "Player promised to return my tool").

## 4. Context Retrieval (The Recall Trigger)

When a player enters the Sensory Radius (Layer 1), the brain performs a "Memory Sweep" to build the context for Layer 6:

- **Step 1:** Query `relationships` to find the current Trust_Score and nickname.
- **Step 2:** Query the 3 most recent `episodes` involving this player.
- **Step 3:** Query `conversations` for "Unresolved Promises" or specific keywords.
- **Step 4:** Package into a "Context Packet" for the Language Cortex.

## 5. Implementation Rules for AI Agent

- **Subjectivity:** All queries must be filtered by `v_id`. A villager cannot access another villager's rows unless explicitly coded as "Gossip."
- **Async Operations:** Database writes should be handled asynchronously to prevent Minecraft tick-lag.
- **Vector Comparison:** Use Euclidean distance to match "Unknown" episodes in Layer 3 against the `concepts` table in Layer 5.
- **Knowledge Isolation.** Villagers cannot "cheat" and use global concept IDs. Every villager must have a `discovery` record for a concept before they can use its label in conversation. If a villager sees a known game but doesn't have the concept record, they must label it as "Strange Activity" until taught.
