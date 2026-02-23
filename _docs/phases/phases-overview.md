# 📋 Development Phases — Immersive Villager AI

**Project:** Immersive Villager AI for Minecraft Bedrock Edition  
**Architecture:** 7-Layer Cognitive System  
**Last Updated:** Feb 23, 2026

---

## Overview

This directory contains the complete iterative development plan for the Immersive Villager AI project. Each phase builds progressively toward a production-ready system with intelligent, subjective villager agents.

---

## Development Roadmap

### Phase 0: Setup (Foundation)
**Status:** Not Started  
**Duration:** 2-3 sessions  
**Document:** `phase0-setup.md`

**Goal:** Establish barebones infrastructure

**Key Deliverables:**
- PostgreSQL database operational with schema
- Node.js backend responding to health checks
- llama.cpp server running and responding
- Script API can send HTTP requests to backend
- Basic logging operational

**Success Criteria:**
- All services running without errors
- HTTP communication verified between Script API and backend
- Database accepts test writes
- LLM responds to test prompts (<3 seconds)

---

### Phase 1: MVP (Core Loop)
**Status:** Not Started  
**Duration:** 5-7 sessions  
**Document:** `phase1-mvp.md`

**Goal:** Complete cognitive loop functional

**Key Deliverables:**
- Layers 1-4 (Fast Gear): Event filtering → Vectorization → Episode formation → Working Memory
- Layer 5: Episode writes to PostgreSQL with relationship tracking
- Layer 6: LLM generates basic intents via Brain Scheduler
- Layer 7: Intents logged to console (MVP — physical actions in Phase 2)
- Working Memory syncs DynamicProperties to database

**Success Criteria:**
- Player places block near villager → Episode created in database
- LLM generates contextually appropriate speech
- Working Memory persists across server restarts
- System maintains 20 TPS with 10 active villagers
- No memory leaks after 10 minutes of testing

**Example Flow:**
```
Player places diamond block
  ↓ Layer 1: Proximity + LOS check
  ↓ Layer 2: Vector [C:0.8, V:0.9, I:0.3, S:0.7, X:0.1]
  ↓ Layer 3: Episode sealed after 30s
  ↓ Layer 4: Working Memory updated
  ↓ Layer 5: HTTP POST → PostgreSQL write
  ↓ Layer 6: LLM generates intent: "That's a beautiful diamond block!"
  ↓ Layer 7: Console log output
```

---

### Phase 2: Enhancement (Rich Features)
**Status:** Not Started  
**Duration:** 7-10 sessions  
**Document:** `phase2-enhancement.md`

**Goal:** Feature-rich, polished experience

**Key Deliverables:**
- Physical actions: Pathfinding, building, animations
- In-game speech display (on-screen text)
- Interactive UI: Hub, Gossip, Memories menus
- Multi-event support: Chat, damage, containers
- Gossip & teaching mechanics
- Identity tag generation
- Instinct fallback for network/LLM failures
- Advanced memory queries

**Success Criteria:**
- Villagers walk to locations and place blocks
- Speech appears on player's screen (not console)
- Players can whisper facts to villagers
- Villagers generate personality tags after 20 episodes
- System falls back to instinct when LLM offline
- UI navigation flows work smoothly

**New Capabilities:**
- Player: "Go to that tree" → Villager pathfinds and walks
- Player whispers: "Diamonds are north" → Villager learns fact
- Villager develops "loves_building" tag after observing construction
- Backend crash → Villager waves (instinct mode)

---

### Phase 3: Polish & Optimization (Production Ready)
**Status:** Not Started  
**Duration:** 5-7 sessions  
**Document:** `phase3-polish.md`

**Goal:** Scalable, production-ready system

**Key Deliverables:**
- Performance profiling and optimization
- Advanced pathfinding with A* and obstacle avoidance
- Villager-to-villager gossip propagation
- Rate limiting and request throttling
- Comprehensive error recovery
- Production monitoring (Prometheus, alerts)
- Complete documentation and deployment guides
- Stress testing with 20+ villagers

**Success Criteria:**
- System supports 20+ villagers with <5ms tick time
- Advanced pathfinding navigates around obstacles
- Gossip spreads through villager network
- Rate limits prevent system overload
- Monitoring dashboards operational
- Documentation complete and tested
- No performance degradation after 1-hour stress test

**Advanced Features:**
- Villager A tells fact to Villager B → B learns with reduced confidence
- LLM queue hits 15 → Alert sent to operator
- Database writes batched for 70% performance improvement
- Spatial partitioning reduces proximity checks by 80%

---

## Phase Progression Summary

| Phase | Focus | Complexity | Player-Visible Features |
|-------|-------|------------|------------------------|
| **Phase 0** | Infrastructure | Low | None (backend only) |
| **Phase 1** | Core Loop | Medium | Console logs, basic memory |
| **Phase 2** | Rich Features | High | Speech, UI, physical actions |
| **Phase 3** | Production | Medium | Performance, reliability |

---

## Implementation Guidelines

### General Rules

1. **Iterative Development:** Each phase must be fully functional before moving to the next
2. **Testing Required:** Validate all features before marking phase complete
3. **Documentation First:** Read referenced docs before implementing features
4. **Performance Targets:** Maintain <5ms tick time for Layers 1-4
5. **Memory Safety:** Never store entity references, always use entity IDs

### Feature Breakdown Rules

- Max 5 steps per feature
- If feature requires >5 steps, break into smaller features
- Each feature has clear validation criteria
- Files created/modified are explicitly listed

### Phase Completion Criteria

A phase is complete when:
- [ ] All features implemented and tested
- [ ] Success criteria met
- [ ] No critical bugs remain
- [ ] Performance targets achieved
- [ ] Documentation updated
- [ ] Code reviewed (if applicable)

---

## Technical Architecture Reference

### The 7-Layer Brain

```
┌────────────────────────────────────────┐
│         FAST GEAR (Script API)         │
├────────────────────────────────────────┤
│ Layer 1: Sensory (Proximity + LOS)    │
│ Layer 2: Vectorizer ([C,V,I,S,X])     │
│ Layer 3: Sequencer (Episodes)         │
│ Layer 4: Working Memory (DynProps)    │
└────────────────────────────────────────┘
              ↓ HTTP POST
┌────────────────────────────────────────┐
│      SLOW GEAR (Node.js Backend)       │
├────────────────────────────────────────┤
│ Layer 5: Long-Term Memory (PostgreSQL)│
│ Brain Scheduler (LLM Queue)           │
│ Layer 6: Language Cortex (llama.cpp)  │
└────────────────────────────────────────┘
              ↓ HTTP GET (polling)
┌────────────────────────────────────────┐
│         FAST GEAR (Script API)         │
├────────────────────────────────────────┤
│ Layer 7: Action Layer (Physical Body) │
└────────────────────────────────────────┘
```

### Data Flow

1. **Player Action** → Layer 1 filters by proximity/LOS
2. **Filtered Event** → Layer 2 calculates semantic vector
3. **Semantic Vector** → Layer 3 groups into episode
4. **Episode Summary** → Layer 4 updates Working Memory
5. **Working Memory** → Layer 5 writes to PostgreSQL via HTTP
6. **Database Context** → Layer 6 LLM generates intent
7. **Intent Packet** → Layer 7 polls and executes action
8. **Physical Action** → Player observes villager behavior

---

## Project Structure

```
Immersive_Villagers BP/
├── scripts/                    # Fast Gear (Layers 1-4)
│   ├── layers/
│   ├── ui/
│   ├── utils/
│   ├── config/
│   ├── events/
│   └── main.js
├── nodeDB/                     # Slow Gear (Layers 5-7)
│   ├── db/
│   ├── queries/
│   ├── routes/
│   ├── brain/
│   ├── middleware/
│   ├── utils/
│   ├── app.js
│   └── server.js
└── _docs/                      # Documentation
    ├── phases/                 # THIS DIRECTORY
    ├── project-overview.md
    ├── tech-stack.md
    ├── interaction-flow.md
    └── project-rules.md
```

---

## Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Game-Side | Minecraft Script API (JavaScript) | Layers 1-4 |
| Backend | Node.js + Express | Layers 5-7 |
| Database | PostgreSQL + pg-pool | Long-term memory |
| LLM | llama.cpp (Llama 3 7B Q4_K_M) | Decision-making |
| State | DynamicProperties | Working Memory |
| Logging | Pino | Structured logging |
| Networking | @minecraft/server-net | HTTP requests |

---

## Performance Targets

| Metric | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|
| Active Villagers | 5-10 | 10-15 | 20+ |
| Avg Tick Time | <5ms | <5ms | <5ms |
| LLM Throughput | 10 req/min | 15 req/min | 20 req/min |
| Memory Usage | <5GB | <6GB | <7GB |
| Database Writes | 50ms avg | 75ms avg | 50ms avg (batched) |

---

## Common Commands

### Start All Services
```bash
# Terminal 1: PostgreSQL (if not running as service)
sudo systemctl start postgresql

# Terminal 2: llama.cpp
cd llama.cpp
./server -m models/llama-3-7b-q4_k_m.gguf -c 2048 --port 8080 --threads 4

# Terminal 3: Node.js Backend
cd nodeDB
node server.js

# Terminal 4: Bedrock Dedicated Server
cd bedrock-server-1.26.1.1
./bedrock_server
```

### Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Test episode write
curl -X POST http://localhost:3000/api/memory/episode \
  -H "Content-Type: application/json" \
  -d '{"villagerID":"test-1","actorID":"player-1","episodeSummary":{"vectorAverage":{"C":0.8,"V":0.9,"I":0.3,"S":0.7,"X":0.1},"duration":5000,"eventCount":2}}'

# Check database
psql -U minecraft_ai -d villager_memory -c "SELECT COUNT(*) FROM episodes;"

# View metrics
curl http://localhost:3000/api/metrics/dashboard
```

---

## Troubleshooting

### Common Issues

**Issue:** Backend won't start  
**Solution:** Check if port 3000 is already in use: `lsof -i :3000`

**Issue:** Script API can't reach backend  
**Solution:** Verify `@minecraft/server-net` is in manifest.json dependencies

**Issue:** LLM responses are slow  
**Solution:** Use smaller model (7B vs 13B) or reduce context length

**Issue:** Database connection errors  
**Solution:** Check PostgreSQL is running and credentials in `.env` are correct

**Issue:** Villagers not responding  
**Solution:** Enable DEBUG_MODE and check Content Log for errors

---

## Next Steps

1. **Review Documentation:**
   - Read `_docs/project-overview.md` for architecture
   - Read `_docs/tech-stack.md` for technology details
   - Read `_docs/interaction-flow.md` for data flow

2. **Start Phase 0:**
   - Open `phase0-setup.md`
   - Follow step-by-step instructions
   - Validate all features before moving to Phase 1

3. **Set Up Development Environment:**
   - Install PostgreSQL, Node.js, llama.cpp
   - Create workspace directories
   - Clone/download required models

4. **Enable DEBUG_MODE:**
   - In-game: `/scriptevent debug:enable`
   - Backend: Set `DEBUG_MODE=true` in `.env`
   - View detailed logs for troubleshooting

---

## Contributing

When implementing features:
1. Read the phase document completely before starting
2. Follow the 5-step rule (max 5 steps per feature)
3. Test each feature before marking complete
4. Update documentation if behavior changes
5. Use JSDoc comments for all functions
6. Keep files under 500 lines (split if larger)

---

## Support & Resources

- **Project Rules:** `_docs/project-rules.md`
- **UI Guidelines:** `_docs/ui-rules.md`
- **UX Guidelines:** `_docs/ux-rules.md`
- **Tech Stack Details:** `_docs/tech-stack.md`

---

**Document Type:** Phase Index  
**Version:** 1.0  
**Status:** Ready for Implementation  
**Last Updated:** Feb 23, 2026
