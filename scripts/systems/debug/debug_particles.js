/**
 * Villager Lifecycle - Debug Particle Visualization
 * 
 * Visual indicator for active villagers within proximity range.
 * Spawns particles above villagers' heads to show detection status.
 * 
 * @module debug_particles
 */

import { world, system } from "@minecraft/server";
import { activeVillagers } from "../villager_lifecycle/lifecycle_state.js";

let particleVisualizationEnabled = false;
let particleVisualizationHandle = null;

const PARTICLE_INTERVAL = 5; // ticks (4 times per second - performance-optimized)

/**
 * Starts particle visualization above active villagers.
 * Shows purple particles to indicate proximity detection is working.
 */
export function startParticleVisualization() {
  if (particleVisualizationEnabled) {
    world.sendMessage("§e[Debug] Particle visualization already running");
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

        if (activeVillagers.has(villager.id)) {
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
      console.error(`§c[Debug] Particle error: ${error.message}`);
    }
  }, PARTICLE_INTERVAL);

  world.sendMessage(
    "§a[Debug] Particle visualization ENABLED\n§7Purple particles indicate active villagers within proximity range"
  );
  console.warn("§a[Debug] Particle visualization enabled");
}

/**
 * Stops particle visualization.
 */
export function stopParticleVisualization() {
  if (!particleVisualizationEnabled) {
    world.sendMessage("§e[Debug] Particle visualization not running");
    return;
  }

  if (particleVisualizationHandle !== null) {
    system.clearRun(particleVisualizationHandle);
    particleVisualizationHandle = null;
  }

  particleVisualizationEnabled = false;

  world.sendMessage("§c[Debug] Particle visualization DISABLED");
  console.warn("§c[Debug] Particle visualization disabled");
}

/**
 * Checks if particle visualization is currently running.
 * @returns {boolean}
 */
export function isParticleVisualizationEnabled() {
  return particleVisualizationEnabled;
}
