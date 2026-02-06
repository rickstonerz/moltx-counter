#!/usr/bin/env bash
set -euo pipefail
PID_FILE="/home/rick/moltx/control/moltx_home_stats.pid"
LOG_FILE="/home/rick/moltx/logs/moltx_home_stats.log"
SCRIPT="/home/rick/moltx/scripts/moltx_home_stats.sh"

# prevent multiple loops
if [[ -f "$PID_FILE" ]]; then
  if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    exit 0
  fi
fi

echo $$ > "$PID_FILE"

while true; do
  "$SCRIPT" >> "$LOG_FILE" 2>&1 || true
  sleep 55
 done
