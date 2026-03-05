import express from "express";
import { callLLM } from "../brain/llm_client.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * POST /api/llm/chat
 * Sends a prompt to llama.cpp and returns the response.
 * @body {string} prompt - The user's prompt
 * @body {number} maxTokens - Max tokens to generate (optional, default 256)
 * @body {number} temperature - Sampling temperature (optional, default 0.7)
 * @returns {Object} LLM response with generated text
 */
router.post("/chat", async (req, res) => {
  try {
    const { prompt, maxTokens = 256, temperature = 0.7 } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid prompt",
      });
    }

    logger.info({ promptLength: prompt.length, maxTokens, temperature }, "[LLM] Chat request received");

    const startTime = Date.now();
    const response = await callLLM(prompt, maxTokens, temperature);
    const duration = Date.now() - startTime;

    logger.info({ duration, responseLength: response.length }, "[LLM] Chat request completed");

    res.json({
      status: "success",
      response: response,
      duration,
      timestamp: Date.now(),
    });

  } catch (error) {
    logger.error({ error: error.message }, "[LLM] Chat request failed");

    res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: Date.now(),
    });
  }
});

export default router;
