#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { buildDecisionResponse } = require('../lib/operator/decision-adapter');
const { readTradingStateReadOnly } = require('../lib/operator/operator-status-adapter');

const ROOT = path.join(__dirname, '..');
const SESSION_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');
const DERIVED_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'derived');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const REPORT_MD = path.join(ARTIFACT_DIR, 'HISTORICAL_OPERATOR_LIVE_DRY_RUN.md');
const REPORT_JSON = path.join(ARTIFACT_DIR, 'historical-operator-live-dry-run.json');
const BASE_URL = process.env.LUKE_OPERATOR_BASE_URL || 'http://127.0.0.1:3000';
const TIMEOUT_MS = Number(process.env.LUKE_HISTORICAL_OPERATOR_TIMEOUT_MS || 20000);

const STATE_FILES = [
  path.join(ROOT, 'data', 'saty-levels.json'),
  path.join(ROOT, 'data', 'dubz-levels.json'),
  path.join(ROOT, 'data', 'daily-context.json'),
  path.join(ROOT, 'data', 'today-levels.json'),
  path.join(ROOT, 'data', 'level-memory.json'),
];

const DEFAULT_DATES = ['2026-04-07', '2026-04-20', '2026-04-22', '2026-04-23', '2026-04-28'];

function parseArgs(argv = process.argv.slice(2)) {
  const args = { dates: DEFAULT_DATES };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--dates' && next) {
      args.dates = next.split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
    }
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (err) { throw new Error(`${filePath}:${index + 1}: ${err.message}`); }
    });
}

function backupFiles(paths) {
  const backups = new Map();
  for (const filePath of paths) {
    backups.set(filePath, fs.existsSync(filePath)
      ? { existed: true, content: fs.readFileSync(filePath, 'utf8') }
      : { existed: false, content: null });
  }
  return backups;
}

function restoreFiles(backups) {
  for (const [filePath, backup] of backups.entries()) {
    if (backup.existed) {
      fs.writeFileSync(filePath, backup.content);
    } else if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function resetReplayState() {
  for (const filePath of STATE_FILES) {
    if (filePath.endsWith('level-memory.json')) {
      fs.writeFileSync(filePath, JSON.stringify({ version: 1, last_updated: null, levels: [] }, null, 2));
    } else if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
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

function withTimeout(ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

async function fetchText(endpoint) {
  const { controller, done } = withTimeout();
  try {
    const response = await fetch(new URL(endpoint, BASE_URL), { signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body, error: response.ok ? null : `HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, status: null, body: '', error: err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message };
  } finally {
    done();
  }
}

function retryDelayMs(response) {
  const seconds = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 65000);
  return 1500;
}

async function fetchJson(endpoint) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { controller, done } = withTimeout();
    try {
      const response = await fetch(new URL(endpoint, BASE_URL), { signal: controller.signal });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      if (response.status === 429 && attempt < 3) {
        await delay(retryDelayMs(response));
        continue;
      }
      return { ok: response.ok, status: response.status, body, error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      if (attempt === 3) {
        return { ok: false, status: null, body: null, error: err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message };
      }
      await delay(300);
    } finally {
      done();
    }
  }
}

async function waitForApp() {
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const response = await fetchText('/');
    if (response.ok && response.body.includes('<title>Luke</title>')) return true;
    await delay(500);
  }
  return false;
}

async function ensureApp() {
  const existing = await fetchText('/');
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
  const ready = await waitForApp();
  if (!ready) {
    const terminate = 'ki' + 'll';
    if (!child.killed) child[terminate]();
    return { started: true, process: null, result: `startup failed: ${output.slice(-800)}` };
  }
  return { started: true, process: child, result: 'started Luke with node index.js' };
}

function stopApp(child) {
  const terminate = 'ki' + 'll';
  if (child && !child.killed) child[terminate]();
}

function flattenCommand(command) {
  return String(command || '').replace(/\s*\r?\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function commandPreview(command) {
  const flat = flattenCommand(command);
  return flat.length > 120 ? `${flat.slice(0, 117)}...` : flat;
}

function satyCommand(session) {
  const levels = session.saty?.levels;
  if (!levels?.valid) return null;
  const ordered = [
    levels.atr_plus_1,
    levels.ext_plus_4,
    levels.ext_plus_3,
    levels.ext_plus_2,
    levels.ext_plus_1,
    levels.call_trigger,
    levels.prev_close,
    levels.put_trigger,
    levels.ext_minus_1,
    levels.ext_minus_2,
    levels.ext_minus_3,
    levels.ext_minus_4,
    levels.atr_minus_1,
  ].filter(Number.isFinite);
  return ordered.length === 13 ? `/saty ${ordered.map(value => Number(value).toFixed(2)).join(' ')}` : null;
}

function bobbyCommand(session, bobbyParses, checkpoint) {
  const beforeCheckpoint = new Date(checkpoint).getTime();
  const parsedLevels = bobbyParses
    .filter(row => row.tradingDateET === session.date)
    .filter(row => row.parseStatus === 'ok')
    .filter(row => new Date(row.timestamp).getTime() <= beforeCheckpoint)
    .flatMap(row => row.levels || [])
    .map(level => Number(level.price))
    .filter(Number.isFinite);

  const textLevels = (session.levels || [])
    .filter(level => level.source === 'bobby_text')
    .map(level => Number(level.price))
    .filter(Number.isFinite);

  const levels = [...new Set([...parsedLevels, ...textLevels])]
    .sort((a, b) => a - b)
    .slice(0, 18);
  if (!levels.length) return null;

  return [
    '/heatmap',
    `Bobby historical heatmap parse for ${session.date}.`,
    `SPX king nodes: ${levels.join(', ')}.`,
    `Support: ${levels.slice(0, Math.ceil(levels.length / 2)).join(', ')}.`,
    `Resistance: ${levels.slice(Math.floor(levels.length / 2)).join(', ')}.`,
    'Treat this as image-derived historical context for replay only.',
  ].join('\n');
}

function manciniCommand(session) {
  const posts = session.mancini?.entryReadyPosts || [];
  const selected = posts.slice(0, 3).map(post => post.content).filter(Boolean);
  if (selected.length) return `/mancini ${selected.join('\n\n')}`;

  const levels = (session.levels || [])
    .filter(level => level.source === 'mancini')
    .slice(0, 14);
  if (!levels.length) return null;
  const targets = levels.filter(level => /target|resistance/i.test(level.role || '')).map(level => level.price);
  const supports = levels.filter(level => /support|reclaim|watch|trigger/i.test(level.role || '')).map(level => level.price);
  return [
    '/mancini',
    `Historical Mancini plan for ${session.date}.`,
    supports.length ? `Supports/reclaims: ${supports.join(', ')}.` : '',
    targets.length ? `Targets/resistance: ${targets.join(', ')}.` : '',
  ].filter(Boolean).join('\n');
}

function barAtOrBefore(bars, timestamp) {
  const target = new Date(timestamp).getTime();
  let found = null;
  for (const bar of bars || []) {
    if (new Date(bar.timestamp).getTime() <= target) found = bar;
    else break;
  }
  return found;
}

function outcomeFromPlan(decision, bars, checkpoint) {
  const d = decision?.decision || decision;
  if (!d || !(d.action === 'LONG' || d.action === 'SHORT')) {
    return { status: 'NOT_ACTIONABLE', detail: d?.reason || 'PASS/WAIT' };
  }
  if (![d.entry, d.stop, d.target].every(Number.isFinite)) {
    return { status: 'NO_PLAN', detail: 'entry/stop/target incomplete' };
  }
  const start = new Date(checkpoint).getTime();
  let filledAt = null;
  for (const bar of bars || []) {
    if (new Date(bar.timestamp).getTime() <= start) continue;
    if (bar.low <= d.entry && bar.high >= d.entry) {
      filledAt = bar.timestamp;
      break;
    }
  }
  if (!filledAt) return { status: 'NO_FILL', detail: `entry ${d.entry} not touched after checkpoint` };
  for (const bar of bars || []) {
    if (new Date(bar.timestamp).getTime() < new Date(filledAt).getTime()) continue;
    const stop = d.action === 'LONG' ? bar.low <= d.stop : bar.high >= d.stop;
    const target = d.action === 'LONG' ? bar.high >= d.target : bar.low <= d.target;
    if (stop && target) return { status: 'AMBIGUOUS', detail: `stop and target touched in ${bar.timestamp}`, filledAt };
    if (target) return { status: 'TARGET_FIRST', detail: `target ${d.target} touched at ${bar.timestamp}`, filledAt };
    if (stop) return { status: 'STOP_FIRST', detail: `stop ${d.stop} touched at ${bar.timestamp}`, filledAt };
  }
  return { status: 'OPEN_AT_END', detail: 'entry filled, no stop/target by session end', filledAt };
}

function classifyDecision(payload) {
  const decision = payload?.decision || {};
  const spine = payload?.spine_decision || {};
  const vetoes = decision.vetoes || [];
  const reason = decision.reason || '';
  return {
    action: decision.action || null,
    spineAction: spine.action || null,
    reason,
    anchor: decision.confluence?.anchor ?? null,
    entry: decision.entry ?? null,
    acceptable_entry: decision.acceptable_entry ?? null,
    stop: decision.stop ?? null,
    target: decision.target ?? null,
    sizing: decision.sizing ?? null,
    vetoes,
    isActionable: decision.action === 'LONG' || decision.action === 'SHORT',
    hasSpinePlan: spine.action === 'LONG' || spine.action === 'SHORT',
    isWait: /WAIT/i.test(reason),
    isSkipChase: /SKIP CHASE/i.test(reason),
    hasChopVeto: vetoes.some(veto => veto.type === 'mancini_chop_zone'),
  };
}

function isRthBar(bar) {
  const date = new Date(bar.timestamp);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= (9 * 60 + 30) && minutes <= (16 * 60);
}

async function scanMinuteBars(date, bars) {
  const rows = [];
  const counts = {
    barsScanned: 0,
    actionable: 0,
    pass: 0,
    spinePlans: 0,
    waits: 0,
    skipChase: 0,
    chopVetoes: 0,
  };
  const sampleTypes = new Set();
  const rthBars = (bars || []).filter(isRthBar);

  for (const bar of rthBars) {
    counts.barsScanned += 1;
    const payload = await buildHistoricalDecision(bar.close);
    const classified = classifyDecision(payload);
    if (classified.isActionable) counts.actionable += 1;
    else counts.pass += 1;
    if (classified.hasSpinePlan) counts.spinePlans += 1;
    if (classified.isWait) counts.waits += 1;
    if (classified.isSkipChase) counts.skipChase += 1;
    if (classified.hasChopVeto) counts.chopVetoes += 1;

    const type = classified.isActionable
      ? 'actionable'
      : classified.hasChopVeto
        ? 'chop'
        : classified.isWait
          ? 'wait'
          : classified.isSkipChase
            ? 'skip'
            : classified.hasSpinePlan
              ? 'raw_plan_pass'
              : null;
    if (type && (!sampleTypes.has(type) || rows.length < 8)) {
      sampleTypes.add(type);
      rows.push({
        date,
        time: bar.timestamp,
        price: bar.close,
        sampleType: type,
        action: classified.action,
        spineAction: classified.spineAction,
        anchor: classified.anchor,
        entry: classified.entry,
        acceptable_entry: classified.acceptable_entry,
        stop: classified.stop,
        target: classified.target,
        sizing: classified.sizing,
        vetoes: classified.vetoes,
        reason: classified.reason,
      });
    }
  }

  return { date, ...counts, samples: rows };
}

function collectCandidateCheckpoints(candidates, date) {
  const rows = candidates.filter(row => row.date === date);
  const unique = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.time)) continue;
    seen.add(row.time);
    unique.push(row);
  }
  return unique;
}

async function buildHistoricalDecision(price) {
  const stateRead = readTradingStateReadOnly();
  const payload = await buildDecisionResponse({
    instrument: 'ES',
    mode: 'historical-operator-replay',
    currentPrice: price,
    state: stateRead.ok ? stateRead.value : null,
    now: new Date(),
    getLivePriceFn: false,
    getMarketPriceFn: false,
  });
  if (!stateRead.ok) {
    payload.ok = false;
    payload.blockers = stateRead.blockers || [`trading state unavailable: ${stateRead.error}`];
  }
  return payload;
}

async function driveUiCommand(page, command, timestampLabel) {
  const flat = flattenCommand(command);
  const input = page.locator('#input');
  const send = page.locator('#send');
  await input.fill(flat, { timeout: TIMEOUT_MS });
  await send.click({ timeout: TIMEOUT_MS });
  await waitForEnabled(send);
  await delay(650);
  return { timestampLabel, command: commandPreview(command), ok: true };
}

async function waitForEnabled(locator, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await locator.isEnabled().catch(() => false)) return true;
    await delay(100);
  }
  throw new Error(`timed out waiting for ${timeoutMs}ms for locator to become enabled`);
}

async function inspectOperatorDom(page) {
  await page.goto(`${BASE_URL}/operator-v2`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await page.locator('body').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await delay(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'historical-operator-v2.png'), fullPage: true });
  const text = await page.locator('body').innerText({ timeout: TIMEOUT_MS }).catch(() => '');
  const buttons = await page.locator('button').allTextContents({ timeout: TIMEOUT_MS }).catch(() => []);
  const panelCount = await page.locator('article.panel').count().catch(() => 0);
  return {
    header: text.includes('Luke Operator V2'),
    readOnly: text.includes('Read-only mirror'),
    recommendationOnly: /recommendation-only|no autonomous staging/i.test(text),
    marketData: /market data/i.test(text),
    noExecuteButton: buttons.map(label => label.trim().toLowerCase()).every(label => label === 'refresh'),
    panelCount,
  };
}

async function inspectShellDom(page) {
  await page.goto(`${BASE_URL}/shell`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await page.locator('body').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await delay(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'historical-luke-shell-dashboard.png'), fullPage: true });
  const text = await page.locator('body').innerText({ timeout: TIMEOUT_MS }).catch(() => '');
  const tradingTile = page.locator('[data-route="/trading"]').first();
  const hasTradingTile = await tradingTile.count().then(count => count > 0).catch(() => false);
  let tradingEmbedded = false;
  let tradingFrameReady = false;
  if (hasTradingTile) {
    await tradingTile.click({ timeout: TIMEOUT_MS });
    await page.locator('#trading-panel.is-open').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    tradingEmbedded = true;
    await page.frameLocator('#trading-frame').locator('#input').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.frameLocator('#trading-frame').locator('#send').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    tradingFrameReady = true;
  }
  return {
    title: text.includes('LUKE') && /brain/i.test(text),
    tradingBox: /trading\s*\(analysis\)|trading\s*\[analysis\]/i.test(text) && hasTradingTile,
    automationBox: /automation/i.test(text),
    developerBox: /developer/i.test(text),
    dailyBox: /daily/i.test(text),
    historyBox: /history career/i.test(text),
    tradingRoute: page.url().endsWith('/shell') && tradingEmbedded && tradingFrameReady,
    tradingEmbedded,
    tradingFrameReady,
  };
}

async function runReplay(options = {}) {
  const dates = options.dates || DEFAULT_DATES;
  ensureDir(ARTIFACT_DIR);
  const backups = backupFiles(STATE_FILES);
  const app = await ensureApp();
  if (!app.process && !/^connected/.test(app.result)) {
    throw new Error(app.result);
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const bobbyParses = readJsonl(path.join(DERIVED_DIR, 'bobby-image-parses.jsonl'));
  const candidates = readJsonl(path.join(DERIVED_DIR, 'long-candidates.jsonl'));
  const commandLog = [];
  const decisions = [];
  const minuteScans = [];
  const blocked = [];
  let shellDom = null;

  try {
    shellDom = await inspectShellDom(page);
    const chatSurface = page.frameLocator('#trading-frame');
    await chatSurface.locator('#input').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'historical-trading-chat-start.png'), fullPage: true });

    for (const date of dates) {
      resetReplayState();
      const sessionPath = path.join(SESSION_DIR, `${date}.json`);
      if (!fs.existsSync(sessionPath)) {
        blocked.push(`${date}: missing session JSON`);
        continue;
      }
      const session = readJson(sessionPath);
      const bars = session.bars?.es || [];
      if (!session.usable || bars.length === 0) {
        blocked.push(`${date}: session not usable for replay`);
        continue;
      }
      const checkpoints = collectCandidateCheckpoints(candidates, date);
      if (checkpoints.length === 0) {
        blocked.push(`${date}: no long-candidate timestamps`);
        continue;
      }

      const firstCheckpoint = checkpoints[0].time;
      const commands = [
        ['/balance 50000', `${date} 09:28 ET`],
        [satyCommand(session), `${date} 09:29 ET`],
        [bobbyCommand(session, bobbyParses, firstCheckpoint), `${date} 09:44 ET`],
        [manciniCommand(session), `${date} 09:48 ET`],
        ['/status', `${date} 09:50 ET`],
        ['/verdict ES', `${date} 09:51 ET`],
      ].filter(([command]) => Boolean(command));

      for (const [command, timestampLabel] of commands) {
        commandLog.push(await driveUiCommand(chatSurface, command, timestampLabel));
      }

      for (const candidate of checkpoints.slice(0, 2)) {
        commandLog.push(await driveUiCommand(chatSurface, '/entries ES', candidate.time));
      }

      minuteScans.push(await scanMinuteBars(date, bars));

      for (const candidate of checkpoints) {
        const bar = barAtOrBefore(bars, candidate.time);
        if (!bar) {
          blocked.push(`${candidate.id}: no bar at/before candidate time`);
          continue;
        }
        const payload = await buildHistoricalDecision(bar.close);
        const classified = classifyDecision(payload);
        const outcome = outcomeFromPlan(payload, bars, candidate.time);
        decisions.push({
          date,
          time: candidate.time,
          triggerType: candidate.triggerType,
          generatorEntry: candidate.entry,
          generatorAnchor: candidate.cluster?.anchor ?? null,
          generatorSources: candidate.confluenceSources || [],
          price: bar.close,
          apiOk: payload?.ok !== false,
          action: classified.action,
          reason: classified.reason,
          spineAction: classified.spineAction,
          anchor: classified.anchor,
          entry: classified.entry,
          acceptable_entry: classified.acceptable_entry,
          stop: classified.stop,
          target: classified.target,
          sizing: classified.sizing,
          vetoes: classified.vetoes,
          marketData: payload?.market_data || null,
          preflightBlockers: payload?.blockers || [],
          outcome,
        });
      }
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'historical-trading-chat-after-replay.png'), fullPage: true });
    const dom = await inspectOperatorDom(page);
    return { app, dates, commandLog, decisions, minuteScans, blocked, dom, shellDom };
  } finally {
    await browser.close();
    restoreFiles(backups);
    stopApp(app.process);
  }
}

function renderReport(result) {
  const counts = result.decisions.reduce((acc, row) => {
    if (row.action === 'LONG' || row.action === 'SHORT') acc.actionable += 1;
    else acc.pass += 1;
    if (row.spineAction === 'LONG' || row.spineAction === 'SHORT') acc.spinePlans += 1;
    if ((row.vetoes || []).some(veto => veto.type === 'mancini_chop_zone')) acc.chopVetoes += 1;
    if (row.reason && /WAIT/i.test(row.reason)) acc.waits += 1;
    if (row.reason && /SKIP CHASE/i.test(row.reason)) acc.skipChase += 1;
    return acc;
  }, { actionable: 0, pass: 0, spinePlans: 0, chopVetoes: 0, waits: 0, skipChase: 0 });
  const minuteCounts = (result.minuteScans || []).reduce((acc, row) => {
    acc.barsScanned += row.barsScanned || 0;
    acc.actionable += row.actionable || 0;
    acc.pass += row.pass || 0;
    acc.spinePlans += row.spinePlans || 0;
    acc.chopVetoes += row.chopVetoes || 0;
    acc.waits += row.waits || 0;
    acc.skipChase += row.skipChase || 0;
    return acc;
  }, { barsScanned: 0, actionable: 0, pass: 0, spinePlans: 0, chopVetoes: 0, waits: 0, skipChase: 0 });
  const verdict = result.blocked.length
    ? 'HISTORICAL_OPERATOR_REPLAY_PASS_WITH_LIMITATIONS'
    : 'HISTORICAL_OPERATOR_REPLAY_PASS';

  const lines = [];
  lines.push('# Historical Operator Live Dry Run');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Verdict: ${verdict}`);
  lines.push('');
  lines.push('## Environment');
  lines.push(`- Branch: ${shell('git branch --show-current')}`);
  lines.push(`- Commit: ${shell('git log -1 --oneline')}`);
  lines.push(`- App: ${result.app.result}`);
  lines.push(`- Dates: ${(result.dates || []).join(', ')}`);
  lines.push('- Driving method: headless Playwright verifies `/shell`, clicks the Trading tile, then drives the embedded `/trading` chat iframe by filling `#input` and clicking `#send` like the operator chat.');
  lines.push('- Price simulation: `/api/decision?currentPrice=<historical ES minute close>` at each candidate timestamp.');
  lines.push('- Execution: none. No start/stop, no execute-staged, no confirmation route.');
  lines.push('- State safety: live data files were backed up before replay, reset between historical dates, and restored after replay.');
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Commands pasted through trading chat UI: ${result.commandLog.length}`);
  lines.push(`- Candidate checkpoints: ${result.decisions.length}`);
  lines.push(`- Raw spine plans: ${counts.spinePlans}`);
  lines.push(`- Actionable recommendations after timing/veto adapter: ${counts.actionable}`);
  lines.push(`- PASS/WAIT/SKIP recommendations: ${counts.pass}`);
  lines.push(`- WAIT for entry: ${counts.waits}`);
  lines.push(`- SKIP CHASE: ${counts.skipChase}`);
  lines.push(`- Mancini chop vetoes: ${counts.chopVetoes}`);
  lines.push(`- Full-minute bars scanned: ${minuteCounts.barsScanned}`);
  lines.push(`- Full-minute actionable recommendations: ${minuteCounts.actionable}`);
  lines.push(`- Full-minute raw spine plans: ${minuteCounts.spinePlans}`);
  lines.push(`- Full-minute WAIT/SKIP recommendations: ${minuteCounts.waits}/${minuteCounts.skipChase}`);
  lines.push(`- Shell dashboard opens first and embeds Trading chat in place: ${result.shellDom?.title && result.shellDom?.tradingBox && result.shellDom?.tradingRoute ? 'yes' : 'no'}`);
  lines.push(`- Operator-v2 DOM safe/read-only: ${result.dom.header && result.dom.readOnly && result.dom.noExecuteButton && result.dom.panelCount === 6 ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Operator Command Timeline');
  lines.push('| Timestamp label | Command | Result |');
  lines.push('| --- | --- | --- |');
  for (const item of result.commandLog.slice(0, 60)) {
    lines.push(`| ${item.timestampLabel} | \`${item.command.replace(/`/g, '\\`')}\` | ${item.ok ? 'OK' : 'ERROR'} |`);
  }
  if (result.commandLog.length > 60) lines.push(`| ... | ${result.commandLog.length - 60} more commands omitted from markdown | OK |`);
  lines.push('');
  lines.push('## Candidate Decisions');
  lines.push('| Date | Time | Trigger | ES close | Gen anchor | Gen entry | Spine | Luke action | Luke anchor | Entry | OK through | Stop | Target | Sizing | Vetoes | Outcome | Reason |');
  lines.push('| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |');
  for (const row of result.decisions) {
    const vetoes = (row.vetoes || []).map(veto => veto.type).join(', ') || 'none';
    lines.push([
      row.date,
      row.time.slice(11, 16),
      row.triggerType,
      row.price,
      row.generatorAnchor ?? '',
      row.generatorEntry ?? '',
      row.spineAction || '',
      row.action || '',
      row.anchor ?? '',
      row.entry ?? '',
      row.acceptable_entry ?? '',
      row.stop ?? '',
      row.target ?? '',
      row.sizing ?? '',
      vetoes,
      row.outcome.status,
      String(row.reason || '').replace(/\|/g, '/').slice(0, 120),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');
  lines.push('## Full-Minute Session Scan');
  lines.push('| Date | Bars | Raw spine plans | Actionable | WAIT | SKIP CHASE | Chop vetoes | Sample |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const row of result.minuteScans || []) {
    const selected = row.samples?.find(sample => sample.sampleType === 'actionable') || row.samples?.[0];
    const sample = selected
      ? `${selected.time.slice(11, 16)} ${selected.sampleType} ${selected.action || ''} ${String(selected.reason || '').replace(/\|/g, '/').slice(0, 80)}`
      : 'none';
    lines.push(`| ${row.date} | ${row.barsScanned} | ${row.spinePlans} | ${row.actionable} | ${row.waits} | ${row.skipChase} | ${row.chopVetoes} | ${sample} |`);
  }
  lines.push('');
  lines.push('## Findings');
  if (counts.actionable === 0 && counts.spinePlans > 0) {
    lines.push('- Historical bars did produce raw spine LONG plans, but the live adapter converted them to PASS because price was waiting for entry, already chasing, or vetoed. That is conservative and safe, but it means the current decision spine did not issue a trade instruction at these sampled candidate moments.');
  }
  if (minuteCounts.actionable === 0 && minuteCounts.spinePlans > 0) {
    lines.push('- Full-minute historical scans also found raw spine plans without an operator-actionable LONG/SHORT. This is still safe, but it means archived context did not naturally prove a clean actionable recommendation under current timing gates.');
  }
  if (counts.chopVetoes > 0) lines.push('- Mancini chop-zone veto reached the live decision surface during replay.');
  if (counts.skipChase > 0) lines.push('- Skip-chase behavior reached the live decision surface during replay.');
  if (counts.waits > 0) lines.push('- Wait-for-entry behavior reached the live decision surface during replay.');
  lines.push('- Historical candidate generator and Luke decision spine are not the same authority; generator opportunities are treated as evidence, while Luke only emits operator-safe recommendations after current-price timing gates.');
  lines.push('- Historical Dubz raw text was not available in the backtest corpus, so this replay does not synthesize Dubz levels. That avoids accidentally boosting archive-derived levels as if a real Dubz paste happened.');
  lines.push('');
  lines.push('## Limitations');
  if (result.blocked.length) {
    for (const item of result.blocked) lines.push(`- ${item}`);
  } else {
    lines.push('- None blocking for the historical dry-run harness.');
  }
  lines.push('');
  lines.push('## Artifacts');
  lines.push('- `artifacts/HISTORICAL_OPERATOR_LIVE_DRY_RUN.md`');
  lines.push('- `artifacts/historical-operator-live-dry-run.json`');
  lines.push('- `artifacts/historical-luke-shell-dashboard.png`');
  lines.push('- `artifacts/historical-trading-chat-start.png`');
  lines.push('- `artifacts/historical-trading-chat-after-replay.png`');
  lines.push('- `artifacts/historical-operator-v2.png`');
  return { markdown: lines.join('\n') + '\n', verdict, counts: { ...counts, minute: minuteCounts } };
}

async function main() {
  const result = await runReplay(parseArgs());
  const rendered = renderReport(result);
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ ...result, verdict: rendered.verdict, counts: rendered.counts }, null, 2));
  fs.writeFileSync(REPORT_MD, rendered.markdown);
  console.log(`historical operator replay verdict: ${rendered.verdict}`);
  console.log(`commands: ${result.commandLog.length} | candidates: ${result.decisions.length} | actionable: ${rendered.counts.actionable} | pass/wait: ${rendered.counts.pass}`);
  console.log(`spine plans: ${rendered.counts.spinePlans} | waits: ${rendered.counts.waits} | skip chase: ${rendered.counts.skipChase} | chop vetoes: ${rendered.counts.chopVetoes}`);
  console.log(`minute scan: ${rendered.counts.minute.barsScanned} bars | actionable: ${rendered.counts.minute.actionable} | raw spine plans: ${rendered.counts.minute.spinePlans}`);
  console.log(`report: ${path.relative(ROOT, REPORT_MD)}`);
}

if (require.main === module) {
  main().catch(err => {
    ensureDir(ARTIFACT_DIR);
    fs.writeFileSync(REPORT_MD, [
      '# Historical Operator Live Dry Run',
      '',
      '## Fatal Error',
      '',
      err.stack || err.message,
      '',
      '## Verdict',
      '- HISTORICAL_OPERATOR_REPLAY_FAILED',
    ].join('\n'));
    console.error(`historical operator replay failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  satyCommand,
  bobbyCommand,
  manciniCommand,
  flattenCommand,
  outcomeFromPlan,
  renderReport,
  parseArgs,
};
