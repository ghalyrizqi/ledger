#!/usr/bin/env bash
# Public link for the ledger via a Cloudflare quick tunnel (free, no account).
# The app is login-gated (Basic Auth) and bound to 127.0.0.1; this makes only an
# OUTBOUND connection — no port is published on the box. The trycloudflare URL
# changes each run, so on startup we post the current link to the owner's
# Telegram chat and also write it to ~/.ledger/public_url.
set -uo pipefail

CF=/home/ghaly/.local/bin/cloudflared
ENV_FILE=/home/ghaly/ledger/backend/.env
STATE=/home/ghaly/.ledger
LOG="$STATE/cloudflared.log"
URLFILE="$STATE/public_url"
mkdir -p "$STATE"
: > "$LOG"

# load LEDGER_TG_TOKEN + LEDGER_TG_ALLOWED for the notification
set -a; . "$ENV_FILE" 2>/dev/null || true; set +a
CHAT_ID="${LEDGER_TG_ALLOWED%%:*}"   # first "chatid:userid" → chatid

# start cloudflared; it stays in the foreground of this backgrounded process
"$CF" tunnel --no-autoupdate --url http://localhost:3001 >> "$LOG" 2>&1 &
CFPID=$!

# wait for the assigned public URL to show up in the log
URL=""
for i in $(seq 1 40); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  kill -0 "$CFPID" 2>/dev/null || break
  sleep 1
done

if [ -n "$URL" ]; then
  echo "$URL" > "$URLFILE"
  echo "public url: $URL"
  if [ -n "${LEDGER_TG_TOKEN:-}" ] && [ -n "$CHAT_ID" ]; then
    curl -s "https://api.telegram.org/bot${LEDGER_TG_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${CHAT_ID}" \
      --data-urlencode "text=🔗 Link ledger (baru):
${URL}

Login pakai email + password kamu." >/dev/null || true
  fi
else
  echo "WARN: could not detect tunnel URL; see $LOG"
fi

# keep this process alive as long as cloudflared runs; if it dies, exit so pm2
# restarts us (which mints a fresh URL and re-notifies).
wait "$CFPID"
