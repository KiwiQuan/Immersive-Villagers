import express from "express";
import morgan from "morgan";
import * as queries from "#db/queries/queries";

const app = express();

app.use(morgan("dev"));
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/api/test", async (req, res) => {
  try {
    const rows = await queries.getAllRows();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/test/:id", async (req, res) => {
  try {
    const row = await queries.getRowById(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: "Row not found" });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/test", async (req, res) => {
  try {
    const { name, age } = req.body;
    if (!name || !age) {
      return res
        .status(400)
        .json({ success: false, error: "Name and age are required" });
    }
    const row = await queries.createRow(name, age);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/test/:id", async (req, res) => {
  try {
    const { name, age } = req.body;
    if (!name || !age) {
      return res
        .status(400)
        .json({ success: false, error: "Name and age are required" });
    }
    const row = await queries.updateRow(req.params.id, name, age);
    if (!row) {
      return res.status(404).json({ success: false, error: "Row not found" });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/test/:id", async (req, res) => {
  try {
    const row = await queries.deleteRow(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: "Row not found" });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
