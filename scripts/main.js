import { world, system } from "@minecraft/server";
import { runAllTests, initializeDebugCommands } from "./test_http.js";
import { initializeLLMCommands } from "./test_llamacpp.js";
import { initializeDynamicPropertiesCommands } from "./test_dynamic_properties.js";
// import { initializeVillagerLifecycle } from "./systems/villager_lifecycle.js";
import { initializeLayer4System } from "./layers/layer4_working_memory/layer4_init.js";
// import { initializeSandboxCommands } from "./sandbox/test_entity_load_detection.js";
import { initializeProximitySandbox } from "./sandbox/test_proximity_detection.js";

console.warn("§e[AI Brain] Script is initializing...");

system.runTimeout(() => {
  console.warn("§b[AI Brain] Initializing debug commands...");
  initializeDebugCommands();
  initializeLLMCommands();
  initializeDynamicPropertiesCommands();
  
  console.warn("§e[AI Brain] Initializing SANDBOX tests...");
  // initializeSandboxCommands(); // Old multi-method test
  initializeProximitySandbox(); // Refined proximity-only test

  // console.warn("§b[AI Brain] Initializing Villager Lifecycle System...");
  // initializeVillagerLifecycle();

  console.warn("§b[AI Brain] Initializing Layer 4 (Working Memory)...");
  initializeLayer4System();

  // console.warn("§b[AI Brain] Running initial HTTP communication tests...");
  // runAllTests().catch((error) => {
  //   console.error(`§c[AI Brain] Test suite failed: ${error.message}`);
  // });
}, 40);
