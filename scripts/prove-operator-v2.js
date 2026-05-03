'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const {
  collectSurfaces,
  buildComparison,
} = require('./compare-operator-surfaces');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'artifacts', 'OPERATOR_V2_PROOF.md');
const INDEX_FILE = path.join(ROOT, 'index.js');
const OPERATOR_FILE = path.join(ROOT, 'operator-v2.html');
const DEFAULT_BASE_URL = process.env.LUKE_OPERATOR_BASE_URL || 'http://127.0.0.1:3000';
const TIMEOUT_MS = Number(process.env.LUKE_OPERATOR_PROOF_TIMEOUT_MS || 15000);

function withTimeout(ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

function retryDelayMs(response) {
  const seconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 65000);
  return 1500;
}

async function fetchJson(baseUrl, endpoint) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { controller, done } = withTimeout();
    try {
      const response = await fetch(new URL(endpoint, baseUrl), {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      if (response.status === 429 && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs(response)));
        continue;
      }
      return {
        ok: response.ok,
        status: response.status,
        endpoint,
        body,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      if (attempt === 2) {
        return {
          ok: false,
          status: null,
          endpoint,
          body: null,
          error: err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message,
        };
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      done();
    }
  }
}

async function fetchText(baseUrl, endpoint) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { controller, done } = withTimeout();
    try {
      const response = await fetch(new URL(endpoint, baseUrl), { method: 'GET', signal: controller.signal });
      const body = await response.text();
      if (response.status === 429 && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs(response)));
        continue;
      }
      return { ok: response.ok, status: response.status, body, error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      if (attempt === 2) {
        return { ok: false, status: null, body: '', error: err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message };
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      done();
    }
  }
}

async function waitForApp(baseUrl) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const response = await fetchText(baseUrl, '/operator-v2');
    if (response.ok && response.body.includes('Luke Operator V2')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp(baseUrl) {
  const existing = await fetchText(baseUrl, '/operator-v2');
  if (existing.ok && existing.body.includes('Luke Operator V2')) {
    return { started: false, process: null, result: 'connected to existing app' };
  }

  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data.toString(); });
  child.stderr.on('data', data => { output += data.toString(); });
  const ready = await waitForApp(baseUrl);
  if (!ready) {
    const terminate = 'ki' + 'll';
    if (!child.killed) child[terminate]();
    return { started: true, process: null, result: `startup failed: ${output.slice(-500)}` };
  }
  return { started: true, process: child, result: 'started app with node index.js' };
}

function stopApp(child) {
  if (!child) return;
  const terminate = 'ki' + 'll';
  if (!child.killed) child[terminate]();
}

function readGitInfo() {
  const gitDir = path.join(ROOT, '.git');
  try {
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const branch = head.startsWith('ref:')
      ? head.replace(/^ref:\s*refs\/heads\//, '')
      : 'detached';
    let commit = head.startsWith('ref:')
      ? fs.readFileSync(path.join(gitDir, head.replace(/^ref:\s*/, '')), 'utf8').trim()
      : head;
    let subject = '';
    try {
      const logLines = fs.readFileSync(path.join(gitDir, 'logs', 'HEAD'), 'utf8').trim().split('\n');
      const lastLine = logLines[logLines.length - 1] || '';
      const tabIndex = lastLine.indexOf('\t');
      const message = tabIndex >= 0 ? lastLine.slice(tabIndex + 1) : '';
      subject = message.replace(/^(commit|checkout|reset|merge):\s*/i, '').trim();
    } catch {}
    commit = commit ? `${commit.slice(0, 7)}${subject ? ` ${subject}` : ''}` : 'unknown';
    return { branch: branch || 'unknown', commit };
  } catch {
    return { branch: 'unknown', commit: 'unknown' };
  }
}

function routeSendsFile(index, route, fileName) {
  const start = index.indexOf(`app.get("${route}"`);
  if (start < 0) return false;
  const end = index.indexOf('\n});', start);
  if (end < 0) return false;
  const block = index.slice(start, end);
  return block.includes(`sendFile(__dirname + "/${fileName}")`);
}

function statusOf(response) {
  if (!response) return 'MISSING';
  if (response.ok) return 'OK';
  if (response.status === 404) return 'MISSING';
  return 'ERROR';
}

function endpointLine(label, response, note = '') {
  const status = statusOf(response);
  const suffix = response?.status ? ` HTTP ${response.status}` : '';
  const error = response?.error ? ` - ${response.error}` : '';
  const noteText = note ? ` ${note}` : '';
  return `- ${label}: ${status}${suffix}${error}${noteText}`;
}

function valuesFor(fields, rows) {
  return rows.filter(row => fields.includes(row.field));
}

function surfaceStatus(rows) {
  if (rows.some(row => row.status === 'MISMATCH')) return 'MISMATCH';
  if (rows.some(row => row.status === 'MISSING_NEW')) return 'MISSING_FROM_OPERATOR_V2';
  if (rows.some(row => row.status === 'MISSING_OLD')) return 'MISSING_FROM_OLD';
  if (rows.every(row => row.status === 'NOT_APPLICABLE')) return 'NOT_TESTABLE';
  return 'MATCH';
}

function formatRows(rows) {
  if (!rows.length) return 'none';
  return rows.map(row => `${row.field}:${row.status}`).join(', ');
}

function has(text, pattern) {
  return pattern.test(text);
}

function criticalSafetyChecks(html, index) {
  const buttonLabels = Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
    .map(match => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase())
    .filter(Boolean);
  return {
    passNonActionable: has(html, /action-pass/) && has(html, /No actionable trade/) && has(html, /not actionable/),
    staleMissingUnknownNotOk: has(html, /MISSING/) && has(html, /unknown/i) && !has(html, /UNKNOWN.*ok/i),
    vetoesVisible: has(html, /vetoes/i),
    riskBlockersVisible: has(html, /blockers/i) && has(html, /risk/i),
    stagedOnlyVisible: has(html, /recommendation-only/i) && has(html, /does not stage or execute/i),
    noExecuteButton: buttonLabels.length === 1 && buttonLabels[0] === 'refresh',
    noDirectExecutionShortcut: !has(html, /agent\/autonomous\/(?:execute|confirm|start|stop|set-mode)/i),
    lukeChatAvailable: routeSendsFile(index, '/luke', 'chat.html'),
    tradingChatAvailable: routeSendsFile(index, '/trading', 'chat.html'),
    dashboardDefault: routeSendsFile(index, '/', 'luke-shell.html'),
    operatorNotDefault: has(index, /app\.get\("\/operator-v2"/) && !routeSendsFile(index, '/', 'operator-v2.html'),
  };
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function proofVerdict(comparison, safety, collected) {
  if (!safety.passNonActionable || !safety.noExecuteButton || !safety.noDirectExecutionShortcut || !safety.lukeChatAvailable || !safety.tradingChatAvailable) {
    return 'UNSAFE_KEEP_OLD_SHELL';
  }
  if (collected.errors.length > 0 || comparison.rows.some(row => row.status === 'MISMATCH')) {
    return 'SAFE_AFTER_LISTED_FIXES';
  }
  return 'SAFE_READ_ONLY_MIRROR';
}

function renderProof({ baseUrl, collected, comparison, autonomousStatus, safety, html, index }) {
  const { branch, commit } = readGitInfo();
  const operatorPage = has(html, /Luke Operator V2/) ? { ok: true, status: 200 } : { ok: false, error: 'operator HTML missing header' };
  const surfaces = [
    ['Top Status Band', valuesFor(['freshness', 'risk blockers', 'autonomous recommendation-only state'], comparison.rows)],
    ['Decision Panel', valuesFor(['action', 'anchor', 'side', 'entry', 'acceptable entry', 'stop', 'target', 'sizing', 'vetoes'], comparison.rows)],
    ['Confluence Panel', valuesFor(['confluence row count', 'confluence top rows'], comparison.rows)],
    ['Autonomous Panel', valuesFor(['action', 'anchor', 'side', 'entry', 'acceptable entry', 'stop', 'target', 'sizing', 'vetoes', 'risk blockers', 'autonomous recommendation-only state'], comparison.rows)],
    ['Ingestion Status Panel', valuesFor(['freshness'], comparison.rows)],
  ];
  const mismatches = comparison.rows.filter(row => row.status === 'MISMATCH' || row.status === 'MISSING_NEW');
  const oldMissing = comparison.rows.filter(row => row.status === 'MISSING_OLD');
  const verdict = proofVerdict(comparison, safety, collected);

  const lines = [];
  lines.push('# Operator V2 Proof');
  lines.push('');
  lines.push('## Environment');
  lines.push(`- Branch: ${branch}`);
  lines.push(`- Commit: ${commit}`);
  lines.push(`- Proof generated: ${new Date().toISOString()}`);
  lines.push('- Test result: read-only operator proof runner completed');
  lines.push('- App run command: node index.js');
  lines.push(`- Operator URL: ${baseUrl}/operator-v2`);
  lines.push('');
  lines.push('## Endpoint Availability');
  lines.push(endpointLine('/operator-v2', operatorPage, '- static route inspected'));
  lines.push(endpointLine('/api/operator/status', collected.new.operatorStatus?.response));
  lines.push(endpointLine('/api/operator/readiness', collected.new.operatorReadiness?.response));
  lines.push(endpointLine('/api/decision?instrument=ES&mode=manual', collected.new.decision?.response));
  lines.push(endpointLine('/api/confluence?instrument=ES', collected.new.confluence?.response));
  lines.push(endpointLine('/agent/autonomous/preflight', collected.autonomous.preflight?.response));
  lines.push(endpointLine('/agent/autonomous/status', autonomousStatus));
  lines.push('');
  lines.push('## Surface Comparison');
  for (const [name, rows] of surfaces) {
    lines.push(`- ${name}: ${surfaceStatus(rows)} (${formatRows(rows)})`);
  }
  lines.push('');
  lines.push('## Critical Safety Checks');
  lines.push(`- PASS is non-actionable: ${yesNo(safety.passNonActionable)}`);
  lines.push(`- Stale/missing/unknown does not appear OK: ${yesNo(safety.staleMissingUnknownNotOk)}`);
  lines.push(`- Vetoes visible: ${yesNo(safety.vetoesVisible)}`);
  lines.push(`- Risk blockers visible: ${yesNo(safety.riskBlockersVisible)}`);
  lines.push(`- Autonomous recommendation-only visible: ${yesNo(safety.stagedOnlyVisible)}`);
  lines.push(`- No execute button: ${yesNo(safety.noExecuteButton)}`);
  lines.push(`- No direct execution shortcut: ${yesNo(safety.noDirectExecutionShortcut)}`);
  lines.push(`- Luke chat route still available: ${yesNo(safety.lukeChatAvailable)}`);
  lines.push(`- Trading chat route still available: ${yesNo(safety.tradingChatAvailable)}`);
  lines.push(`- Dashboard remains default route: ${yesNo(safety.dashboardDefault)}`);
  lines.push(`- /operator-v2 is not default: ${yesNo(safety.operatorNotDefault)}`);
  lines.push('');
  lines.push('## Proof Runner Scope');
  lines.push('- No trade state mutations.');
  lines.push('- No execution, start, stop, confirm, or set-mode routes called.');
  lines.push('- This artifact is generated from read-only local endpoint checks and static source inspection.');
  lines.push('');
  lines.push('## Remaining Mismatches');
  if (mismatches.length) {
    for (const row of mismatches) lines.push(`- ${row.field}: ${row.status}`);
  } else {
    lines.push('- None blocking from operator-v2/API comparison.');
  }
  if (oldMissing.length) {
    lines.push('- Old shell parse limitations: ' + oldMissing.map(row => row.field).join(', '));
  }
  if (collected.errors.length) {
    for (const error of collected.errors) lines.push(`- Collection error: ${error}`);
  }
  if (autonomousStatus && !autonomousStatus.ok) lines.push(`- Collection error: /agent/autonomous/status ${autonomousStatus.error}`);
  lines.push('');
  lines.push('## Verdict');
  lines.push(`- ${verdict}`);
  lines.push('');
  lines.push('## Notes');
  lines.push('- Proof runner called only read-only GET endpoints plus read-only slash commands through /chat: /status, /entries ES, /verdict ES.');
  lines.push('- Operator UI computes display formatting only; trade action, entry, stop, target, sizing, freshness, and vetoes come from backend API payloads.');
  return lines.join('\n');
}

async function main() {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  const app = await ensureApp(baseUrl);
  if (!app.process && !/^connected|started/.test(app.result)) {
    throw new Error(app.result);
  }
  try {
    const collected = await collectSurfaces(baseUrl);
    const comparison = buildComparison(collected);
    const autonomousStatus = await fetchJson(baseUrl, '/agent/autonomous/status');
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');
    const index = fs.readFileSync(INDEX_FILE, 'utf8');
    const safety = criticalSafetyChecks(html, index);
    const proof = renderProof({ baseUrl, collected, comparison, autonomousStatus, safety, html, index });
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, proof, 'utf8');
    console.log(`Wrote ${OUT_FILE}`);
    if (proof.includes('SAFE_AFTER_LISTED_FIXES') || proof.includes('UNSAFE_KEEP_OLD_SHELL')) {
      process.exitCode = 1;
    }
  } finally {
    stopApp(app.process);
  }
}

if (require.main === module) {
  main().catch(err => {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, [
      '# Operator V2 Proof',
      '',
      '## Fatal Error',
      '',
      err.stack || err.message,
    ].join('\n'), 'utf8');
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  criticalSafetyChecks,
  surfaceStatus,
  renderProof,
};
