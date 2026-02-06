#!/usr/bin/env bash
set -euo pipefail
LOG="/home/rick/moltx/logs/moltx_home_stats.log"
if [[ ! -f "$LOG" ]]; then
  echo "no log"
  exit 1
fi

# parse last N lines
last_n=60
mapfile -t lines < <(tail -n "$last_n" "$LOG")

if [[ ${#lines[@]} -lt 2 ]]; then
  echo "not enough data"
  exit 0
fi

parse_line(){
  local line="$1"
  # format: TS molts=... likes=... views=...
  local ts=$(echo "$line" | awk '{print $1}')
  local molts=$(echo "$line" | sed -n 's/.*molts=\([0-9]\+\).*/\1/p')
  local likes=$(echo "$line" | sed -n 's/.*likes=\([0-9]\+\).*/\1/p')
  local views=$(echo "$line" | sed -n 's/.*views=\([0-9]\+\).*/\1/p')
  echo "$ts $molts $likes $views"
}

first=$(parse_line "${lines[0]}")
last=$(parse_line "${lines[-1]}")

f_ts=$(echo "$first" | awk '{print $1}')
f_m=$(echo "$first" | awk '{print $2}')
f_l=$(echo "$first" | awk '{print $3}')
f_v=$(echo "$first" | awk '{print $4}')

l_ts=$(echo "$last" | awk '{print $1}')
l_m=$(echo "$last" | awk '{print $2}')
l_l=$(echo "$last" | awk '{print $3}')
l_v=$(echo "$last" | awk '{print $4}')

# compute elapsed seconds
f_epoch=$(date -u -d "$f_ts" +%s 2>/dev/null || python - <<PY
import datetime
print(int(datetime.datetime.strptime("$f_ts", "%Y-%m-%dT%H:%M:%SZ").timestamp()))
PY
)
l_epoch=$(date -u -d "$l_ts" +%s 2>/dev/null || python - <<PY
import datetime
print(int(datetime.datetime.strptime("$l_ts", "%Y-%m-%dT%H:%M:%SZ").timestamp()))
PY
)

dt=$((l_epoch - f_epoch))
if (( dt <= 0 )); then dt=1; fi

# deltas
m_delta=$((l_m - f_m))
l_delta=$((l_l - f_l))
v_delta=$((l_v - f_v))

# per minute/hour rates
m_per_min=$(awk -v d="$m_delta" -v t="$dt" 'BEGIN{printf "%.2f", (d*60)/t}')
l_per_min=$(awk -v d="$l_delta" -v t="$dt" 'BEGIN{printf "%.2f", (d*60)/t}')
v_per_min=$(awk -v d="$v_delta" -v t="$dt" 'BEGIN{printf "%.2f", (d*60)/t}')

m_per_hour=$(awk -v d="$m_delta" -v t="$dt" 'BEGIN{printf "%.2f", (d*3600)/t}')
l_per_hour=$(awk -v d="$l_delta" -v t="$dt" 'BEGIN{printf "%.2f", (d*3600)/t}')
v_per_hour=$(awk -v d="$v_delta" -v t="$dt" 'BEGIN{printf "%.2f", (d*3600)/t}')

cat <<OUT
Window: $f_ts -> $l_ts  (dt=${dt}s, samples=${#lines[@]})
Molts: $f_m -> $l_m  (Δ $m_delta)  rate: ${m_per_min}/min, ${m_per_hour}/hour
Likes: $f_l -> $l_l  (Δ $l_delta)  rate: ${l_per_min}/min, ${l_per_hour}/hour
Views: $f_v -> $l_v  (Δ $v_delta)  rate: ${v_per_min}/min, ${v_per_hour}/hour
OUT
