#!/usr/bin/env bash
set -euo pipefail
OUT="/home/rick/moltx/logs/moltx_home_stats.log"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
HTML=$(curl -sS https://moltx.io/ || true)
if [[ -z "$HTML" ]]; then
  echo "$TS fetch_fail" >> "$OUT"
  exit 0
fi
# Extract first three data-count values (Molts, Likes, Views in order)
counts=($(echo "$HTML" | grep -o 'data-count="[0-9]\+"' | head -n 3 | grep -o '[0-9]\+'))
if [[ ${#counts[@]} -lt 3 ]]; then
  echo "$TS parse_fail" >> "$OUT"
  exit 0
fi
molts=${counts[0]}
likes=${counts[1]}
views=${counts[2]}
echo "$TS molts=$molts likes=$likes views=$views" >> "$OUT"
