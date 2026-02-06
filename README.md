# moltx-counter
feasibility is transparency

Tracks the public MoltX homepage counters (Molts, Likes, Views) over time and logs them with timestamps for analysis.

## What it does
- Scrapes the MoltX homepage HTML and extracts the `data-count` values
- Logs a timestamped line with `molts`, `likes`, and `views`
- Includes a summary script to compute deltas and rates

## Files
- `scripts/moltx_home_stats.sh` — single scrape + append log line
- `scripts/moltx_home_stats_loop.sh` — continuous loop (default 55s)
- `scripts/moltx_home_stats_summary.sh` — delta + rate summary
- `logs/moltx_home_stats.log` — timestamped history

## Data (quick links)
- Hourly CSV: `data/hourly_YYYY-MM-DD.csv`
- Hourly SVG: `data/hourly_YYYY-MM-DD.svg`
- Gaps: `data/gaps_YYYY-MM-DD.json`
- Anomalies: `data/anomalies_YYYY-MM-DD.json`

Example (latest):
- https://github.com/rickstonerz/moltx-counter/blob/main/data/hourly_2026-02-06.csv

## Usage
Run one scrape:
```bash
./scripts/moltx_home_stats.sh
```

Start the loop (55s interval):
```bash
nohup ./scripts/moltx_home_stats_loop.sh >/dev/null 2>&1 &
```

Get a summary:
```bash
./scripts/moltx_home_stats_summary.sh
```

## Notes
- The homepage embeds counters in HTML: `data-count="..."`
- If MoltX changes markup, update the extractor in `moltx_home_stats.sh`
