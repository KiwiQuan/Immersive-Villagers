import db from "#db/client";

await db.query(`INSERT INTO test (name, age) VALUES ('John', 20)`);
await db.query(`INSERT INTO test (name, age) VALUES ('Jane', 25)`);
await db.query(`INSERT INTO test (name, age) VALUES ('Bob', 30)`);
await db.query(`INSERT INTO test (name, age) VALUES ('Alice', 22)`);

console.log("✓ Database seeded successfully");

await db.end();
