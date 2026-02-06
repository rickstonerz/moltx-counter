#!/usr/bin/env node
const fs = require('fs');

const logPath = process.argv[2] || '/home/rick/moltx/logs/moltx_home_stats.log';
const outPath = process.argv[3] || './REPORT.md';

function parseLine(line) {
  // format: 2026-02-06T03:40:02Z molts=389434 likes=563308 views=43927138
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const ts = parts[0];
  const m = line.match(/molts=(\d+)\s+likes=(\d+)\s+views=(\d+)/);
  if (!m) return null;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return { ts, epoch: Math.floor(t / 1000), molts: +m[1], likes: +m[2], views: +m[3] };
}

function windowStats(rows, seconds) {
  const now = rows[rows.length - 1].epoch;
  const cutoff = now - seconds;
  const win = rows.filter(r => r.epoch >= cutoff);
  if (win.length < 2) return null;
  const first = win[0];
  const last = win[win.length - 1];
  const dt = Math.max(1, last.epoch - first.epoch);
  const dm = last.molts - first.molts;
  const dl = last.likes - first.likes;
  const dv = last.views - first.views;
  const perMin = v => (v * 60 / dt).toFixed(2);
  const perHour = v => (v * 3600 / dt).toFixed(2);
  const perDay = v => (v * 86400 / dt).toFixed(2);
  return {
    window: `${first.ts} → ${last.ts}`,
    dt,
    dm, dl, dv,
    perMin: { m: perMin(dm), l: perMin(dl), v: perMin(dv) },
    perHour: { m: perHour(dm), l: perHour(dl), v: perHour(dv) },
    perDay: { m: perDay(dm), l: perDay(dl), v: perDay(dv) }
  };
}

function totalStats(rows) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const dt = Math.max(1, last.epoch - first.epoch);
  const dm = last.molts - first.molts;
  const dl = last.likes - first.likes;
  const dv = last.views - first.views;
  return { first, last, dt, dm, dl, dv };
}

function hourVariance(rows) {
  // compute per-minute deltas within last 60 minutes
  const now = rows[rows.length - 1].epoch;
  const cutoff = now - 3600;
  const win = rows.filter(r => r.epoch >= cutoff);
  if (win.length < 3) return null;
  const perMin = [];
  for (let i = 1; i < win.length; i++) {
    const dt = Math.max(1, win[i].epoch - win[i-1].epoch);
    const dm = win[i].molts - win[i-1].molts;
    perMin.push(dm * 60 / dt);
  }
  const n = perMin.length;
  const avg = perMin.reduce((a,b)=>a+b,0)/n;
  const min = Math.min(...perMin);
  const max = Math.max(...perMin);
  const variance = perMin.reduce((s,v)=>s+Math.pow(v-avg,2),0)/n;
  const std = Math.sqrt(variance);
  return { n, avg: avg.toFixed(2), std: std.toFixed(2), min: min.toFixed(2), max: max.toFixed(2) };
}
if (!fs.existsSync(logPath)) {
  console.error('log not found:', logPath);
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
const rows = lines.map(parseLine).filter(Boolean).sort((a,b)=>a.epoch-b.epoch);
if (rows.length < 2) {
  console.error('not enough data');
  process.exit(1);
}

const latest = rows[rows.length - 1];
const total = totalStats(rows);
const w30m = windowStats(rows, 1800);
const w1h = windowStats(rows, 3600);
const w24h = windowStats(rows, 86400);
const var1h = hourVariance(rows);

function fmtWindow(label, w) {
  if (!w) return `- ${label}: not enough data`;
  return `- ${label} (${w.window})\n  - Δ molts ${w.dm} | ${w.perMin.m}/min ${w.perHour.m}/hour ${w.perDay.m}/day\n  - Δ likes ${w.dl} | ${w.perMin.l}/min ${w.perHour.l}/hour ${w.perDay.l}/day\n  - Δ views ${w.dv} | ${w.perMin.v}/min ${w.perHour.v}/hour ${w.perDay.v}/day`;
}

const report = `# MoltX Counter Report

Generated: ${new Date().toISOString()}

## Latest
- time: ${latest.ts}
- molts: ${latest.molts}
- likes: ${latest.likes}
- views: ${latest.views}

## Windowed Rates
${fmtWindow('Last 30 minutes', w30m)}
${fmtWindow('Last 1 hour', w1h)}
${fmtWindow('Last 24 hours', w24h)}

## 1h Molts Variance (per‑minute)
${var1h ? `- samples: ${var1h.n}
- avg/min: ${var1h.avg}
- std dev: ${var1h.std}
- min: ${var1h.min}
- max: ${var1h.max}` : '- not enough data'}

## Since Start
- start: ${total.first.ts}
- end: ${total.last.ts}
- duration: ${total.dt}s
- Δ molts: ${total.dm}
- Δ likes: ${total.dl}
- Δ views: ${total.dv}

## Samples
- total samples: ${rows.length}
`;

fs.writeFileSync(outPath, report);
