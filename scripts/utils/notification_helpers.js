/**
 * Player notification and messaging utilities.
 * Handles message broadcasting with range filtering and formatting.
 * 
 * @module notification_helpers
 */

import { world } from "@minecraft/server";
import { calculateDistance } from "./geometry_helpers.js";

/**
 * Notifies only players within a specified radius of a location.
 * Useful for reducing chat spam by only alerting nearby players.
 * 
 * @param {string} message - Message to send (supports Minecraft color codes)
 * @param {Object} location - Event location {x, y, z}
 * @param {number} location.x - X coordinate
 * @param {number} location.y - Y coordinate
 * @param {number} location.z - Z coordinate
 * @param {number} [radius=200] - Notification radius in blocks
 * 
 * @example
 * // Notify only players within 200 blocks of the villager
 * notifyNearbyPlayers(
 *   "§aVillager activated!",
 *   villager.location,
 *   200
 * );
 */
export function notifyNearbyPlayers(message, location, radius = 200) {
  const allPlayers = world.getAllPlayers();
  
  for (const player of allPlayers) {
    const distance = calculateDistance(player.location, location);
    if (distance <= radius) {
      player.sendMessage(message);
    }
  }
}

/**
 * Broadcasts a message to all players in the world.
 * No distance filtering applied.
 * 
 * @param {string} message - Message to send (supports Minecraft color codes)
 * 
 * @example
 * broadcastToAllPlayers("§b[System] Server restarting in 5 minutes!");
 */
export function broadcastToAllPlayers(message) {
  world.sendMessage(message);
}

/**
 * Sends a message to a specific player.
 * Wrapper for player.sendMessage with null checks.
 * 
 * @param {Player|null} player - Player entity to send message to
 * @param {string} message - Message to send
 * @returns {boolean} True if message was sent, false if player is null/invalid
 * 
 * @example
 * if (sendMessageToPlayer(player, "§eYour villager is ready!")) {
 *   console.log("Message sent successfully");
 * }
 */
export function sendMessageToPlayer(player, message) {
  if (!player || !player.isValid) return false;
  
  try {
    player.sendMessage(message);
    return true;
  } catch (error) {
    console.error(`§c[Notification] Failed to send message: ${error.message}`);
    return false;
  }
}

/**
 * Displays an actionbar message to a player (non-intrusive, above hotbar).
 * Useful for frequent updates without cluttering chat.
 * 
 * @param {Player} player - Player entity
 * @param {string} message - Message to display
 * @returns {boolean} True if successful
 * 
 * @example
 * // Show active villager count above hotbar
 * showActionBar(player, `§a${activeCount} villagers nearby`);
 */
export function showActionBar(player, message) {
  if (!player || !player.isValid) return false;
  
  try {
    player.onScreenDisplay.setActionBar(message);
    return true;
  } catch (error) {
    console.error(`§c[Notification] Failed to show actionbar: ${error.message}`);
    return false;
  }
}

/**
 * Formats a timestamp into a readable time string.
 * 
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string (e.g., "2:30:45 PM")
 * 
 * @example
 * const timeStr = formatTimestamp(villager.firstSeen);
 * player.sendMessage(`First seen: ${timeStr}`);
 */
export function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Formats a location as a readable coordinate string.
 * 
 * @param {Object} location - Location {x, y, z}
 * @param {boolean} [rounded=true] - Whether to round coordinates
 * @returns {string} Formatted string (e.g., "X=100, Y=64, Z=-50")
 * 
 * @example
 * const coordStr = formatLocation(villager.location);
 * player.sendMessage(`Villager at: ${coordStr}`);
 */
export function formatLocation(location, rounded = true) {
  if (rounded) {
    return `X=${Math.round(location.x)}, Y=${Math.round(location.y)}, Z=${Math.round(location.z)}`;
  }
  return `X=${location.x}, Y=${location.y}, Z=${location.z}`;
}
