#!/usr/bin/env bash
set -euo pipefail

SLUGS=(
  april-wray
  luxury-limousines
  kre8-media
  tsb-podiatry
)
API_BASE="http://127.0.0.1:3100"
LOCK_FILE="/tmp/seo-office-sweeps.lock"
LOG_FILE="/home/dane/seo-office/logs/cron-sweeps.log"

mkdir -p /home/dane/seo-office/logs

# Keep only one scheduler invocation at a time
if ! exec 200>"$LOCK_FILE"; then
  echo "Failed to open lock file: $LOCK_FILE" >> "$LOG_FILE"
  exit 1
fi

if ! flock -n 200; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) skip (already running)" >> "$LOG_FILE"
  exit 0
fi

for slug in "${SLUGS[@]}"; do
  curl -sS -X POST "$API_BASE/api/clients/$slug/sweeps" >> "$LOG_FILE" 2>&1
  echo >> "$LOG_FILE"
done
