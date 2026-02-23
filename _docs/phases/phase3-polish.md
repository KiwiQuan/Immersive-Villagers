# Phase 3: Polish & Optimization — Production Ready

**Status:** Polish & Optimization Phase  
**Goal:** Optimize performance, add advanced features, prepare for production  
**Deliverable:** Scalable system supporting 20+ villagers with polished UX  
**Duration Target:** 5-7 implementation sessions

---

## Overview

This phase focuses on performance optimization, advanced features, comprehensive error handling, and production readiness. The system will scale efficiently, handle edge cases gracefully, and provide a polished experience for both players and server operators.

**Success Criteria:**
- System supports 20+ active villagers without lag
- Advanced pathfinding with obstacle avoidance
- Villager-to-villager gossip and knowledge sharing
- Comprehensive rate limiting and throttling
- Production monitoring and alerting
- Complete documentation and deployment guides

---

## Feature 1: Performance Profiling & Optimization

**Goal:** Identify and eliminate performance bottlenecks

### Steps:
1. Add performance metrics collection: Track tick time per layer
2. Implement profiling endpoints: `/api/metrics/performance`
3. Optimize Layer 1 filters: Use spatial partitioning for proximity checks
4. Batch database writes: Group multiple episode writes into single transaction
5. Add caching layer: Cache frequently accessed data (relationships, identity tags)

**Files Created:**
- `scripts/utils/performance_monitor.js`
- `nodeDB/utils/metrics.js`
- `nodeDB/middleware/cache.js`

**Performance Monitor:**
```javascript
// scripts/utils/performance_monitor.js
const layerMetrics = new Map();

export function trackLayerPerformance(layerName, executionTime) {
  if (!layerMetrics.has(layerName)) {
    layerMetrics.set(layerName, { total: 0, count: 0, max: 0 });
  }
  
  const metrics = layerMetrics.get(layerName);
  metrics.total += executionTime;
  metrics.count++;
  metrics.max = Math.max(metrics.max, executionTime);
}

export function getLayerMetrics() {
  const report = {};
  for (const [layer, data] of layerMetrics) {
    report[layer] = {
      average: data.total / data.count,
      max: data.max,
      calls: data.count
    };
  }
  return report;
}

// Usage in layers
const start = Date.now();
// ... layer logic ...
trackLayerPerformance('Layer1_Sensory', Date.now() - start);
```

**Database Write Batching:**
```javascript
// nodeDB/utils/batch_writer.js
class BatchWriter {
  constructor() {
    this.episodeQueue = [];
    this.flushInterval = 2000; // 2 seconds
    this.maxBatchSize = 10;
    
    setInterval(() => this.flush(), this.flushInterval);
  }
  
  enqueue(episode) {
    this.episodeQueue.push(episode);
    
    if (this.episodeQueue.length >= this.maxBatchSize) {
      this.flush();
    }
  }
  
  async flush() {
    if (this.episodeQueue.length === 0) return;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const episode of this.episodeQueue) {
        await client.query(
          'INSERT INTO episodes (villager_id, actor_id, vector_c, vector_v, vector_i, vector_s, vector_x, duration, event_count, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [episode.villagerID, episode.actorID, episode.vectorAverage.C, episode.vectorAverage.V, episode.vectorAverage.I, episode.vectorAverage.S, episode.vectorAverage.X, episode.duration, episode.eventCount, episode.timestamp]
        );
      }
      
      await client.query('COMMIT');
      logger.info({ batchSize: this.episodeQueue.length }, '[BatchWriter] Flushed episode batch');
      this.episodeQueue = [];
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ error: err.message }, '[BatchWriter] Batch write failed');
    } finally {
      client.release();
    }
  }
}

const batchWriter = new BatchWriter();
module.exports = batchWriter;
```

**Spatial Partitioning:**
```javascript
// scripts/utils/spatial_grid.js
class SpatialGrid {
  constructor(cellSize = 32) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  
  getCellKey(x, z) {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }
  
  insert(entity) {
    const key = this.getCellKey(entity.location.x, entity.location.z);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key).add(entity.id);
  }
  
  getNearby(location, radius) {
    const minX = location.x - radius;
    const maxX = location.x + radius;
    const minZ = location.z - radius;
    const maxZ = location.z + radius;
    
    const nearby = new Set();
    
    for (let x = minX; x <= maxX; x += this.cellSize) {
      for (let z = minZ; z <= maxZ; z += this.cellSize) {
        const key = this.getCellKey(x, z);
        const cell = this.grid.get(key);
        if (cell) {
          for (const entityID of cell) {
            nearby.add(entityID);
          }
        }
      }
    }
    
    return Array.from(nearby);
  }
  
  clear() {
    this.grid.clear();
  }
}

export const villagerGrid = new SpatialGrid();
```

**Validation:**
- Performance metrics endpoint shows <5ms average for Layers 1-4
- Batch writer reduces database load by 70%
- Spatial partitioning reduces proximity checks by 80%

---

## Feature 2: Advanced Pathfinding

**Goal:** Implement A* pathfinding with obstacle avoidance

### Steps:
1. Create `scripts/utils/pathfinding.js` with A* algorithm implementation
2. Build navigation grid from world blocks (walkable vs. obstacles)
3. Cache navigation data in DynamicProperties (per-villager memory of area)
4. Implement smooth path interpolation for natural movement
5. Add path recalculation when blocked

**Files Created:**
- `scripts/utils/pathfinding.js`
- `scripts/utils/navigation_grid.js`

**A* Pathfinding:**
```javascript
// scripts/utils/pathfinding.js
function findPath(start, goal, dimension) {
  const openSet = [{ pos: start, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), parent: null }];
  const closedSet = new Set();
  
  while (openSet.length > 0) {
    // Sort by f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    
    // Goal reached
    if (distance(current.pos, goal) < 1.0) {
      return reconstructPath(current);
    }
    
    closedSet.add(posKey(current.pos));
    
    // Check neighbors
    const neighbors = getWalkableNeighbors(current.pos, dimension);
    for (const neighbor of neighbors) {
      const key = posKey(neighbor);
      if (closedSet.has(key)) continue;
      
      const g = current.g + distance(current.pos, neighbor);
      const h = heuristic(neighbor, goal);
      const f = g + h;
      
      const existing = openSet.find(n => posKey(n.pos) === key);
      if (existing && g >= existing.g) continue;
      
      if (existing) {
        existing.g = g;
        existing.f = f;
        existing.parent = current;
      } else {
        openSet.push({ pos: neighbor, g, h, f, parent: current });
      }
    }
  }
  
  // No path found
  return null;
}

function reconstructPath(node) {
  const path = [];
  let current = node;
  while (current) {
    path.unshift(current.pos);
    current = current.parent;
  }
  return path;
}

function getWalkableNeighbors(pos, dimension) {
  const neighbors = [];
  const offsets = [
    { x: 1, z: 0 }, { x: -1, z: 0 },
    { x: 0, z: 1 }, { x: 0, z: -1 },
    { x: 1, z: 1 }, { x: -1, z: -1 },
    { x: 1, z: -1 }, { x: -1, z: 1 }
  ];
  
  for (const offset of offsets) {
    const neighbor = {
      x: pos.x + offset.x,
      y: pos.y,
      z: pos.z + offset.z
    };
    
    // Check if walkable
    const blockBelow = dimension.getBlock(neighbor);
    const blockAt = dimension.getBlock({ x: neighbor.x, y: neighbor.y + 1, z: neighbor.z });
    
    if (blockBelow && blockBelow.isSolid && (!blockAt || !blockAt.isSolid)) {
      neighbors.push(neighbor);
    }
  }
  
  return neighbors;
}

function heuristic(a, b) {
  // Manhattan distance
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function distance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));
}

function posKey(pos) {
  return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}
```

**Path Following:**
```javascript
// In scripts/layers/layer7_action.js
function followPath(villager) {
  const pathJSON = villager.getDynamicProperty('current_path');
  if (!pathJSON) return;
  
  const path = JSON.parse(pathJSON);
  const pathIndex = villager.getDynamicProperty('path_index') || 0;
  
  if (pathIndex >= path.length) {
    // Path complete
    villager.setDynamicProperty('is_pathfinding', false);
    villager.setDynamicProperty('current_path', undefined);
    return;
  }
  
  const target = path[pathIndex];
  const currentLoc = villager.location;
  
  if (distance(currentLoc, target) < 0.5) {
    // Reached waypoint, move to next
    villager.setDynamicProperty('path_index', pathIndex + 1);
    return;
  }
  
  // Move toward waypoint
  const dx = (target.x - currentLoc.x);
  const dz = (target.z - currentLoc.z);
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  villager.teleport({
    x: currentLoc.x + (dx / dist) * 0.3,
    y: target.y,
    z: currentLoc.z + (dz / dist) * 0.3
  });
}
```

**Validation:**
- Villager navigates around walls to reach destination
- Path recalculates when blocked by new obstacle
- Movement appears smooth and natural

---

## Feature 3: Villager-to-Villager Gossip

**Goal:** Villagers share knowledge with each other

### Steps:
1. Add villager proximity detection: Villagers within 5 blocks can gossip
2. Implement automatic gossip sharing: Every 60 seconds, share random fact with nearby villager
3. Create gossip propagation algorithm: Facts spread through network over time
4. Add confidence decay: Old gossip becomes less reliable (confidence drops)
5. Display gossip chains in debug menu: Show how facts spread

**Files Created:**
- `scripts/systems/gossip_network.js`
- `nodeDB/queries/gossip_propagation.js`

**Gossip Sharing System:**
```javascript
// scripts/systems/gossip_network.js
system.runInterval(() => {
  const villagers = world.getDimension('overworld').getEntities({ type: 'minecraft:villager_v2' });
  
  for (const villager of villagers) {
    if (!villager.isValid()) continue;
    
    // Find nearby villagers
    const nearby = villagers.filter(other => 
      other.id !== villager.id &&
      other.isValid() &&
      distance(villager.location, other.location) < 5.0
    );
    
    if (nearby.length === 0) continue;
    
    // Share a random fact
    http.get(`http://localhost:3000/api/gossip/random?villagerID=${villager.id}`)
      .then(response => {
        const data = JSON.parse(response.body);
        if (data.status === 'success' && data.fact) {
          // Share with random nearby villager
          const recipient = nearby[Math.floor(Math.random() * nearby.length)];
          
          http.post('http://localhost:3000/api/gossip/share', {
            body: JSON.stringify({
              sourceVillagerID: villager.id,
              targetVillagerID: recipient.id,
              fact: data.fact,
              originalConfidence: data.confidence
            })
          });
        }
      });
  }
}, 1200); // Every 60 seconds
```

**Gossip Propagation Logic:**
```javascript
// nodeDB/queries/gossip_propagation.js
async function shareGossip(sourceVillagerID, targetVillagerID, fact, originalConfidence) {
  const client = await pool.connect();
  try {
    // Check if target already knows this fact
    const existing = await client.query(
      'SELECT confidence FROM gossip WHERE villager_id = $1 AND fact = $2',
      [targetVillagerID, fact]
    );
    
    if (existing.rows.length > 0) {
      // Already knows, maybe reinforce confidence
      const newConfidence = Math.min(existing.rows[0].confidence + 0.1, 1.0);
      await client.query(
        'UPDATE gossip SET confidence = $1 WHERE villager_id = $2 AND fact = $3',
        [newConfidence, targetVillagerID, fact]
      );
    } else {
      // New knowledge, reduce confidence slightly (second-hand info)
      const reducedConfidence = originalConfidence * 0.9;
      await client.query(
        'INSERT INTO gossip (villager_id, fact, source_type, source_id, confidence, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
        [targetVillagerID, fact, 'villager', sourceVillagerID, reducedConfidence, Date.now()]
      );
    }
  } finally {
    client.release();
  }
}
```

**Confidence Decay:**
```javascript
// Run daily via cron or scheduled job
async function decayGossipConfidence() {
  await pool.query(
    'UPDATE gossip SET confidence = GREATEST(confidence * 0.95, 0.1) WHERE timestamp < $1',
    [Date.now() - (7 * 24 * 60 * 60 * 1000)] // Facts older than 7 days
  );
  
  logger.info('[Gossip] Applied confidence decay to old gossip');
}
```

**Validation:**
- Whisper fact to Villager A → Within 2 minutes, nearby Villager B learns it
- Check database: Both villagers have the fact with different confidence scores
- Old gossip decays over time

---

## Feature 4: Rate Limiting & Throttling

**Goal:** Prevent system overload from excessive requests

### Steps:
1. Add LLM request rate limiter: Max 1 request per villager per 5 seconds
2. Implement Brain Scheduler queue limits: Max 20 requests queued
3. Add HTTP request throttling: Max 100 req/sec from Script API
4. Implement exponential backoff for failed requests
5. Add rate limit headers in API responses

**Files Created:**
- `nodeDB/middleware/rate_limit.js`
- `scripts/utils/request_throttle.js`

**LLM Rate Limiter:**
```javascript
// In nodeDB/brain/scheduler.js
class BrainScheduler {
  constructor() {
    this.queue = [];
    this.pendingIntents = new Map();
    this.lastRequestTime = new Map(); // villagerID → timestamp
    this.rateLimitWindow = 5000; // 5 seconds
    this.maxQueueSize = 20;
  }
  
  enqueue(request) {
    // Check rate limit
    const lastTime = this.lastRequestTime.get(request.villagerID) || 0;
    const now = Date.now();
    
    if (now - lastTime < this.rateLimitWindow) {
      logger.warn({ villagerID: request.villagerID }, '[Brain Scheduler] Rate limited');
      return { status: 'rate_limited', retryAfter: this.rateLimitWindow - (now - lastTime) };
    }
    
    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn('[Brain Scheduler] Queue full, rejecting request');
      return { status: 'queue_full' };
    }
    
    this.lastRequestTime.set(request.villagerID, now);
    
    const requestID = `req_${now}_${request.villagerID}`;
    this.queue.push({ requestID, ...request, timestamp: now });
    
    if (!this.isProcessing) this.processQueue();
    
    return { status: 'queued', requestID };
  }
}
```

**HTTP Rate Limiter Middleware:**
```javascript
// nodeDB/middleware/rate_limit.js
const requestCounts = new Map();

function rateLimitMiddleware(req, res, next) {
  const clientIP = req.ip;
  const now = Date.now();
  const windowSize = 1000; // 1 second
  const maxRequests = 100;
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, []);
  }
  
  const requests = requestCounts.get(clientIP);
  
  // Remove old requests outside window
  const recent = requests.filter(timestamp => now - timestamp < windowSize);
  
  if (recent.length >= maxRequests) {
    return res.status(429).json({
      status: 'error',
      message: 'Rate limit exceeded',
      retryAfter: windowSize
    });
  }
  
  recent.push(now);
  requestCounts.set(clientIP, recent);
  
  next();
}

module.exports = rateLimitMiddleware;
```

**Exponential Backoff:**
```javascript
// scripts/utils/request_throttle.js
async function requestWithBackoff(url, options, maxRetries = 3) {
  let retries = 0;
  let delay = 1000; // Start with 1 second
  
  while (retries < maxRetries) {
    try {
      const response = await http.post(url, options);
      return response;
    } catch (err) {
      retries++;
      
      if (retries >= maxRetries) {
        throw new Error(`Max retries reached: ${err.message}`);
      }
      
      console.warn(`[Retry ${retries}] Request failed, retrying in ${delay}ms`);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => system.runTimeout(resolve, ms / 50)); // Convert to ticks
}
```

**Validation:**
- Send 10 requests in 1 second from same villager → Only 2 processed
- Queue fills to 20 → New requests rejected with queue_full
- HTTP endpoint receives 150 req/sec → Returns 429 after 100

---

## Feature 5: Advanced Error Recovery

**Goal:** Graceful handling of all failure scenarios

### Steps:
1. Add health check monitoring: Detect when services are down
2. Implement automatic service restart attempts
3. Add circuit breaker pattern: Stop calling failed services temporarily
4. Create fallback data: Use cached/stale data when fresh data unavailable
5. Add comprehensive error logging with context

**Files Created:**
- `nodeDB/utils/health_monitor.js`
- `nodeDB/utils/circuit_breaker.js`
- `scripts/utils/error_handler.js`

**Health Monitor:**
```javascript
// nodeDB/utils/health_monitor.js
class HealthMonitor {
  constructor() {
    this.services = {
      database: { healthy: true, lastCheck: 0 },
      llm: { healthy: true, lastCheck: 0 }
    };
    
    this.checkInterval = 30000; // 30 seconds
    setInterval(() => this.checkAll(), this.checkInterval);
  }
  
  async checkAll() {
    await this.checkDatabase();
    await this.checkLLM();
  }
  
  async checkDatabase() {
    try {
      const result = await pool.query('SELECT 1');
      this.services.database.healthy = true;
      this.services.database.lastCheck = Date.now();
    } catch (err) {
      this.services.database.healthy = false;
      logger.error({ error: err.message }, '[Health] Database check failed');
    }
  }
  
  async checkLLM() {
    try {
      const response = await axios.get('http://localhost:8080/health', { timeout: 2000 });
      this.services.llm.healthy = true;
      this.services.llm.lastCheck = Date.now();
    } catch (err) {
      this.services.llm.healthy = false;
      logger.error({ error: err.message }, '[Health] LLM check failed');
    }
  }
  
  isHealthy(service) {
    return this.services[service]?.healthy || false;
  }
  
  getStatus() {
    return this.services;
  }
}

const healthMonitor = new HealthMonitor();
module.exports = healthMonitor;
```

**Circuit Breaker:**
```javascript
// nodeDB/utils/circuit_breaker.js
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
  }
  
  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn('[CircuitBreaker] Circuit opened, cooling down');
    }
  }
}

const llmCircuitBreaker = new CircuitBreaker();
module.exports = { llmCircuitBreaker };
```

**Comprehensive Error Logging:**
```javascript
// scripts/utils/error_handler.js
function handleLayerError(layerName, error, context) {
  const errorData = {
    layer: layerName,
    message: error.message,
    stack: error.stack,
    context: {
      villagerID: context.villagerID,
      timestamp: Date.now(),
      ...context
    }
  };
  
  console.error(`[Error] [${layerName}] ${error.message}`, JSON.stringify(errorData));
  
  // Send to backend for aggregation
  http.post('http://localhost:3000/api/errors/log', {
    body: JSON.stringify(errorData)
  }).catch(() => {
    // Silent fail if backend unreachable
  });
}
```

**Validation:**
- Stop PostgreSQL → Health monitor detects within 30 seconds
- LLM fails 5 times → Circuit breaker opens
- Errors logged with full context for debugging

---

## Feature 6: Production Monitoring

**Goal:** Real-time metrics and alerting for operators

### Steps:
1. Create monitoring dashboard endpoint: `/api/metrics/dashboard`
2. Track key metrics: Active villagers, LLM queue size, database connections
3. Add alerting thresholds: Queue >15, DB connections >18, tick time >10ms
4. Implement metrics export: Prometheus format for external monitoring
5. Create operator notification system (optional: Discord webhook)

**Files Created:**
- `nodeDB/routes/metrics.js`
- `nodeDB/utils/prometheus_exporter.js`

**Metrics Dashboard:**
```javascript
// nodeDB/routes/metrics.js
router.get('/dashboard', (req, res) => {
  const metrics = {
    villagers: {
      active: getActiveVillagerCount(),
      withMemories: getVillagersWithMemories()
    },
    brain: {
      queueSize: brainScheduler.queue.length,
      pendingIntents: brainScheduler.pendingIntents.size,
      avgProcessingTime: getAvgLLMProcessingTime()
    },
    database: {
      activeConnections: pool.totalCount - pool.idleCount,
      totalConnections: pool.totalCount,
      queuedRequests: pool.waitingCount
    },
    performance: {
      avgTickTime: getAvgTickTime(),
      maxTickTime: getMaxTickTime(),
      episodesPerSecond: getEpisodesPerSecond()
    },
    health: healthMonitor.getStatus()
  };
  
  res.json({ status: 'success', metrics });
});
```

**Alerting System:**
```javascript
// nodeDB/utils/alerting.js
class AlertManager {
  constructor() {
    this.thresholds = {
      queueSize: 15,
      dbConnections: 18,
      tickTime: 10
    };
    
    this.lastAlerts = new Map();
    this.cooldown = 300000; // 5 minutes
  }
  
  checkThresholds(metrics) {
    if (metrics.brain.queueSize > this.thresholds.queueSize) {
      this.sendAlert('queue_overload', `LLM queue size: ${metrics.brain.queueSize}`);
    }
    
    if (metrics.database.activeConnections > this.thresholds.dbConnections) {
      this.sendAlert('db_exhaustion', `DB connections: ${metrics.database.activeConnections}`);
    }
    
    if (metrics.performance.avgTickTime > this.thresholds.tickTime) {
      this.sendAlert('performance_degradation', `Avg tick time: ${metrics.performance.avgTickTime}ms`);
    }
  }
  
  sendAlert(alertType, message) {
    const lastAlert = this.lastAlerts.get(alertType) || 0;
    const now = Date.now();
    
    if (now - lastAlert < this.cooldown) return; // Cooldown
    
    this.lastAlerts.set(alertType, now);
    
    logger.error({ alertType, message }, '[Alert] Threshold exceeded');
    
    // Optional: Send to Discord webhook
    if (process.env.DISCORD_WEBHOOK_URL) {
      axios.post(process.env.DISCORD_WEBHOOK_URL, {
        content: `🚨 **Alert**: ${alertType}\n${message}`
      }).catch(() => {});
    }
  }
}

const alertManager = new AlertManager();
module.exports = alertManager;
```

**Prometheus Metrics Export:**
```javascript
// nodeDB/utils/prometheus_exporter.js
router.get('/prometheus', (req, res) => {
  const metrics = `
# HELP villager_active_count Number of active villagers
# TYPE villager_active_count gauge
villager_active_count ${getActiveVillagerCount()}

# HELP brain_queue_size LLM request queue size
# TYPE brain_queue_size gauge
brain_queue_size ${brainScheduler.queue.length}

# HELP db_connections_active Active database connections
# TYPE db_connections_active gauge
db_connections_active ${pool.totalCount - pool.idleCount}

# HELP performance_tick_time_ms Average tick time in milliseconds
# TYPE performance_tick_time_ms gauge
performance_tick_time_ms ${getAvgTickTime()}
`;
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics.trim());
});
```

**Validation:**
- Access `/api/metrics/dashboard` → Shows real-time metrics
- Queue size exceeds 15 → Alert triggered (logged/Discord)
- Prometheus scraper can ingest `/api/metrics/prometheus`

---

## Feature 7: Comprehensive Documentation

**Goal:** Complete guides for deployment and maintenance

### Steps:
1. Create deployment guide: Step-by-step production setup
2. Write operator manual: Common tasks, troubleshooting, monitoring
3. Document API endpoints: OpenAPI/Swagger specification
4. Create architecture diagrams: Layer flows, data models
5. Write performance tuning guide: Optimization tips for different server sizes

**Files Created:**
- `_docs/deployment-guide.md`
- `_docs/operator-manual.md`
- `_docs/api-reference.md`
- `_docs/performance-tuning.md`

**Deployment Guide Outline:**
```markdown
# Deployment Guide

## Prerequisites
- Ubuntu 22.04 LTS (or equivalent)
- PostgreSQL 15+
- Node.js 18+
- llama.cpp compiled
- Minecraft Bedrock Dedicated Server 1.26+

## Step 1: Database Setup
- Install PostgreSQL
- Create database and user
- Apply schema.sql
- Configure connection pooling

## Step 2: Backend Setup
- Install Node.js dependencies
- Configure .env file
- Start Express server
- Verify health check

## Step 3: LLM Setup
- Download quantized model
- Start llama.cpp server
- Test inference
- Configure auto-restart

## Step 4: Behavior Pack Deployment
- Copy files to BDS
- Enable in server properties
- Restart BDS
- Test HTTP connectivity

## Step 5: Monitoring Setup
- Configure Prometheus scraping
- Set up alerting (Discord/email)
- Test health checks
- Monitor logs

## Troubleshooting
- Common issues and solutions
- Log locations
- Debug mode usage
```

**Operator Manual Outline:**
```markdown
# Operator Manual

## Daily Operations
- Checking system health
- Monitoring villager count
- Reviewing logs

## Maintenance Tasks
- Database backups
- Log rotation
- Performance tuning

## Troubleshooting
- Villagers not responding
- LLM timeouts
- Database connection issues
- High memory usage

## Advanced Operations
- Scaling to 50+ villagers
- Migrating to faster LLM
- Database optimization
- Custom vector rules
```

**Validation:**
- Documentation complete and tested
- All commands verified on fresh install
- Troubleshooting section covers common issues

---

## Feature 8: Advanced LLM Prompting

**Goal:** Optimize prompts for better villager behavior

### Steps:
1. Add few-shot examples to prompts: Include sample inputs/outputs
2. Implement chain-of-thought prompting: Ask LLM to explain reasoning
3. Add constraint enforcement: Strict JSON format validation
4. Create prompt templates library: Different templates for different scenarios
5. Implement dynamic prompt adjustment based on context complexity

**Files Modified:**
- `nodeDB/brain/prompt_builder.js`

**Enhanced Prompt with Few-Shot:**
```javascript
function buildEnhancedPrompt(villagerContext) {
  return `You are an intelligent villager in Minecraft. You observe players and form relationships based on their actions.

## Example Interactions

Input: Player placed 5 diamond blocks near you. Trust score: 0.8
Output: {
  "action": "speak",
  "speechText": "Wow, those are beautiful diamonds! Are you building something special?",
  "internalMonologue": "This player trusts me with valuable blocks. They seem friendly and generous."
}

Input: Player broke your bed. Trust score: 0.2
Output: {
  "action": "speak",
  "speechText": "Hey! That was my bed! Why would you do that?",
  "internalMonologue": "I don't trust this player. They're destructive and disrespectful."
}

## Your Current Situation

Recent Activity:
${formatEpisodes(villagerContext.recentEpisodes)}

Gossip You've Heard:
${formatGossip(villagerContext.gossip)}

Your Relationship with Player ${villagerContext.actorID}:
- Trust Score: ${villagerContext.relationshipScore.toFixed(2)}
- Total Interactions: ${villagerContext.interactionCount}

Your Personality Traits:
- ${villagerContext.identityTags.join(', ')}

## Your Response

Based on the above context, generate a JSON response with your action and thoughts.

IMPORTANT: 
- Only speak if the situation warrants a comment
- Choose "idle" if nothing interesting is happening
- Be consistent with your personality traits
- Consider your trust score when responding

JSON Response:`;
}
```

**Validation:**
- LLM generates more contextually appropriate responses
- JSON format compliance improves to >95%
- Villagers exhibit consistent personalities

---

## Feature 9: Performance Stress Testing

**Goal:** Validate system performance under load

### Steps:
1. Create stress test script: Simulate 20+ villagers simultaneously
2. Measure key metrics: Tick time, LLM throughput, database load
3. Identify bottlenecks: Profile hot paths in code
4. Optimize based on findings: Apply targeted improvements
5. Document performance benchmarks: Create baseline metrics

**Files Created:**
- `_tests/stress_test.js`
- `_docs/performance-benchmarks.md`

**Stress Test Script:**
```javascript
// _tests/stress_test.js
const axios = require('axios');

async function simulateVillager(villagerID, duration) {
  const startTime = Date.now();
  let episodeCount = 0;
  
  while (Date.now() - startTime < duration) {
    // Simulate episode write
    await axios.post('http://localhost:3000/api/memory/episode', {
      villagerID,
      actorID: 'test-player',
      episodeSummary: {
        vectorAverage: {
          C: Math.random() * 2 - 1,
          V: Math.random() * 2 - 1,
          I: Math.random() * 2 - 1,
          S: Math.random() * 2 - 1,
          X: Math.random() * 2 - 1
        },
        duration: 5000,
        eventCount: 3,
        timestamp: Date.now()
      }
    });
    
    episodeCount++;
    
    // Simulate LLM request
    await axios.post('http://localhost:3000/api/brain/request', {
      villagerID,
      actorID: 'test-player',
      trigger: 'episode_complete',
      priority: 'medium'
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`Villager ${villagerID}: ${episodeCount} episodes in ${duration}ms`);
}

async function runStressTest() {
  const villagerCount = 20;
  const testDuration = 60000; // 1 minute
  
  console.log(`Starting stress test: ${villagerCount} villagers for ${testDuration}ms`);
  
  const villagers = Array.from({ length: villagerCount }, (_, i) => 
    simulateVillager(`stress-test-v${i}`, testDuration)
  );
  
  await Promise.all(villagers);
  
  // Fetch metrics
  const metrics = await axios.get('http://localhost:3000/api/metrics/dashboard');
  console.log('Final metrics:', metrics.data);
}

runStressTest();
```

**Performance Benchmarks Document:**
```markdown
# Performance Benchmarks

## Test Environment
- Hardware: [CPU, RAM, Storage specs]
- Software: BDS 1.26, Node.js 18, PostgreSQL 15
- LLM: llama.cpp with Llama 3 7B Q4_K_M

## 20 Villagers (Target Configuration)
- Avg Tick Time: 4.2ms (target: <5ms) ✅
- LLM Throughput: 18 req/min (target: >15) ✅
- Database Write Latency: 42ms avg (target: <100ms) ✅
- Memory Usage: 6.2GB (4.5GB base + 1.7GB villagers)

## 50 Villagers (Stress Test)
- Avg Tick Time: 9.8ms (degraded performance)
- LLM Queue Size: 35 (overloaded)
- Database Write Latency: 125ms avg
- Recommendation: Limit to 30 villagers without optimization

## Bottlenecks Identified
1. LLM inference speed (1-3s per villager)
2. Episode vectorization (Layer 2) at scale
3. Pathfinding calculations
```

**Validation:**
- System handles 20 villagers with <5ms tick time
- All services remain responsive under load
- No memory leaks after 1-hour test

---

## Feature 10: Final Polish & Bug Fixes

**Goal:** Address edge cases and improve UX

### Steps:
1. Fix UI navigation bugs: Ensure all menus can be exited
2. Add input validation: Sanitize all player-provided text
3. Improve error messages: User-friendly messages instead of technical errors
4. Add loading states: Show "Processing..." while waiting for LLM
5. Final QA pass: Test all features end-to-end

**QA Checklist:**
- [ ] All menu navigation flows work correctly
- [ ] Speech bubbles display special characters correctly
- [ ] Gossip system handles long text (>200 chars)
- [ ] Pathfinding doesn't get stuck in corners
- [ ] Identity tags update correctly over time
- [ ] Debug menu only accessible to operators
- [ ] Rate limiting prevents spam
- [ ] Instinct fallback activates when appropriate
- [ ] Working Memory persists across restarts
- [ ] Database backups can be restored successfully

---

## Production Readiness Checklist

**Infrastructure:**
- [ ] PostgreSQL configured with optimized settings
- [ ] Connection pooling limits set appropriately
- [ ] llama.cpp runs as systemd service with auto-restart
- [ ] Backend runs as systemd service with auto-restart
- [ ] Logs rotate automatically (logrotate configured)
- [ ] Backups scheduled (daily database dumps)

**Security:**
- [ ] .env file has secure passwords
- [ ] Database user has minimal required permissions
- [ ] HTTP endpoints are not publicly exposed
- [ ] Input validation on all user-provided data
- [ ] Rate limiting enabled on all endpoints

**Monitoring:**
- [ ] Prometheus scraping configured
- [ ] Alerting thresholds set
- [ ] Discord webhook connected (optional)
- [ ] Health checks passing
- [ ] Metrics dashboard accessible

**Documentation:**
- [ ] Deployment guide complete
- [ ] Operator manual written
- [ ] API reference documented
- [ ] Architecture diagrams created
- [ ] Performance tuning guide finalized

---

## Performance Targets (Phase 3)

| Metric | Target | Achieved |
|--------|--------|----------|
| Max Active Villagers | 20+ | To be measured |
| Avg Tick Time (20 villagers) | <5ms | To be measured |
| LLM Queue Processing | 20 req/min | To be measured |
| Database Write Latency | <100ms | To be measured |
| Memory Usage (20 villagers) | <7GB | To be measured |
| Uptime | 99%+ | To be measured |

---

## Known Limitations (Post-Phase 3)

**Future Enhancements (Post-MVP):**
- Machine learning for vector rule optimization
- Voice synthesis for villager speech
- Multi-language support
- Cloud-based LLM fallback
- Villager relationship graphs
- Advanced economy simulation

---

**Document Type:** Phase Plan  
**Phase:** 3 (Polish & Optimization)  
**Status:** Ready for Implementation  
**Last Updated:** Feb 23, 2026
