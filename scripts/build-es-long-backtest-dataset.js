'use strict';

// Offline ES long backtest dataset builder.
//
// Inputs:
//   data/backtest/es-long-bracket/raw/bobby json.json
//   discord-exports/bobby/media/manifest.json
//   discord-exports/bobby/media/
//   data/backtest/es-long-bracket/raw/mancini/Mancini.txt
//   data/historical/*.csv (ES for Saty and trading date collection)
//
// Outputs (under data/backtest/es-long-bracket/derived/ by default):
//   bobby-messages.jsonl
//   bobby-image-cache.jsonl
//   mancini-posts.jsonl
//   saty-levels-by-date.json
//   dataset-build-report.json
//   dataset-build-report.md
//
// Safety:
//   - No Anthropic vision calls.
//   - No Discord CDN downloads.
//   - No live routes, /entries, scheduler, or broker execution touched.
//   - Bobby commentary (bobby-messages.jsonl) and Bobby images (bobby-image-cache.jsonl)
//     are separate files linked by messageId.
//   - Unmatched Bobby images are recorded explicitly; never silently dropped.
//   - Low-confidence Mancini timestamps preserved in JSONL but flagged
//     timestampConfidence: 'low' and excluded from entryGenerationReady count.
//   - Saty: no lookahead. For date D, use the prior completed ES futures
//     session (18:00-17:00 ET), matching Saty Pine Day/session.extended logic.
//   - Long-only ES scope. Short support untouched.

const fs   = require('fs');
const path = require('path');

const { loadBobbyExport }      = require('../lib/backtest-data/bobby-export');
const { buildImageCache }      = require('../lib/backtest-data/bobby-image-cache');
const { loadManciniText }      = require('../lib/backtest-data/mancini-text');
const { deriveLevelsByDate }   = require('../lib/backtest-data/saty-historical');
const { loadIntraday }         = require('../lib/historical-data');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  bobby:    path.join(ROOT, 'data/backtest/es-long-bracket/raw/bobby json.json'),
  mancini:  path.join(ROOT, 'data/backtest/es-long-bracket/raw/mancini/Mancini.txt'),
  manifest: path.join(ROOT, 'discord-exports/bobby/media/manifest.json'),
  mediaDir: path.join(ROOT, 'discord-exports/bobby/media'),
  out:      path.join(ROOT, 'data/backtest/es-long-bracket/derived'),
};

// The Mancini.txt was scraped 2026-04-29 (per roadmap observation).
// Relative timestamps are reconstructed against this date.
const MANCINI_SCRAPE_DATE = '2026-04-29';

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { ...DEFAULTS, start: null, end: null };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--bobby')     { args.bobby    = next; i++; }
    else if (flag === '--mancini')  { args.mancini  = next; i++; }
    else if (flag === '--manifest') { args.manifest = next; i++; }
    else if (flag === '--media-dir'){ args.mediaDir = next; i++; }
    else if (flag === '--out')      { args.out      = next; i++; }
    else if (flag === '--start')    { args.start    = next; i++; }
    else if (flag === '--end')      { args.end      = next; i++; }
  }
  return args;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonl(filePath, rows) {
  const lines = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(filePath, lines, 'utf8');
}

function inDateRange(date, start, end) {
  if (!date) return true;
  if (start && date < start) return false;
  if (end   && date > end)   return false;
  return true;
}

// Collect all unique trading dates present in an array of bar objects.
// bars expected to have a .timestamp or .date field (auto-detected).
function uniqueTradingDates(bars) {
  if (!bars || bars.length === 0) return [];
  const key = bars[0].timestamp !== undefined ? 'timestamp' : 'date';
  const dates = new Set(bars.map(b => String(b[key]).slice(0, 10)));
  return [...dates].sort();
}

// ── Report builders ───────────────────────────────────────────────────────────

function buildJsonReport({
  args, startedAt, generatedAt,
  bobbyMeta, filteredBobbyCount,
  imageSummary,
  manciniTotal, manciniHighConf, manciniLowConf,
  manciniWeekConf,
  satyResult,
}) {
  const satyDates   = Object.keys(satyResult);
  const satyValid   = satyDates.filter(d => satyResult[d].valid).length;
  const satyInvalid = satyDates.filter(d => !satyResult[d].valid);

  return {
    generatedAt,
    startedAt,
    mode: 'offline-backtest-data-build',
    args: {
      bobby:    args.bobby,
      mancini:  args.mancini,
      manifest: args.manifest,
      mediaDir: args.mediaDir,
      out:      args.out,
      start:    args.start,
      end:      args.end,
    },
    bobby: {
      totalExportMessages:      bobbyMeta.totalExportMessages,
      bobbyMessagesInExport:    bobbyMeta.bobbyMessages,
      bobbyMessagesAfterFilter: filteredBobbyCount,
      firstTimestamp:           bobbyMeta.firstTimestamp,
      lastTimestamp:            bobbyMeta.lastTimestamp,
      totalAttachments:         bobbyMeta.totalAttachments,
      totalImageAttachments:    bobbyMeta.totalImageAttachments,
    },
    bobbyImageCache: imageSummary,
    mancini: {
      totalPosts:            manciniTotal,
      highConfidence:        manciniHighConf,
      weekConfidence:        manciniWeekConf,
      lowConfidence:         manciniLowConf,
      entryGenerationReady:  manciniHighConf,
      scrapeDate:            MANCINI_SCRAPE_DATE,
    },
    saty: {
      datesRequested: satyDates.length,
      datesValid:     satyValid,
      datesInvalid:   satyDates.length - satyValid,
      invalidDates:   satyInvalid,
    },
    outputs: {
      bobbyMessages:      'bobby-messages.jsonl',
      bobbyImageCache:    'bobby-image-cache.jsonl',
      manciniPosts:       'mancini-posts.jsonl',
      satyLevelsByDate:   'saty-levels-by-date.json',
      datasetBuildReport: 'dataset-build-report.json',
      datasetBuildMd:     'dataset-build-report.md',
    },
  };
}

function buildMarkdownReport(report, unmatchedRows) {
  const b = report.bobby;
  const img = report.bobbyImageCache;
  const m = report.mancini;
  const s = report.saty;

  const lines = [
    '# ES Long Backtest — Dataset Build Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    '**Mode:** Offline data build only. No live routes, /entries, PM2, broker execution, or scheduler touched.',
    '',
    '---',
    '',
    '## Bobby Export',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Total export messages | ${b.totalExportMessages} |`,
    `| BOBBY messages in export | ${b.bobbyMessagesInExport} |`,
    `| BOBBY messages (after date filter) | ${b.bobbyMessagesAfterFilter} |`,
    `| First timestamp | ${b.firstTimestamp} |`,
    `| Last timestamp | ${b.lastTimestamp} |`,
    `| Total attachments | ${b.totalAttachments} |`,
    `| Image attachments | ${b.totalImageAttachments} |`,
    '',
    '## Bobby Image Cache',
    '',
    '| Status | Count |',
    '|---|---|',
  ];

  for (const [k, v] of Object.entries(img)) {
    if (k !== 'total') lines.push(`| ${k} | ${v} |`);
  }
  lines.push(`| **total** | **${img.total}** |`);
  lines.push('');

  if (unmatchedRows.length > 0) {
    lines.push(
      `> **Unmatched images (${unmatchedRows.length}):** Not in local media cache.`,
      '> CDN download not attempted. Each is recorded explicitly — nothing silently dropped.',
      '',
      '| messageId | fileName | tradingDateET |',
      '|---|---|---|',
    );
    const shown = unmatchedRows.slice(0, 25);
    for (const u of shown) {
      lines.push(`| ${u.messageId} | ${u.fileName} | ${u.tradingDateET ?? '—'} |`);
    }
    if (unmatchedRows.length > 25) {
      lines.push(`| *(${unmatchedRows.length - 25} more not shown)* | | |`);
    }
    lines.push('');
  }

  lines.push(
    '## Mancini Posts',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Total posts | ${m.totalPosts} |`,
    `| High-confidence timestamps | ${m.highConfidence} |`,
    `| Week-candidate timestamps | ${m.weekConfidence ?? 0} |`,
    `| Low-confidence timestamps | ${m.lowConfidence} |`,
    `| Entry-generation-ready | ${m.entryGenerationReady} |`,
    `| Scrape date used | ${m.scrapeDate} |`,
    '',
    '> All posts are written to `mancini-posts.jsonl`. Low-confidence posts have',
    '> `timestampConfidence: "low"` and are excluded from entry generation.',
    '',
    '---',
    '',
    '## Saty Levels',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Trading dates requested | ${s.datesRequested} |`,
    `| Dates with valid Saty levels | ${s.datesValid} |`,
    `| Dates without prior ES futures-session ATR | ${s.datesInvalid} |`,
  );

  if (s.invalidDates.length > 0) {
    lines.push('');
    lines.push('**Dates without valid Saty (missing prior ES futures-session ATR):**');
    for (const d of s.invalidDates) lines.push(`  - ${d}`);
  }

  lines.push(
    '',
    '---',
    '',
    '## Output Files',
    '',
    '| File | Description |',
    '|---|---|',
    '| `bobby-messages.jsonl` | Normalized BOBBY text commentary (content, levels, instruments) |',
    '| `bobby-image-cache.jsonl` | Per-image cache status linked by messageId |',
    '| `mancini-posts.jsonl` | All Mancini posts with levels and timestampConfidence |',
    '| `saty-levels-by-date.json` | Saty call/put triggers by trading date (no lookahead) |',
    '| `dataset-build-report.json` | Machine-readable build summary |',
    '| `dataset-build-report.md` | This report |',
    '',
    '---',
    '',
    '> **Safety:** No Anthropic vision calls. No Discord CDN downloads.',
    '> No live trading routes, /entries, PM2, scheduler, or broker execution modified.',
    '> Long-only ES scope. Short support untouched.',
    '',
  );

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  const args = parseArgs(process.argv);

  console.log('[build-dataset] ════ Offline ES Long Backtest Dataset Build ════');
  console.log(`[build-dataset] Output dir: ${args.out}`);
  if (args.start || args.end) {
    console.log(`[build-dataset] Date filter: ${args.start ?? '*'} → ${args.end ?? '*'}`);
  }

  ensureDir(args.out);

  // ── Step 1: Bobby export ──────────────────────────────────────────────────
  console.log('\n[build-dataset] Step 1/5: Bobby export');
  const exportResult = loadBobbyExport(args.bobby);
  const bobbyMeta = exportResult.meta;

  let messages = exportResult.messages;
  if (args.start || args.end) {
    messages = messages.filter(m => inDateRange(m.tradingDateET, args.start, args.end));
  }
  console.log(`[build-dataset]   BOBBY messages: ${bobbyMeta.bobbyMessages} total → ${messages.length} after filter`);

  writeJsonl(path.join(args.out, 'bobby-messages.jsonl'), messages);
  console.log(`[build-dataset]   Wrote bobby-messages.jsonl (${messages.length} rows)`);

  // ── Step 2: Bobby image cache ─────────────────────────────────────────────
  console.log('\n[build-dataset] Step 2/5: Bobby image cache');
  const imageCacheResult = buildImageCache(messages, args.manifest, args.mediaDir);
  const imgSummary = imageCacheResult.summary;
  const unmatchedRows = imageCacheResult.rows.filter(r => r.status === 'unmatched');

  console.log(`[build-dataset]   Image cache: ${imgSummary.total} total`);
  console.log(`[build-dataset]     local_matched:       ${imgSummary.local_matched ?? 0}`);
  console.log(`[build-dataset]     local_manifest_only: ${imgSummary.local_manifest_only ?? 0}`);
  console.log(`[build-dataset]     unmatched:           ${imgSummary.unmatched ?? 0} (no CDN download attempted)`);
  console.log(`[build-dataset]     skipped_non_image:   ${imgSummary.skipped_non_image ?? 0}`);

  if (unmatchedRows.length > 0) {
    console.log(`[build-dataset]   WARNING: ${unmatchedRows.length} images not in local cache. Recorded explicitly.`);
  }

  writeJsonl(path.join(args.out, 'bobby-image-cache.jsonl'), imageCacheResult.rows);
  console.log(`[build-dataset]   Wrote bobby-image-cache.jsonl (${imageCacheResult.rows.length} rows)`);

  // ── Step 3: Mancini text ──────────────────────────────────────────────────
  console.log('\n[build-dataset] Step 3/5: Mancini text');
  // All posts written to JSONL (both high and low confidence).
  // Low-confidence posts are flagged timestampConfidence: 'low' for downstream exclusion.
  const manciniPosts = loadManciniText(args.mancini, { scrapeDate: MANCINI_SCRAPE_DATE });
  const manciniHighConf = manciniPosts.filter(p => p.timestampConfidence === 'high').length;
  const manciniWeekConf = manciniPosts.filter(p => p.timestampConfidence === 'week').length;
  const manciniLowConf  = manciniPosts.filter(p => p.timestampConfidence === 'low').length;

  console.log(`[build-dataset]   Posts: ${manciniPosts.length} total`);
  console.log(`[build-dataset]     high-confidence (entry-ready): ${manciniHighConf}`);
  console.log(`[build-dataset]     week-candidate (context only): ${manciniWeekConf}`);
  console.log(`[build-dataset]     low-confidence (preserved, excluded from entries): ${manciniLowConf}`);

  writeJsonl(path.join(args.out, 'mancini-posts.jsonl'), manciniPosts);
  console.log(`[build-dataset]   Wrote mancini-posts.jsonl (${manciniPosts.length} rows)`);

  // ── Step 4: Saty historical levels ────────────────────────────────────────
  console.log('\n[build-dataset] Step 4/5: Saty historical levels (no lookahead)');

  const esBars  = loadIntraday('ES');

  if (!esBars || esBars.length === 0) {
    console.warn('[build-dataset]   WARNING: No ES bars found. Saty levels cannot be derived.');
  }

  // Union of Bobby trading dates and ES bar dates → all dates we may need signals for
  const bobbyDates = new Set(messages.map(m => m.tradingDateET).filter(Boolean));
  const esDates    = new Set(uniqueTradingDates(esBars));
  const allDates   = [...new Set([...bobbyDates, ...esDates])].sort();

  const targetDates = allDates.filter(d => inDateRange(d, args.start, args.end));
  console.log(`[build-dataset]   Trading dates: ${targetDates.length} (Bobby ∪ ES dates, after filter)`);

  let satyResult = {};
  if (esBars && esBars.length > 0) {
    satyResult = deriveLevelsByDate(esBars, targetDates);
  }

  const satyValid   = Object.values(satyResult).filter(v => v.valid).length;
  const satyInvalid = Object.values(satyResult).filter(v => !v.valid).length;
  console.log(`[build-dataset]   Saty: ${satyValid} valid, ${satyInvalid} missing prior ES futures-session ATR`);

  fs.writeFileSync(
    path.join(args.out, 'saty-levels-by-date.json'),
    JSON.stringify(satyResult, null, 2),
    'utf8',
  );
  console.log('[build-dataset]   Wrote saty-levels-by-date.json');

  // ── Step 5: Build reports ─────────────────────────────────────────────────
  console.log('\n[build-dataset] Step 5/5: Build reports');

  const generatedAt = new Date().toISOString();
  const jsonReport  = buildJsonReport({
    args, startedAt, generatedAt,
    bobbyMeta,
    filteredBobbyCount: messages.length,
    imageSummary: imgSummary,
    manciniTotal:    manciniPosts.length,
    manciniHighConf,
    manciniWeekConf,
    manciniLowConf,
    satyResult,
  });

  fs.writeFileSync(
    path.join(args.out, 'dataset-build-report.json'),
    JSON.stringify(jsonReport, null, 2),
    'utf8',
  );
  console.log('[build-dataset]   Wrote dataset-build-report.json');

  const mdReport = buildMarkdownReport(jsonReport, unmatchedRows);
  fs.writeFileSync(path.join(args.out, 'dataset-build-report.md'), mdReport, 'utf8');
  console.log('[build-dataset]   Wrote dataset-build-report.md');

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n[build-dataset] ════ BUILD SUMMARY ════');
  console.log(`  Bobby messages written:    ${messages.length}`);
  console.log(`  Image cache rows:          ${imageCacheResult.rows.length}`);
  console.log(`    local_matched:           ${imgSummary.local_matched ?? 0}`);
  console.log(`    local_manifest_only:     ${imgSummary.local_manifest_only ?? 0}`);
  console.log(`    unmatched (CDN needed):  ${imgSummary.unmatched ?? 0}`);
  console.log(`    skipped_non_image:       ${imgSummary.skipped_non_image ?? 0}`);
  console.log(`  Mancini posts written:     ${manciniPosts.length} (${manciniHighConf} high-conf, ${manciniLowConf} low-conf)`);
  console.log(`  Saty dates:                ${targetDates.length} requested → ${satyValid} valid`);
  console.log(`  Output dir:                ${args.out}`);
  console.log('[build-dataset] Done.\n');
}

main().catch(err => {
  console.error('[build-dataset] FATAL:', err.message || err);
  process.exit(1);
});
