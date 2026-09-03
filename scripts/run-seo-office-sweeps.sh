#!/usr/bin/env bash
set -euo pipefail

API_BASE="http://127.0.0.1:3100"
LOCK_FILE="/tmp/seo-office-sweeps.lock"
DATA_DIR="${SEO_OFFICE_DATA_DIR:-/var/lib/seo-office}"
SCHEDULE_CONFIG="${SEO_OFFICE_SCHEDULE_CONFIG:-/etc/seo-office/scheduled-clients.json}"
LOG_DIR="${SEO_OFFICE_LOG_DIR:-/var/log/seo-office}"
LOG_FILE="$LOG_DIR/scheduled-sweeps.log"

mkdir -p "$LOG_DIR"

# Keep only one scheduler invocation at a time
if ! exec 200>"$LOCK_FILE"; then
  echo "Failed to open lock file: $LOCK_FILE" >> "$LOG_FILE"
  exit 1
fi

if ! flock -n 200; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) skip (already running)" >> "$LOG_FILE"
  exit 0
fi

if [[ ! -r "$SCHEDULE_CONFIG" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) blocked: missing schedule config $SCHEDULE_CONFIG" >> "$LOG_FILE"
  exit 1
fi

mapfile -t SLUGS < <(jq -r '.clients[] | select(.enabled == true) | .slug' "$SCHEDULE_CONFIG")
for slug in "${SLUGS[@]}"; do
  review="$DATA_DIR/vaults/$slug/wiki/meta/brain-review.json"
  if [[ ! -r "$review" ]]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $slug blocked: semantic review unavailable" >> "$LOG_FILE"
    continue
  fi
  high="$(jq -r '.high_severity // 999' "$review")"
  medium="$(jq -r '.medium_severity // 999' "$review")"
  if [[ "$high" != "0" || "$medium" != "0" ]]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $slug blocked: semantic review has $high high and $medium medium findings" >> "$LOG_FILE"
    continue
  fi
  curl --fail --silent --show-error -X POST "$API_BASE/api/clients/$slug/sweeps" >> "$LOG_FILE" 2>&1
  echo >> "$LOG_FILE"
done
