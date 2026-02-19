import { WebSocketServer } from "ws";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
import * as queries from "#db/queries/queries"; // Adjust path as needed

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("§a✓ Minecraft client connected");

  // 1. Tell Minecraft to send us chat messages (so we hear world.sendMessage)
  ws.send(
    JSON.stringify({
      header: {
        version: 1,
        requestId: uuidv4(),
        messagePurpose: "subscribe",
        messageType: "commandRequest",
      },
      body: { eventName: "PlayerMessage" },
    }),
  );

  // 2. Send the Handshake success back to the Script API
  sendCommand(ws, `/scriptevent db:handshake {"status":"connected"}`);

  ws.on("message", async (packet) => {
    const msg = JSON.parse(packet.toString());
    
    console.log("📩 Received message type:", msg.header?.messagePurpose, msg.header?.eventName);

    // Check if this is a message from the Script API (world.sendMessage)
    if (msg.header?.eventName === "PlayerMessage") {
      const chatContent = msg.body?.message;
      console.log("💬 Chat message:", chatContent);

      try {
        // Extract JSON from chat message (remove player name prefix like "[kw132275] ")
        const jsonMatch = chatContent.match(/\{.*\}/);
        if (!jsonMatch) {
          console.log("⚠️  No JSON found in message");
          return;
        }
        
        const data = JSON.parse(jsonMatch[0]);
        console.log("✓ Parsed Query:", data.action);

        let result;
        if (data.action === "read") {
          console.log("📖 Querying database...");
          const rows = await queries.getAllRows();
          console.log(`✓ Found ${rows.length} rows`);
          result = { type: "read_result", success: true, data: rows };
        } else if (data.action === "create") {
          console.log("➕ Creating record...");
          const row = await queries.createRow(data.name, data.age);
          console.log(`✓ Created: ${row.name}`);
          result = { type: "create_result", success: true, data: row };
        } else if (data.action === "delete") {
          console.log("🗑️  Deleting record...");
          const row = await queries.deleteRow(data.id);
          if (row) {
            console.log(`✓ Deleted: ${row.name}`);
            result = { type: "delete_result", success: true, data: row };
          } else {
            console.log("✗ Record not found");
            result = { type: "error", success: false, error: "Record not found" };
          }
        }

        // Send the result back to the Script API
        if (result) {
          console.log("📤 Sending result back to Minecraft...");
          sendCommand(ws, `/scriptevent db:result ${JSON.stringify(result)}`);
        }
      } catch (e) {
        console.log("⚠️  Not a JSON message (probably player chat)");
      }
    }
  });
});

// Helper to send commands into the game
function sendCommand(ws, cmd) {
  ws.send(
    JSON.stringify({
      header: {
        version: 1,
        requestId: uuidv4(),
        messagePurpose: "commandRequest",
        messageType: "commandRequest",
      },
      body: { version: 1, commandLine: cmd },
    }),
  );
}

server.listen(3000, () => console.log("Server running on port 3000"));
