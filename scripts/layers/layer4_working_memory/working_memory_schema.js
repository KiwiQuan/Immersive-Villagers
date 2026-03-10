/**
 * Working Memory Schema Definition for DynamicProperties
 * Defines all persistent entity properties for villager AI state management.
 * 
 * DynamicProperties supported types:
 * - string: Text data
 * - number: Floating point or integer
 * - boolean: True/false flags
 * - Vector3: 3D coordinates (not used in WM, but available)
 * 
 * Note: All properties must be stored individually (no complex objects).
 * For complex data, use JSON.stringify() to store as string.
 */

/**
 * Working Memory property definitions.
 * Each property represents a specific aspect of villager consciousness.
 */
const WORKING_MEMORY_SCHEMA = {
  /**
   * Current focus entity ID (who the villager is observing).
   * @type {string}
   */
  wm_currentFocus: {
    type: "string",
    defaultValue: null,
    description: "Entity ID of current focus (player/entity being observed)",
  },

  /**
   * Current mood vector components (5-axis semantic state).
   * Each component is stored separately for fast access.
   */
  wm_currentMood_C: {
    type: "number",
    defaultValue: 0.5,
    description: "Constructiveness axis (-1 to 1): Building (+) vs Destroying (-)",
  },
  wm_currentMood_V: {
    type: "number",
    defaultValue: 0.5,
    description: "Value axis (0 to 1): Economic/Survival importance",
  },
  wm_currentMood_I: {
    type: "number",
    defaultValue: 0.5,
    description: "Intensity axis (0 to 1): Energy/Arousal level",
  },
  wm_currentMood_S: {
    type: "number",
    defaultValue: 0.5,
    description: "Sociality axis (-1 to 1): Friendly (+) vs Hostile (-)",
  },
  wm_currentMood_X: {
    type: "number",
    defaultValue: 0.5,
    description: "Complexity axis (0 to 1): Systemic (+) vs Random (-)",
  },

  /**
   * Shock state flag (triggered by intense/unexpected events).
   * @type {boolean}
   */
  wm_shockState: {
    type: "boolean",
    defaultValue: false,
    description: "True if villager is in shock state (freezes normal behavior)",
  },

  /**
   * Last update timestamp (milliseconds since epoch).
   * @type {number}
   */
  wm_lastUpdate: {
    type: "number",
    defaultValue: 0,
    description: "Timestamp of last Working Memory update (Date.now())",
  },

  /**
   * Sync flag (indicates Working Memory needs database sync).
   * @type {boolean}
   */
  wm_needsSync: {
    type: "boolean",
    defaultValue: false,
    description: "True if Working Memory has changed and needs PostgreSQL sync",
  },

  /**
   * Last successful sync timestamp.
   * @type {number}
   */
  wm_lastSyncSuccess: {
    type: "number",
    defaultValue: 0,
    description: "Timestamp of last successful database sync",
  },

  /**
   * Network status flag (tracks backend connectivity).
   * @type {string}
   */
  wm_networkStatus: {
    type: "string",
    defaultValue: "unknown",
    description: "Backend connectivity status: 'online' | 'offline' | 'unknown'",
  },
};

/**
 * Returns list of all Working Memory property names.
 * @returns {string[]} Array of property identifiers
 */
function getWorkingMemoryPropertyNames() {
  return Object.keys(WORKING_MEMORY_SCHEMA);
}

/**
 * Returns default value for a specific property.
 * @param {string} propertyName - Property identifier
 * @returns {string|number|boolean|null} Default value or null if property doesn't exist
 */
function getDefaultValue(propertyName) {
  const property = WORKING_MEMORY_SCHEMA[propertyName];
  return property ? property.defaultValue : null;
}

/**
 * Returns expected type for a specific property.
 * @param {string} propertyName - Property identifier
 * @returns {string|null} Type name ('string', 'number', 'boolean') or null if property doesn't exist
 */
function getPropertyType(propertyName) {
  const property = WORKING_MEMORY_SCHEMA[propertyName];
  return property ? property.type : null;
}

/**
 * Validates that a value matches the expected type for a property.
 * @param {string} propertyName - Property identifier
 * @param {any} value - Value to validate
 * @returns {boolean} True if value matches expected type
 */
function validatePropertyValue(propertyName, value) {
  const expectedType = getPropertyType(propertyName);
  
  if (!expectedType) return false;
  if (value === null || value === undefined) return true;
  
  const actualType = typeof value;
  return actualType === expectedType;
}

export {
  WORKING_MEMORY_SCHEMA,
  getWorkingMemoryPropertyNames,
  getDefaultValue,
  getPropertyType,
  validatePropertyValue,
};
