#!/bin/bash
# Restarts all backend JS scripts for the finance dashboard

# List of backend JS files to restart (edit as needed)
BACKENDS=(
  "kite-mcp-server.js"
  "proxy.js"
  "ai-bridge.js"
  "gemini-bridge.js"
  "mcp-bridge.js"
)

echo "Stopping all backend JS scripts..."
for SCRIPT in "${BACKENDS[@]}"; do
  echo "Stopping: $SCRIPT"
  pkill -f "node .*${SCRIPT}" 2>/dev/null
done

# Small delay for processes to exit
sleep 1

echo "Starting all backend JS scripts..."
for SCRIPT in "${BACKENDS[@]}"; do
  if [ -f "$SCRIPT" ]; then
    echo "Starting: $SCRIPT"
    nohup node "$SCRIPT" > "${SCRIPT%.js}.log" 2>&1 &
    sleep 0.2
  else
    echo "Not found: $SCRIPT"
  fi
done

echo "All backend JS scripts restarted."
echo "Check logs (*.log) for each script for output/errors."
# To make this script executable: chmod +x restart-backends.sh
