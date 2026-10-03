#!/usr/bin/env bash
set -euo pipefail
umask 077
data_root="${MUGGZONE_DATA_ROOT:-/workspace/muggzone-data}"
display="${DISPLAY:-:99}"
Xvfb "$display" -screen 0 1600x900x24 -nolisten tcp &
xvfb_pid=$!
for attempt in {1..40}; do
  [[ -S /tmp/.X11-unix/X${display#:} ]] && break
  kill -0 "$xvfb_pid"
  sleep 0.25
done
openbox &
wm_pid=$!
x11vnc -display "$display" -localhost -nopw -forever -shared -rfbport 5900 &
vnc_pid=$!
websockify --web=/usr/share/novnc 127.0.0.1:6080 127.0.0.1:5900 &
web_pid=$!
# Use Chromium's sandbox. If this container cannot support it, fix the runtime; do not
# silently downgrade the browser that holds the manually authenticated Discord session.
chromium --user-data-dir="$data_root/chrome-profile" \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 \
  --disable-dev-shm-usage --no-first-run --disable-features=Translate \
  "${MUGGZONE_CHANNEL_URL:-https://discord.com/login}" &
chrome_pid=$!
trap 'kill "$chrome_pid" "$web_pid" "$vnc_pid" "$wm_pid" "$xvfb_pid" 2>/dev/null || true' EXIT INT TERM
wait -n "$chrome_pid" "$web_pid" "$vnc_pid" "$wm_pid" "$xvfb_pid"
