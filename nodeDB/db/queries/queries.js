import db from "#db/client";

export const getAllRows = async () => {
  try {
    const result = await db.query("SELECT * FROM test ORDER BY id");
    return result.rows;
  } catch (error) {
    console.error("Error fetching all rows:", error);
    throw error;
  }
};

export const getRowById = async (id) => {
  try {
    const result = await db.query("SELECT * FROM test WHERE id = $1", [id]);
    return result.rows[0];
  } catch (error) {
    console.error("Error fetching row by id:", error);
    throw error;
  }
};

export const createRow = async (name, age) => {
  try {
    const result = await db.query(
      "INSERT INTO test (name, age) VALUES ($1, $2) RETURNING *",
      [name, age],
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating row:", error);
    throw error;
  }
};

export const updateRow = async (id, name, age) => {
  try {
    const result = await db.query(
      "UPDATE test SET name = $1, age = $2 WHERE id = $3 RETURNING *",
      [name, age, id],
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error updating row:", error);
    throw error;
  }
};

export const deleteRow = async (id) => {
  try {
    const result = await db.query(
      "DELETE FROM test WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error deleting row:", error);
    throw error;
  }
};
