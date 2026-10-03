#!/usr/bin/env bash
set -euo pipefail
umask 077
config="${1:-${MUGGZONE_DATA_ROOT:-/workspace/muggzone-data}/observer/config.json}"
if [[ ! -f "$config" ]]; then
  echo "Configure the exact channel and author IDs before starting: $config" >&2
  exit 1
fi
observer_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
data_dir="$(node -e 'const fs=require("node:fs"); const {validateConfig}=require(process.argv[2]); console.log(validateConfig(JSON.parse(fs.readFileSync(process.argv[1], "utf8"))).data_dir)' "$config" "$observer_root/lib/muggzone/observer.js")"
mkdir -p "$data_dir"
chmod 700 "$data_dir"
# nohup keeps the cloud observer alive when the user's SSH/desktop tunnel disconnects.
# The CLI's exclusive lock prevents simultaneous observers for this data directory.
nohup node "$observer_root/scripts/muggzone-observe.js" --config "$config" \
  >> "$data_dir/observer-run.log" 2>&1 < /dev/null &
printf 'Observer launch PID %s; inspect %s/observer-status.json for readiness.\n' "$!" "$data_dir"
