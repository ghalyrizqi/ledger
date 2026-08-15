#!/usr/bin/env bash
# Auto-deploy: pull origin/main and rebuild+reload when GitHub moves forward.
# Safe by design: only FAST-FORWARDS a CLEAN working tree; if the VPS has local
# edits or has diverged, it skips and (for dirty tree) pings Telegram instead of
# clobbering anything. Builds first; only reloads if the build succeeds, so a bad
# push can't take the live app down. Run from cron every few minutes.
set -uo pipefail
export PATH="/home/ghaly/.local/bin:/usr/bin:/bin:/usr/local/bin"
export HOME=/home/ghaly
REPO=/home/ghaly/ledger
STATE=/home/ghaly/.ledger
LOG="$STATE/autodeploy.log"
ENV_FILE="$REPO/backend/.env"
mkdir -p "$STATE"
cd "$REPO" || exit 1

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
notify() {
  set -a; . "$ENV_FILE" 2>/dev/null || true; set +a
  local chat="${LEDGER_TG_ALLOWED%%:*}"
  [ -n "${LEDGER_TG_TOKEN:-}" ] && [ -n "$chat" ] && \
    curl -s "https://api.telegram.org/bot${LEDGER_TG_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${chat}" --data-urlencode "text=$1" >/dev/null 2>&1 || true
}

# avoid overlapping runs
exec 9>"$STATE/autodeploy.lock"
flock -n 9 || exit 0

git fetch --quiet origin main 2>>"$LOG" || { log "fetch failed"; exit 0; }
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)
BASE=$(git merge-base @ origin/main)

[ "$LOCAL" = "$REMOTE" ] && exit 0                      # already up to date

if [ "$LOCAL" != "$BASE" ]; then
  log "local ahead/diverged — skip (local=$LOCAL remote=$REMOTE)"
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "working tree dirty — skip pull"
  notify "⚠️ ledger auto-deploy dilewati: ada perubahan lokal di server yang belum di-commit."
  exit 0
fi

log "pulling ${LOCAL:0:7} -> ${REMOTE:0:7}"
git pull --ff-only --quiet origin main 2>>"$LOG" || { log "pull failed"; exit 0; }
CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE")

ok=1
if echo "$CHANGED" | grep -q '^backend/'; then
  ( cd backend \
    && { echo "$CHANGED" | grep -q '^backend/package.json' && yarn install --frozen-lockfile >>"$LOG" 2>&1 || true; } \
    && yarn build >>"$LOG" 2>&1 ) || ok=0
fi
if echo "$CHANGED" | grep -q '^frontend/'; then
  ( cd frontend \
    && { echo "$CHANGED" | grep -q '^frontend/package.json' && yarn install --frozen-lockfile >>"$LOG" 2>&1 || true; } \
    && yarn build >>"$LOG" 2>&1 ) || ok=0
fi

SHA=$(git rev-parse --short HEAD)
if [ "$ok" = 1 ]; then
  pm2 reload ledger-backend >>"$LOG" 2>&1
  log "deployed $SHA"
  notify "✅ ledger ke-update ke ${SHA} (auto-deploy)."
else
  log "BUILD FAILED at $SHA — kept running old build"
  notify "❌ ledger auto-deploy: build gagal di ${SHA}, versi lama tetap jalan. Cek autodeploy.log."
fi
