import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { postRequest } from "./utils/network_helpers.js";

const MAX_HISTORY_DISPLAY = 5;
const chatHistory = [];

/**
 * Adds a message to chat history.
 * @param {string} role - "user" or "assistant"
 * @param {string} message - The message content
 */
function addToHistory(role, message) {
  chatHistory.push({
    role,
    message,
    timestamp: Date.now(),
  });
}

/**
 * Gets the last N messages from chat history formatted for display.
 * @param {number} limit - Maximum messages to return
 * @returns {string} Formatted chat history
 */
function getFormattedHistory(limit = MAX_HISTORY_DISPLAY) {
  if (chatHistory.length === 0) {
    return "No messages yet. Start a conversation!";
  }

  const recentMessages = chatHistory.slice(-limit);
  return recentMessages
    .map((msg) => {
      const roleLabel = msg.role === "user" ? "§bYou" : "§aLLM";
      const truncated =
        msg.message.length > 100
          ? msg.message.substring(0, 100) + "..."
          : msg.message;
      return `${roleLabel}§r: ${truncated}`;
    })
    .join("\n\n");
}

/**
 * Shows the LLM chat modal to a player.
 * @param {Player} player - The player to show the modal to
 */
async function showLLMChatModal(player) {
  const modal = new ModalFormData();

  modal.title("§l§6LLM Chat - llama.cpp Test");

  // Display chat history
  const history = getFormattedHistory();
  modal.label(`§7Recent Messages:\n${history}`);

  modal.divider();

  // Prompt input
  modal.textField("§eYour Message:", "Type your prompt here...");

  // Output mode selector
  modal.dropdown("§eOutput Mode:", ["Chat Message", "Modal Response"], {
    defaultValueIndex: 0,
  });

  modal.submitButton("§aSend to LLM");

  try {
    const response = await modal.show(player);

    if (response.canceled) {
      return;
    }

    // Debug: Log all form values
    console.warn(
      `§e[LLM Test] Form values: ${JSON.stringify(response.formValues)}`,
    );

    // formValues indices: label and divider add nulls, so textField=2, dropdown=3
    const prompt = response.formValues[2];
    const outputMode = response.formValues[3];

    console.warn(
      `§e[LLM Test] Prompt: "${prompt}", Output Mode: ${outputMode}`,
    );

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      player.sendMessage("§c✗ Please enter a prompt!");
      return;
    }

    addToHistory("user", prompt);
    player.sendMessage("§e⏳ Sending to LLM... (this may take 2-10 seconds)");

    const llmResponse = await postRequest(
      "/api/llm/chat",
      {
        prompt: prompt,
        maxTokens: 256,
        temperature: 0.7,
      },
      15,
    );

    if (llmResponse.status === "success") {
      addToHistory("assistant", llmResponse.response);

      if (outputMode === 1) {
        showResponseModal(player, llmResponse.response, llmResponse.duration);
      } else {
        player.sendMessage(`§a[LLM]§r: ${llmResponse.response}`);
        player.sendMessage(`§7(Generated in ${llmResponse.duration}ms)`);
      }

      player.sendMessage(
        "§a✓ LLM response received! Use /scriptevent llm:chat to continue.",
      );
    } else {
      player.sendMessage(
        `§c✗ LLM request failed: ${llmResponse.message || "Unknown error"}`,
      );
    }
  } catch (error) {
    console.error(`[LLM Test] Modal error: ${error.message || error}`);
    player.sendMessage(
      `§c✗ Request failed: ${error.message || "Connection error"}`,
    );
  }
}

/**
 * Shows LLM response in a modal.
 * @param {Player} player - The player to show the modal to
 * @param {string} response - The LLM response text
 * @param {number} duration - Response generation time in ms
 */
async function showResponseModal(player, response, duration) {
  const modal = new ModalFormData();

  modal.title("§l§aLLM Response");

  modal.label(`§7Generated in ${duration}ms\n\n§r${response}`);

  modal.submitButton("§aContinue Chat");

  try {
    const result = await modal.show(player);

    if (!result.canceled) {
      showLLMChatModal(player);
    }
  } catch (error) {
    console.error(`[LLM Test] Response modal error: ${error.message || error}`);
  }
}

/**
 * Clears the chat history.
 */
function clearChatHistory() {
  chatHistory.length = 0;
  console.warn("§a[LLM Test] Chat history cleared");
}

/**
 * Initializes scriptevent listeners for LLM testing.
 */
function initializeLLMCommands() {
  // Listen for llm:chat - Open chat modal
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "llm:chat") {
      const player = event.sourceEntity;

      if (!player || player.typeId !== "minecraft:player") {
        console.warn("§c[LLM Test] llm:chat must be triggered by a player");
        return;
      }

      showLLMChatModal(player);
    }
  });

  // Listen for llm:clear - Clear chat history
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "llm:clear") {
      clearChatHistory();

      if (
        event.sourceEntity &&
        event.sourceEntity.typeId === "minecraft:player"
      ) {
        event.sourceEntity.sendMessage("§a✓ Chat history cleared!");
      }
    }
  });

  console.warn("§a[LLM Test] LLM commands registered!");
  console.warn("§a  - /scriptevent llm:chat (opens chat modal)");
  console.warn("§a  - /scriptevent llm:clear (clears history)");
}

export { showLLMChatModal, clearChatHistory, initializeLLMCommands };
