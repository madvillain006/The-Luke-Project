#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  buildKatPlainProof,
  writeKatPlainProof,
} = require('../lib/kat-plain-proof');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'katbot-plain');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pngLooksValid(file) {
  if (!fs.existsSync(file)) return false;
  const buffer = fs.readFileSync(file);
  return buffer.length > 1000 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
}

async function renderPlainTextPng(text, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 });
    await page.setContent([
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<style>',
      'body{margin:0;background:#111827;color:#e5e7eb;font:15px/1.45 Consolas,Menlo,monospace;}',
      'main{padding:28px 34px;}',
      'pre{white-space:pre-wrap;word-break:break-word;margin:0;}',
      '.bar{position:sticky;top:0;background:#0b1120;border-bottom:1px solid #334155;padding:12px 34px;font:600 16px/1.2 system-ui,sans-serif;color:#f8fafc;}',
      '</style>',
      '<div class="bar">Katbot plain output proof - no Discord post, no HTML report</div>',
      '<main><pre>' + escapeHtml(text) + '</pre></main>',
    ].join(''));
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await browser.close();
  }
}

async function main() {
  const proof = buildKatPlainProof({ rootDir: ROOT, ticker: 'SPX' });
  const files = writeKatPlainProof(proof, OUT_DIR);
  const png = path.join(OUT_DIR, 'katbot-sanity.png');
  await renderPlainTextPng(proof.proof_text, png);

  const result = {
    ok: proof.config.heatmap_requests_configured === true &&
      proof.config.secondary_research_configured === true &&
      proof.counts.raw > 0 &&
      proof.counts.processed > 0 &&
      /chart-backed analyst posts/.test(proof.outputs.equity_chart || '') &&
      pngLooksValid(png),
    generated_at: proof.generated_at,
    as_of: proof.as_of,
    counts: proof.counts,
    heatmap_requests_configured: proof.config.heatmap_requests_configured,
    secondary_research_configured: proof.config.secondary_research_configured,
    discord_output_gated: {
      responses_enabled: proof.config.discord_responses_enabled,
      posts_enabled: proof.config.discord_posts_enabled,
    },
    files: {
      ...files,
      png,
    },
    png_valid: pngLooksValid(png),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'katbot-proof-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
