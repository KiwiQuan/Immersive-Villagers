-- Enable pgvector extension for high-performance vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables (for clean reinstall)
DROP TABLE IF EXISTS build_tasks;
DROP TABLE IF EXISTS pattern_observations;
DROP TABLE IF EXISTS villager_world_map;
DROP TABLE IF EXISTS structure_blueprints;
DROP TABLE IF EXISTS structure_templates;
DROP TABLE IF EXISTS working_memory;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS episodes;
DROP TABLE IF EXISTS villager_discoveries;
DROP TABLE IF EXISTS concepts;
DROP TABLE IF EXISTS villagers;
-- Drop existing indexes
DROP INDEX IF EXISTS idx_villagers_active;
DROP INDEX IF EXISTS idx_episodes_villager;
DROP INDEX IF EXISTS idx_episodes_actor;
DROP INDEX IF EXISTS idx_relationships_villager;
DROP INDEX IF EXISTS idx_relationships_actor;
DROP INDEX IF EXISTS idx_discoveries_villager;
DROP INDEX IF EXISTS idx_discoveries_concept;
DROP INDEX IF EXISTS idx_concepts_vector_manual;
DROP INDEX IF EXISTS idx_concepts_vector_minilm;
DROP INDEX IF EXISTS idx_episodes_vector_manual;
DROP INDEX IF EXISTS idx_episodes_vector_minilm;
DROP INDEX IF EXISTS idx_templates_hash;
DROP INDEX IF EXISTS idx_templates_embedding;
DROP INDEX IF EXISTS idx_templates_label;
DROP INDEX IF EXISTS idx_blueprints_embedding;
DROP INDEX IF EXISTS idx_blueprints_tags;
DROP INDEX IF EXISTS idx_blueprints_name;
DROP INDEX IF EXISTS idx_world_map_villager;
DROP INDEX IF EXISTS idx_world_map_location;
DROP INDEX IF EXISTS idx_world_map_structure;
DROP INDEX IF EXISTS idx_build_tasks_villager;
DROP INDEX IF EXISTS idx_build_tasks_status;
DROP INDEX IF EXISTS idx_pattern_observations_villager;
DROP INDEX IF EXISTS idx_pattern_observations_hash;
DROP INDEX IF EXISTS idx_vector_cache_text;
DROP INDEX IF EXISTS idx_vector_cache_accessed;


-- Core villager identity table
CREATE TABLE villagers (
  villager_id TEXT PRIMARY KEY,
  name TEXT,
  home_x REAL,
  home_y REAL,
  home_z REAL,
  profession TEXT,
  created_at BIGINT NOT NULL,
  last_seen BIGINT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Concept definitions (shared knowledge pool with dual vector support)
-- semantic_vector_manual stores [C, V, I, S, X] as VECTOR(5) for MONOLITHIC mode
-- semantic_vector_minilm stores 384D embedding for MICROSERVICES mode
CREATE TABLE concepts (
  concept_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  semantic_vector_manual VECTOR(5),
  semantic_vector_minilm VECTOR(384),
  discovery_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subjective knowledge: tracks what each villager has learned
CREATE TABLE villager_discoveries (
  villager_id TEXT REFERENCES villagers(villager_id) ON DELETE CASCADE,
  concept_id INTEGER REFERENCES concepts(concept_id) ON DELETE CASCADE,
  discovered_at BIGINT NOT NULL,
  discovery_method TEXT,
  PRIMARY KEY (villager_id, concept_id)
);

-- Episode storage: recorded memories with dual vector support
-- semantic_vector_manual stores episode's average [C, V, I, S, X] vector (MONOLITHIC mode)
-- semantic_vector_minilm stores 384D embedding (MICROSERVICES mode)
-- summary_text stores T5-small generated summary (MICROSERVICES mode)
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  semantic_vector_manual VECTOR(5),
  semantic_vector_minilm VECTOR(384),
  summary_text TEXT,
  duration INTEGER,
  event_count INTEGER,
  seal_reason TEXT,
  timestamp BIGINT NOT NULL
);

-- Relationship tracking: trust scores per player
CREATE TABLE relationships (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  interaction_count INTEGER DEFAULT 0,
  trust_score REAL DEFAULT 0.5,
  last_interaction BIGINT,
  UNIQUE(villager_id, actor_id)
);

-- Working memory snapshot (synced from DynamicProperties)
-- current_mood_manual stores the villager's current [C, V, I, S, X] state (MONOLITHIC mode)
-- current_mood_minilm stores 384D embedding (MICROSERVICES mode)
CREATE TABLE working_memory (
  villager_id TEXT PRIMARY KEY REFERENCES villagers(villager_id) ON DELETE CASCADE,
  current_mood_manual VECTOR(5),
  current_mood_minilm VECTOR(384),
  current_focus TEXT,
  shock_state BOOLEAN DEFAULT FALSE,
  last_update BIGINT NOT NULL
);

-- Structure templates: building "recipes"
CREATE TABLE structure_templates (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  pattern_hash TEXT UNIQUE,
  embedding VECTOR(384),
  instructions JSONB NOT NULL,
  dimensions JSONB,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observation_count INTEGER DEFAULT 1
);

-- Structure blueprints: high-level assembly guides
CREATE TABLE structure_blueprints (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  embedding VECTOR(384),
  composition JSONB NOT NULL,
  tags JSONB,
  functional_zones JSONB,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  build_count INTEGER DEFAULT 0
);

-- Villager's subjective world map
CREATE TABLE villager_world_map (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  structure_id INTEGER REFERENCES structure_blueprints(id) ON DELETE CASCADE,
  anchor_x INT NOT NULL,
  anchor_y INT NOT NULL,
  anchor_z INT NOT NULL,
  confidence REAL DEFAULT 1.0,
  last_observed BIGINT NOT NULL,
  dimension TEXT DEFAULT 'overworld',
  UNIQUE(villager_id, anchor_x, anchor_y, anchor_z)
);

-- Build task queue
CREATE TABLE build_tasks (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  blueprint_id INTEGER REFERENCES structure_blueprints(id),
  template_id INTEGER REFERENCES structure_templates(id),
  anchor_x INT NOT NULL,
  anchor_y INT NOT NULL,
  anchor_z INT NOT NULL,
  status TEXT DEFAULT 'pending',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  trigger_source TEXT,
  trigger_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at BIGINT,
  completed_at BIGINT
);

-- Pattern observation tracking (for real-time learning)
CREATE TABLE pattern_observations (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  pattern_hash TEXT NOT NULL,
  block_sequence JSONB NOT NULL,
  observation_timestamp BIGINT NOT NULL,
  consolidated BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_villagers_active ON villagers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_episodes_villager ON episodes(villager_id, timestamp DESC);
CREATE INDEX idx_episodes_actor ON episodes(actor_id, timestamp DESC);
CREATE INDEX idx_relationships_villager ON relationships(villager_id);
CREATE INDEX idx_relationships_actor ON relationships(actor_id);
CREATE INDEX idx_discoveries_villager ON villager_discoveries(villager_id);
CREATE INDEX idx_discoveries_concept ON villager_discoveries(concept_id);

-- Vector similarity indexes using pgvector for fast cosine similarity queries
-- These enable the <=> operator for efficient memory retrieval
-- Dual indexes support both MONOLITHIC (5D) and MICROSERVICES (384D) modes
CREATE INDEX idx_concepts_vector_manual ON concepts USING ivfflat (semantic_vector_manual vector_cosine_ops);
CREATE INDEX idx_concepts_vector_minilm ON concepts USING ivfflat (semantic_vector_minilm vector_cosine_ops);
CREATE INDEX idx_episodes_vector_manual ON episodes USING ivfflat (semantic_vector_manual vector_cosine_ops);
CREATE INDEX idx_episodes_vector_minilm ON episodes USING ivfflat (semantic_vector_minilm vector_cosine_ops);

-- Structure system indexes
CREATE INDEX idx_templates_hash ON structure_templates(pattern_hash);
CREATE INDEX idx_templates_embedding ON structure_templates USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_templates_label ON structure_templates(label);
CREATE INDEX idx_blueprints_embedding ON structure_blueprints USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_blueprints_tags ON structure_blueprints USING gin(tags);
CREATE INDEX idx_blueprints_name ON structure_blueprints(name);
CREATE INDEX idx_world_map_villager ON villager_world_map(villager_id);
CREATE INDEX idx_world_map_location ON villager_world_map(anchor_x, anchor_y, anchor_z);
CREATE INDEX idx_world_map_structure ON villager_world_map(structure_id);
CREATE INDEX idx_build_tasks_villager ON build_tasks(villager_id, status);
CREATE INDEX idx_build_tasks_status ON build_tasks(status);
CREATE INDEX idx_pattern_observations_villager ON pattern_observations(villager_id, consolidated);
CREATE INDEX idx_pattern_observations_hash ON pattern_observations(pattern_hash);
