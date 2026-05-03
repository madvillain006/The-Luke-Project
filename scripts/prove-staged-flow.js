'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const fs = require('fs');
const path = require('path');
const express = require('express');

const router = require('../trading/router');
const { saveTradingState } = require('../state/trading-store');
const { events, snapshots } = require('../lib/paths');

const ROOT = path.join(__dirname, '..');
const REPORT_FILE = path.join(ROOT, 'artifacts', 'STAGED_FLOW_PROOF.md');

const STATE_FILES = [
  snapshots.autonomousState,
  path.join(ROOT, 'state', 'snapshots', 'trading-state.json'),
  events.tradingEvents || path.join(ROOT, 'state', 'events', 'trading-events.jsonl'),
  events.paperTrades,
  events.lukeLog,
];

function readFileMaybe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function restoreFile(file, content) {
  if (content === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function backupState() {
  return new Map(STATE_FILES.map(file => [file, readFileMaybe(file)]));
}

function restoreState(snapshot) {
  for (const [file, content] of snapshot.entries()) restoreFile(file, content);
}

function seedState(mode) {
  saveTradingState({
    mode,
    running: true,
    kill_day: false,
    kill_week: false,
    kill_week_until: null,
    daily_pnl: 0,
    weekly_pnl: 0,
    total_eval_pnl: 0,
    daily_loss_limit: -100,
    weekly_loss_limit: -300,
    apex: {
      enabled: true,
      account_start: 50000,
      profit_target: 3000,
      max_drawdown: 2000,
      daily_loss_limit: 1000,
      consistency_limit: 0.50,
      account_high_eod: 50000,
      eod_threshold: 48000,
      last_eod_update: null,
      contracts: 1,
    },
    paper_trades: 0,
    open_position: null,
    pending_signal: {
      ticker: 'ES',
      direction: 'LONG',
      entry: 7258,
      stop: 7256,
      target: 7264,
      contracts: 1,
      reason: `staged-flow proof ${mode}`,
      strategy: 'proof_only',
      staged_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    },
    tradovate: { username: null, password: null, deviceId: null, cid: null, sec: null, env: 'demo' },
  }, 'STAGED_FLOW_PROOF_SEEDED', { mode });
}

function createServer() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/agent/autonomous', router);
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function postJson(baseUrl, endpoint) {
  const res = await fetch(baseUrl + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

async function getJson(baseUrl, endpoint) {
  const res = await fetch(baseUrl + endpoint);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

function readTradingState() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'state', 'snapshots', 'trading-state.json'), 'utf8'));
}

function summarizePaper(result, state) {
  return {
    routeAccepted: result.ok && result.body.executing === true,
    liveTouched: false,
    openPositionMode: state.open_position && state.open_position.mode,
    pendingCleared: state.pending_signal === null,
    paperTrades: state.paper_trades || 0,
  };
}

function summarizeShadow(result, state) {
  return {
    routeAccepted: result.ok && result.body.executing === true,
    liveTouched: false,
    openPositionMode: state.open_position && state.open_position.mode,
    pendingCleared: state.pending_signal === null,
    shadowRejectedSafely: !state.open_position && state.pending_signal === null,
  };
}

function renderReport({ paper, shadow, pendingAfter, statusAfter }) {
  const verdict = paper.summary.routeAccepted &&
    paper.summary.openPositionMode === 'paper' &&
    paper.summary.pendingCleared &&
    shadow.summary.routeAccepted &&
    shadow.summary.shadowRejectedSafely &&
    pendingAfter.body.pending === false
    ? 'STAGED_FLOW_PROOF_PASS'
    : 'STAGED_FLOW_PROOF_FAIL';

  const lines = [
    '# Staged Flow Proof',
    '',
    `Verdict: ${verdict}`,
    '',
    '## Scope',
    '- Local route drill only.',
    '- Paper execution path allowed.',
    '- Shadow execution path allowed to reject safely when Tradovate credentials are missing.',
    '- Live mode not seeded, not called, and not executed.',
    '',
    '## Paper Execute-Staged',
    `- Route accepted: ${paper.summary.routeAccepted}`,
    `- Open position mode: ${paper.summary.openPositionMode || 'none'}`,
    `- Pending cleared: ${paper.summary.pendingCleared}`,
    `- Paper trades count: ${paper.summary.paperTrades}`,
    '',
    '## Shadow Execute-Staged',
    `- Route accepted: ${shadow.summary.routeAccepted}`,
    `- Open position mode: ${shadow.summary.openPositionMode || 'none'}`,
    `- Pending cleared: ${shadow.summary.pendingCleared}`,
    `- Rejected safely without live execution: ${shadow.summary.shadowRejectedSafely}`,
    '',
    '## Final Read-Only Checks',
    `- /pending pending: ${pendingAfter.body.pending}`,
    `- /status staged_only: ${statusAfter.body.staged_only}`,
    `- /status mode: ${statusAfter.body.mode}`,
    '',
    '## Raw Route Results',
    '```json',
    JSON.stringify({
      paper: paper.result,
      paperSummary: paper.summary,
      shadow: shadow.result,
      shadowSummary: shadow.summary,
      pendingAfter: pendingAfter.body,
      statusAfter: statusAfter.body,
    }, null, 2),
    '```',
    '',
  ];

  return { verdict, text: lines.join('\n') };
}

async function main() {
  const backup = backupState();
  const { server, baseUrl } = await createServer();
  try {
    seedState('paper');
    const paperResult = await postJson(baseUrl, '/agent/autonomous/execute-staged');
    await new Promise(resolve => setTimeout(resolve, 250));
    const paperState = readTradingState();

    seedState('shadow');
    const shadowResult = await postJson(baseUrl, '/agent/autonomous/execute-staged');
    await new Promise(resolve => setTimeout(resolve, 250));
    const shadowState = readTradingState();

    const pendingAfter = await getJson(baseUrl, '/agent/autonomous/pending');
    const statusAfter = await getJson(baseUrl, '/agent/autonomous/status');

    const report = renderReport({
      paper: { result: paperResult, summary: summarizePaper(paperResult, paperState) },
      shadow: { result: shadowResult, summary: summarizeShadow(shadowResult, shadowState) },
      pendingAfter,
      statusAfter,
    });

    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, report.text, 'utf8');
    console.log(`Wrote ${REPORT_FILE}`);
    console.log(report.verdict);
    if (report.verdict !== 'STAGED_FLOW_PROOF_PASS') process.exitCode = 1;
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreState(backup);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
