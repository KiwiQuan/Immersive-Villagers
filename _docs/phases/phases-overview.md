# 📊 Phases Overview — Immersive Villager AI

## Purpose

This document provides a **high-level roadmap** of the iterative development phases for the Immersive Villager AI project, from barebones infrastructure to a polished, production-ready system.

---

## Phase Strategy

Each phase builds on the previous one, delivering a progressively more capable and feature-rich system:

- **Phase 0 (Setup):** Infrastructure foundation — validates connectivity but not playable
- **Phase 1 (MVP):** Core perception-to-action loop — first working prototype
- **Phase 2 (Enhancement):** Memory and intelligence — adaptive behaviors emerge
- **Phase 3 (Polish):** UI and advanced features — production-ready system

---

## Phase 0: Setup (Infrastructure Foundation)

**Goal:** Establish barebones infrastructure for network communication, database, and LLM.

**Duration:** Short  
**Complexity:** Medium  
**Status:** Not playable yet

### Key Deliverables

- PostgreSQL database running with base schema (episodes, relationships, working_memory, concepts)
- Node.js backend with Express routes (/api/health, /api/memory, /api/brain)
- llama.cpp server running with Llama 3.1 8B Q4_K_M model
- Script API HTTP communication tested (POST and GET requests)
- DynamicProperties schema defined and validated
- DEBUG_MODE toggle functional in-game and backend

### Success Criteria

✅ Backend responds to health checks  
✅ PostgreSQL accepts queries  
✅ llama.cpp generates completions  
✅ Script API can send/receive HTTP requests  
✅ DynamicProperties persist across restarts  
✅ DEBUG_MODE enables detailed logging  

### What's Missing

❌ No event filtering or vectorization  
❌ No episode grouping or memory writes  
❌ No LLM integration with game logic  
❌ No villager behaviors or actions  

---

## Phase 1: MVP (Minimal Viable Product)

**Goal:** Build the core perception-to-action loop from player event to villager response.

**Duration:** Moderate  
**Complexity:** High  
**Status:** Playable prototype

### Key Deliverables

- **Layer 1:** Event filtering (proximity + Line of Sight)
- **Layer 2:** Vectorization ([C, V, I, S, X] calculations)
- **Layer 3:** Episode grouping with basic sealing (time + context shift)
- **Layer 4:** Working Memory updates in DynamicProperties
- **Layer 5:** Episode writes to PostgreSQL via HTTP
- **Layer 6:** Basic LLM inference (simple prompts, speak/idle actions)
- **Layer 7:** Action execution (speak via ActionBar)
- **Brain Scheduler:** Basic queue (FIFO processing)

### Success Criteria

✅ Villagers detect player actions within 32 blocks  
✅ Events converted to accurate [C, V, I, S, X] vectors  
✅ Episodes sealed and written to database  
✅ LLM generates simple responses  
✅ Villagers speak responses to players  
✅ Basic concept matching works (DB lookup)  
✅ Complete loop: event → response in 2-10 seconds  

### What's Missing

❌ No relationship scoring (trust always 0.5)  
❌ No personality traits or identity  
❌ No advanced actions (pathfind, flee, stare)  
❌ No concept learning (unknown patterns ignored)  
❌ No priority queue or batching  
❌ No player-facing UI (ActionBar only)  

---

## Phase 2: Enhancement (Memory & Intelligence)

**Goal:** Add relationship tracking, personality development, and advanced behaviors.

**Duration:** Moderate  
**Complexity:** Medium-High  
**Status:** Adaptive agents with memory

### Key Deliverables

- **Relationship Scoring:** Dynamic trust scores based on Sociality (S) axis
- **Personality Tags:** Villagers develop traits (loves_building, is_cautious, etc.)
- **Context-Aware Prompts:** LLM receives personality, relationship, and history
- **Advanced Actions:** Pathfind, stare, flee actions in Layer 7
- **LLM Concept Labeling:** Unknown patterns sent to LLM for naming
- **Priority Queue:** High-priority events (damage) processed first
- **Request Batching:** Multiple villagers observing same event share LLM call

### Success Criteria

✅ Trust scores evolve based on interactions  
✅ Villagers develop personality after 20+ episodes  
✅ LLM responses reflect personality and relationships  
✅ Pathfind/stare/flee actions work correctly  
✅ Unknown concepts labeled by LLM and stored  
✅ Priority queue processes critical events first  
✅ Batching reduces LLM calls for shared observations  

### What's Missing

❌ No player UI (still ActionBar only)  
❌ No gossip system (knowledge not shared)  
❌ No Macro-Concepts (Spleef not recognized)  
❌ No multi-turn conversations  
❌ No instinct fallback system  
❌ No Debug Dashboard  

---

## Phase 3: Polish (UI & Advanced Features)

**Goal:** Complete the system with player UI, gossip, Macro-Concepts, and production polish.

**Duration:** Substantial  
**Complexity:** High  
**Status:** Production-ready

### Key Deliverables

- **Interaction Hub:** Main menu for villager interaction
- **Gossip & Whisper:** View memories and send natural language messages
- **Debug Dashboard:** Full CRUD operations on villager data (admin only)
- **Macro-Pattern Detection (Tier B):** Recognizes Spleef, Tag, minigames
- **Gossip System:** Villagers share learned concepts with each other
- **Multi-Turn Conversations:** Chat context maintained across whispers
- **Instinct Fallback:** Hardcoded behaviors when backend/LLM offline
- **Performance Optimizations:** Supports 20+ villagers at 20 TPS
- **Production Monitoring:** Health checks, error logging, admin alerts

### Success Criteria

✅ All UI menus functional and polished  
✅ Whisper system works with async feedback  
✅ Macro-Concepts detected and labeled correctly  
✅ Gossip propagates knowledge between villagers  
✅ Debug Dashboard provides full control  
✅ Instinct fallback activates gracefully  
✅ System handles all error scenarios  
✅ Performance targets met with 20+ villagers  
✅ Production-ready with comprehensive logging  

### What's Left for Future

💡 Teaching system (player-directed concept injection)  
💡 Villager-to-villager conversations  
💡 Custom animations and models  
💡 Web dashboard for monitoring  
💡 Distributed LLM for scaling >30 villagers  

---

## Phase Comparison Matrix

| Feature | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|---------|
| **PostgreSQL Database** | ✅ Schema only | ✅ Episode writes | ✅ Relationships | ✅ Gossip + Macros |
| **Node.js Backend** | ✅ Health check | ✅ Memory routes | ✅ Full context | ✅ CRUD + monitoring |
| **llama.cpp Integration** | ✅ Test calls | ✅ Basic prompts | ✅ Context-aware | ✅ Optimized batching |
| **Layer 1 (Sensory)** | ❌ | ✅ Proximity + LOS | ✅ Same | ✅ Optimized |
| **Layer 2 (Vectorizer)** | ❌ | ✅ Basic vectors | ✅ Same | ✅ Same |
| **Layer 3 (Sequencer)** | ❌ | ✅ Time + shift seal | ✅ LLM labeling | ✅ Tier B patterns |
| **Layer 4 (Working Memory)** | ✅ Schema only | ✅ DynamicProps sync | ✅ Same | ✅ Chat history |
| **Layer 5 (LTM)** | ❌ | ✅ Episode storage | ✅ Relationships | ✅ Gossip |
| **Layer 6 (Language)** | ❌ | ✅ Simple prompts | ✅ Full context | ✅ Optimized |
| **Layer 7 (Actions)** | ❌ | ✅ Speak + idle | ✅ Pathfind + flee | ✅ Same |
| **Layer 8 (Instinct)** | ❌ | ❌ | ❌ | ✅ Fallback system |
| **Brain Scheduler** | ❌ | ✅ FIFO queue | ✅ Priority + batch | ✅ Optimized |
| **Player UI** | ❌ | ❌ | ❌ | ✅ Full menus |
| **Debug Tools** | ✅ Toggle only | ✅ Console logs | ✅ Same | ✅ Full dashboard |
| **Concept Learning** | ❌ | ✅ DB lookup | ✅ LLM labeling | ✅ Macro-patterns |
| **Relationship Tracking** | ❌ | ❌ | ✅ Trust scores | ✅ Same |
| **Personality Traits** | ❌ | ❌ | ✅ Identity tags | ✅ Same |
| **Gossip System** | ❌ | ❌ | ❌ | ✅ Knowledge sharing |
| **Multi-Turn Chat** | ❌ | ❌ | ❌ | ✅ Context memory |
| **Error Handling** | ⚠️ Basic | ⚠️ Network only | ⚠️ Same | ✅ Comprehensive |
| **Performance** | N/A | ✅ <5ms Fast Gear | ✅ Same | ✅ 20+ villagers |

---

## Iteration Timeline

```
Phase 0: Setup
├─ PostgreSQL + Node.js + llama.cpp
├─ HTTP communication
└─ DynamicProperties + DEBUG_MODE
     ↓
Phase 1: MVP
├─ Layers 1-4 (Fast Gear)
├─ Layers 5-7 (Slow Gear)
├─ Brain Scheduler (basic)
└─ End-to-end loop working
     ↓
Phase 2: Enhancement
├─ Relationship scoring
├─ Personality emergence
├─ Advanced actions
├─ Priority queue + batching
└─ LLM concept labeling
     ↓
Phase 3: Polish
├─ Player UI (Hub, Gossip, Debug)
├─ Macro-Concepts (Tier B)
├─ Gossip system
├─ Multi-turn conversations
├─ Instinct fallback
├─ Performance optimizations
└─ Production monitoring
```

---

## Feature Progression

### Core Cognitive Loop

| Layer | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|-------|---------|---------|---------|---------|
| L1: Sensory | Schema | ✅ Working | ✅ Same | ✅ Optimized |
| L2: Vectorizer | Schema | ✅ Working | ✅ Same | ✅ Same |
| L3: Sequencer | Schema | ✅ Basic | ✅ LLM labels | ✅ Tier B |
| L4: Working Memory | ✅ Schema | ✅ Working | ✅ Same | ✅ Chat memory |
| L5: LTM | ✅ Schema | ✅ Episodes | ✅ Relationships | ✅ Gossip |
| L6: Language | Test only | ✅ Basic | ✅ Context-aware | ✅ Optimized |
| L7: Actions | Schema | ✅ Speak/idle | ✅ Path/flee | ✅ Same |
| L8: Instinct | - | - | - | ✅ Fallback |

### Intelligence Features

| Feature | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|---------|
| Concept Matching | - | ✅ DB lookup | ✅ Same | ✅ Same |
| Concept Learning | - | ❌ Ignored | ✅ LLM labels | ✅ Same |
| Macro-Concepts | - | ❌ | ❌ | ✅ Tier B |
| Relationship Scoring | - | ❌ Default 0.5 | ✅ Dynamic | ✅ Same |
| Personality Tags | - | ❌ | ✅ Auto-emerge | ✅ Same |
| Knowledge Sharing | - | ❌ | ❌ | ✅ Gossip |

### User Experience

| Feature | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|---------|
| Player UI | - | ❌ ActionBar | ❌ ActionBar | ✅ Full menus |
| Natural Language Input | - | ❌ | ❌ | ✅ Whisper |
| Memory Viewing | - | ❌ | ❌ | ✅ Gossip menu |
| Debug Tools | ✅ Toggle | ✅ Console logs | ✅ Same | ✅ Full dashboard |
| Error Feedback | ⚠️ Crashes | ⚠️ Silent fail | ⚠️ Same | ✅ Graceful |

---

## Cumulative Features by Phase End

### After Phase 0 (Setup)
- ✅ Infrastructure tested (PostgreSQL, Node.js, llama.cpp)
- ✅ HTTP communication working
- ✅ DEBUG_MODE toggle functional
- **System State:** Infrastructure-only, not playable

### After Phase 1 (MVP)
- ✅ All Phase 0 features
- ✅ Villagers observe player actions (Layer 1)
- ✅ Events vectorized to [C, V, I, S, X] (Layer 2)
- ✅ Episodes formed and sealed (Layer 3)
- ✅ Working Memory tracked (Layer 4)
- ✅ Episodes written to database (Layer 5)
- ✅ LLM generates simple responses (Layer 6)
- ✅ Villagers speak via ActionBar (Layer 7)
- **System State:** Working prototype, basic interactions

### After Phase 2 (Enhancement)
- ✅ All Phase 1 features
- ✅ Trust scores evolve dynamically
- ✅ Personality traits emerge (5 basic tags)
- ✅ Context-aware LLM prompts
- ✅ Advanced actions (pathfind, stare, flee)
- ✅ Unknown concepts labeled by LLM
- ✅ Priority queue for critical events
- ✅ Request batching for multi-villager observations
- **System State:** Adaptive agents with memory and personality

### After Phase 3 (Polish)
- ✅ All Phase 2 features
- ✅ Interaction Hub UI (main menu)
- ✅ Gossip & Whisper UI (natural language)
- ✅ Debug Dashboard (full CRUD)
- ✅ Macro-Concepts detected (Spleef, Tag, etc.)
- ✅ Gossip system (knowledge sharing)
- ✅ Multi-turn conversations
- ✅ Instinct fallback system
- ✅ Production monitoring and error handling
- **System State:** Production-ready, fully featured

---

## Dependency Chain

```
Phase 0 (Setup)
├─ PostgreSQL installed
├─ Node.js backend skeleton
├─ llama.cpp server running
├─ HTTP communication tested
└─ DynamicProperties validated
     ↓
Phase 1 (MVP)
├─ Requires: Phase 0 complete
├─ Layers 1-7 implemented
├─ Brain Scheduler (basic)
└─ End-to-end loop working
     ↓
Phase 2 (Enhancement)
├─ Requires: Phase 1 stable
├─ Relationship system
├─ Personality emergence
├─ Advanced behaviors
└─ Priority queue + batching
     ↓
Phase 3 (Polish)
├─ Requires: Phase 2 stable
├─ Player UI
├─ Macro-Concepts
├─ Gossip system
├─ Instinct fallback
└─ Production monitoring
```

---

## Testing Strategy by Phase

### Phase 0 Testing
- **Focus:** Connectivity and infrastructure
- **Method:** Unit tests, curl commands, manual DB queries
- **Tools:** psql, curl, node test scripts

### Phase 1 Testing
- **Focus:** Data flow and integration
- **Method:** In-game testing, DEBUG_MODE logging
- **Tools:** Console logs, backend Pino logs, PostgreSQL queries

### Phase 2 Testing
- **Focus:** Behavioral accuracy and performance
- **Method:** Scenario testing, multi-villager stress tests
- **Tools:** DEBUG_MODE, performance metrics, TPS monitoring

### Phase 3 Testing
- **Focus:** UX and error handling
- **Method:** End-user testing, failure injection, load testing
- **Tools:** UI walkthroughs, backend health checks, error logs

---

## Risk Assessment

### Phase 0 Risks
- **Low:** Infrastructure setup is well-documented
- **Mitigation:** Follow official PostgreSQL, Node.js, llama.cpp docs

### Phase 1 Risks
- **Medium:** Network latency, async coordination complexity
- **Mitigation:** Use polling pattern, add timeout handlers, test with DEBUG_MODE

### Phase 2 Risks
- **Medium:** LLM quality for concept labeling, relationship math accuracy
- **Mitigation:** Test with diverse scenarios, tune trust score formula, validate LLM outputs

### Phase 3 Risks
- **Low:** Builds on stable foundation from Phases 1-2
- **Mitigation:** Incremental feature rollout, comprehensive error handling

---

## Performance Targets by Phase

| Metric | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| **Fast Gear Latency** | N/A | <5ms | <5ms | <5ms |
| **Layer 5 Write** | N/A | 50-150ms | 50-150ms | 50-150ms |
| **LLM Inference** | 2-4s (test) | 2-4s | 3-5s | 3-5s |
| **Active Villagers** | 1 (test) | 5-10 | 10-15 | 20-30 |
| **Server TPS** | 20 | 20 | 20 | 20 |
| **HTTP Throughput** | 10 req/s | 50 req/s | 100 req/s | 200 req/s |

---

## Phase Selection Guide

**Starting fresh?** → Begin with Phase 0  
**Infrastructure works?** → Skip to Phase 1  
**Core loop works?** → Jump to Phase 2  
**Ready for users?** → Implement Phase 3  

---

## Document Index

| Phase | Document | Status |
|-------|----------|--------|
| **Phase 0** | `phase0-setup.md` | ✅ Ready |
| **Phase 1** | `phase1-mvp.md` | ✅ Ready |
| **Phase 2** | `phase2-enhancement.md` | ✅ Ready |
| **Phase 3** | `phase3-polish.md` | ✅ Ready |
| **Overview** | `phases-overview.md` | ✅ THIS FILE |

---

## Next Steps

1. **Read Phase 0:** Review infrastructure requirements
2. **Validate Prerequisites:** Ensure PostgreSQL, Node.js, llama.cpp are available
3. **Begin Implementation:** Follow Phase 0 step-by-step
4. **Test Thoroughly:** Complete testing checklist before moving to Phase 1
5. **Iterate:** Each phase builds on the previous — don't skip ahead

---

**Document Type:** Phase Overview  
**Author:** Senior Minecraft Scripting Engineer  
**Status:** Complete  
**Version:** 1.0  
**Last Updated:** Feb 24, 2026
