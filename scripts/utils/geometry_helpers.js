/**
 * Geometry and distance calculation utilities.
 * Pure functions with no side effects - can be used across all layers and systems.
 * 
 * @module geometry_helpers
 */

/**
 * Calculates 3D Euclidean distance between two locations.
 * Uses standard distance formula: sqrt((x2-x1)² + (y2-y1)² + (z2-z1)²)
 * 
 * @param {Object} loc1 - First location
 * @param {number} loc1.x - X coordinate
 * @param {number} loc1.y - Y coordinate
 * @param {number} loc1.z - Z coordinate
 * @param {Object} loc2 - Second location
 * @param {number} loc2.x - X coordinate
 * @param {number} loc2.y - Y coordinate
 * @param {number} loc2.z - Z coordinate
 * @returns {number} Distance in blocks
 * 
 * @example
 * const distance = calculateDistance(
 *   { x: 0, y: 64, z: 0 },
 *   { x: 3, y: 68, z: 4 }
 * );
 * // Returns: 5.0 (Pythagorean triple: 3² + 4² + 0² = 5²)
 */
export function calculateDistance(loc1, loc2) {
  const dx = loc1.x - loc2.x;
  const dy = loc1.y - loc2.y;
  const dz = loc1.z - loc2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Finds the distance to the nearest player from a given location.
 * 
 * @param {Object} location - Target location {x, y, z}
 * @param {number} location.x - X coordinate
 * @param {number} location.y - Y coordinate
 * @param {number} location.z - Z coordinate
 * @param {Player[]} players - Array of player entities
 * @returns {number} Distance to nearest player in blocks (Infinity if no players)
 * 
 * @example
 * const allPlayers = world.getAllPlayers();
 * const distance = getNearestPlayerDistance(villager.location, allPlayers);
 * if (distance <= 150) {
 *   console.log("Villager is within 150 blocks of a player");
 * }
 */
export function getNearestPlayerDistance(location, players) {
  if (players.length === 0) return Infinity;
  
  return Math.min(
    ...players.map(player => calculateDistance(location, player.location))
  );
}

/**
 * Calculates 2D horizontal distance (ignoring Y axis).
 * Useful for chunk-based or flat-plane proximity checks.
 * 
 * @param {Object} loc1 - First location {x, z}
 * @param {number} loc1.x - X coordinate
 * @param {number} loc1.z - Z coordinate
 * @param {Object} loc2 - Second location {x, z}
 * @param {number} loc2.x - X coordinate
 * @param {number} loc2.z - Z coordinate
 * @returns {number} Horizontal distance in blocks
 * 
 * @example
 * const distance = calculateHorizontalDistance(
 *   { x: 0, z: 0 },
 *   { x: 3, z: 4 }
 * );
 * // Returns: 5.0 (ignores Y difference)
 */
export function calculateHorizontalDistance(loc1, loc2) {
  const dx = loc1.x - loc2.x;
  const dz = loc1.z - loc2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Checks if a location is within a rectangular bounding box.
 * Cheaper than full distance calculation - useful for pre-filtering.
 * 
 * @param {Object} location - Target location {x, y, z}
 * @param {Object} center - Center of bounding box {x, y, z}
 * @param {number} maxDistance - Half-width of the box in blocks
 * @returns {boolean} True if location is within the box
 * 
 * @example
 * // Quick pre-filter before expensive distance calculation
 * if (isWithinBoundingBox(villager.location, player.location, 150)) {
 *   const exactDistance = calculateDistance(villager.location, player.location);
 *   // Now do expensive check only if within rough bounds
 * }
 */
export function isWithinBoundingBox(location, center, maxDistance) {
  const dx = Math.abs(location.x - center.x);
  const dy = Math.abs(location.y - center.y);
  const dz = Math.abs(location.z - center.z);
  
  return dx <= maxDistance && dy <= maxDistance && dz <= maxDistance;
}
