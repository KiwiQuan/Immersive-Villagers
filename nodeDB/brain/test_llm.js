import { callLLM } from './llm_client.js';

/**
 * Test script for llm_client.js
 * Make sure llama.cpp server is running before executing this!
 */
async function testLLM() {
  console.log('Testing LLM connection...\n');

  try {
    // Test 1: Simple prompt
    console.log('Test 1: Simple greeting');
    const response1 = await callLLM('You are a villager. Say hello in one sentence.', 50, 0.7);
    console.log('Response:', response1);
    console.log('✓ Test 1 passed\n');

    // Test 2: Longer prompt with context
    console.log('Test 2: Villager with context');
    const response2 = await callLLM(
      'You are a Minecraft villager named Bob. A player just gave you a diamond. Respond in one sentence expressing gratitude.',
      100,
      0.7
    );
    console.log('Response:', response2);
    console.log('✓ Test 2 passed\n');

    console.log('All tests passed! ✓');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. llama.cpp server is running (start-llama-server.bat)');
    console.error('2. Server is accessible at http://localhost:8080');
    process.exit(1);
  }
}

testLLM();
