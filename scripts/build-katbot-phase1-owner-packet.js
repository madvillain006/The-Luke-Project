#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  buildKatReleaseReadiness,
  formatKatReleaseReadinessMarkdown,
} = require('../lib/kat-release-readiness');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'katbot-release');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOwnerMessage(report) {
  const phaseLine = report.status === 'PHASE_1_COMMAND_REPLIES_LIVE'
    ? 'Kat is now live for Phase 1 command replies only.'
    : 'Kat is ready for Phase 1 command replies only.';

  return [
    'Hey, quick Katbot rollout note.',
    '',
    phaseLine,
    '',
    'What Kat does:',
    '- Reads posts from the monitored analysts already in this server.',
    '- Answers only inside the configured Kat command channel.',
    '- Surfaces SPX confluence and chart-backed equity posts with source message links.',
    '- Attaches the relevant chart images directly in Discord when a command asks for evidence.',
    '',
    'Useful commands:',
    '- `!kat` - command list.',
    '- `!kat levels SPX` - qualified SPX levels only; requires 2+ analysts or 3+ independent mentions.',
    '- `!kat recent SPX` - latest SPX/ES/SPY chart-backed analyst posts.',
    '- `!kat bias` - SPX-only directional read from recent captured analyst posts.',
    '- `!kat heatmap SPX` - latest SPX heatmap/chart image with stale warning.',
    '- `!kat equity UPS` - chart-backed analyst posts for an equity ticker. Replace UPS with another ticker.',
    '',
    'What Kat will not do:',
    '- No trade calls.',
    '- No predictions.',
    '- No financial advice.',
    '- No autonomous execution.',
    '- No access to private Luke logic or Conor-only knowledge.',
    '- No internal status/watchlist/options debug output in public Phase 1.',
    '',
    'Safety rails already on:',
    '- Auto Level Magnet posts are still off.',
    '- Replies are limited to command-channel use.',
    '- 10 second per-user cooldown.',
    '- No mass-mention or user-mention pings.',
    '- Every useful answer includes source links or attached chart evidence.',
    '',
    'Known limitations:',
    ...report.warnings.map(item => '- ' + item),
    '',
    'Rollback if it gets noisy:',
    '- Set `discord_responses_enabled=false` and `discord_posts_enabled=false`.',
  ].join('\n');
}

async function renderPng(text, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
    await page.setContent([
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<style>',
      'body{margin:0;background:#0f172a;color:#e5e7eb;font:16px/1.5 ui-sans-serif,system-ui,Segoe UI,Arial;}',
      '.bar{background:#020617;border-bottom:1px solid #334155;padding:14px 28px;font-weight:700;color:#f8fafc;}',
      'main{padding:28px;max-width:1040px;}',
      'pre{white-space:pre-wrap;word-break:break-word;margin:0;font:15px/1.5 Consolas,Menlo,monospace;}',
      '</style>',
      '<div class="bar">Katbot Phase 1 owner packet</div>',
      '<main><pre>' + escapeHtml(text) + '</pre></main>',
    ].join(''));
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await browser.close();
  }
}

async function main() {
  const report = buildKatReleaseReadiness({ rootDir: ROOT });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ownerMessage = buildOwnerMessage(report);
  const files = {
    message: path.join(OUT_DIR, 'server-owner-phase1-message.md'),
    readiness: path.join(OUT_DIR, 'katbot-release-readiness.md'),
    png: path.join(OUT_DIR, 'server-owner-phase1-message.png'),
  };

  fs.writeFileSync(files.message, ownerMessage + '\n', 'utf8');
  fs.writeFileSync(files.readiness, formatKatReleaseReadinessMarkdown(report), 'utf8');
  await renderPng(ownerMessage, files.png);

  console.log(JSON.stringify({
    status: report.status,
    recommended_phase: report.recommended_phase,
    files,
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
