#!/usr/bin/env bash
set -euo pipefail
umask 077
runtime=/workspace/muggzone-runtime
source_dir=/workspace/muggzone-source
mkdir -p "$runtime" /workspace/muggzone-data
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends xvfb openbox x11vnc novnc websockify dbus-x11 curl ca-certificates xz-utils git procps
cd "$runtime"
node_archive=node-v24.21.0-linux-x64.tar.xz
if [[ ! -x "$runtime/node/bin/node" ]]; then
  curl --fail --location --retry 2 -o SHASUMS256.txt https://nodejs.org/dist/v24.21.0/SHASUMS256.txt
  curl --fail --location --retry 2 -o "$node_archive" "https://nodejs.org/dist/v24.21.0/$node_archive"
  awk -v name="$node_archive" '$2 == name' SHASUMS256.txt | sha256sum --check --strict
  mkdir -p node
  tar --no-same-owner -xJf "$node_archive" --strip-components=1 -C node
  rm "$node_archive"
fi
export PATH="$runtime/node/bin:$runtime/bin:$PATH"
if [[ ! -d "$source_dir/.git" ]]; then
  git init "$source_dir"
  git -C "$source_dir" remote add origin https://github.com/madvillain006/The-Luke-Project.git
fi
revision="${MUGGZONE_REVISION:?Set MUGGZONE_REVISION to the reviewed commit SHA}"
git -C "$source_dir" fetch --depth=1 origin "$revision"
git -C "$source_dir" checkout --detach FETCH_HEAD
cd "$source_dir/deploy/muggzone"
npm install --omit=dev --ignore-scripts
export PLAYWRIGHT_BROWSERS_PATH="$runtime/browsers"
npx playwright install --with-deps firefox
/usr/local/bin/python -m pip install 'jupyter-server-proxy==4.6.0'
id trader >/dev/null 2>&1 || useradd --create-home --shell /bin/bash trader
mkdir -p /workspace/muggzone-data/firefox-profile /workspace/muggzone-data/observer
# RunPod's encrypted /workspace volume does not implement POSIX ownership/modes.
# Do not depend on chown/chmod for isolation; use the authenticated private gateway.
node --test "$source_dir"/tests/muggzone*.node.test.js > "$runtime/test-results.txt" 2>&1
node "$source_dir/scripts/muggzone-replay.js" > "$runtime/replay-result.json"
setsid runuser -u trader -- env PATH="$PATH" DISPLAY=:99 MUGGZONE_DATA_ROOT=/workspace/muggzone-data \
  bash "$source_dir/deploy/muggzone/start-firefox-desktop.sh" > "$runtime/desktop.log" 2>&1 < /dev/null &
printf '%s\n' 'SETUP_INSTALLED: preserve Jupyter authentication with restart-jupyter-proxy.py before opening noVNC.'
