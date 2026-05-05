'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { checkRuntimeHealth } = require('./check-runtime-health');
const { resolveProofPort } = require('./proof-runtime');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'luke-dashboard-demo');
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
    const shell = await fetchText('/shell');
    if (health.ok && health.text.includes('"app":"Luke"') && shell.ok && shell.text.includes('Trading (Analysis)')) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureApp() {
  const existing = await fetchText('/shell');
  const health = await fetchText('/api/health');
  if (existing.ok && existing.text.includes('Trading (Analysis)') && health.ok && health.text.includes('"app":"Luke"')) {
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

async function waitForTradingFrame(page) {
  await page.locator('#trading-panel.is-open').waitFor({ timeout: 15000 });
  const frameHandle = await page.locator('#trading-frame').elementHandle();
  const frame = frameHandle ? await frameHandle.contentFrame() : null;
  if (!frame) throw new Error('clicked trading iframe did not expose a content frame');
  await frame.getByText('Luke Trading Window').waitFor({ timeout: 15000 });
  await frame.getByText('Katbot / Heatmap Input').waitFor({ timeout: 15000 });
  await frame.getByText('Luke Level Reclaim Watch Script').waitFor({ timeout: 15000 });
  await frame.getByText('tradingview/luke-level-reclaim-watch.pine').waitFor({ timeout: 15000 });
  await frame.getByText('ACK Bobby heatmap 10:03').waitFor({ timeout: 15000 });
  await frame.waitForFunction(() => {
    const focus = document.querySelector('#chart-focus-summary')?.textContent || '';
    const chart = document.querySelector('#price-chart');
    return focus.includes('hidden')
      && !focus.toLowerCase().includes('loading')
      && chart
      && chart.children.length > 10;
  }, { timeout: 15000 });
  return frame;
}

async function waitForTradingChat(page) {
  await page.locator('#trading-panel.is-open').waitFor({ timeout: 15000 });
  await page.getByText('Trading (Analysis) / Luke Chat').waitFor({ timeout: 15000 });
  const frameHandle = await page.locator('#trading-frame').elementHandle();
  const frame = frameHandle ? await frameHandle.contentFrame() : null;
  if (!frame) throw new Error('clicked trading chat iframe did not expose a content frame');
  await frame.locator('#input').waitFor({ timeout: 15000 });
  return frame;
}

async function sendChatCommand(frame, command, expectedText) {
  await frame.locator('#input').fill(command);
  await frame.locator('#send').click();
  try {
    await frame.waitForFunction(({ expected }) => {
      const text = document.querySelector('#messages')?.innerText || document.body.innerText || '';
      return text.toLowerCase().includes(expected.toLowerCase());
    }, { expected: expectedText }, { timeout: 15000 });
  } catch (err) {
    throw new Error(`chat command "${command}" did not show "${expectedText}": ${err.message}`);
  }
}

async function runLukeChatSmoke(frame, options = {}) {
  const statusExpected = options.statusExpected || 'Luke chat: active for trading ops';
  await sendChatCommand(frame, '/status', statusExpected);
  if (typeof options.afterStatus === 'function') await options.afterStatus();
  const commands = options.commands || [
    ['/ready', 'READY SESSION READINESS'],
    ['/alert', 'ALERT Paste'],
    ['/balance', 'Apex balance'],
    ['/saty', 'Saty'],
  ];
  for (const [command, expected] of commands) {
    await sendChatCommand(frame, command, expected);
    if (typeof options.afterCommand === 'function') await options.afterCommand(command);
  }
  return frame.locator('body').innerText();
}

async function captureClickedShellScreenshots() {
  const paths = {
    outer_before_click: path.join(OUT_DIR, 'outer-luke-before-trading-click.png'),
    outer_after_chat_click: path.join(OUT_DIR, 'outer-luke-after-trading-chat-click.png'),
    clicked_trading_chat_status: path.join(OUT_DIR, 'outer-luke-trading-chat-status.png'),
    clicked_trading_chat_ready: path.join(OUT_DIR, 'outer-luke-trading-chat-ready.png'),
    clicked_trading_chat_panel: path.join(OUT_DIR, 'outer-luke-clicked-trading-chat-panel.png'),
    clicked_trading_chat_smoke: path.join(OUT_DIR, 'outer-luke-trading-chat-command-smoke.png'),
    outer_after_window_switch: path.join(OUT_DIR, 'outer-luke-after-window-switch.png'),
    clicked_trading_window_panel: path.join(OUT_DIR, 'outer-luke-clicked-trading-window-panel.png'),
    clicked_trading_frame: path.join(OUT_DIR, 'outer-luke-clicked-trading-window-frame.png'),
    clicked_heatmap_a: path.join(OUT_DIR, 'outer-luke-clicked-heatmap-a.png'),
    clicked_heatmap_b: path.join(OUT_DIR, 'outer-luke-clicked-heatmap-b.png'),
    system_chat_after_click: path.join(OUT_DIR, 'outer-luke-system-chat-status.png'),
    system_chat_smoke: path.join(OUT_DIR, 'outer-luke-system-chat-command-smoke.png'),
  };

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });
    await page.goto(new URL('/shell?proof=outer-click', BASE_URL).toString(), { waitUntil: 'load', timeout: 30000 });
    await page.locator('#trading-launch').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: paths.outer_before_click, fullPage: false });

    await page.locator('#trading-launch').click();
    const chatFrame = await waitForTradingChat(page);
    const chatSmokeText = await runLukeChatSmoke(chatFrame, {
      afterStatus: async () => {
        await page.locator('#trading-panel').screenshot({ path: paths.clicked_trading_chat_status });
      },
      afterCommand: async (command) => {
        if (command === '/ready') {
          await page.locator('#trading-panel').screenshot({ path: paths.clicked_trading_chat_ready });
        }
      },
    });
    await page.screenshot({ path: paths.outer_after_chat_click, fullPage: false });
    await page.locator('#trading-panel').screenshot({ path: paths.clicked_trading_chat_panel });
    await page.locator('#trading-panel').screenshot({ path: paths.clicked_trading_chat_smoke });
    const outerChatText = await page.locator('body').innerText();
    const chatText = await chatFrame.locator('body').innerText();

    await page.locator('#trading-window-view').click();
    const frame = await waitForTradingFrame(page);
    await page.screenshot({ path: paths.outer_after_window_switch, fullPage: false });
    await page.locator('#trading-panel').screenshot({ path: paths.clicked_trading_window_panel });
    await page.locator('#trading-frame').screenshot({ path: paths.clicked_trading_frame });
    await frame.locator('[data-trading-window-heatmap-fixture]').nth(0).screenshot({ path: paths.clicked_heatmap_a });
    await frame.locator('[data-trading-window-heatmap-fixture]').nth(1).screenshot({ path: paths.clicked_heatmap_b });

    const outerWindowText = await page.locator('body').innerText();
    const tradingText = await frame.locator('body').innerText();
    const moduleWidths = await page.$$eval('.module-art', nodes => nodes.map(node => Math.round(node.getBoundingClientRect().width)));
    const unsafeShellButtons = await page.$$eval('button', buttons => buttons
      .map(button => button.textContent.trim())
      .filter(text => /\b(execute|broker|buy|sell|submit)\b/i.test(text)));
    const unsafeTradingButtons = await frame.$$eval('button', buttons => buttons
      .map(button => button.textContent.trim())
      .filter(text => /\b(execute|broker|buy|sell|submit)\b/i.test(text)));

    await page.locator('#trading-close').click();
    await page.locator('.system-button').click();
    await page.locator('#system-panel.is-open').waitFor({ timeout: 15000 });
    const systemFrameHandle = await page.locator('#system-frame').elementHandle();
    const systemFrame = systemFrameHandle ? await systemFrameHandle.contentFrame() : null;
    if (!systemFrame) throw new Error('system chat iframe did not expose a content frame');
    const systemSmokeText = await runLukeChatSmoke(systemFrame, {
      commands: [
        ['/ready', 'belongs in the Trading tab'],
        ['/luke', 'Luke system chat is active'],
      ],
    });
    await page.locator('#system-panel').screenshot({ path: paths.system_chat_after_click });
    await page.locator('#system-panel').screenshot({ path: paths.system_chat_smoke });
    const systemText = await systemFrame.locator('body').innerText();
    const commandSmokeRe = /LUKE ONLINE[\s\S]*READY SESSION READINESS[\s\S]*ALERT Paste[\s\S]*Apex balance[\s\S]*Saty/i;
    const systemSmokeRe = /LUKE ONLINE[\s\S]*Luke chat: active for trading ops[\s\S]*belongs in the Trading tab[\s\S]*Luke system chat is active/i;

    return {
      ok: true,
      shell_before_click_visible: /Trading \(Analysis\)/i.test(outerChatText),
      trading_chat_opened_by_click: /Trading \(Analysis\) \/ Luke Chat/i.test(outerChatText) && /LUKE ONLINE/i.test(chatText),
      trading_chat_command_smoke: commandSmokeRe.test(chatSmokeText) && !/personal logging is retired/i.test(chatSmokeText),
      trading_window_opened_by_switch: /Trading \(Analysis\) \/ Live-Shaped Trading Window/i.test(outerWindowText),
      trading_frame_loaded: /Luke Trading Window/i.test(tradingText) && /Chart Panel/i.test(tradingText),
      bracket_visible: /Bracket Plan/i.test(tradingText) && /Can submit\s+false/i.test(tradingText),
      heatmap_visible: /Katbot \/ Heatmap Input/i.test(tradingText) && /ACK Bobby heatmap 10:03/i.test(tradingText) && /ACK Bobby heatmap 10:05/i.test(tradingText),
      pine_visible: /Luke Level Reclaim Watch Script/i.test(tradingText) && /tradingview\/luke-level-reclaim-watch\.pine/i.test(tradingText),
      replay_not_live_visible: /Replay\/dev simulated/i.test(tradingText) && /No execution controls/i.test(tradingText) && /Not a live trade recommendation/i.test(tradingText),
      system_chat_visible: /LUKE ONLINE/i.test(systemText) && /Autonomous: recommendation-only/i.test(systemText),
      system_chat_command_smoke: systemSmokeRe.test(systemSmokeText) && !/personal logging is retired/i.test(systemSmokeText),
      dashboard_tiles_compact: moduleWidths.length > 0 && Math.max(...moduleWidths) <= 280,
      module_widths: moduleWidths,
      no_unsafe_buttons: unsafeShellButtons.length === 0 && unsafeTradingButtons.length === 0,
      unsafe_buttons: [...unsafeShellButtons, ...unsafeTradingButtons],
      paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, path.relative(ROOT, value).replace(/\\/g, '/')])) ,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, path.relative(ROOT, value).replace(/\\/g, '/')])) ,
    };
  } finally {
    if (browser) await browser.close();
  }
}

function safety(api, screenshots) {
  const chart = api.chart_data?.body || {};
  const heatmap = api.heatmap_proof?.body || {};
  return {
    all_get_endpoints_ok: Object.values(api).every(result => result.ok),
    no_live_execution_flags: [chart, heatmap].every(body => body.no_live_execution === true),
    replay_not_live: chart.live === false && chart.usable_for_live_arming === false,
    outer_shell_before_click: screenshots.shell_before_click_visible === true,
    trading_chat_opened_by_click: screenshots.trading_chat_opened_by_click === true,
    trading_chat_command_smoke: screenshots.trading_chat_command_smoke === true,
    trading_window_opened_by_switch: screenshots.trading_window_opened_by_switch === true,
    clicked_trading_window_loaded: screenshots.trading_frame_loaded === true,
    bracket_inside_clicked_window: screenshots.bracket_visible === true,
    heatmap_inside_clicked_window: screenshots.heatmap_visible === true,
    pine_inside_clicked_window: screenshots.pine_visible === true,
    system_chat_clicked_flow: screenshots.system_chat_visible === true,
    system_chat_command_smoke: screenshots.system_chat_command_smoke === true,
    dashboard_tiles_compact: screenshots.dashboard_tiles_compact === true,
    no_unsafe_buttons: screenshots.no_unsafe_buttons === true,
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
    fs.writeFileSync(path.join(OUT_DIR, 'luke-dashboard-demo-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
    console.log(`luke-dashboard-demo proof ok: ${proof.ok}`);
    process.exitCode = 1;
    return;
  }

  const replay = '?instrument=ES&mode=replay&example=positive';
  proof.api.health = await fetchJson('/api/health', 'api-health.json');
  proof.api.chart_data = await fetchJson(`/api/trading/chart-data${replay}`, 'api-chart-data.json');
  proof.api.heatmap_proof = await fetchJson('/api/operator/heatmap-proof', 'api-heatmap-proof.json');
  proof.screenshots = await captureClickedShellScreenshots();
  proof.safety = safety(proof.api, proof.screenshots);
  proof.ok = Object.values(proof.safety).every(Boolean);
  fs.writeFileSync(path.join(OUT_DIR, 'luke-dashboard-demo-proof.json'), JSON.stringify(proof, null, 2), 'utf8');
  console.log(`luke-dashboard-demo proof ok: ${proof.ok}`);
  console.log(`artifact: ${path.relative(ROOT, path.join(OUT_DIR, 'luke-dashboard-demo-proof.json')).replace(/\\/g, '/')}`);
  stopApp(app.process);
  if (!proof.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`luke-dashboard-demo proof failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
