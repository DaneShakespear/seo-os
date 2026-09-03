#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SEO_OFFICE_SOURCE_DIR:-/home/dane/seo-office-source}"
RELEASE_ROOT="${SEO_OFFICE_RELEASE_ROOT:-/home/dane/.local/share/seo-office/releases}"
CURRENT_LINK="${SEO_OFFICE_CURRENT_LINK:-/home/dane/.local/share/seo-office/current}"
STATE_DIR="${SEO_OFFICE_STATE_DIR:-/home/dane/.local/state/seo-office}"
LOCK_FILE="$STATE_DIR/update.lock"
STATUS_FILE="$STATE_DIR/update-status.json"

mkdir -p "$RELEASE_ROOT" "$STATE_DIR" /home/dane/.cache
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  exit 0
fi

write_status() {
  local state="$1"
  local message="$2"
  local candidate="${3:-}"
  jq -n \
    --arg state "$state" \
    --arg message "$message" \
    --arg candidate "$candidate" \
    --arg checked_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{state:$state,message:$message,candidate:$candidate,checked_at:$checked_at}' \
    > "$STATUS_FILE.tmp"
  mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

cd "$SOURCE_DIR"
git fetch origin main --tags --prune
latest_tag="$(git for-each-ref --sort=-version:refname --format='%(refname:short)' refs/tags | head -1)"
upstream_main="$(git rev-parse origin/main)"

if [[ -z "$latest_tag" ]]; then
  write_status \
    "no_release_channel" \
    "Upstream has no published tag. Official main is monitored but not auto-promoted." \
    "$upstream_main"
  exit 0
fi

candidate="$(git rev-parse "$latest_tag^{commit}")"
deployed_upstream="$(readlink -f "$CURRENT_LINK" 2>/dev/null | xargs -r -I{} sh -c 'test -r "$1/.upstream-sha" && tr -d "\n" < "$1/.upstream-sha"' sh {} || true)"
if [[ "$candidate" == "$deployed_upstream" ]]; then
  write_status "current" "Latest tagged release is already deployed." "$latest_tag@$candidate"
  exit 0
fi

worktree="$(mktemp -d /home/dane/.cache/seo-office-update.XXXXXX)"
cleanup() {
  git -C "$SOURCE_DIR" worktree remove --force "$worktree" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git worktree add --detach "$worktree" production
if ! git -C "$worktree" merge --no-edit "$candidate"; then
  git -C "$worktree" merge --abort >/dev/null 2>&1 || true
  write_status "merge_blocked" "Tagged release conflicts with the production reliability patch." "$latest_tag@$candidate"
  exit 1
fi

cd "$worktree"
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
SEO_OFFICE_PYTHON="${SEO_OFFICE_PYTHON:-python3}" corepack pnpm test
corepack pnpm build

if [[ -x "$SOURCE_DIR/scripts/backup-seo-office.sh" ]]; then
  "$SOURCE_DIR/scripts/backup-seo-office.sh"
fi

release_id="$(git rev-parse --short=12 HEAD)"
release_dir="$RELEASE_ROOT/$release_id"
mkdir -p "$release_dir"
rsync -a --delete \
  --exclude .git \
  --exclude .env.local \
  --exclude .seo-office \
  "$worktree/" "$release_dir/"
printf '%s\n' "$candidate" > "$release_dir/.upstream-sha"
printf '%s\n' "$latest_tag" > "$release_dir/.upstream-release"
printf '%s\n' "$release_id" > "$release_dir/.release-id"
ln -sfn "$release_dir" "$CURRENT_LINK.next"
mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
write_status "promoted" "Tagged release passed all gates and was promoted." "$latest_tag@$candidate"
