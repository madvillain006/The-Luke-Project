#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'candle-feed');
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
    return { ok: response.ok, status: response.status, route, file: fileName, body };
  } catch (err) {
    const body = { ok: false, route, error: err.message };
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(body, null, 2), 'utf8');
    return { ok: false, status: null, route, file: fileName, error: err.message };
  }
}

async function waitForApp() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const response = await fetchText('/operator-v2');
    const health = await fetchText('/api/health');
    const levelState = await fetchText('/api/trading/level-state?instrument=ES');
    if (
      response.ok &&
      response.text.includes('Luke Operator V2') &&
      health.ok &&
      health.text.includes('"app":"Luke"') &&
      levelState.ok
    ) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const existing = await fetchText('/operator-v2');
  const existingApi = await fetchText('/api/trading/level-state?instrument=ES');
  const existingHealth = await fetchText('/api/health');
  if (
    existing.ok &&
    existing.text.includes('Luke Operator V2') &&
    existingHealth.ok &&
    existingHealth.text.includes('"app":"Luke"') &&
    existingApi.ok
  ) {
    return { started: false, process: null, status: 'connected_existing' };
  }

  const startPort = await resolveProofPort({ baseUrl: BASE_URL, proofPort: PROOF_PORT, checkRuntimeHealth });
  BASE_URL = `http://127.0.0.1:${startPort}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
    if (ready) return { started: true, process: child, status: 'started_node_index' };
    if (!child.killed) child.kill();
    if (!output.includes('EADDRINUSE') || attempt === 1) {
      return { started: true, process: null, status: 'startup_failed', output: output.slice(-2000) };
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  return { started: true, process: null, status: 'startup_failed', output: 'startup retry exhausted' };
}

function stopApp(child) {
  if (child && !child.killed) child.kill();
}

async function screenshot(page, route, fileName, options = {}) {
  const output = path.join(OUT_DIR, fileName);
  try {
    await page.goto(new URL(route, BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
    if (options.locator) {
      const target = page.locator(options.locator).first();
      await target.waitFor({ state: 'visible', timeout: 15000 });
      if (options.waitForText) await target.getByText(options.waitForText).first().waitFor({ timeout: 15000 });
      await target.screenshot({ path: output });
    } else {
      if (options.waitForText) await page.getByText(options.waitForText).first().waitFor({ timeout: 15000 });
      await page.screenshot({ path: output, fullPage: options.fullPage !== false });
    }
    return { ok: true, route, path: path.relative(ROOT, output).replace(/\\/g, '/') };
  } catch (err) {
    return { ok: false, route, path: path.relative(ROOT, output).replace(/\\/g, '/'), error: err.message };
  }
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
    screenshots: [],
    safety: {
      read_only: true,
      no_live_execution: true,
      no_execute_buttons_expected: true,
    },
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'virtual-operator-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log('proof ok: false');
    process.exitCode = 1;
    return;
  }

  try {
    proof.runtime_health = await checkRuntimeHealth({ port: new URL(BASE_URL).port || 3000 });
    fs.writeFileSync(path.join(OUT_DIR, 'runtime-health.json'), JSON.stringify(proof.runtime_health, null, 2), 'utf8');
    proof.api.health = await fetchJson('/api/health', 'api-health.json');
    proof.api.candle_status = await fetchJson('/api/trading/candle-status?instrument=ES', 'api-candle-status.json');
    proof.api.level_state = await fetchJson('/api/trading/level-state?instrument=ES', 'api-level-state.json');
    proof.api.trade_candidates = await fetchJson('/api/trading/trade-candidates?instrument=ES', 'api-trade-candidates.json');
    proof.api.alerts = await fetchJson('/api/trading/alerts?instrument=ES', 'api-alerts.json');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    proof.screenshots.push(await screenshot(page, '/', 'old-shell.png'));
    proof.screenshots.push(await screenshot(page, '/operator-v2', 'operator-v2.png', { waitForText: 'Live Level State' }));
    proof.screenshots.push(await screenshot(page, '/operator-v2', 'trading-level-state.png', {
      waitForText: 'Live Level State',
      locator: 'article[aria-labelledby="live-level-state-title"]',
    }));
    proof.screenshots.push(await screenshot(page, '/operator-v2', 'bracket-plan-visual.png', {
      waitForText: 'Bracket Plan Visual',
      locator: 'article[aria-labelledby="bracket-title"]',
    }));
    proof.screenshots.push(await screenshot(page, '/operator-v2', 'alerts-feed.png', {
      waitForText: 'Trading Alerts',
      locator: 'article[aria-labelledby="trading-alerts-title"]',
    }));
    proof.screenshots.push(await screenshot(page, '/operator-v2', 'data-health.png', {
      waitForText: 'Data Health',
      locator: 'article[aria-labelledby="data-health-title"]',
    }));
    proof.screenshots.push(await screenshot(page, '/operator-v2', 'operator-v2-candle-health.png', {
      waitForText: 'Using local/replay 1m candles',
      locator: 'article[aria-labelledby="data-health-title"]',
    }));
    const buttons = await page.locator('button').allTextContents();
    proof.safety.button_labels = buttons.map(item => item.trim()).filter(Boolean);
    await browser.close();
  } catch (err) {
    proof.blockers.push(`browser proof failed: ${err.message}`);
  } finally {
    stopApp(app.process);
  }

  proof.ok = Object.values(proof.api).every(item => item.ok)
    && proof.screenshots.every(item => item.ok)
    && proof.safety.button_labels?.length === 1
    && proof.safety.button_labels[0] === 'Refresh';
  fs.writeFileSync(path.join(OUT_DIR, 'virtual-operator-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'virtual-operator-proof.json')).replace(/\\/g, '/')}`);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    ensureDir(OUT_DIR);
    fs.writeFileSync(path.join(OUT_DIR, 'virtual-operator-proof.json'), JSON.stringify({
      ok: false,
      generated_at: new Date().toISOString(),
      error: err.stack || err.message,
    }, null, 2), 'utf8');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  });
}
