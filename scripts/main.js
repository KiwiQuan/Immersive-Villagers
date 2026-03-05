import { world, system } from "@minecraft/server";
import { runAllTests } from "./test_http.js";

console.warn("§e[AI Brain] Script is initializing...");

system.runTimeout(() => {
  console.warn("§b[AI Brain] Running HTTP communication tests...");
  runAllTests().catch((error) => {
    console.error(`§c[AI Brain] Test suite failed: ${error.message}`);
  });
}, 40);
