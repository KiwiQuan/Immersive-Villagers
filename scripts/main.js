import { world, system } from "@minecraft/server";
import { runAllTests, initializeDebugCommands } from "./test_http.js";
import { initializeLLMCommands } from "./test_llamacpp.js";
import { initializeDynamicPropertiesCommands } from "./layers/layer4_working_memory/debug/test_dynamic_properties.js";
import { initializeVillagerLifecycle } from "./systems/villager_lifecycle/lifecycle_coordinator.js";
import { initializeLifecycleCommands } from "./systems/villager_lifecycle/lifecycle_commands.js";
import { initializeLayer4System } from "./layers/layer4_working_memory/layer4_init.js";
import { initializeDebugCommands as initializeProximityDebugCommands } from "./systems/debug/debug_commands.js";
import { initializeSandboxWMTest } from "./sandbox/test_working_memory_sync.js";
// import { initializeSandboxCommands } from "./sandbox/test_entity_load_detection.js";
// import { initializeProximitySandbox } from "./sandbox/test_proximity_detection.js";

console.warn("§e[AI Brain] Script is initializing...");

system.runTimeout(async () => {
  console.warn("§b[AI Brain] Initializing debug commands...");
  initializeDebugCommands(); // HTTP test commands
  initializeLLMCommands();
  initializeDynamicPropertiesCommands();

  // PRODUCTION SYSTEMS
  console.warn("§b[AI Brain] Initializing Villager Lifecycle System...");
  await initializeVillagerLifecycle(); // Await for auto-recovery

  console.warn("§b[AI Brain] Initializing Layer 4 (Working Memory)...");
  initializeLayer4System();

  console.warn("§6[AI Brain] Initializing Proximity Debug Tools...");
  initializeProximityDebugCommands();
  
  console.warn("§6[AI Brain] Initializing Lifecycle Manual Controls...");
  initializeLifecycleCommands();

  // SANDBOX MODE (disabled - production enabled)
  // console.warn("§6[SANDBOX MODE] Initializing Working Memory Sync Test...");
  // initializeSandboxWMTest();

  // console.warn("§b[AI Brain] Running initial HTTP communication tests...");
  // runAllTests().catch((error) => {
  //   console.error(`§c[AI Brain] Test suite failed: ${error.message}`);
  // });
}, 40);
