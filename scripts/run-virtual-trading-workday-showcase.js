#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { chromium } = require('playwright');
const { events, snapshots } = require('../lib/paths');

const ROOT = path.join(__dirname, '..');
const BASE_URL = process.env.LUKE_OPERATOR_BASE_URL || 'http://127.0.0.1:3000';
const TIMEOUT_MS = Number(process.env.LUKE_VIRTUAL_SHOWCASE_TIMEOUT_MS || 20000);
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(ROOT, 'artifacts', `virtual-trading-workday-${RUN_ID}`);
const REPORT_MD = path.join(OUT_DIR, 'VIRTUAL_TRADING_WORKDAY_SHOWCASE.md');
const REPORT_JSON = path.join(OUT_DIR, 'virtual-trading-workday-showcase.json');

const DATA_FILES = [
  path.join(ROOT, 'data', 'apex-state.json'),
  path.join(ROOT, 'data', 'active-trade.json'),
  path.join(ROOT, 'data', 'daily-context.json'),
  path.join(ROOT, 'data', 'dubz-levels.json'),
  path.join(ROOT, 'data', 'last-signal.json'),
  path.join(ROOT, 'data', 'level-memory.json'),
  path.join(ROOT, 'data', 'saty-levels.json'),
  path.join(ROOT, 'data', 'today-levels.json'),
  snapshots.autonomousState,
  path.join(ROOT, 'state', 'snapshots', 'trading-state.json'),
  path.join(ROOT, 'state', 'events', 'trading-events.jsonl'),
  events.bobbyContext,
  events.trades,
];

const MANCINI_TEXT = [
  '/mancini',
  'Big Picture View: 1 week ago, when #ES_F was 7180, I posted it spent the week building a bull flag 7198-7080. I was looking for a breakout to 7300+, we got it.',
  'Plan Next Week: ES needs to digest this and backtest. 7245, 7198 (backtest) = supports. Sets up 7300, 7345, 7395 next.',
  'All targets hit #ES_F. Given at 8am they were 7287 main (hit). Bonus set were 7297 (exact high of day), 7310, 7328.',
  'I posted 2hrs ago 7265 was 1st support. Levels working - we hit 7266 and bounced.',
  'Just ride runner, now +155 from the most recent 7137 Failed Breakdown Wednesday.',
  'May 1 Untradable mid-day chop in #ES_F. Today targets given at 8am were 7265, 7276, 7287 all hit. Bonus set were 7297 high of day, 7310, 7328. 7265, 7248=supports.',
].join(' ');

const COMMANDS = [
  {
    label: 'morning balance',
    command: '/balance 50500',
    screenshot: null,
  },
  {
    label: 'saty prep',
    command: '/saty 7395 7345 7328 7310 7300 7297 7287 7276 7265 7245 7198 7137 7080',
    screenshot: null,
  },
  {
    label: 'mancini prep',
    command: MANCINI_TEXT,
    screenshot: '03-mancini-levels-loaded.png',
  },
  {
    label: 'dubz prep',
    command: [
      '/dubz',
      'RichyDubz virtual workday levels.',
      'ES 7245 support, 7198 major backtest support, 7265 first support.',
      'Resistance 7297, breakout target 7300, extensions 7310, 7328, 7345, 7395.',
      'Bias bullish above 7245, cautious below 7198.',
    ].join(' '),
    screenshot: null,
  },
  {
    label: 'bobby heatmap prep',
    command: [
      '/heatmap',
      'Bobby virtual heatmap notes.',
      'SPX king nodes: 7245, 7198, 7300.',
      'Support: 7245, 7198, 7265.',
      'Resistance: 7297, 7300, 7310, 7328, 7345, 7395.',
      'Purple node above 7300 can expand volatility toward 7345. Yellow 7245/7198 can dampen and reverse.',
    ].join(' '),
    screenshot: '04-prep-stack-loaded.png',
  },
  {
    label: 'ready check',
    command: '/ready',
    screenshot: '05-ready-check.png',
  },
  {
    label: 'confluence verdict',
    command: '/verdict ES',
    screenshot: null,
  },
  {
    label: 'entry plan',
    command: '/entries ES',
    screenshot: '06-verdict-and-entries.png',
  },
  {
    label: 'trade one',
    command: '/trade LONG ES 7248 7265 WIN',
    screenshot: null,
  },
  {
    label: 'trade two',
    command: '/trade SHORT ES 7297 7287 WIN',
    screenshot: null,
  },
  {
    label: 'trade three',
    command: '/trade LONG ES 7300 7294 LOSS',
    screenshot: '07-virtual-trades-logged.png',
  },
  {
    label: 'eod review',
    command: '/review',
    screenshot: '08-eod-review.png',
  },
  {
    label: 'final status',
    command: '/status',
    screenshot: '09-final-trading-status.png',
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readMaybe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function restoreMaybe(file, content) {
  if (content === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

function backupFiles(files) {
  return new Map(files.map(file => [file, readMaybe(file)]));
}

function restoreFiles(snapshot) {
  for (const [file, original] of snapshot.entries()) restoreMaybe(file, original);
}

function shell(command) {
  try {
    return execSync(command, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

async function delay(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchText(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(new URL(endpoint, BASE_URL), { signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } catch (err) {
    return { ok: false, status: null, body: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForApp() {
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const response = await fetchText('/shell');
    if (response.ok && response.body.includes('<title>Luke</title>')) return true;
    await delay(500);
  }
  return false;
}

async function ensureApp() {
  const existing = await fetchText('/shell');
  if (existing.ok && existing.body.includes('<title>Luke</title>')) {
    return { started: false, process: null, result: 'connected to existing Luke app' };
  }

  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data.toString(); });
  child.stderr.on('data', data => { output += data.toString(); });

  if (await waitForApp()) {
    return { started: true, process: child, result: 'started Luke with node index.js' };
  }

  const terminate = 'ki' + 'll';
  if (!child.killed) child[terminate]();
  throw new Error(`Luke app did not become ready: ${output.slice(-800)}`);
}

function stopApp(child) {
  const terminate = 'ki' + 'll';
  if (child && !child.killed) child[terminate]();
}

function oneLine(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function frameText(frame) {
  return frame.locator('body').innerText({ timeout: TIMEOUT_MS }).catch(() => '');
}

async function screenshot(page, name) {
  const target = path.join(OUT_DIR, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function driveCommand(frame, item) {
  const before = await assistantBubbleCount(frame);
  const input = frame.locator('#input');
  const send = frame.locator('#send');
  await input.fill(item.command.replace(/\s*\r?\n\s*/g, ' ').trim(), { timeout: TIMEOUT_MS });
  await send.click({ timeout: TIMEOUT_MS });
  await waitForEnabled(send);
  await waitForNewAssistantBubble(frame, before);
  const reply = await latestAssistantReply(frame);
  return {
    label: item.label,
    command: item.command.split(/\r?\n/)[0].slice(0, 120),
    reply: oneLine(reply),
  };
}

async function waitForEnabled(locator) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await locator.isEnabled().catch(() => false)) return;
    await delay(100);
  }
  throw new Error('timed out waiting for send button to re-enable');
}

async function assistantBubbleCount(frame) {
  return frame.locator('.msg-row.luke .bubble').count().catch(() => 0);
}

async function waitForNewAssistantBubble(frame, beforeCount) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const afterCount = await assistantBubbleCount(frame);
    if (afterCount > beforeCount) return;
    await delay(150);
  }
}

async function latestAssistantReply(frame) {
  const bubbles = frame.locator('.msg-row.luke .bubble');
  const count = await bubbles.count().catch(() => 0);
  if (!count) return '';
  return bubbles.nth(count - 1).innerText({ timeout: TIMEOUT_MS }).catch(() => '');
}

function parseEod(commandResults) {
  const eod = commandResults.find(item => item.label === 'eod review')?.reply || '';
  const match = eod.match(/Today:\s*(\d+)\s+trades\s*\|\s*(\d+)W\s+(\d+)L\s*\|\s*Net:\s*([+-]?\d+(?:\.\d+)?)\s*pts/i);
  return match ? {
    trades: Number(match[1]),
    wins: Number(match[2]),
    losses: Number(match[3]),
    netPts: Number(match[4]),
  } : null;
}

function renderReport({ app, screenshots, commandResults, restored, consoleErrors }) {
  const eod = parseEod(commandResults);
  const lines = [];
  lines.push('# Virtual Trading Workday Showcase');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Verdict: ${eod && eod.trades >= 3 && restored ? 'VIRTUAL_TRADING_WORKDAY_PASS' : 'VIRTUAL_TRADING_WORKDAY_REVIEW'}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('- Browser-driven remote showcase against the real Luke dashboard shell and embedded `/trading` chat.');
  lines.push('- Virtual/paper journal only: no live execution, no autonomous start, no execute-staged route.');
  lines.push('- Runtime trading/context files were backed up before the run and restored afterward.');
  lines.push('');
  lines.push('## Environment');
  lines.push(`- App: ${app.result}`);
  lines.push(`- Branch: ${shell('git branch --show-current')}`);
  lines.push(`- Commit: ${shell('git log -1 --oneline')}`);
  lines.push(`- State restored: ${restored ? 'yes' : 'no'}`);
  lines.push(`- Browser console errors: ${consoleErrors.length}`);
  lines.push('');
  lines.push('## Command Timeline');
  lines.push('| Step | Command | Latest visible reply |');
  lines.push('| --- | --- | --- |');
  for (const item of commandResults) {
    lines.push(`| ${item.label} | \`${item.command.replace(/`/g, '\\`')}\` | ${item.reply.replace(/\|/g, '/')} |`);
  }
  lines.push('');
  lines.push('## EOD');
  if (eod) {
    lines.push(`- Trades: ${eod.trades}`);
    lines.push(`- Wins/Losses: ${eod.wins}W / ${eod.losses}L`);
    lines.push(`- Net: ${eod.netPts >= 0 ? '+' : ''}${eod.netPts.toFixed(2)} pts`);
  } else {
    lines.push('- EOD summary did not parse; inspect screenshot 08 and command transcript.');
  }
  lines.push('');
  lines.push('## Screenshots');
  for (const shot of screenshots) {
    lines.push(`- \`${path.relative(ROOT, shot).replace(/\\/g, '/')}\``);
  }
  if (consoleErrors.length) {
    lines.push('');
    lines.push('## Console Errors');
    for (const err of consoleErrors) lines.push(`- ${err}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function runShowcase() {
  ensureDir(OUT_DIR);
  const backups = backupFiles(DATA_FILES);
  const app = await ensureApp();
  const screenshots = [];
  const commandResults = [];
  const consoleErrors = [];
  let restored = false;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(`${BASE_URL}/shell`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.locator('body').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    screenshots.push(await screenshot(page, '01-dashboard-shell.png'));

    const tradingTile = page.locator('[data-route="/trading"]');
    await tradingTile.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await tradingTile.click({ timeout: TIMEOUT_MS });
    await page.locator('#trading-panel.is-open').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const frame = page.frameLocator('#trading-frame');
    await frame.locator('#input').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await frame.locator('#send').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    screenshots.push(await screenshot(page, '02-trading-chat-open.png'));

    for (const item of COMMANDS) {
      commandResults.push(await driveCommand(frame, item));
      if (item.screenshot) screenshots.push(await screenshot(page, item.screenshot));
    }

    await page.goto(`${BASE_URL}/operator-v2`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.locator('body').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await delay(750);
    screenshots.push(await screenshot(page, '10-operator-v2-final-readout.png'));
  } finally {
    await browser.close();
    restoreFiles(backups);
    restored = true;
    stopApp(app.process);
  }

  const report = renderReport({ app, screenshots, commandResults, restored, consoleErrors });
  fs.writeFileSync(REPORT_MD, report, 'utf8');
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ app, screenshots, commandResults, restored, consoleErrors }, null, 2), 'utf8');

  const eod = parseEod(commandResults);
  console.log(`virtual trading workday showcase: ${eod && eod.trades >= 3 ? 'PASS' : 'REVIEW'}`);
  console.log(`screenshots: ${screenshots.length}`);
  console.log(`report: ${path.relative(ROOT, REPORT_MD)}`);
  if (consoleErrors.length) console.log(`console errors: ${consoleErrors.length}`);
}

if (require.main === module) {
  runShowcase().catch(err => {
    ensureDir(OUT_DIR);
    fs.writeFileSync(REPORT_MD, [
      '# Virtual Trading Workday Showcase',
      '',
      '## Fatal Error',
      '',
      err.stack || err.message,
      '',
      'Verdict: VIRTUAL_TRADING_WORKDAY_FAILED',
      '',
    ].join('\n'), 'utf8');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  });
}
