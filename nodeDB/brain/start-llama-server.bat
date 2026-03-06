@echo off
echo Starting llama.cpp server with CUDA...
echo.

cd llama.cpp

.\build\bin\Release\llama-server.exe ^
  -m .\models\llama-3.1-8b-instruct-q4_k_m.gguf ^
  --host localhost ^
  --port 8080 ^
  -c 4096 ^
  -np 2 ^
  -ngl 99 ^
  -t 8 ^
  --context-shift ^
  --cont-batching ^
  --flash-attn on
pause
