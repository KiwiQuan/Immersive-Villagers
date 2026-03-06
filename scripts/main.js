import { world, system } from "@minecraft/server";
import { runAllTests, initializeDebugCommands } from "./test_http.js";
import { initializeLLMCommands } from "./test_llamacpp.js";
import { initializeDynamicPropertiesCommands } from "./test_dynamic_properties.js";

console.warn("§e[AI Brain] Script is initializing...");

system.runTimeout(() => {
  console.warn("§b[AI Brain] Initializing debug commands...");
  initializeDebugCommands();
  initializeLLMCommands();
  initializeDynamicPropertiesCommands();
  
  console.warn("§b[AI Brain] Running initial HTTP communication tests...");
  runAllTests().catch((error) => {
    console.error(`§c[AI Brain] Test suite failed: ${error.message}`);
  });
}, 40);
