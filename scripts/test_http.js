import { world } from "@minecraft/server";
import {
  http,
  HttpRequest,
  HttpHeader,
  HttpRequestMethod,
} from "@minecraft/server-net";

/**
 * Tests HTTP POST request to backend /api/health endpoint.
 * Sends test data and logs the response.
 * @returns {Promise<void>}
 */
async function testPostRequest() {
  try {
    console.warn("§e[HTTP Test] Starting POST test to /api/health...");

    const req = new HttpRequest("http://localhost:3000/api/debug/health");

    req.body = JSON.stringify({
      test: "connection",
      timestamp: Date.now(),
      source: "minecraft-script-api",
    });

    req.method = HttpRequestMethod.Post;
    req.headers = [new HttpHeader("Content-Type", "application/json")];
    req.timeout = 5;

    const response = await http.request(req);

    console.warn(`§a[HTTP Test] POST Success! Status: ${response.status}`);
    console.warn(`§a[HTTP Test] Response Body: ${response.body}`);

    const parsedResponse = JSON.parse(response.body);
    console.warn(`§a[HTTP Test] Backend Status: ${parsedResponse.status}`);
    console.warn(
      `§a[HTTP Test] Backend Timestamp: ${parsedResponse.timestamp}`,
    );

    world.sendMessage(`§a✓ HTTP POST test successful! Backend is online.`);
  } catch (error) {
    console.error(`§c[HTTP Test] POST Failed: ${error.message || error}`);
    world.sendMessage(
      `§c✗ HTTP POST test failed: ${error.message || "Connection error"}`,
    );
  }
}

/**
 * Tests HTTP GET request to backend root endpoint.
 * @returns {Promise<void>}
 */
async function testGetRequest() {
  try {
    console.warn("§e[HTTP Test] Starting GET test to backend root...");

    const response = await http.get("http://localhost:3000/");

    console.warn(`§a[HTTP Test] GET Success! Status: ${response.status}`);
    console.warn(`§a[HTTP Test] Response Body: ${response.body}`);

    const parsedResponse = JSON.parse(response.body);
    console.warn(`§a[HTTP Test] Backend Message: ${parsedResponse.message}`);

    world.sendMessage(`§a✓ HTTP GET test successful!`);
  } catch (error) {
    console.error(`§c[HTTP Test] GET Failed: ${error.message || error}`);
    world.sendMessage(
      `§c✗ HTTP GET test failed: ${error.message || "Connection error"}`,
    );
  }
}

/**
 * Runs both POST and GET tests sequentially.
 * Call this function to verify HTTP communication with backend.
 * @returns {Promise<void>}
 */
async function runAllTests() {
  console.warn("§b[HTTP Test] ========================================");
  console.warn("§b[HTTP Test] Starting HTTP Communication Tests");
  console.warn("§b[HTTP Test] ========================================");

  await testPostRequest();
  await testGetRequest();

  console.warn("§b[HTTP Test] ========================================");
  console.warn("§b[HTTP Test] All tests complete!");
  console.warn("§b[HTTP Test] ========================================");
}

export { testPostRequest, testGetRequest, runAllTests };
