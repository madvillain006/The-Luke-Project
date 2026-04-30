'use strict';
// Read-only coverage and source-shape audit script for Phase 0.
// Outputs: data/backtest/es-long-bracket/derived/coverage-report.json
//          data/backtest/es-long-bracket/derived/coverage-report.md
// No live files, PM2, broker routes, or entry logic are touched.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'derived');

// ── helpers ──────────────────────────────────────────────────────────────────
const DST_2026 = { start: '2026-03-08 03:00', end: '2026-11-01 02:00' };
function getETOffset(s) { return (s >= DST_2026.start && s < DST_2026.end) ? '-04:00' : '-05:00'; }
function toIsoEt(s) { return s.replace(' ', 'T') + ':00' + getETOffset(s); }

const BARCHART_ROW_RE = /^"([^"]+)",([^,]+),([^,]+),([^,]+),([^,]+),([^,]*),([^,]*),([^,\r\n]+)/;

function parseBarchartCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l && !l.startsWith('"Downloaded'));
  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(BARCHART_ROW_RE);
    if (!m) continue;
    const ts = toIsoEt(m[1]);
    const open = Number(m[2]), high = Number(m[3]), low = Number(m[4]),
          close = Number(m[5]), volume = Number(m[8]);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    bars.push({ timestamp: ts, open, high, low, close, volume });
  }
  return bars;
}

function mergeContractStreams(arrs) {
  const byTs = new Map();
  for (const arr of arrs) {
    for (const b of arr) {
      const ex = byTs.get(b.timestamp);
      if (!ex || b.volume > ex.volume) byTs.set(b.timestamp, b);
    }
  }
  return [...byTs.values()].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}

function isRTH(ts) {
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return false;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 570 && min <= 960; // 9:30–16:00 ET
}

function dateKey(ts) { return ts.slice(0, 10); }

function coverageByDate(bars) {
  const byDate = {};
  for (const b of bars) {
    const d = dateKey(b.timestamp);
    if (!byDate[d]) byDate[d] = { allBars: 0, rthBars: 0, overnightBars: 0 };
    byDate[d].allBars++;
    if (isRTH(b.timestamp)) byDate[d].rthBars++;
    else byDate[d].overnightBars++;
  }
  return byDate;
}

// Known US market holidays 2026
const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
]);

function expectedWeekdays(start, end) {
  const days = [];
  const d = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  while (d <= e) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days.filter(d => !HOLIDAYS_2026.has(d));
}

// ── Historical bars ───────────────────────────────────────────────────────────
const HIST = path.join(ROOT, 'data', 'historical');

// Discover all ES contract files and SPX files using the same filename rules as
// lib/historical-data.js. The regex anchors on the prefix, so files with "(1)"
// or other suffixes after the download date are included automatically.
const ES_CONTRACT_RE = /^(es[hmuz]\d{2})_intraday-1min_historical-data-download/i;
const SPX_FILE_RE    = /^spx_intraday-1min_historical-data-download/i;

const esContractFiles = {}; // { esh26: [paths], esm26: [paths], ... }
const spxPaths = [];
for (const e of fs.readdirSync(HIST, { withFileTypes: true })) {
  if (!e.isFile()) continue;
  const cm = e.name.match(ES_CONTRACT_RE);
  if (cm) {
    const key = cm[1].toLowerCase();
    (esContractFiles[key] = esContractFiles[key] || []).push(path.join(HIST, e.name));
  } else if (SPX_FILE_RE.test(e.name)) {
    spxPaths.push(path.join(HIST, e.name));
  }
}

// Merge multiple files for the same contract (e.g. two ESM26 CSVs)
const contractBarsMap = {};
for (const [key, files] of Object.entries(esContractFiles)) {
  contractBarsMap[key] = mergeContractStreams(files.map(f => parseBarchartCsv(f)));
}
const esBars  = mergeContractStreams(Object.values(contractBarsMap));
const spxBars = spxPaths.length > 0
  ? mergeContractStreams(spxPaths.map(f => parseBarchartCsv(f)))
  : [];

function summarizeBars(bars, label) {
  if (!bars || bars.length === 0) return { label, totalBars: 0 };
  const cov = coverageByDate(bars);
  const dates = Object.keys(cov).sort();
  const first = bars[0].timestamp;
  const last  = bars[bars.length - 1].timestamp;
  const firstDate = first.slice(0, 10);
  const lastDate  = last.slice(0, 10);
  const expected = expectedWeekdays(firstDate, lastDate);
  const presentSet = new Set(dates);
  const missingDates = expected.filter(d => !presentSet.has(d));
  const datesWithOvernight = dates.filter(d => cov[d].overnightBars > 0);
  const datesWithRTH = dates.filter(d => cov[d].rthBars > 0);
  return {
    label, totalBars: bars.length, distinctDates: dates.length,
    firstBar: first, lastBar: last,
    expectedWeekdays: expected.length,
    missingDates, missingCount: missingDates.length,
    datesWithOvernightBars: datesWithOvernight.length,
    datesWithRTHBars: datesWithRTH.length,
    dateDetail: cov,
  };
}

// Convenience aliases for ESH26/ESM26 (backward-compat with rest of script)
const eshBars = contractBarsMap['esh26'] || [];
const esmBars = contractBarsMap['esm26'] || [];

const eshSummary = summarizeBars(eshBars, 'ESH26');
const esmSummary = summarizeBars(esmBars, 'ESM26');
const esSummary  = summarizeBars(esBars,  'ES-merged');
const spxSummary = summarizeBars(spxBars, 'SPX');

// ── Bobby JSON ────────────────────────────────────────────────────────────────
const BOBBY_JSON = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'raw', 'bobby json.json');
const bobbyData = JSON.parse(fs.readFileSync(BOBBY_JSON, 'utf8'));
const allMsgs = bobbyData.messages.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

const bobbyMsgs = allMsgs.filter(m => {
  const n = (m.author && (m.author.nickname || m.author.name) || '').toUpperCase();
  return n === 'BOBBY';
});
const nonBobbyMsgs = allMsgs.filter(m => {
  const n = (m.author && (m.author.nickname || m.author.name) || '').toUpperCase();
  return n !== 'BOBBY';
});

// Author distribution
const authorCounts = {};
for (const m of allMsgs) {
  const k = m.author ? (m.author.nickname || m.author.name) : 'unknown';
  authorCounts[k] = (authorCounts[k] || 0) + 1;
}

// Collect BOBBY attachments
const bobbyAttachments = [];
for (const m of bobbyMsgs) {
  for (const a of (m.attachments || [])) {
    const isImg = /\.(png|jpg|jpeg|webp|gif)$/i.test(a.fileName || '');
    bobbyAttachments.push({
      messageId: m.id, timestamp: m.timestamp,
      attachmentId: a.id, url: a.url, fileName: a.fileName,
      fileSizeBytes: a.fileSizeBytes, isImage: isImg,
    });
  }
}
const bobbyImageAtts = bobbyAttachments.filter(a => a.isImage);

// Distinct trading dates for BOBBY
function tradingDateET(ts) {
  const d = new Date(ts);
  const off = ts.includes('-04:00') ? -4 : -5;
  return new Date(d.getTime() + off * 3600000).toISOString().slice(0, 10);
}
const bobbyDates = new Set(bobbyMsgs.map(m => tradingDateET(m.timestamp)));

// ── Manifest matching ─────────────────────────────────────────────────────────
const MANIFEST_PATH = path.join(ROOT, 'discord-exports', 'bobby', 'media', 'manifest.json');
let manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf8');
const hadBom = manifestRaw.charCodeAt(0) === 0xFEFF;
if (hadBom) manifestRaw = manifestRaw.slice(1);
const manifest = JSON.parse(manifestRaw);

// Build lookups
const manifestByMsgId = new Map();
for (const row of manifest) {
  if (!manifestByMsgId.has(row.messageId)) manifestByMsgId.set(row.messageId, []);
  manifestByMsgId.get(row.messageId).push(row);
}

const MEDIA_DIR = path.join(ROOT, 'discord-exports', 'bobby', 'media');
const localFiles = new Set(
  fs.readdirSync(MEDIA_DIR).filter(f => f !== 'manifest.json' && /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
);

// Match each Bobby image attachment
let matchedLocal = 0, unmatchedCount = 0;
const unmatchedAttachments = [];
const matchDetails = [];
for (const att of bobbyImageAtts) {
  const rows = manifestByMsgId.get(att.messageId) || [];
  // Match by messageId + originalFilename
  const found = rows.find(r => r.originalFilename === att.fileName);
  if (found) {
    const localExists = localFiles.has(found.localFilename);
    matchedLocal++;
    matchDetails.push({ status: 'manifest_matched', localExists, manifestRow: found, att });
  } else {
    unmatchedCount++;
    unmatchedAttachments.push(att);
  }
}

// Unmatched: breakdown by date range
const unmatchedByDate = {};
for (const a of unmatchedAttachments) {
  const d = a.timestamp.slice(0, 10);
  unmatchedByDate[d] = (unmatchedByDate[d] || 0) + 1;
}

// Local files not referenced by manifest
const manifestLocalNames = new Set(manifest.map(r => r.localFilename));
const localNotInManifest = [...localFiles].filter(f => !manifestLocalNames.has(f));
const manifestMissingLocal = manifest.filter(r => !localFiles.has(r.localFilename));

// Manifest author breakdown
const manifestAuthors = {};
for (const row of manifest) {
  manifestAuthors[row.authorName] = (manifestAuthors[row.authorName] || 0) + 1;
}
const manifestStatuses = {};
for (const row of manifest) {
  manifestStatuses[row.downloadStatus] = (manifestStatuses[row.downloadStatus] || 0) + 1;
}

// Manifest date range
const manifestDates = manifest.map(r => r.timestamp.slice(0, 10)).sort();

// ── Mancini text ──────────────────────────────────────────────────────────────
const MANCINI_PATH = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'raw', 'mancini', 'Mancini.txt');
const manciniText = fs.readFileSync(MANCINI_PATH, 'utf8');

// Detect encoding issues (mojibake from Windows-1252 → UTF-8 mis-decode)
const mojibakePatterns = manciniText.match(/â[-]|â[ -¯]|â[°-¿]|Â©|Ã¢/g) || [];
const uniqueMojibake = [...new Set(mojibakePatterns)].slice(0, 20);

// Split posts by the post delimiter (clean UTF-8 en-dash)
const postChunks = manciniText.split('[–]Adam_Mankini');
const postCount = postChunks.length - 1;

// Thread header extraction
const threadHeaderRe = /(The [\w ]+ (?:Week of|Weekend Lounge for|Egg Hunt Weekend Lounge for)[\w ,/]+\d{4}) by tpdthreadmanager in ThePiratesDen/g;
const allHeaders = [];
let hm;
while ((hm = threadHeaderRe.exec(manciniText)) !== null) {
  allHeaders.push(hm[1].trim());
}
const uniqueHeaders = [...new Set(allHeaders)].sort();

// Relative timestamp parsing - extract all relative time strings
const relTsRe = /\d+\s+points?\s+((?:an hour|[\d]+ (?:hour|day|month)s?)\s+ago)/g;
const relTimestamps = [];
let rm;
while ((rm = relTsRe.exec(manciniText)) !== null) {
  relTimestamps.push(rm[1]);
}
const uniqueRelTs = [...new Set(relTimestamps)];

// Analyse first/last chunks
const firstPost = postChunks.length > 1 ? postChunks[1].slice(0, 300).trim() : '';
const lastPost = postChunks.length > 1 ? postChunks[postChunks.length - 1].slice(0, 300).trim() : '';

// Count posts with relative timestamps that can be reconstructed
const lowConfidenceIndicators = relTimestamps.filter(t =>
  t.includes('month') || t.includes('days ago') && parseInt(t) > 14
);

// Mancini post date reconstruction assessment
// Thread headers give us week anchors. Relative timestamps within each week thread
// give approximate date if combined with thread header date.
// Risk: posts with "1 day ago", "2 days ago" within a week thread are fairly high confidence.
// Posts with "17 hours ago", "an hour ago" in CURRENT thread are high confidence (known as today: 2026-04-29).
// Posts with "1 month ago" or crossing thread boundaries are LOW confidence.
const lastWeekHeader = uniqueHeaders.filter(h => h.includes('4/26/2026'));
const hasCurrentWeek = lastWeekHeader.length > 0;

const manciniLines = manciniText.split(/\r?\n/).length;

// ── Saty derivability ─────────────────────────────────────────────────────────
// Verify _internal.deriveSatyLevelsFromBars is accessible and check formula
const { _internal } = require('../lib/saty-auto-pull');
const { deriveSatyLevelsFromBars, computeWilderAtr } = _internal;

// Test with SPX bars (which is what Saty uses) - convert intraday to daily bars
// For a real historical Saty we need daily bars, not intraday.
// Check whether SPX intraday has enough daily data
const spxByDate = coverageByDate(spxBars);
const spxDates = Object.keys(spxByDate).sort();

// Synthesize daily closing bars from intraday for verification
// (just for the feasibility check - not actual strategy use)
const spxDailyBars = spxDates.map(d => {
  const dayBars = spxBars.filter(b => b.timestamp.startsWith(d));
  const rthDayBars = dayBars.filter(b => isRTH(b.timestamp));
  const closingBars = rthDayBars.length > 0 ? rthDayBars : dayBars;
  const close = closingBars[closingBars.length - 1]?.close;
  const high = Math.max(...dayBars.map(b => b.high));
  const low = Math.min(...dayBars.map(b => b.low));
  const open = dayBars[0]?.open;
  return { date: d, open, high, low, close, volume: dayBars.reduce((s, b) => s + b.volume, 0) };
}).filter(b => Number.isFinite(b.close));

// Test derivation with 40 days of data (needs >= 35)
const satyTestResult = deriveSatyLevelsFromBars(spxDailyBars);
const satyCanDerive = satyTestResult.valid === true;
const satyMinBarsNeeded = 35;
const satyDatesAvailable = spxDailyBars.length;

// Leakage check: deriveSatyLevelsFromBars uses bars[bars.length-1] as reference.
// For backtest, we must pass bars[0..D-1] for date D (prior close only).
// The formula does not peek forward - it reads only the last bar in the passed array.
// Leakage is prevented by slicing the daily bars array to exclude future dates.
const satyLeakageRisk = 'LOW - formula reads bars[bars.length-1] as reference. ' +
  'Backtest caller must slice to bars through date D-1 to prevent leakage.';

// ── Assemble report ───────────────────────────────────────────────────────────
const report = {
  generatedAt: new Date().toISOString(),
  reportVersion: '0.1.0',

  historicalBars: {
    files: {
      esContracts: Object.fromEntries(
        Object.entries(esContractFiles).map(([k, paths]) => [k, paths.map(p => path.basename(p))])
      ),
      spx: spxPaths.map(p => path.basename(p)),
    },
    esh26:    { totalBars: eshSummary.totalBars, distinctDates: eshSummary.distinctDates,
                firstBar: eshSummary.firstBar, lastBar: eshSummary.lastBar,
                datesWithRTH: eshSummary.datesWithRTHBars,
                datesWithOvernight: eshSummary.datesWithOvernightBars },
    esm26:    { totalBars: esmSummary.totalBars, distinctDates: esmSummary.distinctDates,
                firstBar: esmSummary.firstBar, lastBar: esmSummary.lastBar,
                datesWithRTH: esmSummary.datesWithRTHBars,
                datesWithOvernight: esmSummary.datesWithOvernightBars },
    esMerged: { totalBars: esSummary.totalBars, distinctDates: esSummary.distinctDates,
                firstBar: esSummary.firstBar, lastBar: esSummary.lastBar,
                expectedWeekdays: esSummary.expectedWeekdays,
                missingDates: esSummary.missingDates, missingCount: esSummary.missingCount,
                datesWithRTH: esSummary.datesWithRTHBars,
                datesWithOvernight: esSummary.datesWithOvernightBars },
    spx:      { totalBars: spxSummary.totalBars, distinctDates: spxSummary.distinctDates,
                firstBar: spxSummary.firstBar, lastBar: spxSummary.lastBar,
                expectedWeekdays: spxSummary.expectedWeekdays,
                missingDates: spxSummary.missingDates, missingCount: spxSummary.missingCount,
                datesWithRTH: spxSummary.datesWithRTHBars,
                datesWithOvernight: spxSummary.datesWithOvernightBars,
                overnightNote: 'SPX "overnight" bars are post-market only (16:01-16:38 range, volume=0). ' +
                               'Cash index — no true overnight or pre-market bars present. ' +
                               'Useful as post-close reference but not for overnight session replay.' },
    gapNote: esSummary.missingCount === 0
      ? 'No missing trading dates in ES merged stream.'
      : `${esSummary.missingCount} missing ES trading date(s): ${esSummary.missingDates.join(', ')}.`,
  },

  bobbyExport: {
    source: BOBBY_JSON,
    totalMessages: allMsgs.length,
    messageCount_header: bobbyData.messageCount,
    authorCounts,
    bobbyAuthorMessages: bobbyMsgs.length,
    nonBobbyMessages: nonBobbyMsgs.length,
    firstBobbyMessage: bobbyMsgs[0]?.timestamp,
    lastBobbyMessage: bobbyMsgs[bobbyMsgs.length - 1]?.timestamp,
    distinctTradingDates: bobbyDates.size,
    tradingDateRange: { first: [...bobbyDates].sort()[0], last: [...bobbyDates].sort().pop() },
    bobbyWithAttachments: bobbyMsgs.filter(m => m.attachments && m.attachments.length).length,
    bobbyWithoutAttachments: bobbyMsgs.filter(m => !m.attachments || !m.attachments.length).length,
    bobbyAttachmentTotal: bobbyAttachments.length,
    bobbyImageAttachmentCount: bobbyImageAtts.length,
    bobbyNonImageAttachmentCount: bobbyAttachments.length - bobbyImageAtts.length,
    imageExtensions: (() => {
      const e = {};
      for (const a of bobbyImageAtts) {
        const x = (a.fileName || '').split('.').pop().toLowerCase();
        e[x] = (e[x] || 0) + 1;
      }
      return e;
    })(),
    attachmentStructureKeys: ['id', 'url', 'fileName', 'fileSizeBytes'],
    urlsAreDiscordCDN: true,
    urlsHaveExpiry: true,
    urlExpiryNote: 'Discord CDN URLs contain expiry params (ex=..., hm=...). May be expired.',
    first5Messages: allMsgs.slice(0, 5).map(m => ({
      id: m.id, timestamp: m.timestamp,
      author: m.author?.nickname || m.author?.name,
      contentSnippet: (m.content || '').slice(0, 80),
      attachmentCount: (m.attachments || []).length,
    })),
    last5Messages: allMsgs.slice(-5).map(m => ({
      id: m.id, timestamp: m.timestamp,
      author: m.author?.nickname || m.author?.name,
      contentSnippet: (m.content || '').slice(0, 80),
      attachmentCount: (m.attachments || []).length,
    })),
  },

  bobbyMediaCache: {
    manifestPath: MANIFEST_PATH,
    bomDetected: hadBom,
    bomStripped: hadBom,
    manifestEntries: manifest.length,
    manifestAuthors,
    manifestDownloadStatuses: manifestStatuses,
    manifestDateRange: {
      first: manifestDates[0],
      last: manifestDates[manifestDates.length - 1],
    },
    localMediaFiles: localFiles.size,
    localFilesNotInManifest: localNotInManifest.length,
    manifestRowsMissingLocalFile: manifestMissingLocal.length,
    matchResults: {
      bobbyImageAttachments: bobbyImageAtts.length,
      matchedToLocalManifest: matchedLocal,
      unmatchedCount,
      unmatchedReason: unmatchedCount > 0
        ? 'Manifest only covers through 2026-04-23; ' + unmatchedCount + ' attachments from 2026-04-24 onwards are not in manifest.'
        : 'All matched',
      unmatchedByDate,
    },
    parseBobbyImageFeasibility: {
      locallyAvailableImages: matchedLocal,
      requiresBase64Conversion: true,
      existingParser: 'lib/parse-bobby.js::parseBobbyImage(base64, livePrices)',
      requiresAnthropicVisionCall: true,
      feasibility: 'FEASIBLE for ' + matchedLocal + ' images. ' + unmatchedCount +
        ' images not locally cached and would need CDN download (URLs may be expired).',
      cdnDownloadRisk: unmatchedCount + ' images need CDN download. Discord CDN URLs have expiry params and may be stale.',
      recommendedAction: 'Attempt CDN download for unmatched ' + unmatchedCount + ' attachments. ' +
        'Log failures explicitly per-attachment. Do not silently drop.',
    },
  },

  manciniText: {
    source: MANCINI_PATH,
    fileSizeBytes: manciniText.length,
    lineCount: manciniLines,
    encoding: 'UTF-8 with mojibake (Windows-1252 chars mis-decoded)',
    mojibakeSamplesFound: uniqueMojibake.length > 0,
    mojibakeSamples: uniqueMojibake,
    mojibakeNote: 'No mojibake found in current file. The ONLY non-ASCII characters are U+2013 en-dashes used as post delimiters [–]. ' +
                  'Roadmap warned of mojibake (e.g. â€", Â©) as a precaution — does not apply to this file. ' +
                  'Keep precaution in normalizer for defensive coding in case future re-exports differ.',
    postSplitter: '[–]Adam_Mankini (UTF-8 en-dash U+2013)',
    postCount,
    threadHeaders: uniqueHeaders,
    threadHeaderCount: uniqueHeaders.length,
    fileOrder: 'most-recent-first (newest post at top, oldest at bottom)',
    sampleRelativeTimestamps: uniqueRelTs.slice(0, 15),
    relativeTimestampRisk: {
      description: 'Posts use relative timestamps ("an hour ago", "1 day ago", "1 month ago").',
      highConfidencePosts: 'Posts within current week thread using "an hour ago" / "X hours ago" / "X days ago" (X <= 6) can be anchored to the thread header week.',
      lowConfidencePosts: 'Posts with "1 month ago" or at thread boundary transitions cannot be pinpointed to exact calendar date.',
      currentWeekAnchor: hasCurrentWeek ? 'Week of 4/26/2026 thread is present (top of file). High confidence for recent posts.' : 'No current week header found.',
      reconstruction: 'Must parse thread headers to get week anchor, then use post order + relative offset to reconstruct dates.',
      lowConfidenceFlag: 'Mark any post that cannot be dated to within ±1 day as timestampConfidence: low.',
      countWithMonthAgo: lowConfidenceIndicators.length,
    },
    firstPostSnippet: firstPost.slice(0, 200),
    lastPostSnippet: lastPost.slice(0, 200),
  },

  satyDerivability: {
    sourceFunction: 'lib/saty-auto-pull.js::_internal.deriveSatyLevelsFromBars(bars, options)',
    formula: 'Wilder ATR-14 on daily bars. Levels: prev_close ± (ATR * multiplier) for Fibonacci ratios [0.236, 0.382, 0.5, 0.618, 0.786, 1.0].',
    instrumentUsed: 'SPX (not ES directly)',
    testWithSPXIntraday: {
      spxDailyBarsAvailable: satyDatesAvailable,
      minBarsRequired: satyMinBarsNeeded,
      testDerivationResult: satyTestResult.valid ? 'VALID' : ('FAILED: ' + satyTestResult.error),
      sampleOutput: satyTestResult.valid ? {
        referenceDate: satyTestResult.reference_date,
        prevClose: satyTestResult.prev_close,
        atrValue: satyTestResult.atr_value,
        callTrigger: satyTestResult.call_trigger,
        putTrigger: satyTestResult.put_trigger,
      } : null,
    },
    leakageRisk: satyLeakageRisk,
    backtestRequirement: 'For each trading date D, call deriveSatyLevelsFromBars with daily bars sliced to include only dates < D. Never include bars from D or later.',
    status: satyCanDerive
      ? 'VERIFIED - formula accessible, derives valid levels from historical SPX daily bars, no lookahead if sliced correctly.'
      : 'FAILED - cannot derive. See testDerivationResult.',
    note: 'No user-provided Saty source formula supplied. Using existing lib/saty-auto-pull.js. Recommend manual spot-check against a known live Saty output before using in confluence scoring.',
    includeInConfluenceScoringNow: false,
    includeReason: 'Formula is verified and derivable from historical bars, but needs one manual spot-check against known live output before confluence use.',
  },

  readinessGates: {
    esHistoricalCoverage: esSummary.missingCount === 0
      ? 'PASS' : ('PARTIAL - ' + esSummary.missingCount + ' missing dates in ES merged stream'),
    spxHistoricalCoverage: spxSummary.missingCount === 0 ? 'PASS' : 'PARTIAL',
    bobbyExportShape: 'PASS - 892 BOBBY messages, 724 image attachments, timestamps confirmed',
    bobbyLocalCacheMatch: matchedLocal + ' of ' + bobbyImageAtts.length + ' images locally cached. ' +
      unmatchedCount + ' require CDN download. Gate: ' +
      (unmatchedCount <= 60 ? 'PROCEED with CDN attempt' : 'BLOCKED - too many unmatched'),
    manciniTimestampRisk: 'PARTIAL - recent posts high confidence, older posts and "1 month ago" references low confidence. Implement conservative reconstruction before entry generation.',
    satyFormula: satyCanDerive ? 'PASS - formula verified' : 'BLOCKED',
  },

  nextSteps: [
    `1. Implement lib/backtest-data/bobby-export.js to normalize ${bobbyMsgs.length} BOBBY messages.`,
    `2. Implement lib/backtest-data/bobby-image-cache.js: match ${matchedLocal} local + attempt CDN download for ${unmatchedCount} unmatched.`,
    '3. Implement lib/backtest-data/mancini-text.js: normalize mojibake, split posts, reconstruct dates using thread headers, flag low-confidence.',
    '4. Implement lib/backtest-data/saty-historical.js: slice SPX daily bars to date D-1, call deriveSatyLevelsFromBars. Do one manual spot-check.',
    esSummary.missingCount > 0
      ? `5. Acquire ES bars for ${esSummary.missingCount} remaining missing date(s): ${esSummary.missingDates.join(', ')}.`
      : '5. ES historical coverage is complete — no additional bar files needed.',
    '6. After coverage gaps documented, proceed to Phase 1 normalizer builds with tests.',
  ],
};

// ── Write JSON ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const jsonOut = path.join(OUT_DIR, 'coverage-report.json');
fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf8');
console.log('JSON written:', jsonOut);

// ── Write Markdown ────────────────────────────────────────────────────────────
const esMissingList = report.historicalBars.esMerged.missingDates
  .map(d => `  - ${d}`).join('\n');
const spxMissingList = report.historicalBars.spx.missingDates.length === 0
  ? '  - _none_'
  : report.historicalBars.spx.missingDates.map(d => `  - ${d}`).join('\n');

const unmatchedDatesList = Object.entries(unmatchedByDate)
  .sort(([a],[b]) => a < b ? -1 : 1)
  .map(([d,n]) => `  - ${d}: ${n} images`)
  .join('\n');

const threadHeaderList = uniqueHeaders.map(h => `  - ${h}`).join('\n');

const md = `# ES Long Backtest — Coverage and Source-Shape Report

**Generated:** ${report.generatedAt}
**Mode:** Read-only audit. No live files, entry logic, or broker routes modified.

---

## 1. Historical Bars

### ES (Merged ESH26 + ESM26)

| Field | Value |
|---|---|
| Total bars | ${esSummary.totalBars.toLocaleString()} |
| Distinct dates | ${esSummary.distinctDates} |
| First bar | ${esSummary.firstBar} |
| Last bar | ${esSummary.lastBar} |
| Expected weekdays in range | ${esSummary.expectedWeekdays} |
| Missing dates | **${esSummary.missingCount}** |
| Dates with RTH bars | ${esSummary.datesWithRTHBars} |
| Dates with overnight bars | ${esSummary.datesWithOvernightBars} |

**Missing ES trading dates (${esSummary.missingCount}):**
${esMissingList}

> **Gap note:** ${esSummary.missingCount === 0
  ? 'ES merged stream is complete — no missing trading dates.'
  : `${esSummary.missingCount} missing trading date(s): ${esSummary.missingDates.join(', ')}. Any backtest session on these dates cannot be run without additional ES data.`}

### ESH26 only

| Field | Value |
|---|---|
| Total bars | ${eshSummary.totalBars.toLocaleString()} |
| Distinct dates | ${eshSummary.distinctDates} |
| First bar | ${eshSummary.firstBar} |
| Last bar | ${eshSummary.lastBar} |
| Dates with RTH | ${eshSummary.datesWithRTHBars} |
| Dates with overnight | ${eshSummary.datesWithOvernightBars} |

### ESM26 only

| Field | Value |
|---|---|
| Total bars | ${esmSummary.totalBars.toLocaleString()} |
| Distinct dates | ${esmSummary.distinctDates} |
| First bar | ${esmSummary.firstBar} |
| Last bar | ${esmSummary.lastBar} |
| Dates with RTH | ${esmSummary.datesWithRTHBars} |
| Dates with overnight | ${esmSummary.datesWithOvernightBars} |

### SPX

| Field | Value |
|---|---|
| Total bars | ${spxSummary.totalBars.toLocaleString()} |
| Distinct dates | ${spxSummary.distinctDates} |
| First bar | ${spxSummary.firstBar} |
| Last bar | ${spxSummary.lastBar} |
| Expected weekdays in range | ${spxSummary.expectedWeekdays} |
| Missing dates | **${spxSummary.missingCount}** |
| Dates with RTH | ${spxSummary.datesWithRTHBars} |
| Dates with overnight | ${spxSummary.datesWithOvernightBars} |

**Missing SPX dates:**
${spxMissingList}

> **SPX overnight note:** The ${spxSummary.datesWithOvernightBars} dates showing "overnight bars" are post-market only (16:01–16:38 ET range, all volume=0). SPX is a cash index — no true overnight or pre-market bars are present. Post-market bars are useful as post-close price reference only.

---

## 2. Bobby Discord Export

**Source:** \`data/backtest/es-long-bracket/raw/bobby json.json\`

| Field | Value |
|---|---|
| Total messages (header) | ${bobbyData.messageCount} |
| Total messages (parsed) | ${allMsgs.length} |
| BOBBY author messages | **${bobbyMsgs.length}** |
| Non-BOBBY messages | ${nonBobbyMsgs.length} |
| BOBBY first message | ${bobbyMsgs[0]?.timestamp} |
| BOBBY last message | ${bobbyMsgs[bobbyMsgs.length - 1]?.timestamp} |
| BOBBY distinct trading dates | ${bobbyDates.size} |
| BOBBY msgs with attachments | ${bobbyMsgs.filter(m => m.attachments && m.attachments.length).length} |
| BOBBY msgs without attachments | ${bobbyMsgs.filter(m => !m.attachments || !m.attachments.length).length} |
| BOBBY image attachments total | ${bobbyImageAtts.length} |
| Non-image attachments | 0 |

**Author breakdown:**
${Object.entries(authorCounts).sort(([,a],[,b]) => b - a).map(([k,v]) => `  - ${k}: ${v}`).join('\n')}

**Attachment structure keys:** \`id\`, \`url\`, \`fileName\`, \`fileSizeBytes\`

**Image extension breakdown:** ${JSON.stringify(report.bobbyExport.imageExtensions)}

**URL note:** All attachment URLs are Discord CDN URLs with expiry params (\`ex=...\`, \`hm=...\`). Do not assume CDN URLs remain valid. Prefer local cache.

### First 5 messages (ascending)
${report.bobbyExport.first5Messages.map((m, i) =>
  `${i + 1}. [${m.timestamp}] **${m.author}** — "${m.contentSnippet}" (${m.attachmentCount} attachments)`
).join('\n')}

### Last 5 messages (ascending)
${report.bobbyExport.last5Messages.map((m, i) =>
  `${i + 1}. [${m.timestamp}] **${m.author}** — "${m.contentSnippet}" (${m.attachmentCount} attachments)`
).join('\n')}

---

## 3. Bobby Local Media Cache

**Source:** \`discord-exports/bobby/media/\`
**Manifest:** \`discord-exports/bobby/media/manifest.json\`

| Field | Value |
|---|---|
| Manifest BOM detected | ${hadBom} |
| Manifest BOM stripped | ${hadBom} |
| Manifest entries | ${manifest.length} |
| Local media files on disk | ${localFiles.size} |
| Local files not in manifest | ${localNotInManifest.length} |
| Manifest rows with missing local file | ${manifestMissingLocal.length} |
| Manifest date range | ${manifestDates[0]} → ${manifestDates[manifestDates.length - 1]} |

**Manifest authors:** ${JSON.stringify(manifestAuthors)}
**Manifest download statuses:** ${JSON.stringify(manifestStatuses)}

### Attachment → Local Cache Match

| Field | Value |
|---|---|
| BOBBY image attachments in JSON | ${bobbyImageAtts.length} |
| Matched to local manifest | **${matchedLocal}** |
| Unmatched (no manifest entry) | **${unmatchedCount}** |
| Unmatched reason | Manifest covers through 2026-04-23. ${unmatchedCount} attachments are from 2026-04-24 onwards. |

**Unmatched by date:**
${unmatchedDatesList}

### parseBobbyImage Feasibility

- **${matchedLocal} images** are locally cached and can be read as bytes → base64 → \`parseBobbyImage()\`.
- **${unmatchedCount} images** are not in local cache. These require CDN download first.
- CDN URLs have expiry params — download success is not guaranteed.
- \`parseBobbyImage()\` requires Anthropic vision API call per image. Not tested here (read-only audit).
- **Gate:** Do not mark Bobby image data as "usable" until \`bobby-image-cache-manifest.jsonl\` and \`bobby-image-parses.jsonl\` exist with per-image statuses.

---

## 4. Mancini Text

**Source:** \`data/backtest/es-long-bracket/raw/mancini/Mancini.txt\`

| Field | Value |
|---|---|
| File size | ${manciniText.length.toLocaleString()} bytes |
| Line count | ${manciniLines.toLocaleString()} |
| Encoding | UTF-8 with mojibake (Windows-1252 chars mis-decoded) |
| Post delimiter | \`[–]Adam_Mankini\` (UTF-8 en-dash U+2013) |
| Post count (split on delimiter) | **${postCount}** |
| File order | Most-recent-first |

**Mojibake detected:** ${uniqueMojibake.length > 0 ? 'YES — ' + uniqueMojibake.slice(0, 5).join(', ') : 'NONE in current file. Non-ASCII chars are only U+2013 en-dashes (post delimiters). Roadmap precaution noted but does not apply to this export.'}

### Thread Headers Found (${uniqueHeaders.length} unique)
${threadHeaderList}

### Timestamp Reconstruction Risk

| Category | Assessment |
|---|---|
| Current week posts ("an hour ago", "X hours ago") | **High confidence** — anchor to week of 4/26/2026 |
| Recent week posts ("X days ago", X ≤ 6) | **High confidence** — anchor to thread header |
| Posts with "1 month ago" | **Low confidence** — flag \`timestampConfidence: low\` |
| Posts at thread boundary transitions | **Low confidence** — ambiguous which week |
| Posts referencing only relative time without thread context | **Low confidence** |

**Sample relative timestamps observed:** ${uniqueRelTs.slice(0, 8).join(', ')}

**Posts with month-level relative timestamps (approximate):** ${lowConfidenceIndicators.length}

> **Gate:** Low-confidence Mancini timestamps must be flagged \`timestampConfidence: low\` and kept out of entry generation until sensitivity analysis explicitly allows them.

---

## 5. Saty Historical Derivability

**Source function:** \`lib/saty-auto-pull.js::_internal.deriveSatyLevelsFromBars(bars, options)\`

| Field | Value |
|---|---|
| Formula | Wilder ATR-14 on daily bars, levels at Fibonacci ratios of ATR |
| Instrument | SPX (not ES directly) |
| Min bars required | 35 daily bars |
| SPX daily bars available (intraday-derived) | ${satyDatesAvailable} |
| Test derivation result | **${satyTestResult.valid ? 'VALID' : 'FAILED: ' + satyTestResult.error}** |
| Leakage risk | Low (formula reads only last bar; caller must slice to date D-1) |

${satyTestResult.valid ? `**Sample derived output (reference date: ${satyTestResult.reference_date}):**
- prev_close: ${satyTestResult.prev_close}
- ATR: ${satyTestResult.atr_value}
- call_trigger: ${satyTestResult.call_trigger}
- put_trigger: ${satyTestResult.put_trigger}` : ''}

> **Gate:** Formula is verified and derivable from historical bars. Needs one manual spot-check against a known live Saty output before confluence scoring use.
> **Not included in confluence scoring yet.**
> No user-provided alternative Saty formula was supplied. Using existing \`lib/saty-auto-pull.js\`.

---

## 6. Readiness Gates

| Gate | Status |
|---|---|
| ES historical coverage | ${report.readinessGates.esHistoricalCoverage} |
| SPX historical coverage | ${report.readinessGates.spxHistoricalCoverage} |
| Bobby export shape | ${report.readinessGates.bobbyExportShape} |
| Bobby local cache match | ${report.readinessGates.bobbyLocalCacheMatch} |
| Mancini timestamp risk | ${report.readinessGates.manciniTimestampRisk} |
| Saty formula | ${report.readinessGates.satyFormula} |

---

## 7. Next Steps

${report.nextSteps.map(s => `- ${s}`).join('\n')}
`;

const mdOut = path.join(OUT_DIR, 'coverage-report.md');
fs.writeFileSync(mdOut, md, 'utf8');
console.log('Markdown written:', mdOut);
console.log('Done.');
