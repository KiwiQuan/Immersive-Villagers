import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

/**
 * SANDBOX TEST: Method D - Proximity-Based Detection (REFINED)
 *
 * PURPOSE: Test pure proximity-based villager tracking.
 * No reliance on entityLoad/entityRemove events.
 *
 * LOGIC:
 * 1. Get all villagers via getEntities() (fresh query each cycle)
 * 2. Calculate distance to nearest player
 * 3. If distance <= RADIUS → Add to currentVillagerIDs (active)
 * 4. If distance > RADIUS → Remove from currentVillagerIDs (inactive)
 * 5. Detect NEW villagers during scan (not in detectedVillagers Map)
 *
 * ADVANTAGES:
 * - Pure geometry, no engine quirks
 * - 100% consistent detection
 * - Works across all Bedrock versions
 */

const detectedVillagers = new Map(); // villagerID -> { firstSeen, lastSeen, location, nameTag }
const currentVillagerIDs = new Set(); // Villagers within proximity radius
let totalProximityChecks = 0;
let totalNewDetections = 0;
let totalActivations = 0;
let totalDeactivations = 0;
let proximityCheckHandle = null;
let particleVisualizationEnabled = false;
let particleVisualizationHandle = null;

const PROXIMITY_CHECK_RADIUS = 150; // blocks
const PROXIMITY_CHECK_INTERVAL = 20; // ticks (1 second)

/**
 * Proximity-based detection: Scans all villagers and checks distance to players.
 * Handles both new villager detection and active/inactive state management.
 */
function startProximityDetection() {
  proximityCheckHandle = system.runInterval(() => {
    try {
      totalProximityChecks++;

      const allPlayers = world.getAllPlayers();
      if (allPlayers.length === 0) return;

      const dimension = world.getDimension("overworld");
      const allVillagers = dimension.getEntities({
        type: "minecraft:villager_v2",
      });

      const villagersWithinRadius = new Set();

      // Scan all villagers
      for (const villager of allVillagers) {
        if (!villager || !villager.isValid) continue;

        const villagerID = villager.id;
        const now = Date.now();

        // Calculate distance to nearest player
        let nearestPlayerDistance = Infinity;
        for (const player of allPlayers) {
          const dx = player.location.x - villager.location.x;
          const dy = player.location.y - villager.location.y;
          const dz = player.location.z - villager.location.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (distance < nearestPlayerDistance) {
            nearestPlayerDistance = distance;
          }
        }

        const isWithinRadius = nearestPlayerDistance <= PROXIMITY_CHECK_RADIUS;

        // NEW VILLAGER DETECTION
        if (!detectedVillagers.has(villagerID)) {
          totalNewDetections++;

          detectedVillagers.set(villagerID, {
            firstSeen: now,
            lastSeen: now,
            location: villager.location,
            nameTag: villager.nameTag || "Unnamed",
          });

          for (const player of allPlayers) {
            player.sendMessage(
              `§a[Sandbox] NEW villager detected: ${villager.nameTag || "Unnamed"} (${Math.round(nearestPlayerDistance)}m)`,
            );
          }

          console.warn(
            `§a[Sandbox] NEW villager detected: ${villagerID} at ${Math.round(nearestPlayerDistance)}m`,
          );
        } else {
          // Update metadata for existing villager
          const metadata = detectedVillagers.get(villagerID);
          metadata.lastSeen = now;
          metadata.location = villager.location;
        }

        // ACTIVE/INACTIVE STATE MANAGEMENT
        if (isWithinRadius) {
          villagersWithinRadius.add(villagerID);

          // Villager entered radius (activation)
          if (!currentVillagerIDs.has(villagerID)) {
            totalActivations++;
            currentVillagerIDs.add(villagerID);

            for (const player of allPlayers) {
              player.sendMessage(
                `§a[Sandbox] Villager ACTIVE: ${villager.nameTag || "Unnamed"} (${Math.round(nearestPlayerDistance)}m)`,
              );
            }

            console.warn(
              `§a[Sandbox] Villager ${villagerID} marked ACTIVE (distance: ${Math.round(nearestPlayerDistance)}m)`,
            );
          }
        }
      }

      // DEACTIVATION CHECK: Remove villagers no longer within radius
      const villagersToDeactivate = [];
      for (const trackedID of currentVillagerIDs) {
        if (!villagersWithinRadius.has(trackedID)) {
          villagersToDeactivate.push(trackedID);
        }
      }

      if (villagersToDeactivate.length > 0) {
        totalDeactivations += villagersToDeactivate.length;

        for (const inactiveID of villagersToDeactivate) {
          currentVillagerIDs.delete(inactiveID);

          const metadata = detectedVillagers.get(inactiveID);
          const villagerName = metadata ? metadata.nameTag : inactiveID;

          for (const player of allPlayers) {
            player.sendMessage(
              `§c[Sandbox] Villager INACTIVE: ${villagerName} (beyond ${PROXIMITY_CHECK_RADIUS}m)`,
            );
          }

          console.warn(
            `§c[Sandbox] Villager ${inactiveID} marked INACTIVE (beyond ${PROXIMITY_CHECK_RADIUS}m)`,
          );
        }
      }
    } catch (error) {
      console.error(`§c[Sandbox] Proximity check error: ${error.message}`);
    }
  }, PROXIMITY_CHECK_INTERVAL);

  console.warn(
    `§a[Sandbox] Proximity detection started (every ${PROXIMITY_CHECK_INTERVAL} ticks, radius: ${PROXIMITY_CHECK_RADIUS} blocks)`,
  );
}

/**
 * Particle visualization: Shows particles above villagers in currentVillagerIDs.
 */
function startParticleVisualization() {
  if (particleVisualizationEnabled) {
    world.sendMessage("§e[Sandbox] Particle visualization already running");
    return;
  }

  particleVisualizationEnabled = true;

  particleVisualizationHandle = system.runInterval(() => {
    try {
      const dimension = world.getDimension("overworld");

      const visibleVillagers = dimension.getEntities({
        type: "minecraft:villager_v2",
      });

      for (const villager of visibleVillagers) {
        if (!villager || !villager.isValid) continue;

        if (currentVillagerIDs.has(villager.id)) {
          try {
            const particleLocation = {
              x: villager.location.x,
              y: villager.location.y + 2.5,
              z: villager.location.z,
            };

            dimension.spawnParticle("minecraft:endrod", particleLocation);
          } catch (particleError) {
            // Silently skip if chunk unloads mid-tick
          }
        }
      }
    } catch (error) {
      console.error(`§c[Sandbox] Particle error: ${error.message}`);
    }
  }, 1);

  world.sendMessage(
    "§a[Sandbox] Particle visualization ENABLED (purple particles above active villagers)",
  );
  console.warn("§a[Sandbox] Particle visualization enabled");
}

/**
 * Stops particle visualization.
 */
function stopParticleVisualization() {
  if (!particleVisualizationEnabled) {
    world.sendMessage("§e[Sandbox] Particle visualization not running");
    return;
  }

  if (particleVisualizationHandle !== null) {
    system.clearRun(particleVisualizationHandle);
    particleVisualizationHandle = null;
  }

  particleVisualizationEnabled = false;

  world.sendMessage("§c[Sandbox] Particle visualization DISABLED");
  console.warn("§c[Sandbox] Particle visualization disabled");
}

/**
 * Shows debug modal with state inspection.
 */
async function showDebugModal(player) {
  const dimension = world.getDimension("overworld");
  const actualVisibleVillagers = dimension.getEntities({
    type: "minecraft:villager_v2",
  });

  // Filter by proximity radius to match currentVillagerIDs logic
  const allPlayers = world.getAllPlayers();
  const actualVisibleWithinRadius = actualVisibleVillagers.filter(
    (villager) => {
      if (!villager || !villager.isValid) return false;

      let nearestPlayerDistance = Infinity;
      for (const p of allPlayers) {
        const dx = p.location.x - villager.location.x;
        const dy = p.location.y - villager.location.y;
        const dz = p.location.z - villager.location.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance < nearestPlayerDistance) {
          nearestPlayerDistance = distance;
        }
      }

      return nearestPlayerDistance <= PROXIMITY_CHECK_RADIUS;
    },
  );

  const actualVisibleCount = actualVisibleWithinRadius.length;

  const form = new ActionFormData();
  form.title("§lSandbox Debugger");

  const currentList = Array.from(currentVillagerIDs)
    .map((id) => {
      const metadata = detectedVillagers.get(id);
      return metadata ? metadata.nameTag : id;
    })
    .join(", ");

  form.body(
    `§e=== CURRENT (Active) ===\n` +
      `§aCount: ${currentVillagerIDs.size}\n` +
      `§7${currentList || "None"}\n\n` +
      `§e=== DETECTED (All Time) ===\n` +
      `§aCount: ${detectedVillagers.size}\n\n` +
      `§e=== ACTUAL VISIBLE ===\n` +
      `§aCount: ${actualVisibleCount}\n\n` +
      `§7Select an option below:`,
  );

  form.button("View Current (Active)");
  form.button("View All Detected");
  form.button("View Specific Villager");
  form.button("Close");

  const response = await form.show(player);

  if (response.canceled) return;

  if (response.selection === 0) {
    showCurrentVillagersModal(player);
  } else if (response.selection === 1) {
    showAllDetectedModal(player);
  } else if (response.selection === 2) {
    showVillagerPickerModal(player);
  }
}

/**
 * Shows current active villagers.
 */
async function showCurrentVillagersModal(player) {
  const form = new ActionFormData();
  form.title("§lCurrent Active Villagers");

  let bodyText = `§aTotal: ${currentVillagerIDs.size}\n\n`;

  for (const villagerID of currentVillagerIDs) {
    const metadata = detectedVillagers.get(villagerID);
    if (metadata) {
      bodyText += `§e${metadata.nameTag}\n`;
      bodyText += `§7  Location: X=${Math.round(metadata.location.x)}, Z=${Math.round(metadata.location.z)}\n\n`;
    } else {
      bodyText += `§e${villagerID}\n§7  (No metadata)\n\n`;
    }
  }

  if (currentVillagerIDs.size === 0) {
    bodyText = "§cNo villagers currently active";
  }

  form.body(bodyText);
  form.button("Back");

  const response = await form.show(player);
  if (!response.canceled) {
    showDebugModal(player);
  }
}

/**
 * Shows all detected villagers.
 */
async function showAllDetectedModal(player) {
  const form = new ActionFormData();
  form.title("§lAll Detected Villagers");

  let bodyText = `§aTotal: ${detectedVillagers.size}\n\n`;

  for (const [villagerID, metadata] of detectedVillagers) {
    const isActive = currentVillagerIDs.has(villagerID);
    const statusColor = isActive ? "§a" : "§7";
    const statusText = isActive ? "ACTIVE" : "INACTIVE";

    bodyText += `${statusColor}${metadata.nameTag} [${statusText}]\n`;
    bodyText += `§7  First seen: ${new Date(metadata.firstSeen).toLocaleTimeString()}\n\n`;
  }

  if (detectedVillagers.size === 0) {
    bodyText = "§cNo villagers detected yet";
  }

  form.body(bodyText);
  form.button("Back");

  const response = await form.show(player);
  if (!response.canceled) {
    showDebugModal(player);
  }
}

/**
 * Villager picker for detailed inspection.
 */
async function showVillagerPickerModal(player) {
  const form = new ActionFormData();
  form.title("§lSelect Villager");

  if (detectedVillagers.size === 0) {
    form.body("§cNo villagers detected yet");
    form.button("Back");
    const response = await form.show(player);
    showDebugModal(player);
    return;
  }

  form.body("§7Select a villager to view details:");

  const villagerList = Array.from(detectedVillagers.entries());
  for (const [villagerID, metadata] of villagerList) {
    const isActive = currentVillagerIDs.has(villagerID);
    const statusIcon = isActive ? "§a●" : "§7○";
    form.button(`${statusIcon} ${metadata.nameTag}`);
  }

  form.button("§cBack");

  const response = await form.show(player);

  if (response.canceled) {
    showDebugModal(player);
    return;
  }

  if (response.selection === villagerList.length) {
    showDebugModal(player);
    return;
  }

  const selectedVillager = villagerList[response.selection];
  showVillagerDetailsModal(player, selectedVillager[0], selectedVillager[1]);
}

/**
 * Shows detailed villager info.
 */
async function showVillagerDetailsModal(player, villagerID, metadata) {
  const form = new ActionFormData();
  form.title(`§l${metadata.nameTag}`);

  const isActive = currentVillagerIDs.has(villagerID);
  const statusColor = isActive ? "§a" : "§c";
  const statusText = isActive ? "ACTIVE" : "INACTIVE";

  // Calculate current distance
  const allPlayers = world.getAllPlayers();
  let currentDistance = "Unknown";
  if (allPlayers.length > 0) {
    let nearestDist = Infinity;
    for (const p of allPlayers) {
      const dx = p.location.x - metadata.location.x;
      const dz = p.location.z - metadata.location.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) nearestDist = dist;
    }
    currentDistance = `${Math.round(nearestDist)}m`;
  }

  const bodyText =
    `${statusColor}Status: ${statusText}\n\n` +
    `§7First Seen: ${new Date(metadata.firstSeen).toLocaleTimeString()}\n` +
    `§7Last Seen: ${new Date(metadata.lastSeen).toLocaleTimeString()}\n\n` +
    `§eDistance to nearest player: ${currentDistance}\n` +
    `§eProximity radius: ${PROXIMITY_CHECK_RADIUS}m\n\n` +
    `§7Location:\n` +
    `§7  X=${Math.round(metadata.location.x)}\n` +
    `§7  Y=${Math.round(metadata.location.y)}\n` +
    `§7  Z=${Math.round(metadata.location.z)}`;

  form.body(bodyText);
  form.button("Back");

  const response = await form.show(player);
  if (!response.canceled) {
    showVillagerPickerModal(player);
  }
}

/**
 * Status command - shows detection statistics.
 */
function showStatus() {
  const dimension = world.getDimension("overworld");
  const actualVisibleVillagers = dimension.getEntities({
    type: "minecraft:villager_v2",
  });

  // Filter by proximity radius to match currentVillagerIDs logic
  const allPlayers = world.getAllPlayers();
  const actualVisibleWithinRadius = actualVisibleVillagers.filter(
    (villager) => {
      if (!villager || !villager.isValid) return false;

      let nearestPlayerDistance = Infinity;
      for (const p of allPlayers) {
        const dx = p.location.x - villager.location.x;
        const dy = p.location.y - villager.location.y;
        const dz = p.location.z - villager.location.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance < nearestPlayerDistance) {
          nearestPlayerDistance = distance;
        }
      }

      return nearestPlayerDistance <= PROXIMITY_CHECK_RADIUS;
    },
  );

  const actualVisibleCount = actualVisibleWithinRadius.length;

  for (const player of allPlayers) {
    player.sendMessage("§b========== SANDBOX STATUS ==========");
    player.sendMessage(`§6 Proximity checks run: ${totalProximityChecks}`);
    player.sendMessage(`§a New villagers detected: ${totalNewDetections}`);
    player.sendMessage(`§a Activations: ${totalActivations}`);
    player.sendMessage(`§c Deactivations: ${totalDeactivations}`);
    player.sendMessage("§b====================================");
    player.sendMessage(`§e Total detected: ${detectedVillagers.size}`);
    player.sendMessage(`§a Currently active: ${currentVillagerIDs.size}`);
    player.sendMessage(`§7 Actual visible: ${actualVisibleCount}`);
    if (currentVillagerIDs.size !== actualVisibleCount) {
      player.sendMessage(`§c MISMATCH! (Should investigate)`);
    } else {
      player.sendMessage(`§a Perfect tracking!`);
    }
    player.sendMessage("§b====================================");
  }

  console.warn("§b[Sandbox] ========== STATUS ==========");
  console.warn(`§6 Proximity checks: ${totalProximityChecks}`);
  console.warn(`§a New detections: ${totalNewDetections}`);
  console.warn(`§a Activations: ${totalActivations}`);
  console.warn(`§c Deactivations: ${totalDeactivations}`);
  console.warn(`§e Total detected: ${detectedVillagers.size}`);
  console.warn(`§a Currently active: ${currentVillagerIDs.size}`);
  console.warn(`§7 Actual visible: ${actualVisibleCount}`);
  if (currentVillagerIDs.size !== actualVisibleCount) {
    console.warn(`§c MISMATCH DETECTED!`);
  } else {
    console.warn(`§a Perfect tracking!`);
  }

  // Show each villager
  for (const [villagerID, metadata] of detectedVillagers) {
    const isActive = currentVillagerIDs.has(villagerID);
    const statusIcon = isActive ? "§a●" : "§7○";
    console.warn(
      `${statusIcon} ${metadata.nameTag}: ${isActive ? "ACTIVE" : "INACTIVE"}`,
    );
  }

  console.warn("§b[Sandbox] ====================================");
}

/**
 * Reset test data.
 */
function resetTest() {
  detectedVillagers.clear();
  currentVillagerIDs.clear();
  totalProximityChecks = 0;
  totalNewDetections = 0;
  totalActivations = 0;
  totalDeactivations = 0;

  if (proximityCheckHandle !== null) {
    system.clearRun(proximityCheckHandle);
    proximityCheckHandle = null;
  }

  if (particleVisualizationHandle !== null) {
    system.clearRun(particleVisualizationHandle);
    particleVisualizationHandle = null;
    particleVisualizationEnabled = false;
  }

  world.sendMessage("§c[Sandbox] Test data reset");
  console.warn("§c[Sandbox] Test data reset");
}

/**
 * Initialize sandbox commands.
 */
function initializeProximitySandbox() {
  // Start test
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sandbox:start") {
      world.sendMessage("§b[Sandbox] Starting proximity detection test...");
      startProximityDetection();
    }
  });

  // Status
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sandbox:status") {
      showStatus();
    }
  });

  // Debug modal
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sandbox:debug") {
      if (!event.sourceEntity) return;
      showDebugModal(event.sourceEntity);
    }
  });

  // Particles
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sandbox:particles_on") {
      startParticleVisualization();
    }
  });

  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sandbox:particles_off") {
      stopParticleVisualization();
    }
  });

  // Reset
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sandbox:reset") {
      resetTest();
    }
  });

  console.warn("§a[Sandbox] Proximity detection sandbox initialized");
  console.warn("§a[Sandbox] Commands:");
  console.warn("§a  - /scriptevent sandbox:start");
  console.warn("§a  - /scriptevent sandbox:status");
  console.warn("§a  - /scriptevent sandbox:debug");
  console.warn("§a  - /scriptevent sandbox:particles_on");
  console.warn("§a  - /scriptevent sandbox:particles_off");
  console.warn("§a  - /scriptevent sandbox:reset");
}

export { initializeProximitySandbox };
