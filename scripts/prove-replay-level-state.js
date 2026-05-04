#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'replay-level-state');
let BASE_URL = process.env.LUKE_BASE_URL || 'http://127.0.0.1:3000';
const PROOF_PORT = Number(process.env.LUKE_PROOF_PORT || 3000);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function examplesFromArtifact(relativePath) {
  const data = readJson(relativePath, null);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.examples || data.rows || data.winners || [];
}

function timestampOf(row) {
  return row?.first_reclaim_timestamp_et || row?.reclaim_timestamp_et || row?.timestamp_et || row?.entry_timestamp_et || row?.timestamp || null;
}

function routeParts(row, fallbackDate, fallbackTime) {
  const ts = timestampOf(row);
  if (!ts) return { date: fallbackDate, time: fallbackTime };
  return { date: ts.slice(0, 10), time: ts.slice(11, 16) };
}

function chooseReplayExamples() {
  const positives = examplesFromArtifact('artifacts/research/ladder-reclaim-bobby-mancini-review.json');
  const negatives = examplesFromArtifact('artifacts/research/ladder-reclaim-false-positives.json');
  const positive = positives.find(row => timestampOf(row)?.startsWith('2026-04-02T11:31'))
    || positives.find(row => row.date === '2026-04-02')
    || positives.find(row => timestampOf(row)?.startsWith('2026-03-31T11:00'))
    || positives[0]
    || { date: '2026-04-20', first_reclaim_timestamp_et: '2026-04-20T09:49:00-04:00', source: 'fallback' };
  const negative = negatives.find(row => timestampOf(row)?.startsWith('2026-04-20T09:49'))
    || negatives.find(row => row.date === '2026-04-20')
    || negatives[0]
    || { date: '2026-04-20', first_reclaim_timestamp_et: '2026-04-20T15:23:00-04:00', source: 'fallback' };
  return { positive, negative };
}

async function fetchText(route) {
  try {
    const response = await fetch(new URL(route, BASE_URL), { method: 'GET' });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch (err) {
    return { ok: false, status: null, text: '', error: err.message };
  }
}

async function fetchJson(route, fileName) {
  const url = new URL(route, BASE_URL);
  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(body, null, 2), 'utf8');
    return { ok: response.ok, status: response.status, route, url: url.toString(), file: fileName, body };
  } catch (err) {
    const body = { ok: false, route, error: err.message };
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(body, null, 2), 'utf8');
    return { ok: false, status: null, route, url: url.toString(), file: fileName, error: err.message };
  }
}

async function waitForApp() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const health = await fetchText('/api/health');
    const replay = await fetchText('/api/trading/level-state?instrument=ES&mode=replay&date=2026-04-20&time=09:49');
    if (health.ok && health.text.includes('"app":"Luke"') && replay.ok) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const health = await fetchText('/api/health');
  const replay = await fetchText('/api/trading/level-state?instrument=ES&mode=replay&date=2026-04-20&time=09:49');
  if (health.ok && health.text.includes('"app":"Luke"') && replay.ok) {
    return { started: false, process: null, status: 'connected_existing' };
  }

  const requestedPort = Number(new URL(BASE_URL).port || 3000);
  const runtime = await checkRuntimeHealth({ port: requestedPort });
  const startPort = runtime.status === 'free' ? requestedPort : PROOF_PORT;
  BASE_URL = `http://127.0.0.1:${startPort}`;

  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(startPort) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data.toString(); });
  child.stderr.on('data', data => { output += data.toString(); });
  const ready = await waitForApp();
  if (!ready) {
    if (!child.killed) child.kill();
    return { started: true, process: null, status: 'startup_failed', output: output.slice(-2000) };
  }
  return { started: true, process: child, status: 'started_node_index' };
}

function stopApp(child) {
  if (child && !child.killed) child.kill();
}

async function screenshotOperator() {
  const output = path.join(OUT_DIR, 'operator-v2-replay-mode.png');
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(new URL('/operator-v2', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('API mode').first().waitFor({ timeout: 15000 });
    await page.locator('#data-health-panel').first().screenshot({ path: output });
    await browser.close();
    return { ok: true, path: path.relative(ROOT, output).replace(/\\/g, '/') };
  } catch (err) {
    return { ok: false, path: path.relative(ROOT, output).replace(/\\/g, '/'), error: err.message };
  }
}

function replayRoute(base, parts) {
  return `${base}?instrument=ES&mode=replay&date=${encodeURIComponent(parts.date)}&time=${encodeURIComponent(parts.time)}`;
}

function replaySafety(api) {
  const bodies = Object.values(api).map(item => item.body).filter(Boolean);
  return {
    read_only: bodies.every(body => body.read_only === true),
    no_live_execution: bodies.every(body => body.no_live_execution === true),
    mode_replay: bodies.every(body => body.mode === 'replay'),
    local_replay_candles: bodies.every(body => body.candle_feed?.source === 'local_csv' && body.candle_feed?.usable_for_replay === true),
    live_false: bodies.every(body => body.market_data?.live === false || body.replay?.live === false),
    usable_for_live_arming_false: bodies.every(body => body.live_arming_enabled === false && body.candle_feed?.usable_for_live_arming === false),
    same_engine_path: 'api trading routes -> trading-state adapter -> buildTradingState -> getCandles -> local_csv provider',
  };
}

async function main() {
  ensureDir(OUT_DIR);
  const app = await ensureApp();
  const proof = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    app: { status: app.status, started: app.started, output: app.output || null },
    selected_examples: chooseReplayExamples(),
    api: {},
    screenshot: null,
    safety: {},
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'virtual-replay-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`replay proof ok: ${proof.ok}`);
    stopApp(app.process);
    process.exitCode = 1;
    return;
  }

  const positiveParts = routeParts(proof.selected_examples.positive, '2026-03-31', '11:00');
  const negativeParts = routeParts(proof.selected_examples.negative, '2026-04-20', '15:23');
  proof.api.positive_level_state = await fetchJson(
    replayRoute('/api/trading/level-state', positiveParts),
    'replay-positive-level-state.json',
  );
  proof.api.negative_level_state = await fetchJson(
    replayRoute('/api/trading/level-state', negativeParts),
    'replay-negative-level-state.json',
  );
  proof.api.trade_candidates = await fetchJson(
    replayRoute('/api/trading/trade-candidates', positiveParts),
    'replay-trade-candidates.json',
  );
  proof.api.alerts = await fetchJson(
    replayRoute('/api/trading/alerts', positiveParts),
    'replay-alerts.json',
  );
  proof.screenshot = await screenshotOperator();
  proof.safety = replaySafety(proof.api);
  proof.ok = Object.values(proof.api).every(item => item.ok)
    && proof.safety.read_only
    && proof.safety.no_live_execution
    && proof.safety.mode_replay
    && proof.safety.local_replay_candles
    && proof.safety.live_false
    && proof.safety.usable_for_live_arming_false;

  fs.writeFileSync(path.join(OUT_DIR, 'virtual-replay-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`replay proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'virtual-replay-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`replay level-state proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
