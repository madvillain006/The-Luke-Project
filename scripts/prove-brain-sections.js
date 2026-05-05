#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'brain-sections');
let BASE_URL = process.env.LUKE_BASE_URL || 'http://127.0.0.1:3000';
const PROOF_PORT = Number(process.env.LUKE_PROOF_PORT || 3001);

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
    const brain = await fetchText('/brain-dashboard');
    if (health.ok && health.text.includes('"app":"Luke"') && brain.ok && brain.text.includes('Luke Brain')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const health = await fetchText('/api/health');
  const brain = await fetchText('/brain-dashboard');
  if (health.ok && health.text.includes('"app":"Luke"') && brain.ok && brain.text.includes('Luke Brain')) {
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

async function waitForBrain(page) {
  await page.waitForFunction(() => {
    const meta = document.querySelector('#brain-meta')?.textContent || '';
    const automation = document.querySelector('#spine-automation')?.innerText || '';
    const developer = document.querySelector('#spine-developer')?.innerText || '';
    const daily = document.querySelector('#spine-daily')?.innerText || '';
    const history = document.querySelector('#spine-history')?.innerText || '';
    return meta.trim()
      && !/loading/i.test(meta)
      && /AI Automation Business/i.test(automation)
      && /Developer AI Stack/i.test(developer)
      && /Daily/i.test(daily)
      && /history/i.test(history);
  }, { timeout: 30000 });
}

async function auditLayout(page) {
  return page.evaluate(() => {
    const issues = [];
    const nodes = [...document.querySelectorAll('button,a,input,.status,.metric,.search-row,pre')];
    for (const node of nodes) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const label = (node.textContent || node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.tagName).trim().replace(/\s+/g, ' ').slice(0, 80);
      if (rect.left < -2 || rect.right > window.innerWidth + 2) {
        issues.push({ type: 'viewport-x-overflow', label, x: Math.round(rect.left), right: Math.round(rect.right) });
      }
      if (node.scrollWidth > node.clientWidth + 4 && style.overflowX === 'visible') {
        issues.push({ type: 'text-x-overflow', label, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth });
      }
    }
    return issues.slice(0, 25);
  });
}

async function captureViewport(page, key, file, results) {
  const filePath = path.join(OUT_DIR, file);
  await page.screenshot({ path: filePath, fullPage: false });
  const body = await page.locator('body').innerText();
  const stats = fs.statSync(filePath);
  const layoutIssues = await auditLayout(page);
  const item = {
    key,
    file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    bytes: stats.size,
    ok: stats.size > 5000 && layoutIssues.length === 0,
    layout_issues: layoutIssues,
    body_excerpt: body.slice(0, 400),
  };
  results.push(item);
  return item;
}

async function clickSection(page, key, selector, expectedTexts, file, results) {
  const outputSelector = selector.includes('artifact') ? '#artifact-output' : '#section-output';
  await page.locator(selector).click();
  await page.waitForFunction(({ expected, outputSelector }) => {
    const output = document.querySelector(outputSelector)?.innerText || '';
    return expected.every(text => output.toLowerCase().includes(text.toLowerCase()));
  }, { expected: expectedTexts, outputSelector }, { timeout: 30000 });
  const panel = page.locator(outputSelector);
  await panel.scrollIntoViewIfNeeded();
  return captureViewport(page, key, file, results);
}

async function runProof() {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const consoleErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.goto(new URL('/brain-dashboard?proof=brain-sections', BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
    await waitForBrain(page);
    await captureViewport(page, 'brain-dashboard-loaded', 'brain-dashboard-loaded.png', results);

    await clickSection(page, 'brain-brief', '[data-section="brain-brief"]', ['Brain:', 'Next Actions'], 'brain-brief.png', results);
    await clickSection(page, 'morning-brief', '[data-section="daily-morning"]', ['Morning brief', 'Weather:', 'Market'], 'morning-brief.png', results);
    await clickSection(page, 'afternoon-brief', '[data-section="daily-afternoon"]', ['Afternoon brief', 'Weather:', 'News:'], 'afternoon-brief.png', results);
    await clickSection(page, 'automation-plan', '[data-section="automation-plan"]', ['First 30 Days', 'Sub-agents'], 'automation-plan.png', results);
    await clickSection(page, 'developer-plan', '[data-section="developer-plan"]', ['Provider Order', 'Setup Plan'], 'developer-plan.png', results);
    await clickSection(page, 'history-searches', '[data-section="history-searches"]', ['Tracks', 'Next Searches'], 'history-searches.png', results);
    await clickSection(page, 'automation-context-file', '[data-artifact="context-file"]', ['Quality Standards', 'regional history museum'], 'automation-context-file.png', results);

    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(new URL('/brain-dashboard?proof=brain-sections-mobile', BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
    await waitForBrain(page);
    await clickSection(page, 'mobile-developer-plan', '[data-section="developer-plan"]', ['Provider Order', 'Setup Plan'], 'mobile-developer-plan.png', results);

    await page.close();
  } finally {
    await browser.close();
  }

  return {
    ok: results.length > 0 && results.every(item => item.ok) && pageErrors.length === 0,
    screenshots: results,
    page_errors: pageErrors,
    console_errors: consoleErrors.slice(0, 10),
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
    screenshots: [],
    blockers: [],
  };

  if (app.status === 'startup_failed') {
    proof.blockers.push('app startup failed');
    fs.writeFileSync(path.join(OUT_DIR, 'brain-sections-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`brain-sections proof ok: ${proof.ok}`);
    process.exitCode = 1;
    return;
  }

  const result = await runProof();
  proof.ok = result.ok;
  proof.screenshots = result.screenshots;
  proof.page_errors = result.page_errors;
  proof.console_errors = result.console_errors;
  fs.writeFileSync(path.join(OUT_DIR, 'brain-sections-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`brain-sections proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'brain-sections-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`brain-sections proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
