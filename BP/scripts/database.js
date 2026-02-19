import { world } from "@minecraft/server";

const TABLE_PREFIX = "db_";
const INDEX_SUFFIX = "_index";

export class DynamicDatabase {
  constructor(tableName) {
    this.tableName = tableName;
    this.tableKey = `${TABLE_PREFIX}${tableName}`;
    this.indexKey = `${this.tableKey}${INDEX_SUFFIX}`;
    this.initialized = false;
  }

  ensureInitialized() {
    if (!this.initialized) {
      const index = world.getDynamicProperty(this.indexKey);
      if (index === undefined) {
        world.setDynamicProperty(this.indexKey, 0);
      }
      this.initialized = true;
    }
  }

  getNextId() {
    this.ensureInitialized();
    const currentIndex = world.getDynamicProperty(this.indexKey) || 0;
    const nextId = currentIndex + 1;
    world.setDynamicProperty(this.indexKey, nextId);
    return nextId;
  }

  getAllIds() {
    this.ensureInitialized();
    const maxId = world.getDynamicProperty(this.indexKey) || 0;
    const ids = [];
    for (let i = 1; i <= maxId; i++) {
      const key = `${this.tableKey}_${i}`;
      if (world.getDynamicProperty(key) !== undefined) {
        ids.push(i);
      }
    }
    return ids;
  }

  create(data) {
    this.ensureInitialized();
    const id = this.getNextId();
    const record = { id, ...data };
    const key = `${this.tableKey}_${id}`;
    
    try {
      world.setDynamicProperty(key, JSON.stringify(record));
      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  read(id) {
    this.ensureInitialized();
    const key = `${this.tableKey}_${id}`;
    const data = world.getDynamicProperty(key);
    
    if (data === undefined) {
      return { success: false, error: "Record not found" };
    }
    
    try {
      return { success: true, data: JSON.parse(data) };
    } catch (error) {
      return { success: false, error: "Failed to parse record" };
    }
  }

  readAll() {
    this.ensureInitialized();
    const ids = this.getAllIds();
    const records = [];
    
    for (const id of ids) {
      const result = this.read(id);
      if (result.success) {
        records.push(result.data);
      }
    }
    
    return { success: true, data: records };
  }

  update(id, data) {
    this.ensureInitialized();
    const existing = this.read(id);
    
    if (!existing.success) {
      return { success: false, error: "Record not found" };
    }
    
    const updated = { ...existing.data, ...data, id };
    const key = `${this.tableKey}_${id}`;
    
    try {
      world.setDynamicProperty(key, JSON.stringify(updated));
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }

  delete(id) {
    this.ensureInitialized();
    const existing = this.read(id);
    
    if (!existing.success) {
      return { success: false, error: "Record not found" };
    }
    
    const key = `${this.tableKey}_${id}`;
    world.setDynamicProperty(key, undefined);
    
    return { success: true, data: existing.data };
  }

  clear() {
    this.ensureInitialized();
    const ids = this.getAllIds();
    
    for (const id of ids) {
      const key = `${this.tableKey}_${id}`;
      world.setDynamicProperty(key, undefined);
    }
    
    world.setDynamicProperty(this.indexKey, 0);
    this.initialized = false;
    return { success: true, message: `Cleared ${ids.length} records` };
  }

  count() {
    this.ensureInitialized();
    return this.getAllIds().length;
  }
}
