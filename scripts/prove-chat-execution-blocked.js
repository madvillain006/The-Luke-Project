'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'chat-execution-blocked');
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

async function waitForApp() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const health = await fetchText('/api/health');
    const trading = await fetchText('/trading');
    if (health.ok && health.text.includes('"app":"Luke"') && trading.ok && trading.text.includes('pending-trade')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const health = await fetchText('/api/health');
  const trading = await fetchText('/trading');
  if (health.ok && health.text.includes('"app":"Luke"') && trading.ok && trading.text.includes('pending-trade')) {
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

async function captureBlockedOverlay() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 780 }, deviceScaleFactor: 1 });
  const screenshotPath = path.join(OUT_DIR, 'chat-execution-blocked-overlay.png');
  try {
    await page.goto(`${BASE_URL}/trading`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pending-trade', { state: 'attached' });
    await page.evaluate(() => {
      document.getElementById('pt-chart-inner').innerHTML = '<div style="height:162px;display:flex;align-items:center;justify-content:center;color:#e2b96a;border-bottom:1px solid #2a2308;">Chart intentionally omitted from blocked execution proof</div>';
      document.getElementById('pt-signal').textContent = 'LONG ES E:6592.25 S:6586.25 T:6594.25';
      document.getElementById('pt-meta').textContent = 'REVIEW ONLY - execution blocked | Risk: $300 R:R 1:1';
      document.getElementById('pt-reason').textContent = 'Proof overlay: legacy chat can review a staged signal, but cannot submit it.';
      document.getElementById('lbl-target').textContent = 'T 6594.25';
      document.getElementById('lbl-entry').textContent = 'E 6592.25';
      document.getElementById('lbl-stop').textContent = 'S 6586.25';
      document.getElementById('pt-countdown-text').textContent = 'locked';
      document.getElementById('pending-trade').classList.add('visible');
      document.getElementById('pending-trade').style.display = 'flex';
    });
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const check = await page.evaluate(() => {
      const button = document.getElementById('execute-btn');
      const text = document.body.textContent;
      return {
        button_text: button ? button.textContent.replace(/\s+/g, ' ').trim() : null,
        button_disabled: button ? button.disabled : false,
        review_only_text: text.includes('REVIEW ONLY - execution blocked'),
        blocked_label: text.includes('02B REVIEW ONLY - EXECUTION BLOCKED'),
        execute_endpoint_in_dom: document.documentElement.innerHTML.includes('/agent/autonomous/execute-staged'),
      };
    });
    return { ok: check.button_disabled && check.review_only_text && check.blocked_label && !check.execute_endpoint_in_dom, path: screenshotPath, check };
  } finally {
    await browser.close();
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
    screenshot: null,
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'chat-execution-blocked-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    process.exitCode = 1;
    return;
  }

  proof.screenshot = await captureBlockedOverlay();
  proof.ok = proof.screenshot.ok;
  fs.writeFileSync(path.join(OUT_DIR, 'chat-execution-blocked-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`chat execution blocked proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'chat-execution-blocked-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`chat execution blocked proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
