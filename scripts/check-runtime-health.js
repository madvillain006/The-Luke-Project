#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');

function parseArgs(argv = process.argv.slice(2)) {
  const out = { port: Number(process.env.PORT || 3000) };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--port') out.port = Number(argv[index + 1]);
  }
  return out;
}

function parseNetstat(output, port) {
  const re = new RegExp(`\\s(?:127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::\\]|::1):${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i');
  for (const line of String(output || '').split(/\r?\n/)) {
    const match = line.match(re);
    if (match) return Number(match[1]);
  }
  return null;
}

function getListeningPid(port, execFile = execFileSync) {
  try {
    const output = execFile('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    return parseNetstat(output, port);
  } catch {
    return null;
  }
}

function parseWmicList(output) {
  const result = {};
  for (const line of String(output || '').split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

function getProcessInfo(pid, execFile = execFileSync) {
  if (!pid) return null;
  try {
    const output = execFile('wmic', ['process', 'where', `processid=${pid}`, 'get', 'ProcessId,CommandLine,ExecutablePath', '/value'], { encoding: 'utf8' });
    const parsed = parseWmicList(output);
    return {
      pid,
      command_line: parsed.CommandLine || null,
      executable_path: parsed.ExecutablePath || null,
    };
  } catch {
    return { pid, command_line: null, executable_path: null };
  }
}

async function fetchHealth(port, fetchFn = fetch) {
  for (const route of ['/api/health', '/health', '/']) {
    try {
      const response = await fetchFn(`http://127.0.0.1:${port}${route}`, { method: 'GET', signal: AbortSignal.timeout(2500) });
      const text = await response.text();
      let body = null;
      try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
      if (response.ok) return { ok: true, route, status: response.status, body };
      return { ok: false, route, status: response.status, body };
    } catch {
      // try next route
    }
  }
  return { ok: false, route: null, status: null, body: null, error: 'no_http_response' };
}

function looksLikeLuke(processInfo, health) {
  const command = String(processInfo?.command_line || '').toLowerCase();
  return health?.body?.app === 'Luke' || (command.includes('node') && command.includes('index.js'));
}

function isCurrentLuke(health) {
  return health?.ok === true && health?.body?.app === 'Luke';
}

async function checkRuntimeHealth(options = {}) {
  const port = Number(options.port || process.env.PORT || 3000);
  const pid = options.pid !== undefined ? options.pid : getListeningPid(port, options.execFile);
  const processInfo = pid ? getProcessInfo(pid, options.execFile) : null;
  const health = await fetchHealth(port, options.fetchFn || fetch);
  const luke = looksLikeLuke(processInfo, health);
  const currentLuke = isCurrentLuke(health);
  let status = 'free';
  if (currentLuke) {
    status = 'current Luke';
  } else if (pid) {
    status = luke ? 'stale Luke' : 'occupied unknown';
  } else if (health?.ok) {
    status = 'occupied unknown';
  }
  return {
    ok: currentLuke || (!pid && !health?.ok),
    app: 'Luke',
    port,
    status,
    pid,
    process: processInfo,
    http: health,
    appears_to_be_luke: luke,
    is_current_luke: currentLuke,
    safe_to_stop_with_force: Boolean(pid && luke),
    checked_at: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs();
  const result = await checkRuntimeHealth(args);
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
  parseArgs,
  parseNetstat,
  parseWmicList,
  getListeningPid,
  getProcessInfo,
  fetchHealth,
  looksLikeLuke,
  isCurrentLuke,
  checkRuntimeHealth,
};
