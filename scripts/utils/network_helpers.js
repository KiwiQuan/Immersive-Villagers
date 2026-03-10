import {
  http,
  HttpRequest,
  HttpHeader,
  HttpRequestMethod,
} from "@minecraft/server-net";
import { debugLog } from "./debug_mode_helper.js";

const BACKEND_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT = 5;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Waits for a specified duration (used for retry delays).
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends HTTP POST request with error handling and timeout.
 * @param {string} endpoint - API endpoint path (e.g., "/api/memory/episode")
 * @param {Object} data - Data to send in request body
 * @param {number} timeout - Timeout in seconds (default: 5)
 * @returns {Promise<Object>} Parsed response body
 * @throws {Error} If request fails or times out
 */
async function postRequest(endpoint, data, timeout = DEFAULT_TIMEOUT) {
  try {
    debugLog("Network", "POST request starting", { endpoint, timeout });

    const req = new HttpRequest(`${BACKEND_URL}${endpoint}`);
    req.body = JSON.stringify(data);
    req.method = HttpRequestMethod.Post;
    req.headers = [new HttpHeader("Content-Type", "application/json")];
    req.timeout = timeout;

    const startTime = Date.now();
    const response = await http.request(req);
    const duration = Date.now() - startTime;

    debugLog("Network", "POST request succeeded", {
      endpoint,
      status: response.status,
      duration,
    });

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.body}`);
    }

    return JSON.parse(response.body);
  } catch (error) {
    debugLog("Network", "POST request failed", {
      endpoint,
      error: error.message || String(error),
    });
    throw new Error(`POST ${endpoint} failed: ${error.message || error}`);
  }
}

/**
 * Sends HTTP GET request with retry mechanism and timeout.
 * Automatically retries failed requests up to MAX_RETRY_ATTEMPTS times.
 * @param {string} endpoint - API endpoint path (e.g., "/api/brain/poll")
 * @param {number} timeout - Timeout in seconds (default: 5)
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} Parsed response body
 * @throws {Error} If all retry attempts fail
 */
async function getRequest(
  endpoint,
  timeout = DEFAULT_TIMEOUT,
  maxRetries = MAX_RETRY_ATTEMPTS,
) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog("Network", "GET request attempt", {
        endpoint,
        attempt,
        maxRetries,
        timeout,
      });

      const req = new HttpRequest(`${BACKEND_URL}${endpoint}`);
      req.method = HttpRequestMethod.Get;
      req.timeout = timeout;

      const startTime = Date.now();
      const response = await http.request(req);
      const duration = Date.now() - startTime;

      debugLog("Network", "GET request succeeded", {
        endpoint,
        status: response.status,
        duration,
        attempt,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
      }

      return JSON.parse(response.body);
    } catch (error) {
      lastError = error;

      debugLog("Network", "GET request failed", {
        endpoint,
        attempt,
        maxRetries,
        error: error.message || String(error),
      });

      if (attempt < maxRetries) {
        console.warn(
          `§e[Network] GET ${endpoint} failed (attempt ${attempt}/${maxRetries}), retrying in ${RETRY_DELAY_MS}ms...`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `GET ${endpoint} failed after ${maxRetries} attempts: ${lastError.message || lastError}`,
  );
}

/**
 * Sends HTTP POST request without waiting for response (fire-and-forget).
 * Used for non-critical operations where response isn't needed.
 * Logs errors but doesn't throw.
 * @param {string} endpoint - API endpoint path
 * @param {Object} data - Data to send in request body
 * @param {number} timeout - Timeout in seconds (default: 5)
 * @returns {Promise<void>}
 */
async function postRequestAsync(endpoint, data, timeout = DEFAULT_TIMEOUT) {
  try {
    await postRequest(endpoint, data, timeout);
  } catch (error) {
    console.warn(`§e[Network] Async POST ${endpoint} failed: ${error.message}`);
  }
}

/**
 * Checks if the backend is reachable.
 * @returns {Promise<boolean>} True if backend responds, false otherwise
 */
async function isBackendOnline() {
  try {
    const req = new HttpRequest(`${BACKEND_URL}/`);
    req.method = HttpRequestMethod.Get;
    req.timeout = 2;

    const response = await http.request(req);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

export { postRequest, getRequest, postRequestAsync, isBackendOnline };
