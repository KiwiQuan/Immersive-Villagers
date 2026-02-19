# Minecraft Bedrock Database Test Project

Test project for integrating Minecraft Bedrock Scripting API with a PostgreSQL database backend.

## Setup

### 1. Database Setup
```bash
# Create database
createdb immersive_villagers

# Run schema
npm run db:schema

# Seed test data
npm run db:seed
```

### 2. Start Backend Server
```bash
npm run dev
```

The server will run on `http://localhost:3000`

### 3. Configure Minecraft

1. Copy the `BP` folder to your Minecraft behavior_packs folder
2. Enable the behavior pack in your world
3. Make sure your world has "Enable GameTest Framework" enabled in settings

### 4. Test In-Game

1. Get any item (e.g., stick, paper)
2. Rename it to "read" using an anvil
3. Right-click (use) the item
4. All database rows will be displayed in chat

## API Endpoints

### GET /api/test
Get all rows from the database

### GET /api/test/:id
Get a specific row by ID

### POST /api/test
Create a new row
```json
{
  "name": "string",
  "age": number
}
```

### PUT /api/test/:id
Update a row
```json
{
  "name": "string",
  "age": number
}
```

### DELETE /api/test/:id
Delete a row

## How It Works

1. Player uses an item named "read" in Minecraft
2. Minecraft script captures the `itemUse` event
3. Script makes HTTP GET request to `http://localhost:3000/api/test`
4. Backend queries PostgreSQL database
5. Results are sent back and displayed in Minecraft chat

## Files Structure

```
├── BP/
│   ├── manifest.json          # Behavior pack manifest
│   └── scripts/
│       └── main.js            # Minecraft scripting logic
├── db/
│   ├── client.js              # Database connection
│   ├── queries.js             # Database query functions
│   ├── schema.sql             # Database schema
│   └── seed.js                # Test data seeding
├── server.js                  # Express API server
├── .env                       # Environment variables
└── package.json               # Node.js dependencies
```

## Extending

To add more item listeners:

```javascript
if (itemName === "create") {
  // Make POST request to create data
}

if (itemName === "delete") {
  // Make DELETE request
}
```
