#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'trading-window');
let BASE_URL = process.env.LUKE_BASE_URL || 'http://127.0.0.1:3000';
const PROOF_PORT = Number(process.env.LUKE_PROOF_PORT || 3001);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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
    const page = await fetchText('/trading-window');
    if (health.ok && health.text.includes('"app":"Luke"') && page.ok && page.text.includes('Luke Trading Window')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const existing = await fetchText('/trading-window');
  if (existing.ok && existing.text.includes('Luke Trading Window')) {
    return { started: false, process: null, status: 'connected_existing' };
  }

  const startPort = await resolveProofPort({ baseUrl: BASE_URL, proofPort: PROOF_PORT, checkRuntimeHealth });
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

async function captureScreenshots() {
  const outputs = {
    trading_window: path.join(OUT_DIR, 'trading-window.png'),
    operator_dashboard: path.join(OUT_DIR, 'operator-dashboard-full.png'),
    chart_bracket: path.join(OUT_DIR, 'chart-bracket.png'),
    replay_example: path.join(OUT_DIR, 'replay-example.png'),
    heatmap_image_a: path.join(OUT_DIR, 'heatmap-proof-image-a.png'),
    heatmap_image_b: path.join(OUT_DIR, 'heatmap-proof-image-b.png'),
  };
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    await page.goto(new URL('/trading-window', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('Luke Trading Window').waitFor({ timeout: 15000 });
    await page.screenshot({ path: outputs.trading_window, fullPage: true });
    await page.locator('#chart-panel').screenshot({ path: outputs.chart_bracket });
    await page.locator('#candidate-panel').screenshot({ path: outputs.replay_example });
    const tradingUnsafeButtons = await page.$$eval('button', buttons => buttons.map(button => button.textContent.trim()).filter(text => /execute|submit|broker/i.test(text)));
    await page.goto(new URL('/operator-v2?proof=heatmap', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('Replay Trading Window Embedded In Dashboard').waitFor({ timeout: 15000 });
    await page.getByText('Katbot / Heatmap Input Proof').waitFor({ timeout: 15000 });
    await page.screenshot({ path: outputs.operator_dashboard, fullPage: true });
    await page.locator('[data-heatmap-fixture]').nth(0).screenshot({ path: outputs.heatmap_image_a });
    await page.locator('[data-heatmap-fixture]').nth(1).screenshot({ path: outputs.heatmap_image_b });
    const operatorUnsafeButtons = await page.$$eval('button', buttons => buttons.map(button => button.textContent.trim()).filter(text => /execute|submit|broker/i.test(text)));
    const unsafeButtons = [...tradingUnsafeButtons, ...operatorUnsafeButtons];
    return {
      ok: unsafeButtons.length === 0,
      paths: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, path.relative(ROOT, value).replace(/\\/g, '/')])),
      unsafe_buttons: unsafeButtons,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      paths: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, path.relative(ROOT, value).replace(/\\/g, '/')])),
    };
  } finally {
    if (browser) await browser.close();
  }
}

function safety(api, screenshots) {
  const chart = api.chart_data?.body || {};
  const source = api.source_health?.body || {};
  const candidates = api.trade_candidates?.body || {};
  const heatmapProof = api.heatmap_proof?.body || {};
  return {
    read_only: [chart, source, candidates, heatmapProof].every(body => body.read_only === true),
    no_live_execution: [chart, source, candidates, heatmapProof].every(body => body.no_live_execution === true),
    chart_has_candles: Array.isArray(chart.candles) && chart.candles.length > 0,
    chart_uses_replay: chart.mode === 'replay' && chart.candle_feed?.source === 'local_csv',
    live_false: chart.market_data?.live === false || chart.data_mode?.live === false,
    live_arming_disabled: chart.live_arming_enabled === false && chart.data_mode?.can_generate_live_candidate === false,
    candidate_not_live_ready: (candidates.candidates || []).every(candidate => candidate.status !== 'LIVE_READY' && candidate.can_execute_live !== true),
    source_health_has_heatmap_gex: Boolean(source.heatmap_gex),
    operator_heatmap_two_images: heatmapProof.checks?.two_distinct_images === true,
    operator_heatmap_ack_levels: heatmapProof.checks?.every_fixture_has_levels === true,
    no_unsafe_buttons: screenshots.ok === true,
    same_engine_path: 'trading-window -> /api/trading/chart-data -> trading-state adapter -> buildTradingState -> candle-feed provider',
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
    api: {},
    screenshots: null,
    safety: {},
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'virtual-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`trading-window proof ok: ${proof.ok}`);
    process.exitCode = 1;
    return;
  }

  const query = '?instrument=ES&mode=replay&example=positive';
  proof.api.chart_data = await fetchJson(`/api/trading/chart-data${query}`, 'chart-data.json');
  proof.api.source_health = await fetchJson(`/api/trading/source-health${query}`, 'source-health.json');
  proof.api.heatmap_proof = await fetchJson('/api/operator/heatmap-proof', 'heatmap-proof.json');
  proof.api.active_levels = await fetchJson(`/api/trading/level-state${query}`, 'active-levels.json');
  proof.api.trade_candidates = await fetchJson(`/api/trading/trade-candidates${query}`, 'trade-candidates.json');
  proof.api.alerts = await fetchJson(`/api/trading/alerts${query}`, 'alerts.json');
  proof.screenshots = await captureScreenshots();
  proof.safety = safety(proof.api, proof.screenshots);
  proof.ok = Object.values(proof.api).every(item => item.ok)
    && Object.values(proof.safety).filter(value => typeof value === 'boolean').every(Boolean);

  fs.writeFileSync(path.join(OUT_DIR, 'virtual-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`trading-window proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'virtual-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`trading-window proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
