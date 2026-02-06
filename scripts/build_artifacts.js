#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const rawDir = path.join(repo, 'data', 'raw');
const hourDir = path.join(repo, 'data', 'hourly');
const outDir = path.join(repo, 'data');

function today() {
  return new Date().toISOString().slice(0,10);
}

function parseRawLine(line) {
  const m = line.match(/^(\S+)\s+molts=(\d+)\s+likes=(\d+)\s+views=(\d+)/);
  if (!m) return null;
  const ts = m[1];
  const epoch = Date.parse(ts);
  if (Number.isNaN(epoch)) return null;
  return { ts, epoch: Math.floor(epoch/1000), molts:+m[2], likes:+m[3], views:+m[4] };
}

function gapReport(rows, gapSec=120) {
  const gaps = [];
  for (let i=1;i<rows.length;i++) {
    const dt = rows[i].epoch - rows[i-1].epoch;
    if (dt >= gapSec) {
      gaps.push({ from: rows[i-1].ts, to: rows[i].ts, gap_sec: dt });
    }
  }
  return gaps;
}

function writeCSV(hours, outPath) {
  const header = ['hour','samples','delta_molts','delta_likes','delta_views','rate_molts_per_min','rate_likes_per_min','rate_views_per_min','rate_molts_per_hour','rate_likes_per_hour','rate_views_per_hour'];
  const lines = [header.join(',')];
  for (const h of hours) {
    lines.push([
      h.hour,
      h.samples,
      h.delta.molts,
      h.delta.likes,
      h.delta.views,
      h.rate_per_min.molts,
      h.rate_per_min.likes,
      h.rate_per_min.views,
      h.rate_per_hour.molts,
      h.rate_per_hour.likes,
      h.rate_per_hour.views
    ].join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'));
}

function writeSVGLine(hours, outPath) {
  // Simple SVG line chart of hourly moltx per-hour rate
  const width = 900, height = 260, pad = 30;
  const values = hours.map(h => h.rate_per_hour.molts);
  if (values.length === 0) {
    fs.writeFileSync(outPath, '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260"></svg>');
    return;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const xStep = (width - 2*pad) / Math.max(1, values.length-1);
  const points = values.map((v,i) => {
    const x = pad + i*xStep;
    const y = height - pad - ((v - min) / span) * (height - 2*pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0e1116"/>
  <g stroke="#2b313b" stroke-width="1">
    <line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"/>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height-pad}"/>
  </g>
  <polyline fill="none" stroke="#e6edf3" stroke-width="2" points="${points}"/>
  <text x="${pad}" y="${pad-8}" fill="#9aa6b2" font-size="12">Hourly Molts rate (per hour)</text>
  <text x="${pad}" y="${height-8}" fill="#9aa6b2" font-size="11">min ${min.toFixed(2)} · max ${max.toFixed(2)}</text>
</svg>`;
  fs.writeFileSync(outPath, svg);
}

function anomalies(hours) {
  // Flag hours with very low variance in per-minute rate or suspicious flatlines
  const flags = [];
  for (const h of hours) {
    const rate = h.rate_per_min.molts;
    if (rate === 0) {
      flags.push({hour: h.hour, reason: 'zero_rate'});
    }
    if (h.samples >= 5 && rate > 0 && h.rate_per_hour.molts > 500 && h.rate_per_min.molts < 5) {
      flags.push({hour: h.hour, reason: 'low_rate_high_hour'});
    }
  }
  return flags;
}

const day = today();
const rawPath = path.join(rawDir, `${day}.log`);
const hourPath = path.join(hourDir, `${day}.json`);
if (!fs.existsSync(rawPath) || !fs.existsSync(hourPath)) process.exit(0);

const rawLines = fs.readFileSync(rawPath,'utf8').trim().split('\n').filter(Boolean);
const rows = rawLines.map(parseRawLine).filter(Boolean);
const hourJson = JSON.parse(fs.readFileSync(hourPath,'utf8'));
const hours = hourJson.hours || [];

writeCSV(hours, path.join(outDir, `hourly_${day}.csv`));
writeSVGLine(hours, path.join(outDir, `hourly_${day}.svg`));
const gaps = gapReport(rows);
fs.writeFileSync(path.join(outDir, `gaps_${day}.json`), JSON.stringify({date: day, gaps}, null, 2));
fs.writeFileSync(path.join(outDir, `anomalies_${day}.json`), JSON.stringify({date: day, flags: anomalies(hours)}, null, 2));
