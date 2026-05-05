#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'luke-ui-ux');
let BASE_URL = process.env.LUKE_BASE_URL || 'http://127.0.0.1:3000';
const PROOF_PORT = Number(process.env.LUKE_PROOF_PORT || 3001);
const CHROMIUM_ARGS = ['--disable-gpu', '--disable-gpu-compositing'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchText(route) {
  try {
    const response = await fetch(new URL(route, BASE_URL), { method: 'GET', signal: AbortSignal.timeout(5000) });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch (err) {
    return { ok: false, status: null, text: '', error: err.message };
  }
}

async function waitForApp() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const health = await fetchText('/api/health');
    const shell = await fetchText('/shell');
    if (health.ok && health.text.includes('"app":"Luke"') && shell.ok && shell.text.includes('Trading (Analysis)')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const health = await fetchText('/api/health');
  const shell = await fetchText('/shell');
  if (health.ok && health.text.includes('"app":"Luke"') && shell.ok && shell.text.includes('Trading (Analysis)')) {
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

async function auditLayout(page) {
  return page.evaluate(() => {
    const issues = [];
    const selectors = [
      'button',
      'a',
      'input',
      '.pill',
      '.status',
      '.panel-action',
      '.hero-card',
      '.module-link',
    ];
    const nodes = [...document.querySelectorAll(selectors.join(','))];
    for (const node of nodes) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const label = (node.textContent || node.getAttribute('aria-label') || node.getAttribute('title') || node.tagName).trim().replace(/\s+/g, ' ').slice(0, 80);
      if (rect.left < -2 || rect.right > window.innerWidth + 2) {
        issues.push({ type: 'viewport-x-overflow', label, x: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
      }
      if (node.scrollWidth > node.clientWidth + 3 && style.overflowX === 'visible') {
        issues.push({ type: 'text-x-overflow', label, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth });
      }
      if (node.scrollHeight > node.clientHeight + 3 && style.overflowY === 'visible') {
        issues.push({ type: 'text-y-overflow', label, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight });
      }
    }
    return issues.slice(0, 25);
  });
}

async function sendChatCommand(page, command, expectedText) {
  await page.locator('#input').fill(command);
  await page.locator('#send').click();
  await page.waitForFunction(({ expected }) => {
    const text = document.querySelector('#messages')?.innerText || document.body.innerText || '';
    return text.toLowerCase().includes(expected.toLowerCase());
  }, { expected: expectedText }, { timeout: 15000 });
}

async function waitForShellStatus(page) {
  await page.waitForFunction(() => {
    const ids = ['weather-line', 'brain-line', 'blocker-line', 'runtime-line', 'daily-brief-note'];
    return ids.every(id => {
      const text = document.getElementById(id)?.textContent || '';
      return text.trim() && !/loading/i.test(text);
    });
  }, { timeout: 15000 });
}

async function waitForTradingWindowChart(page) {
  await page.waitForFunction(() => {
    const chart = document.querySelector('#price-chart');
    const focus = document.querySelector('#chart-focus-summary')?.textContent || '';
    return chart && chart.children.length > 10 && focus.includes('hidden') && !/loading/i.test(focus);
  }, { timeout: 15000 });
}

async function waitForBrainDashboard(page) {
  await page.waitForFunction(() => {
    const meta = document.querySelector('#brain-meta')?.textContent || '';
    const trading = document.querySelector('#spine-trading')?.innerText || '';
    const daily = document.querySelector('#spine-daily')?.innerText || '';
    return meta.trim()
      && !/loading/i.test(meta)
      && /Recommendation-only/i.test(trading)
      && /Daily/i.test(daily);
  }, { timeout: 15000 });
}

async function waitForDailyWindow(page) {
  await page.waitForFunction(() => {
    const body = document.body.innerText || '';
    return /Luke Daily/.test(body)
      && /I love Kat/.test(body)
      && /Knoxville, TN/.test(body)
      && /Wilmington, NC/.test(body)
      && /History Jobs/i.test(body)
      && !/Loading date|loading time|Loading mail/i.test(body);
  }, { timeout: 45000 });
}

async function openDailyPanelFromShell(page) {
  await waitForShellStatus(page);
  await page.locator('#daily-launch').click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('#daily-panel');
    const frame = document.querySelector('#daily-frame');
    return panel?.classList.contains('is-open') && frame?.getAttribute('src');
  }, { timeout: 15000 });
  await page.waitForFunction(() => {
    const frame = document.querySelector('#daily-frame');
    const text = frame?.contentWindow?.document?.body?.innerText || '';
    return /Luke Daily/.test(text)
      && /I love Kat/.test(text)
      && /Gmail cleanup/.test(text)
      && /Buffalo, NY/.test(text)
      && !/Loading date|Loading time|loading/i.test(text);
  }, { timeout: 30000 });
}

async function capturePage(browser, spec, proof) {
  const page = await browser.newPage({ viewport: spec.viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));

  const filePath = path.join(OUT_DIR, spec.file);
  await page.goto(new URL(spec.route, BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
  for (const text of spec.waitForText || []) {
    await page.waitForFunction(({ expected }) => {
      return (document.body.innerText || '').toLowerCase().includes(expected.toLowerCase());
    }, { expected: text }, { timeout: 30000 });
  }
  if (typeof spec.action === 'function') await spec.action(page);

  const bodyText = await page.locator('body').innerText({ timeout: 15000 });
  const layoutIssues = await auditLayout(page);
  await page.screenshot({
    path: filePath,
    fullPage: spec.fullPage !== false,
    animations: 'disabled',
    caret: 'hide',
  });
  const stats = fs.statSync(filePath);
  const missingText = (spec.mustContain || []).filter(text => !bodyText.toLowerCase().includes(text.toLowerCase()));
  const forbiddenText = (spec.mustNotContain || []).filter(text => bodyText.toLowerCase().includes(text.toLowerCase()));
  const unsafeButtons = await page.$$eval('button', buttons => buttons
    .map(button => button.textContent.trim())
    .filter(text => /\b(execute|broker|buy|sell|submit)\b/i.test(text) && !/\bblocked\b/i.test(text)));

  const result = {
    key: spec.key,
    route: spec.route,
    viewport: spec.viewport,
    file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    bytes: stats.size,
    ok: stats.size > 5000 && missingText.length === 0 && forbiddenText.length === 0 && unsafeButtons.length === 0 && layoutIssues.length === 0 && pageErrors.length === 0,
    missing_text: missingText,
    forbidden_text: forbiddenText,
    unsafe_buttons: unsafeButtons,
    layout_issues: layoutIssues,
    page_errors: pageErrors,
    console_errors: consoleErrors.slice(0, 10),
  };
  proof.screenshots.push(result);
  await page.close();
  return result;
}

async function launchProofBrowser() {
  return chromium.launch({ headless: true, args: CHROMIUM_ARGS });
}

async function captureScreenshots() {
  const proof = { screenshots: [] };
  let browser = await launchProofBrowser();
  const desktop = { width: 1920, height: 1400 };
  const mobile = { width: 390, height: 900 };
  const specs = [
      {
        key: 'shell-desktop',
        route: '/shell?proof=ui-ux',
        file: 'shell-desktop.png',
        viewport: desktop,
        waitForText: ['Trading (Analysis)', 'Brain Status'],
        action: waitForShellStatus,
        mustContain: ['Trading (Analysis)', 'Luke System', 'Brain Status'],
        mustNotContain: ['loading'],
        fullPage: false,
      },
      {
        key: 'shell-mobile',
        route: '/shell?proof=ui-ux',
        file: 'shell-mobile.png',
        viewport: mobile,
        waitForText: ['Trading (Analysis)', 'Brain Status'],
        action: waitForShellStatus,
        mustContain: ['Trading (Analysis)', 'Brain Status'],
        mustNotContain: ['loading'],
      },
      {
        key: 'shell-daily-panel-desktop',
        route: '/shell?proof=ui-ux-daily-panel',
        file: 'shell-daily-panel-desktop.png',
        viewport: desktop,
        waitForText: ['Trading (Analysis)', 'Daily Brief'],
        action: openDailyPanelFromShell,
        mustContain: ['Daily Brief / Schedule Window'],
        mustNotContain: ['loading'],
      },
      {
        key: 'luke-chat-desktop',
        route: '/luke?proof=ui-ux',
        file: 'luke-chat-desktop.png',
        viewport: desktop,
        waitForText: ['DASHBOARD'],
        action: async page => sendChatCommand(page, '/status', 'LUKE ONLINE'),
        mustContain: ['LUKE ONLINE', 'Autonomous: recommendation-only'],
      },
      {
        key: 'trading-chat-desktop',
        route: '/trading?proof=ui-ux',
        file: 'trading-chat-desktop.png',
        viewport: desktop,
        waitForText: ['DASHBOARD'],
        action: async page => sendChatCommand(page, '/ready', 'READY SESSION READINESS'),
        mustContain: ['READY SESSION READINESS', 'NOT READY'],
      },
      {
        key: 'trading-window-desktop',
        route: '/trading-window?mode=replay&example=positive&proof=ui-ux',
        file: 'trading-window-desktop.png',
        viewport: desktop,
        waitForText: ['Luke Trading Window', 'Chart Panel', 'Bracket Plan', 'Katbot / Heatmap Input'],
        action: waitForTradingWindowChart,
        mustContain: ['No execution controls', 'Can submit', 'false'],
        mustNotContain: ['Focus: loading'],
      },
      {
        key: 'trading-window-mobile',
        route: '/trading-window?mode=replay&example=positive&proof=ui-ux',
        file: 'trading-window-mobile.png',
        viewport: mobile,
        waitForText: ['Luke Trading Window', 'Bracket Plan'],
        action: waitForTradingWindowChart,
        mustContain: ['No execution controls', 'Replay/dev simulated'],
        mustNotContain: ['Focus: loading'],
      },
      {
        key: 'daily-window-desktop',
        route: '/daily?proof=ui-ux',
        file: 'daily-window-desktop.png',
        viewport: desktop,
        waitForText: ['Luke Daily', 'Daily Brief', 'This Week'],
        action: waitForDailyWindow,
        mustContain: ['I love Kat', 'Knoxville, TN', 'Wilmington, NC', 'Gmail cleanup', 'History Jobs / Leads'],
        mustNotContain: ['Loading date', 'Loading mail'],
      },
      {
        key: 'daily-window-mobile',
        route: '/daily?proof=ui-ux',
        file: 'daily-window-mobile.png',
        viewport: mobile,
        waitForText: ['Luke Daily', 'Daily Brief'],
        action: waitForDailyWindow,
        mustContain: ['I love Kat', 'Move to Tennessee', 'Gmail cleanup', 'History Jobs / Leads'],
        mustNotContain: ['Loading date', 'Loading mail'],
      },
      {
        key: 'operator-v2-desktop',
        route: '/operator-v2?demo=client&proof=ui-ux',
        file: 'operator-v2-desktop.png',
        viewport: desktop,
        waitForText: ['Luke Operator V2 - Read Only', 'Replay Trading Window Embedded In Dashboard', 'Client Demo Replay Trade Plan'],
        mustContain: ['No execution controls', 'Client Demo Replay Trade Plan'],
        mustNotContain: ['Loading chart', 'Loading candidates', 'Loading heatmap proof'],
      },
      {
        key: 'brain-dashboard-desktop',
        route: '/brain-dashboard?proof=ui-ux',
        file: 'brain-dashboard-desktop.png',
        viewport: desktop,
        waitForText: ['Luke Brain', 'Brain Next Actions'],
        action: waitForBrainDashboard,
        mustContain: ['Luke Brain', 'Brain Next Actions', 'AI Automation Business Spine', 'Recommendation-only'],
        mustNotContain: ['Loading'],
      },
      {
        key: 'brain-dashboard-mobile',
        route: '/brain-dashboard?proof=ui-ux',
        file: 'brain-dashboard-mobile.png',
        viewport: mobile,
        waitForText: ['Luke Brain', 'Brain Next Actions'],
        action: waitForBrainDashboard,
        mustContain: ['Luke Brain', 'Brain Next Actions', 'Recommendation-only'],
        mustNotContain: ['Loading'],
      },
  ];

  try {
    for (const spec of specs) {
      try {
        await capturePage(browser, spec, proof);
      } catch (err) {
        try {
          await browser.close();
        } catch {}
        browser = await launchProofBrowser();
        try {
          await capturePage(browser, spec, proof);
        } catch (retryErr) {
          proof.screenshots.push({
            key: spec.key,
            route: spec.route,
            file: spec.file,
            ok: false,
            issues: [`capture failed after retry: ${retryErr?.message || retryErr}`],
            page_errors: [],
            console_errors: [],
          });
        }
      }
    }
  } finally {
    try {
      await browser.close();
    } catch {}
  }
  return proof;
}

async function main() {
  ensureDir(OUT_DIR);
  const app = await ensureApp();
  const proof = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    app,
    screenshots: [],
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'luke-ui-ux-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`luke-ui-ux proof ok: ${proof.ok}`);
    process.exitCode = 1;
    return;
  }

  const captured = await captureScreenshots();
  proof.screenshots = captured.screenshots;
  proof.ok = proof.screenshots.length > 0 && proof.screenshots.every(item => item.ok);
  fs.writeFileSync(path.join(OUT_DIR, 'luke-ui-ux-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`luke-ui-ux proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'luke-ui-ux-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`luke-ui-ux proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
