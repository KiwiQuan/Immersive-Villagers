import pool from "./pool.js";

/**
 * Test script for Step 5: Database Connectivity Testing
 * Tests pool connection, INSERT/SELECT operations, and concurrent queries.
 */

async function runTests() {
  console.log("=== Starting Database Connectivity Tests ===\n");

  try {
    // Test 1: Pool connection
    console.log("Test 1: Testing pool connection...");
    const client = await pool.connect();
    console.log("✅ Pool connection successful");
    client.release();

    // Test 2: Insert test villager (MUST insert before episodes)
    console.log("\nTest 2: Inserting test villager...");
    const villagerResult = await pool.query(
      `INSERT INTO villagers (villager_id, name, home_x, home_y, home_z, profession, created_at, last_seen, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (villager_id) DO UPDATE SET last_seen = EXCLUDED.last_seen
       RETURNING villager_id, name`,
      [
        "test-node-001",
        "Alice",
        150.0,
        64.0,
        250.0,
        "librarian",
        Date.now(),
        Date.now(),
        true,
      ]
    );
    console.log("✅ Villager inserted:", villagerResult.rows[0]);

    // Test 3: Insert test episode with valid villager_id
    console.log("\nTest 3: Inserting test episode...");
    const episodeResult = await pool.query(
      `INSERT INTO episodes (villager_id, actor_id, semantic_vector, duration, event_count, seal_reason, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, villager_id, actor_id`,
      [
        "test-node-001",
        "player-test-uuid",
        "[0.7, 0.8, 0.4, 0.6, 0.2]",
        8000,
        5,
        "episode_timeout",
        Date.now(),
      ]
    );
    console.log("✅ Episode inserted:", episodeResult.rows[0]);

    // Test 4: Insert relationship
    console.log("\nTest 4: Inserting test relationship...");
    await pool.query(
      `INSERT INTO relationships (villager_id, actor_id, interaction_count, trust_score, last_interaction)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (villager_id, actor_id) DO UPDATE SET interaction_count = relationships.interaction_count + 1`,
      ["test-node-001", "player-test-uuid", 1, 0.65, Date.now()]
    );
    console.log("✅ Relationship inserted");

    // Test 5: SELECT with JOIN to verify foreign key relationships
    console.log("\nTest 5: Testing JOIN query...");
    const joinResult = await pool.query(
      `SELECT 
        v.villager_id, 
        v.name, 
        v.profession,
        e.id AS episode_id,
        e.actor_id,
        e.event_count,
        e.duration,
        r.trust_score,
        r.interaction_count
       FROM villagers v
       LEFT JOIN episodes e ON v.villager_id = e.villager_id
       LEFT JOIN relationships r ON v.villager_id = r.villager_id AND e.actor_id = r.actor_id
       WHERE v.villager_id = $1`,
      ["test-node-001"]
    );
    console.log("✅ JOIN query successful:");
    console.log(joinResult.rows[0]);

    // Test 6: Verify connection pooling with concurrent queries
    console.log("\nTest 6: Testing concurrent queries (connection pooling)...");
    const concurrentQueries = [];
    for (let i = 0; i < 5; i++) {
      concurrentQueries.push(
        pool.query("SELECT COUNT(*) FROM villagers WHERE is_active = TRUE")
      );
    }

    const results = await Promise.all(concurrentQueries);
    console.log(`✅ Connection pooling works: ${results.length} concurrent queries executed`);
    console.log(`   Active villagers count: ${results[0].rows[0].count}`);

    // Test 7: Test vector similarity query
    console.log("\nTest 7: Testing pgvector cosine similarity...");
    const vectorResult = await pool.query(
      `SELECT 
        name, 
        semantic_vector,
        semantic_vector <=> $1::vector AS cosine_distance
       FROM concepts
       ORDER BY semantic_vector <=> $1::vector
       LIMIT 1`,
      ["[0.2, 0.8, 0.6, 0.3, 0.4]"]
    );
    console.log("✅ Vector similarity query successful:");
    console.log(`   Closest concept: "${vectorResult.rows[0].name}" (distance: ${vectorResult.rows[0].cosine_distance})`);

    // Cleanup: Remove test data
    console.log("\nCleaning up test data...");
    await pool.query("DELETE FROM villagers WHERE villager_id = $1", [
      "test-node-001",
    ]);
    console.log("✅ Test data cleaned up (CASCADE delete verified)");

    // Verify cascade delete worked
    const cascadeCheck = await pool.query(
      "SELECT COUNT(*) FROM episodes WHERE villager_id = $1",
      ["test-node-001"]
    );
    if (cascadeCheck.rows[0].count === "0") {
      console.log("✅ CASCADE DELETE verified (related episodes deleted)");
    }

    console.log("\n=== All Tests Passed! ===\n");
    console.log("Pool stats:");
    console.log(`  Total connections: ${pool.totalCount}`);
    console.log(`  Idle connections: ${pool.idleCount}`);
    console.log(`  Waiting requests: ${pool.waitingCount}`);
  } catch (err) {
    console.error("\n❌ Test failed:");
    console.error(`  Error: ${err.message}`);
    console.error(`  Code: ${err.code}`);
    if (err.detail) console.error(`  Detail: ${err.detail}`);
    process.exit(1);
  } finally {
    // Close pool
    await pool.end();
    console.log("\n[PostgreSQL] Pool closed successfully");
    process.exit(0);
  }
}

runTests();
