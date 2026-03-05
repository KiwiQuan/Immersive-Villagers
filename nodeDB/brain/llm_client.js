import axios from "axios";

const LLAMA_URL = process.env.LLAMA_URL || "http://localhost:8080";
const TIMEOUT = 10000; // 10 seconds

/**
 * Calls the llama.cpp server for text completion using the OpenAI-compatible chat endpoint.
 * @param {string} prompt - The prompt/context to send to the LLM
 * @param {number} maxTokens - Maximum tokens to generate (default: 256)
 * @param {number} temperature - Sampling temperature (default: 0.7)
 * @returns {Promise<string>} Generated text response
 */
export async function callLLM(prompt, maxTokens = 256, temperature = 0.7) {
  try {
    const response = await axios.post(
      `${LLAMA_URL}/v1/chat/completions`,
      {
        model: "llama-3.1-8b-instruct", // Model name (informational)
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.9,
      },
      {
        timeout: TIMEOUT,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    // Extract content from OpenAI-compatible response
    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      const content = response.data.choices[0].message.content;
      return content.trim();
    }

    throw new Error("Invalid response format from LLM");
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      throw new Error("LLM server is not running (connection refused)");
    } else if (err.code === "ETIMEDOUT" || err.message.includes("timeout")) {
      throw new Error("LLM request timed out (>10 seconds)");
    } else if (err.response) {
      throw new Error(
        `LLM server error: ${err.response.status} - ${err.response.data?.error?.message || "Unknown error"}`,
      );
    } else {
      throw new Error(`LLM call failed: ${err.message}`);
    }
  }
}
