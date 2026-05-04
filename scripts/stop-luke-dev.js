#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const { parseArgs, checkRuntimeHealth } = require('./check-runtime-health');

function hasForce(argv = process.argv.slice(2)) {
  return argv.includes('--force');
}

function stopPid(pid, execFile = execFileSync) {
  execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' });
}

async function stopLukeDev(options = {}) {
  const port = Number(options.port || process.env.PORT || 3000);
  const force = options.force === true;
  const health = await checkRuntimeHealth({ port, execFile: options.execFile, fetchFn: options.fetchFn });
  const result = {
    ok: true,
    port,
    force,
    runtime: health,
    action: 'none',
    stopped: false,
    message: null,
  };

  if (!health.pid) {
    result.message = 'port is free; nothing to stop';
    return result;
  }
  if (!health.safe_to_stop_with_force) {
    result.ok = false;
    result.action = 'refused';
    result.message = 'process is not safely identifiable as Luke; refusing to stop';
    return result;
  }
  if (!force) {
    result.action = 'would_stop';
    result.message = 'safe Luke process identified; rerun with --force to stop it';
    return result;
  }

  stopPid(health.pid, options.execFile);
  result.action = 'stopped';
  result.stopped = true;
  result.message = `stopped Luke process ${health.pid}`;
  return result;
}

async function main() {
  const args = parseArgs();
  const result = await stopLukeDev({ port: args.port, force: hasForce() });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  hasForce,
  stopPid,
  stopLukeDev,
};
