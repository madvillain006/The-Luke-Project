#!/usr/bin/env node
'use strict';

// Historical Katbot analyst image parser.
//
// Default mode is dry-run: counts chart/heatmap image jobs without downloading
// Discord CDN images or calling the Anthropic vision API.
//
// Execute mode:
//   node scripts/parse-kat-images.js --execute --limit 5 --resume
//
// Writes parsed chart and heatmap image records to data/kat/vision-signals.jsonl
// and appends level-bearing vision records into data/kat/processed-signals.jsonl.

const fs = require('fs');
const path = require('path');
const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const { parseKatSignal } = require('../lib/parse-kat');
const { buildHeatseekerReferencePrompt } = require('../lib/heatseeker-reference');
const {
  appendKatVisionRecord,
  buildKatVisionRecord,
  isImageAttachment,
  readKatVisionSignals,
} = require('../lib/kat-vision-store');

const ROOT = path.join(__dirname, '..');
const DEFAULT_RAW = path.join(ROOT, 'data', 'kat', 'raw-feed.jsonl');

function parseArgs(argv) {
  const args = {
    raw: DEFAULT_RAW,
    limit: null,
    resume: false,
    execute: false,
    start: null,
    end: null,
    only: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--raw') { args.raw = next; i++; }
    else if (flag === '--limit') { args.limit = parseInt(next, 10); i++; }
    else if (flag === '--start') { args.start = next; i++; }
    else if (flag === '--end') { args.end = next; i++; }
    else if (flag === '--only') { args.only = next; i++; }
    else if (flag === '--resume') args.resume = true;
    else if (flag === '--execute') args.execute = true;
    else if (flag === '--help' || flag === '-h') args.help = true;
    else throw new Error('Unknown argument: ' + flag);
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/parse-kat-images.js [options]',
    '',
    'Default is dry-run. No downloads. No API calls.',
    '',
    'Options:',
    '  --execute          Actually download images and call Anthropic vision',
    '  --resume           Skip message_id + attachment_id pairs already parsed',
    '  --limit N          Stop after N image attachments',
    '  --start ISO        Only process messages at/after this timestamp/date',
    '  --end ISO          Only process messages at/before this timestamp/date',
    '  --only chart       Only process chart/non-heatmap image candidates',
    '  --only heatmap     Only process heatmap candidates',
    '  --raw <path>       Input raw-feed JSONL',
  ].join('\n');
}

function loadRawFeed(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    })
    .filter(Boolean);
}

function parsedAttachmentKeys(rootDir) {
  const rows = readKatVisionSignals({ rootDir });
  return new Set(rows.map(row => `${row.message_id || ''}|${row.attachment_id || ''}`));
}

function heatmapCandidate(entry) {
  const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
  const hasImage = attachments.some(isImageAttachment);
  if (!hasImage) return false;
  return /\b(heatmap|heat map|heatseeker|gamma|node|king|gatekeeper|air pocket)\b/i.test(entry.content || '');
}

function selectImageJobs(records, args, rootDir) {
  const done = args.resume ? parsedAttachmentKeys(rootDir) : new Set();
  const jobs = [];
  for (const entry of records) {
    if (args.start && String(entry.ts || '') < args.start) continue;
    if (args.end && String(entry.ts || '') > args.end) continue;
    const heatmap = heatmapCandidate(entry);
    if (args.only === 'heatmap' && !heatmap) continue;
    if (args.only === 'chart' && heatmap) continue;
    const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
    attachments.forEach((att, attachmentIndex) => {
      if (!att || !att.url || !isImageAttachment(att)) return;
      const key = `${entry.message_id || ''}|${att.id || `attachment-${attachmentIndex}`}`;
      if (done.has(key)) return;
      jobs.push({ entry, attachment: att, attachmentIndex, heatmap_candidate: heatmap });
    });
  }
  return args.limit ? jobs.slice(0, args.limit) : jobs;
}

function resolveMediaType(att, buffer) {
  const declared = String(att.content_type || '').split(';')[0].toLowerCase();
  const filename = String(att.filename || '').toLowerCase();
  if (buffer && buffer.length >= 12) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
    if (buffer.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
    if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  }
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.gif')) return 'image/gif';
  if (filename.endsWith('.webp')) return 'image/webp';
  return declared.startsWith('image/') ? declared : 'image/png';
}

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function parseImageJob(job, client, heatseekerReference) {
  const imageBuffer = await fetchImage(job.attachment.url);
  const mediaType = resolveMediaType(job.attachment, imageBuffer);
  const parsedSignal = parseKatSignal(job.entry.username, job.entry.content, true);
  const model = 'claude-sonnet-4-6';
  const response = await client.messages.create({
    model,
    max_tokens: 500,
    system: 'You are analyzing a financial chart or heatmap image posted by a trader. ' +
      'Extract key price levels and directional bias. ' +
      'For heatmap images, apply the Heatseeker node reference below. Treat it as confluence only, not a trade trigger. ' +
      'For candlestick or technical chart images, extract only visible levels, patterns, and directional context shown in the image. ' +
      '\n\nHEATSEEKER NODE REFERENCE:\n' + heatseekerReference + '\n\n' +
      'Return ONLY valid JSON: {"chart_type":"candlestick"|"heatmap"|"technical"|"unknown","ticker":string|null,"key_levels":[numbers],"support_levels":[numbers],"resistance_levels":[numbers],"heatmap_context":{"king_nodes":[numbers],"gatekeeper_nodes":[numbers],"air_pockets":[numbers],"node_read":string|null},"bias":"BULLISH"|"BEARISH"|"NEUTRAL","patterns":[strings],"notes":string}. No markdown.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') } },
        { type: 'text', text: 'Analyst: ' + job.entry.username + '\nChannel: #' + job.entry.channel_name + '\nPosted text: ' + (job.entry.content || '') },
      ],
    }],
  });
  const rawText = response.content[0] && response.content[0].text ? response.content[0].text : '';
  const vision = JSON.parse(rawText.replace(/```json|```/g, '').trim());
  return buildKatVisionRecord({
    entry: job.entry,
    attachment: job.attachment,
    attachmentIndex: job.attachmentIndex,
    parsedSignal,
    vision,
    rawModelText: rawText,
    model,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  if (args.only && !['chart', 'heatmap'].includes(args.only)) throw new Error('--only must be chart or heatmap');

  const records = loadRawFeed(args.raw);
  const jobs = selectImageJobs(records, args, ROOT);
  const heatmapJobs = jobs.filter(job => job.heatmap_candidate).length;
  const chartJobs = jobs.length - heatmapJobs;

  console.log('[parse-kat-images] raw messages: ' + records.length);
  console.log('[parse-kat-images] selected image jobs: ' + jobs.length + ' (chart=' + chartJobs + ', heatmap=' + heatmapJobs + ')');
  if (!args.execute) {
    console.log('[parse-kat-images] DRY RUN ONLY. Add --execute to download images and call Anthropic vision.');
    for (const job of jobs.slice(0, 5)) {
      console.log('- ' + job.entry.ts + ' ' + job.entry.username + ' #' + job.entry.channel_name + ' ' + (job.heatmap_candidate ? 'heatmap' : 'chart') + ' ' + (job.attachment.filename || job.attachment.id));
    }
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required for --execute');
  const client = new Anthropic();
  const heatseekerReference = buildHeatseekerReferencePrompt();
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const record = await parseImageJob(job, client, heatseekerReference);
      appendKatVisionRecord(record, { rootDir: ROOT });
      ok++;
      console.log(`[${i + 1}/${jobs.length}] ok ${record.source_class} ${record.ticker || 'unknown'} levels=${record.levels.length} ${record.message_id}`);
    } catch (e) {
      failed++;
      console.error(`[${i + 1}/${jobs.length}] failed ${job.entry.message_id}: ${e.message}`);
    }
  }
  console.log('[parse-kat-images] done ok=' + ok + ' failed=' + failed);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[parse-kat-images] fatal:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  loadRawFeed,
  selectImageJobs,
  heatmapCandidate,
};
