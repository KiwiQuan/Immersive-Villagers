# Optimizations for the Villagers to take load off the LLM

Instead of calling the LLM for every villager at the same time, schedule the calls and make requests 1 by 1 for each villager. some calls will be prioritized over others depending what state that villager is in.

A **central brain scheduler** that:

1. Collects all “I want to think” requests
2. Scores them (danger, curiosity, social, novelty, etc.)
3. Picks only the top few
4. Executes those LLM calls one-by-one (or a tiny batch)
5. Everyone else falls back to instinct (vector learned behavior)

another optimization i thought of would be if multiple villagers are in the same area and they are in the same state (via curious or in some learning state) then the llm/brain can update their memory for all the villagers in that area instead of querying the LLM one by one for each villager.

You must split memory types:

### Shared (safe to batch)

- concepts (what is hiding)
- rules (snow floor breaks → fall)
- discovered mechanics (lever opens door)
- cultural knowledge (players play game)

### Individual (do NOT batch)

- relationships with player
- emotions
- personal goals
- personality
- last seen position

---

## How it looks technically

### Instead of villager memory

```
villager_14 learned hiding
villager_22 learned hiding
villager_31 learned hiding
```

You create:

```
area_memory: plains_village_1concept: hidingconfidence: 0.82
```

Villagers reference it:

```
villager.brain.import(area_memory)
```

---

## What the LLM prompt becomes

Instead of:

> Villager 14 saw player crouch behind wall

You send:

> 4 villagers observed players repeatedly crouching behind blocks while another player searches. Players laugh when discovered.

The LLM detects the pattern once.

## Use LLM once use concepts many

after an LLM or player names a concept and that concept is stored in the database, villagers are able to look up that concept when they have a matching vector + matching context ( e.g. breakBlock, chatmessage ) instead of calling the LLM everytime for a concept that already exist in the database.

basically if a villager already “discovered” a concept, the concept is in a global column/table in the database and can be looked up for other villagers when they learn that concept. less LLM calls. only when something completely new that no villager has discovered, the LLM or the player is involved in naming and giving it that semantic label.

## How long the prompt for the LLM should be for villagers

First: a rough rule

**1 token ≈ ¾ of a word** (English)

So:

| Tokens | Rough words | What it feels like            |
| ------ | ----------- | ----------------------------- |
| 100    | ~75 words   | a small paragraph             |
| 300    | ~225 words  | short conversation            |
| 500    | ~375 words  | half a page                   |
| 700    | ~525 words  | full page of text             |
| 1500   | ~1100 words | long article                  |
| 3000   | ~2200 words | multiple pages (slow locally) |

---

For Minecraft-style real-time NPCs:

> **Stay under ~400–700 tokens per decision**

That lets villagers:

- react in under ~0.3–1.2s
- not freeze tick updates
- feel alive

Anything larger → villagers feel like they lag the server.

---

## Why this matters for your brain system

You CANNOT put:

- full memory
- full history
- full observations

into the LLM.

You must send only:

> distilled thoughts, not raw experiences

## What **~500 tokens** looks like

This is about the size you want villagers thinking with.

Example villager prompt (realistic scale):

> You are a Minecraft villager living in a survival world.
>
> Your personality: cautious, curious about players, prefers safety at night.
>
> Recent observations:
>
> - Player mined iron near a cave entrance
> - Time is night
> - Zombies detected nearby
> - You are holding a pickaxe
> - You remember caves are dangerous at night
>
> Goals:
>
> - Stay alive
> - Gather resources
> - Stay near village
>
> Known concepts:
>
> cave → danger at night
>
> torch → reduces danger
>
> player mining → resource gathering
>
> Current question:
>
> Decide what you should do next.
>
> Available actions:
>
> - follow_player
> - retreat_home
> - place_torch
> - start_mining
> - observe

That’s roughly **400-600 tokens** once formatted as JSON + system instructions.

This is PERFECT for local AI reasoning.
