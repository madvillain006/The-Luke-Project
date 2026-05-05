#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'client-demo');
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
  const existing = await fetchText('/api/health');
  if (existing.ok && existing.text.includes('"app":"Luke"')) {
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

async function captureDemoScreenshots() {
  const paths = {
    operator_desktop: path.join(OUT_DIR, 'operator-desktop-ui.png'),
    operator_demo: path.join(OUT_DIR, 'operator-client-demo.png'),
    trade_window_context: path.join(OUT_DIR, 'trade-window-in-dashboard-context.png'),
    dashboard_trade_window: path.join(OUT_DIR, 'dashboard-trade-window.png'),
    trade_popover: path.join(OUT_DIR, 'hypothetical-trade-popover.png'),
    watch_script: path.join(OUT_DIR, 'watch-script-status.png'),
    trading_window: path.join(OUT_DIR, 'trading-window-demo.png'),
    chatbot: path.join(OUT_DIR, 'regular-chatbot-demo.png'),
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });
  await page.goto(new URL('/operator-v2?demo=client', BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Replay Trading Window Embedded In Dashboard').waitFor({ timeout: 15000 });
  await page.getByText('Client Demo Replay Trade Plan').waitFor({ timeout: 15000 });
  await page.getByText('Dashboard Trade Window Preview').waitFor({ timeout: 15000 });
  await page.getByText('Katbot / heatmap input acknowledgment').waitFor({ timeout: 15000 });
  await page.getByText('Current Pine indicator/watchlist bridge only').waitFor({ timeout: 15000 });
  await page.getByText('Replay Trade Plan Pop-Up').waitFor({ timeout: 15000 });
  await page.screenshot({ path: paths.operator_desktop, fullPage: false });
  await page.screenshot({ path: paths.operator_demo, fullPage: true });
  await page.locator('#demo-trade-window').scrollIntoViewIfNeeded();
  await page.screenshot({ path: paths.trade_window_context, fullPage: false });
  await page.locator('#demo-trade-window').screenshot({ path: paths.dashboard_trade_window });
  await page.locator('#demo-trade-popover').screenshot({ path: paths.trade_popover });
  await page.locator('#demo-watch-script').screenshot({ path: paths.watch_script });
  const operatorBody = await page.locator('body').innerText();
  const unsafeOperatorButtons = await page.$$eval('button', buttons => buttons.map(button => button.textContent.trim()).filter(text => /execute|submit|broker/i.test(text)));

  await page.goto(new URL('/trading-window?example=positive', BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Luke Trading Window').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => {
    const focus = document.querySelector('#chart-focus-summary')?.textContent || '';
    const chart = document.querySelector('#price-chart');
    return focus.includes('hidden')
      && !focus.toLowerCase().includes('loading')
      && chart
      && chart.children.length > 10;
  }, { timeout: 15000 });
  await page.screenshot({ path: paths.trading_window, fullPage: true });

  await page.goto(new URL('/luke', BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
  await page.locator('#input').fill('/status');
  await page.locator('#send').click();
  await page.getByText('LUKE ONLINE').waitFor({ timeout: 15000 });
  await page.screenshot({ path: paths.chatbot, fullPage: true });
  const chatBody = await page.locator('body').innerText();

  await browser.close();
  return {
    ok: true,
    operator_contains_demo_plan: /Dashboard Trade Window Preview/i.test(operatorBody) && /Replay Trade Plan Pop-Up/i.test(operatorBody) && /Entry/i.test(operatorBody) && /TP1 \/ TP2/i.test(operatorBody),
    operator_contains_katbot_input: /Katbot \/ heatmap input acknowledgment/i.test(operatorBody) && /ACK Bobby heatmap/i.test(operatorBody),
    operator_contains_watch_script: /Current Pine indicator\/watchlist bridge only/i.test(operatorBody) && /tradingview\/luke-level-reclaim-watch\.pine/i.test(operatorBody),
    operator_labels_replay_not_live: /Hypothetical replay\/paper plan only/i.test(operatorBody) && /No submit control/i.test(operatorBody),
    no_unsafe_operator_buttons: unsafeOperatorButtons.length === 0,
    chatbot_status_reply: /LUKE ONLINE/i.test(chatBody) && /Autonomous: recommendation-only/i.test(chatBody),
    unsafe_operator_buttons: unsafeOperatorButtons,
    paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, path.relative(ROOT, value).replace(/\\/g, '/')])),
  };
}

function safety(api, screenshots) {
  const chart = api.chart_data?.body || {};
  const sourceHealth = api.source_health?.body || {};
  return {
    all_get_endpoints_ok: Object.values(api).every(result => result.ok),
    no_live_execution_flags: chart.no_live_execution === true && sourceHealth.no_live_execution === true,
    replay_not_live: chart.live === false && chart.usable_for_live_arming === false,
    demo_plan_visible: screenshots.operator_contains_demo_plan === true,
    katbot_input_visible: screenshots.operator_contains_katbot_input === true,
    watch_script_visible: screenshots.operator_contains_watch_script === true,
    chatbot_demo_visible: screenshots.chatbot_status_reply === true,
    no_unsafe_buttons: screenshots.no_unsafe_operator_buttons === true,
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
    fs.writeFileSync(path.join(OUT_DIR, 'client-demo-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`client-demo proof ok: ${proof.ok}`);
    process.exitCode = 1;
    return;
  }

  const replay = '?instrument=ES&mode=replay&example=positive';
  proof.api.health = await fetchJson('/api/health', 'api-health.json');
  proof.api.chart_data = await fetchJson(`/api/trading/chart-data${replay}`, 'api-chart-data.json');
  proof.api.source_health = await fetchJson(`/api/trading/source-health${replay}`, 'api-source-health.json');
  proof.api.heatmap_proof = await fetchJson('/api/operator/heatmap-proof', 'api-heatmap-proof.json');
  proof.screenshots = await captureDemoScreenshots();
  proof.safety = safety(proof.api, proof.screenshots);
  proof.ok = Object.values(proof.safety).every(Boolean);
  fs.writeFileSync(path.join(OUT_DIR, 'client-demo-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`client-demo proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'client-demo-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`client-demo proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
