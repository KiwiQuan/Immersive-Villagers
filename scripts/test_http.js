import { world, system } from "@minecraft/server";
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
 * Tests HTTP GET request to test endpoint.
 * Verifies response parsing and data structure.
 * @returns {Promise<void>}
 */
async function testGetTestEndpoint() {
  try {
    console.warn("§e[HTTP Test] Starting GET test to /api/debug/test...");

    const response = await http.get("http://localhost:3000/api/debug/test");

    console.warn(`§a[HTTP Test] Test Endpoint Success! Status: ${response.status}`);
    
    const parsedResponse = JSON.parse(response.body);
    console.warn(`§a[HTTP Test] Message: ${parsedResponse.message}`);
    console.warn(`§a[HTTP Test] Server Uptime: ${parsedResponse.testData.serverUptime.toFixed(2)}s`);
    console.warn(`§a[HTTP Test] Node Version: ${parsedResponse.testData.nodeVersion}`);

    world.sendMessage("§a✓ Test endpoint GET successful!");

  } catch (error) {
    console.error(`§c[HTTP Test] Test Endpoint Failed: ${error.message || error}`);
    world.sendMessage(`§c✗ Test endpoint failed: ${error.message || "Connection error"}`);
  }
}

/**
 * Tests timeout handling with a slow endpoint.
 * Simulates a backend endpoint that takes 10+ seconds to respond.
 * Should trigger Script API timeout (5 seconds).
 * @returns {Promise<void>}
 */
async function testTimeoutHandling() {
  try {
    console.warn("§e[HTTP Test] Starting timeout test (10s delay, 5s timeout)...");
    console.warn("§e[HTTP Test] This should trigger a timeout error...");

    const req = new HttpRequest("http://localhost:3000/api/debug/test/slow?delay=10");
    req.method = HttpRequestMethod.Get;
    req.timeout = 5;

    const startTime = Date.now();
    const response = await http.request(req);
    const duration = Date.now() - startTime;

    console.warn(`§c[HTTP Test] Unexpected success! Took ${duration}ms`);
    console.warn(`§c[HTTP Test] Response: ${response.body}`);
    world.sendMessage("§c⚠ Timeout test did NOT timeout (unexpected)");

  } catch (error) {
    console.warn(`§a[HTTP Test] Timeout handled correctly! Error: ${error.message || error}`);
    world.sendMessage("§a✓ Timeout handling works! Request was cancelled.");
  }
}

/**
 * Runs all HTTP tests sequentially.
 * Call this function to verify HTTP communication with backend.
 * @returns {Promise<void>}
 */
async function runAllTests() {
  console.warn("§b[HTTP Test] ========================================");
  console.warn("§b[HTTP Test] Starting HTTP Communication Tests");
  console.warn("§b[HTTP Test] ========================================");

  await testPostRequest();
  await testGetRequest();
  await testGetTestEndpoint();
  await testTimeoutHandling();

  console.warn("§b[HTTP Test] ========================================");
  console.warn("§b[HTTP Test] All tests complete!");
  console.warn("§b[HTTP Test] ========================================");
}

/**
 * Initializes scriptevent listeners for debug testing.
 * Allows individual test triggering via /scriptevent commands.
 */
function initializeDebugCommands() {
  // Listen for test:post - Trigger POST test
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:post") {
      world.sendMessage("§b[Debug] Running POST test...");
      testPostRequest();
    }
  });

  // Listen for test:get - Trigger GET test
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:get") {
      world.sendMessage("§b[Debug] Running GET test...");
      testGetRequest();
    }
  });

  // Listen for test:endpoint - Trigger test endpoint GET
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:endpoint") {
      world.sendMessage("§b[Debug] Running test endpoint GET...");
      testGetTestEndpoint();
    }
  });

  // Listen for test:timeout - Trigger timeout test
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:timeout") {
      world.sendMessage("§b[Debug] Running timeout test...");
      testTimeoutHandling();
    }
  });

  // Listen for test:all - Run all tests
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "test:all") {
      world.sendMessage("§b[Debug] Running all HTTP tests...");
      runAllTests();
    }
  });

  console.warn("§a[HTTP Test] Debug commands registered!");
  console.warn("§a[HTTP Test] Available commands:");
  console.warn("§a  - /scriptevent test:post");
  console.warn("§a  - /scriptevent test:get");
  console.warn("§a  - /scriptevent test:endpoint");
  console.warn("§a  - /scriptevent test:timeout");
  console.warn("§a  - /scriptevent test:all");
}

export { testPostRequest, testGetRequest, testGetTestEndpoint, testTimeoutHandling, runAllTests, initializeDebugCommands };
