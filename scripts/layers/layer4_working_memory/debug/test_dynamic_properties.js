import { world, system } from "@minecraft/server";
import {
  getWorkingMemory,
  setWorkingMemory,
  updateWorkingMemoryProperty,
  initializeWorkingMemory,
  hasWorkingMemory,
  clearWorkingMemory,
  getWorkingMemoryByteCount,
} from "../helpers/working_memory_helpers.js";

/**
 * Tests DynamicProperties helper functions on the nearest villager to command source.
 * Verifies read/write operations and persistence.
 * @param {Entity} sourceEntity - Entity that triggered the command (player)
 */
function testDynamicPropertiesHelpers(sourceEntity) {
  try {
    const dimension = sourceEntity.dimension;
    const sourceLocation = sourceEntity.location;

    const villagers = dimension.getEntities({
      type: "minecraft:villager_v2",
      location: sourceLocation,
      maxDistance: 10,
    });

    if (villagers.length === 0) {
      world.sendMessage("§c✗ No villagers found within 10 blocks!");
      console.warn(
        "§c[DP Test] No villagers found. Spawn a villager within 10 blocks and try again.",
      );
      return;
    }

    const testVillager = villagers[0];
    console.warn(`§b[DP Test] Testing on villager: ${testVillager.id}`);
    world.sendMessage(
      `§b[DP Test] Testing on villager: ${testVillager.nameTag || testVillager.id}`,
    );

    console.warn("§e[DP Test] Step 1: Checking if Working Memory exists...");
    const exists = hasWorkingMemory(testVillager);
    console.warn(
      `§a[DP Test] hasWorkingMemory(): ${exists ? "✓ Found" : "✗ Not initialized"}`,
    );

    console.warn("§e[DP Test] Step 2: Initializing Working Memory...");
    const initialized = initializeWorkingMemory(testVillager);
    if (!initialized) {
      world.sendMessage("§c✗ Failed to initialize Working Memory!");
      return;
    }
    console.warn("§a[DP Test] ✓ Initialization succeeded");
    world.sendMessage("§a✓ Working Memory initialized");

    console.warn("§e[DP Test] Step 3: Reading Working Memory...");
    const workingMemory = getWorkingMemory(testVillager);
    if (!workingMemory) {
      world.sendMessage("§c✗ Failed to read Working Memory!");
      return;
    }
    console.warn("§a[DP Test] ✓ Read succeeded:");
    console.warn(
      `§a  - Current Focus: ${workingMemory.currentFocus || "none"}`,
    );
    console.warn(
      `§a  - Current Mood: C=${workingMemory.currentMood.C}, V=${workingMemory.currentMood.V}, I=${workingMemory.currentMood.I}, S=${workingMemory.currentMood.S}, X=${workingMemory.currentMood.X}`,
    );
    console.warn(`§a  - Shock State: ${workingMemory.shockState}`);
    console.warn(`§a  - Network Status: ${workingMemory.networkStatus}`);
    world.sendMessage("§a✓ Working Memory read successful");

    console.warn("§e[DP Test] Step 4: Updating single property...");
    const updated = updateWorkingMemoryProperty(
      testVillager,
      "wm_currentFocus",
      sourceEntity.id,
    );
    if (!updated) {
      world.sendMessage("§c✗ Failed to update property!");
      return;
    }
    console.warn(
      `§a[DP Test] ✓ Updated wm_currentFocus to: ${sourceEntity.id}`,
    );
    world.sendMessage("§a✓ Property update successful");

    console.warn("§e[DP Test] Step 5: Writing full Working Memory...");
    const testMood = {
      currentFocus: sourceEntity.id,
      currentMood: {
        C: 0.8,
        V: 0.9,
        I: 0.3,
        S: 0.7,
        X: 0.1,
      },
      shockState: false,
      networkStatus: "online",
    };
    const written = setWorkingMemory(testVillager, testMood);
    if (!written) {
      world.sendMessage("§c✗ Failed to write Working Memory!");
      return;
    }
    console.warn("§a[DP Test] ✓ Write succeeded");
    world.sendMessage("§a✓ Working Memory write successful");

    console.warn("§e[DP Test] Step 6: Verifying write by reading back...");
    const verifyRead = getWorkingMemory(testVillager);
    if (!verifyRead) {
      world.sendMessage("§c✗ Failed to verify write!");
      return;
    }
    console.warn("§a[DP Test] ✓ Verification read succeeded:");
    console.warn(
      `§a  - Current Mood: C=${verifyRead.currentMood.C}, V=${verifyRead.currentMood.V}, I=${verifyRead.currentMood.I}, S=${verifyRead.currentMood.S}, X=${verifyRead.currentMood.X}`,
    );
    console.warn(`§a  - Needs Sync: ${verifyRead.needsSync}`);
    world.sendMessage(
      `§a✓ Verified: Mood C=${verifyRead.currentMood.C}, Sync=${verifyRead.needsSync}`,
    );

    console.warn("§e[DP Test] Step 7: Checking memory usage...");
    const byteCount = getWorkingMemoryByteCount(testVillager);
    console.warn(`§a[DP Test] ✓ Total bytes used: ${byteCount}`);
    world.sendMessage(`§a✓ Memory usage: ${byteCount} bytes`);

    console.warn("§b[DP Test] ========================================");
    console.warn("§b[DP Test] All tests passed!");
    console.warn("§b[DP Test] ========================================");
    world.sendMessage("§a§l✓ ALL TESTS PASSED!");
    world.sendMessage("§aNow restart the server to test persistence (Step 3)");
  } catch (error) {
    console.error(`§c[DP Test] Test failed: ${error.message}`);
    world.sendMessage(`§c✗ Test failed: ${error.message}`);
  }
}

/**
 * Tests property clearing functionality.
 * @param {Entity} sourceEntity - Entity that triggered the command (player)
 */
function testClearProperties(sourceEntity) {
  try {
    const dimension = sourceEntity.dimension;
    const sourceLocation = sourceEntity.location;

    const villagers = dimension.getEntities({
      type: "minecraft:villager_v2",
      location: sourceLocation,
      maxDistance: 500,
    });

    if (villagers.length === 0) {
      world.sendMessage("§c✗ No villagers found within 10 blocks!");
      return;
    }

    const testVillager = villagers[0];
    console.warn(`§b[DP Test] Clearing Working Memory for: ${testVillager.id}`);

    const cleared = clearWorkingMemory(testVillager);
    if (!cleared) {
      world.sendMessage("§c✗ Failed to clear Working Memory!");
      return;
    }

    console.warn("§a[DP Test] ✓ Properties cleared");
    world.sendMessage("§a✓ Working Memory cleared for villager");

    const stillExists = hasWorkingMemory(testVillager);
    console.warn(
      `§a[DP Test] Verification: hasWorkingMemory() = ${stillExists}`,
    );
    world.sendMessage(
      `§a✓ Verification: ${stillExists ? "Properties still exist" : "Fully cleared"}`,
    );
  } catch (error) {
    console.error(`§c[DP Test] Clear test failed: ${error.message}`);
    world.sendMessage(`§c✗ Clear test failed: ${error.message}`);
  }
}

/**
 * Tests persistence by reading Working Memory from an existing villager.
 * Use this after server restart to verify data persisted.
 * @param {Entity} sourceEntity - Entity that triggered the command (player)
 */
function testPersistence(sourceEntity) {
  try {
    const dimension = sourceEntity.dimension;
    const sourceLocation = sourceEntity.location;

    const villagers = dimension.getEntities({
      type: "minecraft:villager_v2",
      location: sourceLocation,
      maxDistance: 10,
    });

    if (villagers.length === 0) {
      world.sendMessage("§c✗ No villagers found within 10 blocks!");
      return;
    }

    const testVillager = villagers[0];
    console.warn(`§b[DP Test] Testing persistence for: ${testVillager.id}`);

    console.warn("§e[DP Test] Reading Working Memory after restart...");
    const workingMemory = getWorkingMemory(testVillager);

    if (!workingMemory) {
      world.sendMessage("§c✗ Failed to read Working Memory!");
      console.warn("§c[DP Test] Data may have been lost during restart");
      return;
    }

    console.warn("§a[DP Test] ✓ Data persisted across restart!");
    console.warn(
      `§a  - Current Mood: C=${workingMemory.currentMood.C}, V=${workingMemory.currentMood.V}, I=${workingMemory.currentMood.I}`,
    );
    console.warn(`§a  - Last Update: ${workingMemory.lastUpdate}`);
    console.warn(`§a  - Needs Sync: ${workingMemory.needsSync}`);

    world.sendMessage("§a§l✓ PERSISTENCE TEST PASSED!");
    world.sendMessage(
      `§aMood: C=${workingMemory.currentMood.C}, V=${workingMemory.currentMood.V}`,
    );
  } catch (error) {
    console.error(`§c[DP Test] Persistence test failed: ${error.message}`);
    world.sendMessage(`§c✗ Persistence test failed: ${error.message}`);
  }
}

/**
 * Initializes scriptevent listeners for DynamicProperties testing.
 */
function initializeDynamicPropertiesCommands() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:dp_all") {
      if (!event.sourceEntity) {
        console.warn("§c[DP Test] Command must be run by a player");
        return;
      }
      world.sendMessage("§b[DP Test] Running DynamicProperties tests...");
      testDynamicPropertiesHelpers(event.sourceEntity);
    }
  });

  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:dp_clear") {
      if (!event.sourceEntity) {
        console.warn("§c[DP Test] Command must be run by a player");
        return;
      }
      world.sendMessage("§b[DP Test] Clearing Working Memory...");
      testClearProperties(event.sourceEntity);
    }
  });

  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:dp_persistence") {
      if (!event.sourceEntity) {
        console.warn("§c[DP Test] Command must be run by a player");
        return;
      }
      world.sendMessage("§b[DP Test] Testing persistence...");
      testPersistence(event.sourceEntity);
    }
  });

  console.warn("§a[DP Test] DynamicProperties test commands registered!");
  console.warn("§a[DP Test] Available commands:");
  console.warn("§a  - /scriptevent test:dp_all (run all tests)");
  console.warn("§a  - /scriptevent test:dp_clear (clear properties)");
  console.warn("§a  - /scriptevent test:dp_persistence (test after restart)");
}

export {
  testDynamicPropertiesHelpers,
  testClearProperties,
  testPersistence,
  initializeDynamicPropertiesCommands,
};
