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
# Keep the Firefox sandbox enabled. Chromium requires unavailable namespace support
# in the current RunPod container; never use --no-sandbox as a fallback.
unset MOZ_DISABLE_CONTENT_SANDBOX MOZ_DISABLE_GMP_SANDBOX MOZ_DISABLE_RDD_SANDBOX MOZ_DISABLE_SOCKET_PROCESS_SANDBOX
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/workspace/muggzone-runtime/browsers}"
export PATH="/workspace/muggzone-runtime/node/bin:$PATH"
node "$(dirname "$0")/../../scripts/muggzone-desktop.js" &
chrome_pid=$!
trap 'kill "$chrome_pid" "$web_pid" "$vnc_pid" "$wm_pid" "$xvfb_pid" 2>/dev/null || true' EXIT INT TERM
wait -n "$chrome_pid" "$web_pid" "$vnc_pid" "$wm_pid" "$xvfb_pid"
