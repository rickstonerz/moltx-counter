#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_PATH="${LOG_PATH:-/home/rick/moltx/logs/moltx_home_stats.log}"
REPORT_PATH="$REPO_DIR/REPORT.md"

node "$REPO_DIR/scripts/build_report.js" "$LOG_PATH" "$REPORT_PATH"
node "$REPO_DIR/scripts/build_artifacts.js" || true

cd "$REPO_DIR"
git add REPORT.md data/*.csv data/*.svg data/*.json

if git diff --cached --quiet; then
  exit 0
fi

git commit -m "Update report"
git push origin main
