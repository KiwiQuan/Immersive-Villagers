# 🛠️ Immersive Villagers Tech Stack

> **Project:** Minecraft Bedrock AI Villager System with 7-Layer Cognitive Architecture  
> **Last Updated:** March 14, 2026

---

## Core Technologies

### Backend Framework
**Express.js v5**
- Minimalist, unopinionated web framework for Node.js
- Custom middleware for AI model orchestration
- Async error handling built-in
- Industry standard for REST APIs

### Database
**PostgreSQL + node-postgres (pg)**
- Relational database with advanced features
- Connection pooling via `pg.Pool`
- Parameterized queries for SQL injection protection
- Subjective memory isolation per villager

**pgvector Extension**
- Vector similarity search using cosine distance
- IVFFlat indexes for 5D and 384D embeddings
- Dual vector support (MONOLITHIC + MICROSERVICES modes)
- Native SQL integration (no ORM friction)

### AI/ML Models
**@xenova/transformers**
- Pure JavaScript transformer models via ONNX runtime
- Model caching for performance
- Supports all required models:
  - `Xenova/all-MiniLM-L6-v2` (384D embeddings)
  - `Xenova/distilbert-base-uncased-mnli` (intent classification)
  - `Xenova/t5-small` (episode summarization)
  - `Xenova/bert-base-multilingual-cased-ner-slavic` (NER)

**llama.cpp (HTTP Server mode)**
- C++ optimized LLM inference
- Local model execution
- CPU-efficient for dialogue generation
- HTTP API for Node.js integration

### Job Queue & Scheduler
**BullMQ**
- Redis-backed priority queue
- Brain Scheduler implementation:
  - Priority scoring (0-100: CRITICAL, SOCIAL, NOVELTY, ROUTINE)
  - Spatial batching (deduplication for multi-villager events)
  - FIFO with priority re-sorting
  - Job retry and failure handling
- Bull Board dashboard for monitoring

**Redis**
- In-memory data store for BullMQ
- Job persistence and distributed coordination
- Pub/Sub for job notifications

---

## Supporting Libraries

### Validation & Security
**Joi**
- Schema-based request validation
- Descriptive error messages
- Input sanitization for API endpoints

### Logging
**Pino**
- High-performance structured logging
- JSON output for log aggregation
- Child loggers for request tracing
- Lower CPU overhead than Winston

### Process Management
**PM2**
- Production process manager
- Auto-restart on crash
- Zero-downtime reloads
- Process clustering for multi-core CPU
- Built-in log management

### Configuration
**dotenv**
- Environment variable management
- `.env` file loading
- 12-factor app methodology
- Secrets management (DB credentials, API keys)

---

## Communication & APIs

### Minecraft ↔ Node.js Communication
**REST/HTTP (via @minecraft/server-net)**
- Bedrock Script API sends HTTP POST requests
- Unidirectional request/response model
- JSON payload format
- No WebSocket support in Bedrock environment

### API Documentation
**Swagger/OpenAPI**
- Auto-generated interactive API docs
- Schema definitions for all endpoints
- Request/response examples
- Team collaboration and testing

### HTTP Client
**Axios**
- Promise-based HTTP requests
- Request/response interceptors
- Timeout configuration
- Used for external LLM API calls

---

## Development & Testing

### Testing Framework
**Vitest**
- Fast unit and integration testing
- Jest-compatible API
- ES modules support
- Code coverage reports

### Database Migrations
**node-pg-migrate**
- JavaScript-based SQL migrations
- Version control for schema changes
- Rollback support
- Programmatic migration execution

---

## Observability & Monitoring

### Error Tracking
**Sentry**
- Real-time error monitoring
- Stack trace capture
- Performance monitoring
- Alert notifications for critical failures

---

## Architecture Alignment

### Fast Gear (Layers 1-4)
- **In-memory cache**: Native JavaScript `Map` (trackedVillagers)
- **Bedrock Script API**: @minecraft/server, @minecraft/server-net
- **Sync frequency**: 500ms - 2s

### Slow Gear (Layers 5-7)
- **Database**: PostgreSQL + pgvector
- **Job Queue**: BullMQ + Redis
- **LLM**: llama.cpp (HTTP API)
- **AI Models**: @xenova/transformers
- **Sync frequency**: 1-5s

### Dual AI Mode Support
- **MONOLITHIC Mode**: 5D vectors [C, V, I, S, X], full LLM cognitive load
- **MICROSERVICES Mode**: 384D semantic embeddings, distributed cognition

---

## Production Deployment

### Runtime
- **Node.js**: v22+ (ES modules, async/await)
- **Process Manager**: PM2 (clustering, auto-restart)

### Infrastructure Requirements
- PostgreSQL 16+ with pgvector extension
- Redis 7+ for BullMQ
- llama.cpp server (local or remote)
- Bedrock Dedicated Server (BDS 1.26+)

### Environment Variables (via dotenv)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=immersive_villagers
DB_USER=postgres
DB_PASSWORD=***

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM
LLM_API_URL=http://localhost:8080
LLM_MODEL=llama-3-8b

# AI Mode
AI_MODE=microservices  # or monolithic

# Sentry
SENTRY_DSN=***

# Server
PORT=3000
NODE_ENV=production
```

---

## Installation Commands

```bash
# Core dependencies
npm install express pg @xenova/transformers bullmq ioredis

# Validation & logging
npm install joi pino pino-pretty

# Configuration & HTTP
npm install dotenv axios

# API documentation
npm install swagger-jsdoc swagger-ui-express

# Error monitoring
npm install @sentry/node @sentry/profiling-node

# Development dependencies
npm install -D vitest supertest node-pg-migrate

# Global process manager
npm install -g pm2
```

---

## Design Principles Alignment

✅ **DRY (Don't Repeat Yourself)**: Shared modules for vector operations, database queries  
✅ **Separation of Concerns**: Fast Gear (in-memory) vs Slow Gear (database/LLM)  
✅ **KISS (Keep It Simple)**: Unidirectional data flow, minimal abstractions  
✅ **Single Responsibility**: Each layer has one clear purpose  
✅ **Scalability**: Connection pooling, job queues, horizontal scaling support

---

**Next Steps:**
1. Set up PostgreSQL with pgvector extension
2. Install and configure Redis
3. Initialize project with `npm install`
4. Run database migrations (`npm run db:schema`)
5. Configure llama.cpp server
6. Set up PM2 ecosystem file
7. Initialize Sentry project
