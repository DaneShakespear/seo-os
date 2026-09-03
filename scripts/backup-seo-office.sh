#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${SEO_OFFICE_DATA_DIR:-/home/dane/.local/share/seo-office/data}"
CONFIG_DIR="${SEO_OFFICE_CONFIG_DIR:-/home/dane/.config/seo-office}"
BACKUP_ROOT="${SEO_OFFICE_BACKUP_ROOT:-/home/dane/seo-office-backups/daily}"
CURRENT_LINK="${SEO_OFFICE_CURRENT_LINK:-/home/dane/.local/share/seo-office/current}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"

umask 077
mkdir -p "$DEST"
if [[ -r "$DATA_DIR/index.db" ]]; then
  node "$CURRENT_LINK/scripts/backup-index.mjs" "$DATA_DIR/index.db" "$DEST/index.db"
fi
tar --exclude='./index.db' --exclude='./index.db-wal' --exclude='./index.db-shm' \
  -C "$DATA_DIR" -czf "$DEST/data.tgz" .
tar -C "$CONFIG_DIR" -czf "$DEST/config.tgz" .
sha256sum "$DEST"/* > "$DEST/SHA256SUMS"
sha256sum -c "$DEST/SHA256SUMS"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +30 -print -exec rm -rf -- {} +
