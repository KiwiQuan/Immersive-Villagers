import { world } from "@minecraft/server";

/**
 * Gets DEBUG_MODE state from world properties.
 * @returns {boolean} True if DEBUG_MODE is enabled
 */
function isDebugMode() {
  return world.getDynamicProperty("DEBUG_MODE") || false;
}

/**
 * Logs debug information if DEBUG_MODE is enabled.
 * @param {string} module - Module name (e.g., "Network", "DynamicProperties", "Layer2")
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
function debugLog(module, message, data = {}) {
  if (!isDebugMode()) return;

  const timestamp = new Date().toISOString();
  console.warn(
    `[${timestamp}] [DEBUG] [${module}] ${message}`,
    JSON.stringify(data),
  );
}

export { isDebugMode, debugLog };
