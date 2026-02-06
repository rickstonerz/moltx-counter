#!/usr/bin/env bash
set -euo pipefail

# Paths
RAW_DIR="/home/rick/moltx/_repos/moltx-counter/data/raw"
HOUR_DIR="/home/rick/moltx/_repos/moltx-counter/data/hourly"
LOG_SRC="/home/rick/moltx/logs/moltx_home_stats.log"

mkdir -p "$RAW_DIR" "$HOUR_DIR"

# Today in UTC
DAY=$(date -u +%Y-%m-%d)
RAW_FILE="$RAW_DIR/$DAY.log"
HOUR_FILE="$HOUR_DIR/$DAY.json"

# Append new lines since last rollup using a cursor file
CURSOR="/home/rick/moltx/state/moltx_home_stats.cursor"
LAST_LINE=0
if [[ -f "$CURSOR" ]]; then
  LAST_LINE=$(cat "$CURSOR" 2>/dev/null || echo 0)
fi
TOTAL_LINES=$(wc -l < "$LOG_SRC")
if (( TOTAL_LINES > LAST_LINE )); then
  tail -n +$((LAST_LINE+1)) "$LOG_SRC" >> "$RAW_FILE"
  echo "$TOTAL_LINES" > "$CURSOR"
fi

# Build hourly aggregates from RAW_FILE
node - "$RAW_FILE" "$HOUR_FILE" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const out = process.argv[3];
if (!fs.existsSync(path)) process.exit(0);
const lines = fs.readFileSync(path,'utf8').trim().split('\n').filter(Boolean);
function parse(line){
  const m = line.match(/^([^ ]+)\s+molts=(\d+)\s+likes=(\d+)\s+views=(\d+)/);
  if(!m) return null;
  const ts = m[1];
  const epoch = Date.parse(ts);
  if (Number.isNaN(epoch)) return null;
  return {ts, epoch: Math.floor(epoch/1000), molts:+m[2], likes:+m[3], views:+m[4]};
}
const rows = lines.map(parse).filter(Boolean).sort((a,b)=>a.epoch-b.epoch);
if (rows.length < 2) { fs.writeFileSync(out, JSON.stringify({date: path.split('/').pop().replace('.log',''), hours: []}, null, 2)); process.exit(0);} 

const byHour = new Map();
for (const r of rows) {
  const hour = new Date(r.epoch*1000).toISOString().slice(0,13)+':00Z';
  if (!byHour.has(hour)) byHour.set(hour, []);
  byHour.get(hour).push(r);
}

const hours = [];
for (const [hour, arr] of [...byHour.entries()].sort()) {
  if (arr.length < 2) continue;
  const first = arr[0];
  const last = arr[arr.length-1];
  const dt = Math.max(1, last.epoch - first.epoch);
  const dm = last.molts - first.molts;
  const dl = last.likes - first.likes;
  const dv = last.views - first.views;
  hours.push({
    hour,
    samples: arr.length,
    delta: {molts: dm, likes: dl, views: dv},
    rate_per_min: {molts: +(dm*60/dt).toFixed(2), likes: +(dl*60/dt).toFixed(2), views: +(dv*60/dt).toFixed(2)},
    rate_per_hour: {molts: +(dm*3600/dt).toFixed(2), likes: +(dl*3600/dt).toFixed(2), views: +(dv*3600/dt).toFixed(2)}
  });
}
const outObj = {date: path.split('/').pop().replace('.log',''), hours};
fs.writeFileSync(out, JSON.stringify(outObj, null, 2));
NODE

# Daily checksum (only when day rolls over; here we keep updated hash)
sha256sum "$RAW_FILE" > "$RAW_FILE.sha256"
