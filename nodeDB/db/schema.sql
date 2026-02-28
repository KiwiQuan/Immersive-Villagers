-- Enable pgvector extension for high-performance vector operations
CREATE EXTENSION IF NOT EXISTS vector;

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

-- Concept definitions (shared knowledge pool)
-- semantic_vector stores [C, V, I, S, X] as VECTOR(5) for fast cosine similarity
CREATE TABLE concepts (
  concept_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  semantic_vector VECTOR(5) NOT NULL,
  discovery_count INTEGER DEFAULT 0
);

-- Subjective knowledge: tracks what each villager has learned
CREATE TABLE villager_discoveries (
  villager_id TEXT REFERENCES villagers(villager_id) ON DELETE CASCADE,
  concept_id INTEGER REFERENCES concepts(concept_id) ON DELETE CASCADE,
  discovered_at BIGINT NOT NULL,
  discovery_method TEXT,
  PRIMARY KEY (villager_id, concept_id)
);

-- Episode storage: recorded memories
-- semantic_vector stores episode's average [C, V, I, S, X] vector
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  villager_id TEXT NOT NULL REFERENCES villagers(villager_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  semantic_vector VECTOR(5) NOT NULL,
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
-- current_mood stores the villager's current [C, V, I, S, X] state
CREATE TABLE working_memory (
  villager_id TEXT PRIMARY KEY REFERENCES villagers(villager_id) ON DELETE CASCADE,
  current_mood VECTOR(5) NOT NULL,
  current_focus TEXT,
  shock_state BOOLEAN DEFAULT FALSE,
  last_update BIGINT NOT NULL
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
CREATE INDEX idx_concepts_vector ON concepts USING ivfflat (semantic_vector vector_cosine_ops);
CREATE INDEX idx_episodes_vector ON episodes USING ivfflat (semantic_vector vector_cosine_ops);
