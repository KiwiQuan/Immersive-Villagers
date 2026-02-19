-- Test schema for test database
DROP TABLE IF EXISTS test;

CREATE TABLE test (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    age INT NOT NULL
);