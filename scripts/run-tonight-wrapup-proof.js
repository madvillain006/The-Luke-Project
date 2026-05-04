#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'tonight-wrapup');
const BASE_URL = process.env.LUKE_BASE_URL || 'http://127.0.0.1:3000';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchJson(route) {
  const url = `${BASE_URL}${route}`;
  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_err) { json = { raw: text.slice(0, 2000) }; }
    return { ok: response.ok, status: response.status, route, url, response: json };
  } catch (err) {
    return { ok: false, status: null, route, url, error: err.message };
  }
}

async function postChat(command) {
  const route = '/chat';
  const url = `${BASE_URL}${route}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: command, history: [] }),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_err) { json = { raw: text.slice(0, 2000) }; }
    return { ok: response.ok, status: response.status, route, url, command, response: json };
  } catch (err) {
    return { ok: false, status: null, route, url, command, error: err.message };
  }
}

async function screenshot(page, route, fileName, options = {}) {
  const url = route.startsWith('http') ? route : `${BASE_URL}${route}`;
  const output = path.join(OUT_DIR, fileName);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (options.waitForText) {
      await page.getByText(options.waitForText).first().waitFor({ timeout: 10000 });
    }
    if (options.locator) {
      await page.locator(options.locator).first().screenshot({ path: output });
    } else {
      await page.screenshot({ path: output, fullPage: options.fullPage !== false });
    }
    return { ok: true, route, url, path: path.relative(ROOT, output).replace(/\\/g, '/') };
  } catch (err) {
    return { ok: false, route, url, path: path.relative(ROOT, output).replace(/\\/g, '/'), error: err.message };
  }
}

async function layoutMetrics(page, route) {
  const url = route.startsWith('http') ? route : `${BASE_URL}${route}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    return {
      ok: true,
      route,
      url,
      metrics: await page.evaluate(() => ({
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        scroll_width: document.documentElement.scrollWidth,
        scroll_height: document.documentElement.scrollHeight,
        horizontal_scroll_required: document.documentElement.scrollWidth > window.innerWidth,
        vertical_scroll_required: document.documentElement.scrollHeight > window.innerHeight,
      })),
    };
  } catch (err) {
    return { ok: false, route, url, error: err.message };
  }
}

async function main() {
  ensureDir(OUT_DIR);
  const apiRoutes = [
    ['/api/operator/status', 'api-status.json'],
    ['/api/operator/readiness', 'api-readiness.json'],
    ['/api/decision?instrument=ES&mode=manual', 'api-decision.json'],
    ['/api/confluence?instrument=ES', 'api-confluence.json'],
    ['/api/research/fake-breakdown-watchlist?instrument=ES', 'api-watchlist.json'],
    ['/agent/autonomous/status', 'api-autonomous-status.json'],
    ['/agent/autonomous/preflight', 'api-autonomous-preflight.json'],
  ];

  const api = {};
  for (const [route, fileName] of apiRoutes) {
    const result = await fetchJson(route);
    api[route] = result;
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(result, null, 2), 'utf8');
  }

  const chat = {};
  for (const [command, fileName] of [
    ['/saty', 'chat-saty.json'],
    ['/verdict ES', 'chat-verdict-es.json'],
  ]) {
    const result = await postChat(command);
    chat[command] = result;
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(result, null, 2), 'utf8');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const screenshots = [];
  screenshots.push(await screenshot(page, '/', 'old-shell.png'));
  screenshots.push(await screenshot(page, '/', 'old-shell-viewport.png', { fullPage: false }));
  screenshots.push(await screenshot(page, '/operator-v2', 'operator-v2.png', { waitForText: 'Fake Breakdown Watchlist' }));
  screenshots.push(await screenshot(page, '/operator-v2', 'operator-v2-watchlist-card.png', {
    waitForText: 'Fake Breakdown Watchlist',
    locator: 'article[aria-labelledby="fake-breakdown-title"]',
  }));
  screenshots.push(await screenshot(page, '/research/fake-breakdown-watchlist', 'fake-breakdown-watchlist.png', {
    waitForText: 'Fake Breakdown Watchlist Replay',
  }));
  const layout = {
    shell: await layoutMetrics(page, '/'),
    operator_v2: await layoutMetrics(page, '/operator-v2'),
  };
  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'ui-layout-metrics.json'), JSON.stringify(layout, null, 2), 'utf8');

  const proof = {
    ok: screenshots.every(item => item.ok) && Object.values(api).every(item => item.ok) && Object.values(chat).every(item => item.ok),
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    screenshots,
    api,
    chat,
    layout,
    safety: {
      get_only_and_read_only_chat_commands: true,
      no_execution_controls_added: true,
      watchlist_status: 'WATCHLIST_ONLY',
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'virtual-operator-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.join('artifacts', 'proof', 'tonight-wrapup', 'virtual-operator-proof.json')}`);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`tonight wrap-up proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
