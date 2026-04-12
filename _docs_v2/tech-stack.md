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
- Runs on Node.js v24 (stable, optimized V8 engine)

### Database
**PostgreSQL 18 + node-postgres (pg)**
- Latest PostgreSQL with performance improvements
- Connection pooling via `pg.Pool`
- Parameterized queries for SQL injection protection
- Subjective memory isolation per villager
- Advanced JSON/JSONB operators for metadata storage

**pgvector Extension**
- Vector similarity search using cosine distance
- IVFFlat indexes for 5D and 384D embeddings
- Dual vector support (MONOLITHIC + MICROSERVICES modes)
- Native SQL integration (no ORM friction)
- Optimized performance in PostgreSQL 18

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

### Minecraft ↔ Node.js Communication (Hybrid Architecture)

#### REST/HTTP (via @minecraft/server-net)
**Use Cases:** Request/response operations, one-time queries, stateless operations
- Database queries (Layer 5: memory retrieval, episode writes)
- AI model inference (Layer 2: vectorization, Layer 3: intent classification)
- Configuration updates (AI mode switching)
- Health checks and status endpoints
- Idempotent operations that don't require real-time updates

**Characteristics:**
- Unidirectional request/response model
- JSON payload format
- Stateless (no persistent connection)
- Built-in timeout handling
- Simple error recovery (retry logic)

#### WebSocket (Socket.IO via @minecraft/server-net)
**Use Cases:** Real-time bidirectional communication, streaming data, state synchronization
- Layer 4 → Bedrock: Working Memory updates (mood changes, focus shifts)
- Layer 6 → Bedrock: LLM streaming responses (token-by-token dialogue)
- Layer 7 → Bedrock: Real-time action commands (immediate task updates)
- Brain Scheduler → Bedrock: Job queue status broadcasts
- Bedrock → Backend: Continuous sensory stream (Layer 1 event flooding)
- Multi-villager coordination (gossip system, collective learning)

**Characteristics:**
- Bidirectional, full-duplex communication
- Persistent connection with automatic reconnection
- Event-based messaging (pub/sub pattern)
- Low latency (<10ms vs HTTP's 50-100ms)
- Built-in acknowledgments and timeout support
- Room-based broadcasting for multi-villager scenarios

#### Hybrid Decision Matrix

| Operation | Protocol | Reason |
|-----------|----------|--------|
| Memory Retrieval (Layer 5) | HTTP | One-time query, bulk data |
| Episode Write (Layer 5) | HTTP | Fire-and-forget, async |
| Vector Embedding (Layer 2) | HTTP | Batch processing, cacheable |
| LLM Inference (Layer 6) | WebSocket | Stream tokens for UX responsiveness |
| Working Memory Update (Layer 4) | WebSocket | Frequent state changes |
| Action Commands (Layer 7) | WebSocket | Real-time task updates |
| Sensory Events (Layer 1) | WebSocket | High-frequency stream |
| Scheduler Status | WebSocket | Broadcast to multiple clients |
| Config Updates | HTTP | Rare, stateless |

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
- Used for external LLM API calls and REST operations

### Real-Time Communication
**Socket.IO v4**
- Bidirectional WebSocket communication with HTTP long-polling fallback
- Automatic reconnection with exponential backoff
- Event acknowledgments for request/response patterns
- Room-based broadcasting for multi-client scenarios
- Connection state recovery for brief disconnections
- Production-ready with built-in error handling

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
- **Communication**: WebSocket (Socket.IO) for real-time streams, HTTP for queries
- **Sync frequency**: 500ms - 2s (WebSocket push < 50ms latency)

### Slow Gear (Layers 5-7)
- **Database**: PostgreSQL + pgvector
- **Job Queue**: BullMQ + Redis
- **LLM**: llama.cpp (HTTP API)
- **AI Models**: @xenova/transformers
- **Communication**: HTTP for bulk operations, WebSocket for streaming LLM responses
- **Sync frequency**: 1-5s (WebSocket streaming for real-time responses)

### Dual AI Mode Support
- **MONOLITHIC Mode**: 5D vectors [C, V, I, S, X], full LLM cognitive load
- **MICROSERVICES Mode**: 384D semantic embeddings, distributed cognition

---

## Production Deployment

### Runtime
- **Node.js**: v24 (ES modules, async/await, native `--env-file` support)
- **Process Manager**: PM2 (clustering, auto-restart)

### Infrastructure Requirements
- PostgreSQL 18 with pgvector extension
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

# WebSocket
SOCKET_IO_PORT=3001
ALLOWED_ORIGINS=http://localhost:*,https://yourdomain.com
SOCKET_PING_TIMEOUT=20000
SOCKET_PING_INTERVAL=25000

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
# Core dependencies (latest versions)
npm install express@latest pg@latest @xenova/transformers@latest bullmq@latest ioredis@latest

# Communication
npm install socket.io@latest axios@latest

# Validation & logging
npm install joi@latest pino@latest pino-pretty@latest

# Configuration
npm install dotenv@latest

# API documentation
npm install swagger-jsdoc@latest swagger-ui-express@latest

# Error monitoring
npm install @sentry/node@latest @sentry/profiling-node@latest

# Development dependencies
npm install -D vitest@latest supertest@latest node-pg-migrate@latest

# Global process manager
npm install -g pm2@latest
```

### Current Stack Versions (as of March 2026)
- **Express**: v5.1.0
- **pg (node-postgres)**: v8.14.1
- **@xenova/transformers**: Latest stable
- **BullMQ**: v5.x
- **ioredis**: v5.x
- **Socket.IO**: v4.x
- **Joi**: v17.x
- **Pino**: v9.6.0
- **PM2**: v5.x
- **Vitest**: v3.1.1
- **Sentry**: v8.x
- **Axios**: v1.7.9

---

## Version-Specific Benefits

### Node.js v24
- **Native `--env-file` support**: No need for dotenv preload in scripts
- **Performance**: ~15% faster V8 engine compared to v22
- **ES modules**: First-class support with better tree-shaking
- **Async hooks**: Improved tracing for debugging AI pipelines
- **Security**: Latest security patches and TLS 1.3

### PostgreSQL 18
- **Query performance**: Improved query planner for complex vector operations
- **Parallel queries**: Better multi-core utilization for large vector searches
- **JSON performance**: Faster JSONB operations (used in structure templates)
- **Vacuum improvements**: Better performance for high-write workloads (episodes table)
- **pgvector compatibility**: Fully tested with latest pgvector extension

---

## Design Principles Alignment

✅ **DRY (Don't Repeat Yourself)**: Shared modules for vector operations, database queries  
✅ **Separation of Concerns**: Fast Gear (in-memory) vs Slow Gear (database/LLM)  
✅ **KISS (Keep It Simple)**: Unidirectional data flow, minimal abstractions  
✅ **Single Responsibility**: Each layer has one clear purpose  
✅ **Scalability**: Connection pooling, job queues, horizontal scaling support

---

## 📚 Best Practices, Limitations & Conventions

### Express.js

#### Best Practices
- **Error Handling**: Use 4-parameter error-handling middleware (`err, req, res, next`) as the last middleware
- **Async Errors**: Express v5 automatically catches rejected promises; use `try/catch` for sync errors
- **Middleware Order**: Application-level → Router-level → Error handlers
- **Security**: Never expose error stack traces in production (`process.env.NODE_ENV !== 'production'`)
- **Custom Error Classes**: Create `AppError` class with `status` and `message` properties
- **404 Handler**: Place after all routes but before error handler

#### Common Pitfalls
- ❌ **Forgetting `next()`**: Always call `next()` in middleware or response will hang
- ❌ **Missing Error Parameters**: Error handler must have exactly 4 parameters
- ❌ **Sync vs Async**: In Express 5, async route handlers auto-catch, but middleware still needs `next(err)`
- ❌ **Multiple Responses**: Calling `res.send()` twice causes "Cannot set headers after sent" error

#### Conventions
```javascript
// Custom error factory function
function createAppError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Usage in routes
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await findUser(req.params.id);
    if (!user) throw createAppError('User not found', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Error handler (must be last)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});
```

---

### node-postgres (pg)

#### Best Practices
- **Single Pool Instance**: Create pool once at app startup, reuse globally
- **Use Pool for Simple Queries**: `pool.query()` automatically manages client acquisition/release
- **Use Client for Transactions**: Get client with `pool.connect()`, manually release with `client.release()`
- **Parameterized Queries**: Always use `$1, $2` placeholders to prevent SQL injection
- **Pool Configuration**: Set `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`
- **Error Handling**: Listen to `pool.on('error')` for unexpected idle client errors

#### Limitations
- **Transaction Requirement**: Must use same client for all queries in a transaction
- **No Auto-Reconnect**: Pool doesn't auto-reconnect on network failures (restart required)
- **No Built-in Retry**: Implement retry logic manually for transient failures

#### Common Pitfalls
- ❌ **Creating Pools in Functions**: Never create new `Pool()` in frequently-called functions (connection leak)
- ❌ **Using pool.query() for Transactions**: Transactions require single client (`pool.connect()`)
- ❌ **Forgetting client.release()**: Always release clients in `finally` block
- ❌ **Ignoring Pool Errors**: Unhandled pool errors crash the app

#### Conventions
```javascript
// ✅ Correct: Single pool instance
const pool = new Pool({ max: 20, idleTimeoutMillis: 30000 });
pool.on('error', (err) => console.error('Unexpected pool error', err));

// ✅ Simple query
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// ✅ Transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO episodes...');
  await client.query('UPDATE relationships...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

---

### pgvector

#### Best Practices
- **Index Selection**: Use `ivfflat` for faster builds (<1M vectors), `hnsw` for better recall (>1M vectors)
- **Index Configuration**: Set `lists` parameter: `rows/1000` for <1M rows, `sqrt(rows)` for >1M rows
- **Query Optimization**: Set `ivfflat.probes = sqrt(lists)` or `hnsw.ef_search = 100` for better recall
- **Storage**: Use `ALTER TABLE ... ALTER COLUMN ... SET STORAGE PLAIN` to avoid TOAST overhead
- **Parallel Builds**: Set `max_parallel_maintenance_workers = 7` for faster index creation
- **Filtered Queries**: Use `iterative_scan = relaxed_order` with `max_scan_tuples` for filtered vector searches

#### Limitations
- **Approximate Search**: IVFFlat/HNSW are approximate (not exact) nearest neighbor searches
- **Index Build Cost**: Large index builds can take hours and lock the table
- **Memory Usage**: HNSW indexes use more memory than IVFFlat
- **No Index Updates**: Modifying vectors requires full index rebuild

#### Common Pitfalls
- ❌ **Wrong Query Syntax**: Use `ORDER BY embedding <=> '[...]'` not `ORDER BY 1 - (embedding <=> '...')`
- ❌ **Missing Indexes**: Vector queries without indexes are extremely slow (full table scan)
- ❌ **Low Probe Count**: Default `ivfflat.probes = 1` gives poor recall; increase to ~10
- ❌ **No Vacuum**: Stale vector data accumulates; run `VACUUM` regularly

#### Conventions
```sql
-- Create IVFFlat index with optimal configuration
CREATE INDEX CONCURRENTLY idx_episodes_vector_manual 
ON episodes USING ivfflat (semantic_vector_manual vector_cosine_ops) 
WITH (lists = 100);

-- Optimize query performance
SET ivfflat.probes = 10;
SELECT * FROM episodes 
WHERE villager_id = 'v-123'
ORDER BY semantic_vector_manual <=> '[0.3, 0.4, ...]' 
LIMIT 10;
```

---

### @xenova/transformers

#### Best Practices
- **Singleton Pattern**: Load models once at startup, reuse across requests
- **Cache Directory**: Set `env.cacheDir = './.cache'` to persist downloaded models
- **Offline Mode**: Set `env.allowRemoteModels = false` for production (load from cache)
- **Quantization**: Use `q8` or `q4` models for lower memory (e.g., `Xenova/all-MiniLM-L6-v2-q8`)
- **Batch Inference**: Process multiple inputs together for better throughput
- **Model Warming**: Run dummy inference at startup to pre-load model weights

#### Limitations
- **CPU-Only by Default**: No GPU acceleration (use ONNX Runtime with DirectML for GPU)
- **Model Size**: Models downloaded on first use (100-500MB each)
- **Node.js Only Features**: `env.cacheDir` not available in browser
- **No Fine-Tuning**: Read-only inference; cannot train/fine-tune models

#### Common Pitfalls
- ❌ **Loading Models Per Request**: Causes severe performance degradation (load once)
- ❌ **Not Setting Cache Dir**: Models re-download on server restart
- ❌ **Large Batch Sizes**: OOM errors with >100 inputs per batch
- ❌ **Blocking Main Thread**: Run inference in worker threads for high concurrency

#### Conventions
```javascript
import { pipeline, env } from '@xenova/transformers';

// ✅ Module-level singleton using closure
let embeddingPipeline = null;

async function getEmbeddingPipeline() {
  if (embeddingPipeline === null) {
    env.cacheDir = './.cache';
    env.allowRemoteModels = false; // Production: only use cached models
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingPipeline;
}

// Usage
const embedder = await getEmbeddingPipeline();
const result = await embedder('Hello world', { pooling: 'mean', normalize: true });
```

---

### BullMQ

#### Best Practices
- **Job Options**: Set `attempts: 3-5`, `backoff: exponential`, `removeOnComplete: true`
- **Worker Concurrency**: Start with `concurrency: 5`, tune based on CPU/memory
- **Rate Limiting**: Use `limiter: { max: 10, duration: 1000 }` to prevent overwhelming external APIs
- **Graceful Shutdown**: Listen to `SIGTERM` and call `await worker.close()`
- **Job Deduplication**: Use `jobId` option to prevent duplicate jobs
- **Priority Queues**: Lower numbers = higher priority (0 is highest)

#### Limitations
- **Redis Dependency**: Requires Redis server (no standalone mode)
- **No Cross-Queue Priorities**: Priorities only work within a single queue
- **Memory Usage**: Large job payloads stored in Redis (keep data small)
- **No Built-in Scheduling**: Use `delay` or external cron for scheduled jobs

#### Common Pitfalls
- ❌ **Not Handling Retries**: Jobs fail permanently without `attempts` config
- ❌ **Blocking Workers**: Synchronous/CPU-heavy work blocks other jobs (use `concurrency`)
- ❌ **Memory Leaks**: Not calling `queue.close()` and `worker.close()` on shutdown
- ❌ **No Error Logging**: Always listen to `worker.on('failed')` event

#### Conventions
```javascript
// Queue setup
const queue = new Queue('llm-requests', {
  connection: { host: 'localhost', port: 6379 }
});

// Add job with full options
await queue.add('inference', { villagerId: 'v-123', prompt: '...' }, {
  priority: 70,        // Lower = higher priority
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 1000,  // Keep last 1000 completed
  removeOnFail: false      // Keep all failed jobs
});

// Worker with error handling
const worker = new Worker('llm-requests', async (job) => {
  return await processLLMRequest(job.data);
}, { concurrency: 5, limiter: { max: 10, duration: 1000 } });

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});
```

---

### Redis

#### Best Practices
- **Persistence**: Enable AOF for durability (`appendonly yes` in redis.conf)
- **Memory Policy**: Set `maxmemory-policy noeviction` for queue reliability
- **Connection Pooling**: Use `ioredis` with connection pool
- **Monitoring**: Track memory usage with `INFO memory` command
- **Security**: Bind to `127.0.0.1` and require password (`requirepass`)

#### Limitations
- **Single-Threaded**: One command at a time (use pipelining for batches)
- **Memory-Bound**: All data must fit in RAM
- **Persistence Tradeoff**: AOF increases disk I/O, RDB can lose recent data

#### Common Pitfalls
- ❌ **No Persistence**: Data loss on crash without AOF/RDB
- ❌ **Wrong Eviction Policy**: `allkeys-lru` will delete queue jobs!
- ❌ **No Maxmemory**: Redis will crash when RAM is full
- ❌ **Exposing to Internet**: Bind to localhost only

#### Conventions
```bash
# redis.conf production settings
maxmemory 2gb
maxmemory-policy noeviction
appendonly yes
appendfsync everysec
bind 127.0.0.1
requirepass your-strong-password
```

---

### Joi

#### Best Practices
- **Schema Reusability**: Define schemas as constants, reuse across routes
- **Custom Messages**: Use `.messages()` for user-friendly error messages
- **Async Validation**: Use `.external()` for database checks (username availability)
- **Strip Unknown Keys**: Use `stripUnknown: true` to remove unexpected fields
- **Conditional Validation**: Use `.when()` for context-dependent rules

#### Limitations
- **No Built-in Sanitization**: Joi validates but doesn't sanitize (use separate library)
- **Performance**: Complex schemas can add 5-10ms per request
- **No Partial Updates**: Must explicitly use `.fork()` or `.optional()` for PATCH endpoints

#### Common Pitfalls
- ❌ **Ignoring Validation Errors**: Always check `error` before using `value`
- ❌ **Not Using `abortEarly: false`**: Only shows first error by default
- ❌ **Type Coercion Surprises**: `'123'` becomes `123` with default `convert: true`
- ❌ **Forgetting `.required()`**: Fields are optional by default

#### Conventions
```javascript
const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required(),
  email: Joi.string().email().required()
}).messages({
  'string.min': '{{#label}} must be at least {{#limit}} characters',
  'any.required': '{{#label}} is required'
});

// Middleware usage
app.post('/users', (req, res, next) => {
  const { error, value } = userSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ errors: error.details });
  req.body = value;
  next();
});
```

---

### Pino

#### Best Practices
- **Child Loggers**: Use `logger.child({ requestId, userId })` for contextual logging
- **Log Levels**: Use `info` for normal operations, `warn` for non-critical issues, `error` for failures
- **Structured Logging**: Pass objects first: `logger.info({ userId, action }, 'User logged in')`
- **Production Config**: Use `pino-pretty` only in dev; pipe to log aggregator in production
- **Performance**: Check `logger.isLevelEnabled('debug')` before expensive computations

#### Limitations
- **JSON-Only Output**: Default format is newline-delimited JSON (requires parser)
- **No Built-in Rotation**: Use `pm2-logrotate` or external tool for log rotation
- **No Transports**: Pino writes to stdout; use separate tool for log shipping

#### Common Pitfalls
- ❌ **String Concatenation**: Use structured logging, not `logger.info('User: ' + userId)`
- ❌ **Missing Context**: Not using child loggers (hard to trace requests)
- ❌ **Wrong Level**: Using `debug` for important events (filtered out in production)
- ❌ **Expensive Operations**: Computing values before `isLevelEnabled()` check

#### Conventions
```javascript
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ✅ Structured logging
const reqLogger = logger.child({ requestId: req.id, path: req.path });
reqLogger.info({ userId, action: 'login' }, 'User authenticated');

// ✅ Conditional expensive operations
if (logger.isLevelEnabled('debug')) {
  logger.debug({ state: getComplexState() }, 'State snapshot');
}
```

---

### PM2

#### Best Practices
- **Cluster Mode**: Use `instances: 'max'` or specific number for multi-core CPU utilization
- **Memory Limits**: Set `max_memory_restart: '500M'` to prevent memory leaks
- **Graceful Reload**: Use `pm2 reload` instead of `restart` for zero-downtime deployments
- **Log Rotation**: Install `pm2-logrotate` to prevent disk space issues
- **Ecosystem File**: Use `ecosystem.config.js` for version-controlled configuration

#### Limitations
- **No Built-in Load Balancing**: Round-robin only; use nginx for advanced LB
- **Windows Support**: Some features don't work on Windows (use WSL2)
- **Monitoring**: Built-in monitoring is basic; use external APM for production

#### Common Pitfalls
- ❌ **No Graceful Shutdown**: Not listening to `SIGTERM` (kills active connections)
- ❌ **Excessive Restarts**: `max_restarts: 10` prevents restart loops but hides issues
- ❌ **Cluster with Stateful Code**: Shared memory doesn't work across cluster instances
- ❌ **No Log Rotation**: Logs grow unbounded and fill disk

#### Conventions
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'immersive-villagers-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: { NODE_ENV: 'development', PORT: 3000 },
    env_production: { NODE_ENV: 'production', PORT: 8080 },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 5000,
    wait_ready: true
  }]
};

// Graceful shutdown in server.js
process.on('SIGTERM', async () => {
  await server.close();
  await pool.end();
  process.exit(0);
});
```

---

### Vitest

#### Best Practices
- **Test Organization**: Group related tests with `describe()` blocks
- **Cleanup**: Use `onTestFinished()` for reliable spy/mock cleanup
- **Async Testing**: Use `await expect.element()` for DOM assertions with auto-retry
- **Mock Strategies**: Use MSW for API mocking (more realistic than `vi.mock`)
- **Isolation**: Enable `restoreMocks: true` in config to auto-restore after each test

#### Limitations
- **No Multi-Threading**: Tests run in isolated threads (no shared state)
- **Browser Mode Experimental**: Browser testing is still evolving

#### Common Pitfalls
- ❌ **Not Cleaning Mocks**: Mock state leaks between tests (use `onTestFinished`)
- ❌ **Missing Async Assertions**: Not using `await` with async assertions causes flaky tests
- ❌ **Over-Mocking**: Mocking too much reduces test confidence
- ❌ **No Test Timeout**: Long-running tests hang CI (set `testTimeout: 10000`)

#### Conventions
```javascript
import { test, expect, vi, onTestFinished } from 'vitest';

test('processes LLM request', async () => {
  const spy = vi.spyOn(llmClient, 'inference');
  onTestFinished(() => spy.mockClear());

  const result = await processRequest({ prompt: 'Hello' });
  
  expect(spy).toHaveBeenCalledWith({ prompt: 'Hello' });
  expect(result).toHaveProperty('response');
});
```

---

### Sentry

#### Best Practices
- **Initialize Early**: Call `Sentry.init()` before importing other modules
- **Filter Errors**: Use `ignoreErrors: [/pattern/]` to filter noisy errors
- **Context Enrichment**: Use `Sentry.setUser()` and `Sentry.setTag()` for debugging
- **Performance Monitoring**: Enable `tracesSampleRate: 0.1` (10% sampling) for production
- **Release Tracking**: Set `release` option to track errors by version

#### Limitations
- **Rate Limiting**: Free tier has monthly event limits (filter aggressively)
- **Source Maps Required**: Need source maps for readable stack traces in production
- **No Automatic PII Scrubbing**: Must manually configure `beforeSend` to remove sensitive data

#### Common Pitfalls
- ❌ **Capturing Too Much**: Every error sent to Sentry (use `ignoreErrors`)
- ❌ **No Release Info**: Can't track when bugs were introduced
- ❌ **Exposing PII**: Accidentally sending user emails/passwords in context
- ❌ **100% Sampling**: Performance monitoring kills quota (use 10-20%)

#### Conventions
```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.GIT_COMMIT,
  tracesSampleRate: 0.1, // 10% performance sampling
  ignoreErrors: [/network timeout/i, /ECONNREFUSED/],
  beforeSend(event, hint) {
    // Remove sensitive data
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization;
    }
    return event;
  }
});

// Usage
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'llm-inference' },
    extra: { villagerId: 'v-123' }
  });
}
```

---

### Axios

#### Best Practices
- **Instance Configuration**: Create axios instance with `baseURL` and default `timeout`
- **Interceptors**: Use request interceptors for auth tokens, response interceptors for retry logic
- **Timeout**: Always set `timeout: 5000` (5s) to prevent hanging requests
- **Error Handling**: Check `error.response`, `error.request`, and `error.message` separately

#### Limitations
- **No Retry Built-in**: Must implement retry logic with interceptors
- **Request Body Limits**: Default limit is 10MB (adjust with `maxBodyLength`)
- **No Abort Controller**: Use `CancelToken` for request cancellation (deprecated in favor of AbortController)

#### Common Pitfalls
- ❌ **No Timeout**: Requests hang indefinitely on network issues
- ❌ **Ignoring Error Types**: Only checking `error.response` misses network errors
- ❌ **Hardcoded URLs**: Not using `baseURL` and relative paths
- ❌ **Not Reusing Instance**: Creating new axios instance per request

#### Conventions
```javascript
const apiClient = axios.create({
  baseURL: process.env.LLM_API_URL,
  timeout: 10000, // 10s for LLM inference
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor (auth)
apiClient.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${process.env.API_TOKEN}`;
  return config;
});

// Response interceptor (retry)
apiClient.interceptors.response.use(undefined, async (error) => {
  if (error.response?.status === 429 && error.config.retryCount < 3) {
    error.config.retryCount = (error.config.retryCount || 0) + 1;
    await new Promise(resolve => setTimeout(resolve, 1000 * error.config.retryCount));
    return apiClient(error.config);
  }
  throw error;
});

// Error handling
try {
  const { data } = await apiClient.post('/inference', { prompt });
  return data;
} catch (error) {
  if (error.response) {
    // Server responded with error status
    console.error('API Error:', error.response.status, error.response.data);
  } else if (error.request) {
    // No response received
    console.error('Network Error:', error.message);
  } else {
    // Request setup error
    console.error('Request Error:', error.message);
  }
  throw error;
}
```

---

### Socket.IO

#### Best Practices
- **Event Naming**: Use namespaces for feature isolation (e.g., `/villagers`, `/admin`)
- **Room Management**: Group villagers by area/dimension for efficient broadcasting
- **Acknowledgments**: Use `emitWithAck()` for request/response patterns with timeout
- **Connection Recovery**: Enable built-in state recovery for brief disconnections
- **Event Registration**: Register event handlers once, outside `connect` event (prevents duplicates)
- **Heartbeat Tuning**: Adjust `pingTimeout` and `pingInterval` for network conditions
- **Memory Management**: Clear HTTP request reference with `rawSocket.request = null`

#### Limitations
- **HTTP Fallback Overhead**: Long-polling fallback increases latency if WebSocket fails
- **Scaling Complexity**: Multi-server setups require Redis adapter or sticky sessions
- **Message Size**: Large payloads (>1MB) should use HTTP chunking or compression
- **No Built-in Compression**: Must enable `perMessageDeflate` manually (CPU overhead)
- **Binary Data**: Less efficient than pure WebSocket for large binary transfers

#### Common Pitfalls
- ❌ **Registering Handlers in `connect`**: Causes duplicate handlers on reconnect
- ❌ **No Timeout on Acknowledgments**: Requests hang forever without `socket.timeout()`
- ❌ **Storing Socket References**: Sockets become invalid on disconnect (store socket.id instead)
- ❌ **Broadcasting Without Rooms**: Inefficient to emit to all clients when targeting specific group
- ❌ **Not Handling `disconnect`**: Memory leaks from not cleaning up listeners
- ❌ **Synchronous Operations in Handlers**: Blocks event loop (use async/await)

#### Conventions
```javascript
import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.ALLOWED_ORIGINS },
  pingTimeout: 20000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowUpgrades: true
});

// Memory optimization
io.engine.on('connection', (rawSocket) => {
  rawSocket.request = null; // Clear HTTP request reference
});

// Namespace for villager communication
const villagerNamespace = io.of('/villagers');

villagerNamespace.on('connection', (socket) => {
  console.log(`Villager connected: ${socket.id}`);
  
  // Join room based on villager location
  const villagerId = socket.handshake.query.villagerId;
  const dimension = socket.handshake.query.dimension || 'overworld';
  socket.join(`${dimension}`);
  socket.join(`villager:${villagerId}`);
  
  // ✅ Event handlers registered once
  socket.on('sensory-event', async (data) => {
    // Process Layer 1 sensory stream
    await handleSensoryEvent(villagerId, data);
  });
  
  // ✅ Request/response with timeout and acknowledgment
  socket.on('memory-query', async (query, callback) => {
    try {
      const result = await queryMemory(villagerId, query);
      callback({ success: true, data: result });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // ✅ Cleanup on disconnect
  socket.on('disconnect', (reason) => {
    console.log(`Villager disconnected: ${socket.id}, reason: ${reason}`);
    // Clean up any villager-specific resources
    cleanupVillagerResources(villagerId);
  });
  
  // Handle reconnection
  socket.on('connect', () => {
    if (socket.recovered) {
      console.log(`Session recovered for ${socket.id}`);
    } else {
      console.log(`New session for ${socket.id}`);
    }
  });
});

// ✅ Broadcasting to specific rooms
function broadcastWorkingMemoryUpdate(villagerId, memoryState) {
  villagerNamespace.to(`villager:${villagerId}`).emit('working-memory-update', memoryState);
}

// ✅ Broadcasting to dimension (all villagers in overworld)
function broadcastDimensionEvent(dimension, eventData) {
  villagerNamespace.to(dimension).emit('dimension-event', eventData);
}

// ✅ Request/response from server with timeout
async function requestActionFromVillager(villagerId, actionData) {
  const sockets = await villagerNamespace.in(`villager:${villagerId}`).fetchSockets();
  if (sockets.length === 0) throw new Error('Villager not connected');
  
  const socket = sockets[0];
  try {
    const response = await socket.timeout(5000).emitWithAck('execute-action', actionData);
    return response;
  } catch (error) {
    throw new Error(`Action timeout: ${error.message}`);
  }
}

httpServer.listen(3000);
```

#### Hybrid HTTP + WebSocket Pattern
```javascript
// Express HTTP routes (stateless operations)
app.post('/api/episodes', async (req, res) => {
  const { villagerId, episodeData } = req.body;
  await saveEpisode(villagerId, episodeData);
  res.json({ success: true });
});

app.get('/api/memory/:villagerId', async (req, res) => {
  const memory = await queryMemory(req.params.villagerId);
  res.json(memory);
});

// Socket.IO for real-time updates (stateful operations)
villagerNamespace.on('connection', (socket) => {
  // Real-time sensory stream (Layer 1)
  socket.on('sensory-stream', (eventData) => {
    processSensoryEvent(eventData);
  });
  
  // Bidirectional working memory sync (Layer 4)
  socket.on('mood-change', (moodData) => {
    updateWorkingMemory(socket.villagerId, moodData);
    // Broadcast to other connected clients
    socket.broadcast.to(`villager:${socket.villagerId}`).emit('mood-update', moodData);
  });
});

// Server-initiated push (Layer 6 → Bedrock)
async function streamLLMResponse(villagerId, prompt) {
  const sockets = await villagerNamespace.in(`villager:${villagerId}`).fetchSockets();
  if (sockets.length === 0) return;
  
  const socket = sockets[0];
  
  // Stream tokens as they're generated
  for await (const token of generateLLMTokens(prompt)) {
    socket.emit('llm-token', { token });
  }
  socket.emit('llm-complete');
}
```

#### When to Use HTTP vs WebSocket

**Use HTTP When:**
- ✅ One-time data fetches (memory queries, config reads)
- ✅ Bulk operations (batch episode writes, migrations)
- ✅ Cacheable responses (vectorization, concept lookups)
- ✅ Idempotent operations (safe to retry)
- ✅ External API calls (llama.cpp, third-party services)
- ✅ Stateless operations

**Use WebSocket When:**
- ✅ High-frequency updates (Layer 1 sensory events)
- ✅ Bidirectional state sync (working memory)
- ✅ Real-time notifications (action commands, task updates)
- ✅ Streaming responses (LLM token-by-token)
- ✅ Multi-client coordination (gossip, collective learning)
- ✅ Low-latency requirements (<50ms)
- ✅ Persistent connection beneficial

---

**Next Steps:**
1. Set up PostgreSQL 18 with pgvector extension
2. Install and configure Redis 7+
3. Initialize project with `npm install @latest`
4. Run database migrations (`npm run db:schema`)
5. Configure llama.cpp HTTP server
6. Set up Socket.IO server with namespace configuration
7. Create PM2 ecosystem.config.js
8. Initialize Sentry project and obtain DSN
9. Download and cache AI models with @xenova/transformers
10. Configure CORS for WebSocket connections
