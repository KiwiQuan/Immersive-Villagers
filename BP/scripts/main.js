import { world, system } from "@minecraft/server";
import { DynamicDatabase } from "./database.js";

const db = new DynamicDatabase("test");

const seedDatabase = () => {
  const count = db.count();

  if (count === 0) {
    db.create({ name: "John", age: 20 });
    db.create({ name: "Jane", age: 25 });
    db.create({ name: "Bob", age: 30 });
    db.create({ name: "Alice", age: 22 });
    console.warn("Database seeded with initial data");
  }
};

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const { id, message, sourceEntity } = event;

  if (id === "db:seed" && sourceEntity) {
    seedDatabase();
    sourceEntity.sendMessage("§aDatabase seeded!");
  }

  if (id === "db:clear" && sourceEntity) {
    const result = db.clear();
    sourceEntity.sendMessage(`§c${result.message}`);
  }

  if (id === "db:count" && sourceEntity) {
    const count = db.count();
    sourceEntity.sendMessage(`§eDatabase has §f${count}§e records`);
  }
  if (id === "db:help" && sourceEntity) {
    sourceEntity.sendMessage("§e=== Database Commands ===");
    sourceEntity.sendMessage("§a/db:seed - Seed database with initial data");
    sourceEntity.sendMessage("§a/db:clear - Clear all records");
    sourceEntity.sendMessage("§a/db:count - Show record count");
    sourceEntity.sendMessage("§a/db:help - Show this help message");
  }
});

world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;

  if (!itemStack?.nameTag) return;

  const itemName = itemStack.nameTag.toLowerCase();

  if (itemName === "read") {
    player.sendMessage("§aQuerying database...");

    const result = db.readAll();

    if (result.success && result.data) {
      player.sendMessage("§e=== Database Rows ===");
      result.data.forEach((row) => {
        player.sendMessage(
          `§bID: §f${row.id} §b| Name: §f${row.name} §b| Age: §f${row.age}`,
        );
      });
      player.sendMessage(`§e=== Total: ${result.data.length} rows ===`);
    } else {
      player.sendMessage(`§cError: ${result.error || "Failed to fetch data"}`);
    }
  }

  if (itemName === "create") {
    player.sendMessage("§aCreating new record...");

    const randomNames = ["Alex", "Steve", "Creeper", "Enderman", "Zombie"];
    const randomName =
      randomNames[Math.floor(Math.random() * randomNames.length)];
    const randomAge = Math.floor(Math.random() * 50) + 18;

    const result = db.create({ name: randomName, age: randomAge });

    if (result.success) {
      player.sendMessage(
        `§aCreated: §f${result.data.name} (Age: ${result.data.age})`,
      );
    } else {
      player.sendMessage(`§cError: ${result.error}`);
    }
  }

  if (itemName === "delete") {
    player.sendMessage("§cDeleting last record...");

    const allRecords = db.readAll();

    if (allRecords.data.length === 0) {
      player.sendMessage("§cNo records to delete!");
      return;
    }

    const lastRecord = allRecords.data[allRecords.data.length - 1];
    const result = db.delete(lastRecord.id);

    if (result.success) {
      player.sendMessage(
        `§cDeleted: §f${result.data.name} (ID: ${result.data.id})`,
      );
    } else {
      player.sendMessage(`§cError: ${result.error}`);
    }
  }

  if (itemName === "count") {
    const count = db.count();
    player.sendMessage(`§eDatabase has §f${count}§e records`);
  }
});
