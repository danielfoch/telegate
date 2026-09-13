#!/bin/zsh
# Telegate same-Mac test relay.
#
# Runs the relay on this Mac behind a temporary Cloudflare quick tunnel so a phone
# on any network can reach it over HTTPS, and keeps both alive with launchd.
# This is for development and personal testing: quick tunnels get a new random
# hostname every time they start. For everyday use, host the relay permanently
# (docs/SELF-HOST.md).
#
#   scripts/local-relay.sh install     start now and keep running across logins/reboots
#   scripts/local-relay.sh status      current address, health, and process state
#   scripts/local-relay.sh url         print only the current HTTPS address
#   scripts/local-relay.sh restart     restart the relay and tunnel (the address changes)
#   scripts/local-relay.sh uninstall   stop and remove the launchd job
#   scripts/local-relay.sh run         foreground mode used by launchd
#
# Requirements: cloudflared (brew install cloudflared), Node 24+, and
# secrets/relay-preview.env with NODE_ENV, DATABASE_PATH and CALLBACK_SIGNING_KEY
# (PUBLIC_URL, HOST and PORT are set by this script). An optional
# secrets/grokbot.env enables the Grok Bot adapter.
set -euo pipefail

ROOT="${0:A:h:h}"
LABEL="app.telegate.local-relay"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
OUT="$ROOT/outputs"
URL_FILE="$OUT/relay-url.txt"
TUNNEL_LOG="$OUT/local-relay-tunnel.log"
STACK_LOG="$OUT/local-relay.log"
ENV_FILE="$ROOT/secrets/relay-preview.env"
GROK_ENV="$ROOT/secrets/grokbot.env"
PORT="${TELEGATE_PORT:-8790}"
PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
typeset -g TUNNEL_PID="" RELAY_PID=""

mkdir -p "$OUT"

log() { print "$(date '+%F %T') $*"; }
current_url() { [[ -f "$URL_FILE" ]] && cat "$URL_FILE" || true; }
stop_children() {
  rm -f "$URL_FILE"
  [[ -n "$RELAY_PID" ]] && kill "$RELAY_PID" 2>/dev/null || true
  [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
}

run_stack() {
  [[ -f "$ENV_FILE" ]] || { print -u2 "Missing $ENV_FILE"; exit 1; }
  command -v cloudflared >/dev/null || { print -u2 "cloudflared is not installed: brew install cloudflared"; exit 1; }
  command -v node >/dev/null || { print -u2 "Node 24+ is not installed."; exit 1; }
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    print -u2 "Port $PORT is already in use. Stop the other relay first (scripts/local-relay.sh status)."
    exit 1
  fi
  rm -f "$URL_FILE"
  trap stop_children EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  # Keep every run's tunnel output; the URL search only looks at this run's lines.
  local marker="=== run $(date '+%F %T') ==="
  print -- "$marker" >> "$TUNNEL_LOG"
  local start_line; start_line=$(grep -nF -- "$marker" "$TUNNEL_LOG" | tail -1 | cut -d: -f1)
  cloudflared tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate >> "$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  local url=""
  for _ in {1..90}; do
    url=$(tail -n "+$start_line" "$TUNNEL_LOG" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1 || true)
    [[ -n "$url" ]] && break
    kill -0 "$TUNNEL_PID" 2>/dev/null || { print -u2 "cloudflared exited early; see $TUNNEL_LOG"; exit 1; }
    sleep 1
  done
  [[ -n "$url" ]] || { print -u2 "No tunnel address appeared within 90s; see $TUNNEL_LOG"; exit 1; }
  log "tunnel address $url"
  local env_args=(--env-file="$ENV_FILE")
  [[ -f "$GROK_ENV" ]] && env_args+=(--env-file="$GROK_ENV")
  # Values already in the environment win over --env-file, so the live address is authoritative.
  PUBLIC_URL="$url" HOST=127.0.0.1 PORT="$PORT" node "${env_args[@]}" "$ROOT/relay/server.mjs" &
  RELAY_PID=$!
  # Publish the address only once the relay answers through the tunnel end to end.
  for _ in {1..45}; do
    kill -0 "$RELAY_PID" 2>/dev/null || { log "relay exited before becoming healthy"; exit 1; }
    kill -0 "$TUNNEL_PID" 2>/dev/null || { log "tunnel exited before becoming healthy"; exit 1; }
    if curl -fsS -m 5 "$url/health" 2>/dev/null | grep -q '"status":"ok"'; then break; fi
    sleep 2
  done
  if curl -fsS -m 5 "$url/health" 2>/dev/null | grep -q '"status":"ok"'; then
    print -r -- "$url" > "$URL_FILE"
    log "relay reachable at $url"
  else
    log "relay did not become healthy through the tunnel; launchd will retry"
    exit 1
  fi
  # If either side dies, exit so launchd restarts the pair together with a fresh address.
  while kill -0 "$TUNNEL_PID" 2>/dev/null && kill -0 "$RELAY_PID" 2>/dev/null; do sleep 5; done
  local relay_state="running" tunnel_state="running"
  kill -0 "$RELAY_PID" 2>/dev/null || relay_state="exited"
  kill -0 "$TUNNEL_PID" 2>/dev/null || tunnel_state="exited"
  log "stopping: relay $relay_state, tunnel $tunnel_state (see $TUNNEL_LOG); launchd will restart with a new address"
}

write_plist() {
  mkdir -p "${PLIST:h}"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$ROOT/scripts/local-relay.sh</string>
    <string>run</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$STACK_LOG</string>
  <key>StandardErrorPath</key><string>$STACK_LOG</string>
</dict>
</plist>
PLIST
}

wait_for_url() { for _ in {1..120}; do [[ -s "$URL_FILE" ]] && return 0; sleep 1; done; return 1; }

status() {
  local url; url=$(current_url)
  if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then print "launchd job: installed ($LABEL)"; else print "launchd job: not installed"; fi
  if [[ -n "$url" ]]; then
    print "address:      $url"
    local local_health public_health
    local_health=$(curl -s -m 5 "http://127.0.0.1:$PORT/health" || true)
    public_health=$(curl -s -m 12 "$url/health" || true)
    print "local relay:  ${local_health:-unreachable}"
    print "via tunnel:   ${public_health:-unreachable}"
  else
    print "address:      (starting, or not running)"
  fi
  print "logs:         $STACK_LOG"
}

case "${1:-status}" in
  run) run_stack ;;
  install)
    write_plist
    launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
    rm -f "$URL_FILE"
    launchctl bootstrap "gui/$UID" "$PLIST"
    wait_for_url || true
    status ;;
  uninstall)
    launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
    rm -f "$PLIST"
    rm -f "$URL_FILE"
    print "Stopped and removed $LABEL." ;;
  restart)
    rm -f "$URL_FILE"
    launchctl kickstart -k "gui/$UID/$LABEL"
    wait_for_url || true
    status ;;
  url) current_url ;;
  status) status ;;
  *) print -u2 "Usage: $0 {install|status|url|restart|uninstall|run}"; exit 2 ;;
esac
