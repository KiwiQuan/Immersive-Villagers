# Dynamic Properties Database

A lightweight database implementation using Minecraft's Dynamic Properties system.

## Features

- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ Auto-incrementing IDs
- ✅ Persistent storage (saved with world data)
- ✅ JSON serialization
- ✅ Multiple tables support
- ✅ No external dependencies needed

## Database API

### Initialize Database

```javascript
import { DynamicDatabase } from "./database.js";

const db = new DynamicDatabase("tableName");
```

### Create (Insert)

```javascript
const result = db.create({ name: "John", age: 20 });
// Returns: { success: true, data: { id: 1, name: "John", age: 20 } }
```

### Read (Single Record)

```javascript
const result = db.read(1);
// Returns: { success: true, data: { id: 1, name: "John", age: 20 } }
```

### Read All Records

```javascript
const result = db.readAll();
// Returns: { success: true, data: [...] }
```

### Update

```javascript
const result = db.update(1, { age: 21 });
// Returns: { success: true, data: { id: 1, name: "John", age: 21 } }
```

### Delete

```javascript
const result = db.delete(1);
// Returns: { success: true, data: { id: 1, name: "John", age: 21 } }
```

### Clear Table

```javascript
const result = db.clear();
// Returns: { success: true, message: "Cleared 4 records" }
```

### Count Records

```javascript
const count = db.count();
// Returns: number
```

## In-Game Usage

### Items (Rename in anvil)

- **"read"** - Display all database records
- **"create"** - Create a new random record
- **"delete"** - Delete the last record
- **"count"** - Show total record count

### Commands

```
/scriptevent db:seed     # Seed database with initial data
/scriptevent db:clear    # Clear all records
/scriptevent db:count    # Show record count
```

## Storage Details

- Records stored as: `db_tableName_1`, `db_tableName_2`, etc.
- Index stored as: `db_tableName_index`
- Data format: JSON strings
- Persistent across world reloads
- No size limit per table (only per dynamic property)

## Limitations

- Each dynamic property has a size limit (~32KB per property)
- Large objects may fail to store
- No complex queries (filtering, sorting must be done in code)
- No relationships between tables
- All data loaded into memory for queries

## Example: Multiple Tables

```javascript
const users = new DynamicDatabase("users");
const items = new DynamicDatabase("items");
const villages = new DynamicDatabase("villages");

users.create({ name: "Player1", level: 10 });
items.create({ name: "Diamond Sword", damage: 7 });
villages.create({ name: "Village1", population: 50 });
```

## Advantages Over External Database

- ✅ No network requests needed
- ✅ No BDS required
- ✅ Data saved with world
- ✅ Instant access (no latency)
- ✅ Works in regular Minecraft client
- ✅ Simple to use

## Migration to PostgreSQL

When ready to use real PostgreSQL:

1. Export data using `db.readAll()`
2. Send to Node.js backend via HTTP (requires BDS)
3. Import into PostgreSQL
4. Replace database.js calls with HTTP requests
