#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'virtual-operator-dashboard');
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
  try {
    const response = await fetch(new URL(route, BASE_URL), { method: 'GET' });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(body, null, 2), 'utf8');
    return { ok: response.ok, status: response.status, route, file: fileName, body };
  } catch (err) {
    const body = { ok: false, route, error: err.message };
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(body, null, 2), 'utf8');
    return { ok: false, status: null, route, file: fileName, body };
  }
}

async function waitForApp() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const health = await fetchText('/api/health');
    const operator = await fetchText('/operator-v2');
    if (health.ok && health.text.includes('"app":"Luke"') && operator.ok && operator.text.includes('Luke Operator V2')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const existing = await fetchText('/operator-v2');
  if (existing.ok && existing.text.includes('Luke Operator V2')) {
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
  if (await waitForApp()) return { started: true, process: child, status: 'started_node_index' };
  if (!child.killed) child.kill();
  return { started: true, process: null, status: 'startup_failed', output: output.slice(-2000) };
}

function stopApp(child) {
  if (child && !child.killed) child.kill();
}

async function captureScreenshots() {
  const paths = {
    operator_dashboard: path.join(OUT_DIR, 'operator-dashboard-full.png'),
    embedded_chart: path.join(OUT_DIR, 'embedded-chart.png'),
    heatmap_a: path.join(OUT_DIR, 'heatmap-proof-image-a.png'),
    heatmap_b: path.join(OUT_DIR, 'heatmap-proof-image-b.png'),
  };
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });
    await page.goto(new URL('/operator-v2?proof=heatmap', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('Replay Trading Window Embedded In Dashboard').waitFor({ timeout: 15000 });
    await page.getByText('Katbot / Heatmap Input Proof').waitFor({ timeout: 15000 });
    await page.screenshot({ path: paths.operator_dashboard, fullPage: true });
    await page.locator('#operator-chart-panel').screenshot({ path: paths.embedded_chart });
    await page.locator('[data-heatmap-fixture]').nth(0).screenshot({ path: paths.heatmap_a });
    await page.locator('[data-heatmap-fixture]').nth(1).screenshot({ path: paths.heatmap_b });
    const bodyText = await page.locator('body').innerText();
    const normalizedBodyText = bodyText.toLowerCase();
    const signalLabels = [
      'Top Status Band',
      'Decision',
      'Confluence',
      'Live Level State',
      'Trade Candidates',
      'Bracket Plan Visual',
      'Trading Alerts',
      'Data Health',
      'Autonomous',
      'Katbot / Heatmap Input Proof',
    ];
    const missingSignalLabels = signalLabels.filter(label => !normalizedBodyText.includes(label.toLowerCase()));
    const unsafeButtons = await page.$$eval('button', buttons => buttons.map(button => button.textContent.trim()).filter(text => /execute|submit|broker/i.test(text)));
    return {
      ok: unsafeButtons.length === 0 && /ACK Bobby heatmap 10:03/i.test(bodyText) && /ACK Bobby heatmap 10:05/i.test(bodyText),
      body_has_all_signals: missingSignalLabels.length === 0,
      missing_signal_labels: missingSignalLabels,
      unsafe_buttons: unsafeButtons,
      paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, path.relative(ROOT, value).replace(/\\/g, '/')])),
    };
  } finally {
    if (browser) await browser.close();
  }
}

function safety(api, screenshots) {
  const heatmap = api.heatmap_proof?.body || {};
  return {
    all_get_endpoints_ok: Object.values(api).every(result => result.ok),
    no_live_execution_flags: [api.chart_data?.body, api.source_health?.body, api.heatmap_proof?.body]
      .every(body => body && body.no_live_execution === true),
    two_distinct_heatmap_images: heatmap.checks?.two_distinct_images === true,
    acknowledged_actual_levels: heatmap.checks?.every_fixture_has_levels === true,
    full_dashboard_contains_all_signals: screenshots.body_has_all_signals === true,
    no_unsafe_buttons: screenshots.unsafe_buttons.length === 0,
  };
}

async function main() {
  ensureDir(OUT_DIR);
  const app = await ensureApp();
  const proof = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    app,
    api: {},
    screenshots: null,
    safety: {},
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'virtual-operator-dashboard-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`virtual-operator-dashboard proof ok: ${proof.ok}`);
    process.exitCode = 1;
    return;
  }

  const replay = '?instrument=ES&mode=replay&example=positive';
  proof.api.health = await fetchJson('/api/health', 'api-health.json');
  proof.api.operator_status = await fetchJson('/api/operator/status', 'api-operator-status.json');
  proof.api.operator_readiness = await fetchJson('/api/operator/readiness', 'api-operator-readiness.json');
  proof.api.decision = await fetchJson('/api/decision?instrument=ES&mode=manual', 'api-decision.json');
  proof.api.confluence = await fetchJson('/api/confluence?instrument=ES', 'api-confluence.json');
  proof.api.level_state = await fetchJson(`/api/trading/level-state${replay}`, 'api-level-state.json');
  proof.api.trade_candidates = await fetchJson(`/api/trading/trade-candidates${replay}`, 'api-trade-candidates.json');
  proof.api.alerts = await fetchJson(`/api/trading/alerts${replay}`, 'api-alerts.json');
  proof.api.chart_data = await fetchJson(`/api/trading/chart-data${replay}`, 'api-chart-data.json');
  proof.api.source_health = await fetchJson(`/api/trading/source-health${replay}`, 'api-source-health.json');
  proof.api.heatmap_proof = await fetchJson('/api/operator/heatmap-proof', 'api-heatmap-proof.json');
  proof.api.autonomous_status = await fetchJson('/agent/autonomous/status', 'api-autonomous-status.json');
  proof.screenshots = await captureScreenshots();
  proof.safety = safety(proof.api, proof.screenshots);
  proof.ok = Object.values(proof.safety).every(Boolean);
  fs.writeFileSync(path.join(OUT_DIR, 'virtual-operator-dashboard-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`virtual-operator-dashboard proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'virtual-operator-dashboard-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`virtual-operator-dashboard proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
