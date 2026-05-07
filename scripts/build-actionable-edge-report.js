'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'actionable-edge-report');

const FILES = {
  highConfluence: path.join(ROOT, 'artifacts', 'research', 'mancini-options-high-confluence', 'high-confluence-summary.json'),
  flagshipSummary: path.join(ROOT, 'artifacts', 'research', 'flagship-acceptance-window', 'summary.csv'),
  shipAudit: path.join(ROOT, 'artifacts', 'research', 'ship-audit-current-saty-barchart-futures', 'summary.json'),
  closeTrades: path.join(ROOT, 'artifacts', 'research', 'ship-audit-current-saty-barchart-futures', 'close-trades.csv'),
  sessions: path.join(ROOT, 'artifacts', 'research', 'ship-audit-current-saty-barchart-futures', 'sessions.csv'),
  detectorDir: path.join(ROOT, 'artifacts', 'research', 'mancini-live-detector'),
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());
  return lines.map(line => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      const value = cols[index] ?? '';
      const num = Number(value);
      row[header] = value !== '' && Number.isFinite(num) ? num : value;
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pct(value) {
  return `${round2(Number(value || 0) * 100)}%`;
}

function mean(rows, field) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length;
}

function median(values) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function summarizeTrades(rows) {
  const n = rows.length;
  if (!n) return null;
  return {
    trades: n,
    tp1_rate: rows.filter(row => row.outcome === 'tp1_first' || row.outcome === 'tp2_first').length / n,
    stop_rate: rows.filter(row => row.outcome === 'stop_first' || row.outcome === 'mixed_stop_first').length / n,
    avg_net: mean(rows, 'net_dollars'),
    median_net: median(rows.map(row => row.net_dollars)),
    total_net: rows.reduce((sum, row) => sum + Number(row.net_dollars || row.dollars || 0), 0),
  };
}

function satyLevelsFromSession(session) {
  const prev = Number(session.prev_close);
  const atr = Number(session.atr_value);
  if (!Number.isFinite(prev) || !Number.isFinite(atr)) return null;
  return {
    atr_plus_1: prev + atr,
    ext_plus_4: prev + atr * 0.786,
    ext_plus_3: prev + atr * 0.618,
    ext_plus_2: prev + atr * 0.5,
    ext_plus_1: prev + atr * 0.382,
    call_trigger: prev + atr * 0.236,
    prev_close: prev,
    put_trigger: prev - atr * 0.236,
    ext_minus_1: prev - atr * 0.382,
    ext_minus_2: prev - atr * 0.5,
    ext_minus_3: prev - atr * 0.618,
    ext_minus_4: prev - atr * 0.786,
    atr_minus_1: prev - atr,
  };
}

function nearestSaty(entry, levels) {
  return Object.entries(levels)
    .map(([field, price]) => ({ field, price, distance: Math.abs(Number(entry) - Number(price)) }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function bucketDistance(distance) {
  if (distance <= 1) return '<=1pt';
  if (distance <= 2) return '<=2pt';
  if (distance <= 5) return '<=5pt';
  if (distance <= 10) return '<=10pt';
  return '>10pt';
}

function groupSummary(rows, getKey) {
  const groups = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...summarizeTrades(group) }))
    .sort((a, b) => b.trades - a.trades);
}

function analyzeSatyInteractions() {
  const sessions = parseCsv(FILES.sessions)
    .filter(row => row.reference_field === 'close' && row.valid === 'true');
  const sessionByDate = new Map(sessions.map(row => [row.date, row]));
  const trades = parseCsv(FILES.closeTrades);
  const enriched = trades.map(trade => {
    const session = sessionByDate.get(trade.date);
    const levels = session ? satyLevelsFromSession(session) : null;
    const nearest = levels ? nearestSaty(trade.entry, levels) : null;
    const entry = Number(trade.entry);
    return {
      ...trade,
      nearest_saty_field: nearest?.field || 'unknown',
      nearest_saty_distance: nearest ? round2(nearest.distance) : null,
      nearest_saty_bucket: nearest ? bucketDistance(nearest.distance) : 'unknown',
      saty_zone: levels
        ? entry >= levels.call_trigger ? 'above_call_trigger'
          : entry <= levels.put_trigger ? 'below_put_trigger'
            : 'inside_chop_zone'
        : 'unknown',
      atr_extension_side: levels
        ? entry >= levels.ext_plus_1 ? 'above_ext_plus_1'
          : entry <= levels.ext_minus_1 ? 'below_ext_minus_1'
            : 'inside_first_extensions'
        : 'unknown',
    };
  });

  return {
    by_zone: groupSummary(enriched, row => row.saty_zone),
    by_distance: groupSummary(enriched, row => row.nearest_saty_bucket),
    by_nearest_field: groupSummary(enriched, row => row.nearest_saty_field).slice(0, 10),
    by_extension_side: groupSummary(enriched, row => row.atr_extension_side),
    enriched,
  };
}

function topRows(rows, predicate, limit = 6) {
  return rows.filter(predicate).slice(0, limit);
}

function mdTable(rows, columns) {
  if (!rows.length) return '_No rows._';
  const header = `| ${columns.map(col => col.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(col => col.format ? col.format(row[col.key], row) : row[col.key]).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let inTable = false;
  for (const line of lines) {
    if (/^# /.test(line)) out.push(`<h1>${htmlEscape(line.slice(2))}</h1>`);
    else if (/^## /.test(line)) out.push(`<h2>${htmlEscape(line.slice(3))}</h2>`);
    else if (/^### /.test(line)) out.push(`<h3>${htmlEscape(line.slice(4))}</h3>`);
    else if (/^\|/.test(line)) {
      if (/^\|[-| ]+\|$/.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      if (!inTable) {
        out.push('<table>');
        inTable = true;
        out.push(`<tr>${cells.map(cell => `<th>${htmlEscape(cell)}</th>`).join('')}</tr>`);
      } else {
        out.push(`<tr>${cells.map(cell => `<td>${htmlEscape(cell)}</td>`).join('')}</tr>`);
      }
    } else {
      if (inTable) {
        out.push('</table>');
        inTable = false;
      }
      if (/^- /.test(line)) out.push(`<p class="bullet">${htmlEscape(line)}</p>`);
      else if (line.trim()) out.push(`<p>${htmlEscape(line)}</p>`);
      else out.push('<div class="spacer"></div>');
    }
  }
  if (inTable) out.push('</table>');
  return out.join('\n');
}

function readDetectorSummaries() {
  if (!fs.existsSync(FILES.detectorDir)) return [];
  return fs.readdirSync(FILES.detectorDir)
    .filter(name => /-summary\.json$/.test(name))
    .map(name => readJson(path.join(FILES.detectorDir, name), null))
    .filter(Boolean)
    .sort((a, b) => String(a.requested_date || '').localeCompare(String(b.requested_date || '')));
}

function buildMarkdown({ highConfluence, saty, flagship, shipAudit, detectorSummaries }) {
  const rows = highConfluence?.rows || [];
  const topFilters = topRows(rows, row => row.triggers >= 5, 6);
  const superRows = (highConfluence?.superRows || []).filter(row => row.super_triggers >= 3).slice(0, 6);
  const legacy = flagship.filter(row => row.entry_mode === 'legacy_plan_entry' && row.acceptance_bars === 3 && row.min_tap_groups === 3)[0];
  const nextOpen = flagship.filter(row => row.entry_mode === 'next_open_market' && row.acceptance_bars === 3 && row.min_tap_groups === 3)[0];
  const retest30 = flagship.filter(row => row.entry_mode === 'limit_retest_30m' && row.acceptance_bars === 5 && row.min_tap_groups === 3)[0];

  return `# Actionable Edge Report - Mancini Acceptance + Saty Context

Generated: ${new Date().toISOString()}

## Bottom Line

- The cleanest actionable idea is still the Mancini acceptance trigger: ES flushes below a known Mancini level, then accepts above it for about 3 one-minute bars.
- For direct or naked calls, the only filter in this data that approached the requested high-probability profile was **2+ ES point flush + 5+ prior tap groups**. It had 5 triggers, 4 signal days, 80% same-day positive, 80% next-day positive, and 100% week-positive SPX underlying movement. That is actionable, but it is a small sample and convex-regime sensitive.
- The current Pine-style ledger behavior is profitable in historical replay, but the research still says execution mode matters. The old "planned entry already resting" model is where the edge lives. Blind next-open market chasing is not the same strategy and tested badly.
- Saty is useful as a context filter, not a standalone trigger. The strongest use from this pass is to avoid/chill signals inside the Saty chop zone and to prefer signals reclaiming above call-trigger/extension structure.

## Detector Output

New research-only detector files:

- ${path.join(ROOT, 'lib', 'mancini-trigger-detector.js')}
- ${path.join(ROOT, 'scripts', 'check-mancini-trigger-detector.js')}
- ${path.join(ROOT, 'tradingview', 'LUKE-OPTIONS-MANCINI-TRIGGER-v1.pine')}

The detector emits structured tiers:

- MANCINI_ACCEPTANCE_WATCH: basic flush + 3m acceptance.
- MANCINI_HIGH_CONFLUENCE_CALL: after 09:45 ET, 5+ prior tap groups, 2+ ES point flush.
- MANCINI_SUPER_TRIGGER_WATCH: same-level repeated acceptance cluster inside the configured window.

Replay sanity sample from the detector:

${mdTable(detectorSummaries.map(row => ({
    date: row.requested_date,
    rows: row.source?.candles?.rows,
    levels: row.source?.levels?.used,
    triggers: row.detector_summary?.triggers,
    high: row.detector_summary?.high_confluence,
    discord: String(row.discord_text || '').split('\n')[0],
  })), [
    { key: 'date', label: 'Date' },
    { key: 'rows', label: '1m bars' },
    { key: 'levels', label: 'Known levels' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'high', label: 'High-conf' },
    { key: 'discord', label: 'Latest signal line' },
  ])}

## High-Confluence Options Proxy

This is SPX underlying movement, not option-contract P/L. It is still useful for finding where call premium can be mispriced if IV/skew/spread are acceptable.

${mdTable(topFilters, [
    { key: 'filter_label', label: 'Filter' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'signal_days', label: 'Days' },
    { key: 'avg_flush_depth', label: 'Avg flush' },
    { key: 'rate_mfe10_2h', label: '2h MFE +10' },
    { key: 'rate_mfe20_4h', label: '4h MFE +20' },
    { key: 'rate_eod_positive', label: 'EOD +' },
    { key: 'rate_next_eod_positive', label: 'Next day +' },
    { key: 'avg_close_next_eod', label: 'Avg next-day SPX' },
  ])}

The +90 SPX next-day average is not a normal expectation. It is heavily helped by April 7 continuation. The actionable read is "this creates convex upside windows," not "buy calls expecting +90."

## Same-Level Super Triggers

Repeated same-level triggers should be treated as one setup, not multiple trades. The useful signal is escalation: the level is being defended/reclaimed repeatedly.

${mdTable(superRows, [
    { key: 'mode', label: 'Entry mode' },
    { key: 'super_window_minutes', label: 'Window' },
    { key: 'filter_label', label: 'Filter' },
    { key: 'super_triggers', label: 'Setups' },
    { key: 'signal_days', label: 'Days' },
    { key: 'rate_mfe20_4h', label: '4h MFE +20' },
    { key: 'rate_eod_positive', label: 'EOD +' },
    { key: 'rate_next_eod_positive', label: 'Next day +' },
  ])}

Sanity check: super triggers are promising as context, but the sample is extremely small once filtered for repeats. I would not trade them alone. I would use them to upgrade a normal Mancini acceptance watch.

## Pine Behavior Read

Current Saty/Pine replay audit:

- Current Pine reference field: close/current Pine.
- Valid sessions: ${shipAudit?.close_summary?.sessions_valid}
- Trades: ${shipAudit?.close_summary?.trades}
- TP1-first rate: ${pct(shipAudit?.close_summary?.tp1_first_rate)}
- Stop-first rate: ${pct(shipAudit?.close_summary?.stop_first_rate)}
- Net: $${round2(shipAudit?.close_summary?.total_dollars)}

Execution-mode comparison from the flagship acceptance research:

${mdTable([
    { mode: 'Legacy planned entry', ...legacy },
    { mode: 'Next open market chase', ...nextOpen },
    { mode: '30m limit retest', ...retest30 },
  ].filter(Boolean), [
    { key: 'mode', label: 'Mode' },
    { key: 'trades', label: 'Trades' },
    { key: 'tp1_first_rate', label: 'TP1 rate', format: value => pct(value) },
    { key: 'stop_first_rate', label: 'Stop rate', format: value => pct(value) },
    { key: 'total_dollars', label: 'Net $', format: value => `$${round2(value)}` },
    { key: 'average_dollars', label: 'Avg $', format: value => `$${round2(value)}` },
  ])}

Reasoning check: the prior alpha was not all cheating. The strategy depended on having a planned entry resting at level + tick or acting immediately when acceptance completes. The market-chase version is a different strategy and loses much of the edge.

## Saty ATR Edge Cases

Saty bucket analysis used the 30-session current Pine replay trade list and derived Saty levels from prior-session close/ATR.

By Saty zone:

${mdTable(saty.by_zone, [
    { key: 'key', label: 'Zone' },
    { key: 'trades', label: 'Trades' },
    { key: 'tp1_rate', label: 'TP1 rate', format: value => pct(value) },
    { key: 'stop_rate', label: 'Stop rate', format: value => pct(value) },
    { key: 'avg_net', label: 'Avg net', format: value => `$${round2(value)}` },
    { key: 'total_net', label: 'Total net', format: value => `$${round2(value)}` },
  ])}

By nearest-Saty distance:

${mdTable(saty.by_distance, [
    { key: 'key', label: 'Distance to Saty' },
    { key: 'trades', label: 'Trades' },
    { key: 'tp1_rate', label: 'TP1 rate', format: value => pct(value) },
    { key: 'stop_rate', label: 'Stop rate', format: value => pct(value) },
    { key: 'avg_net', label: 'Avg net', format: value => `$${round2(value)}` },
  ])}

Distance note: this bucket is not a useful discriminator in the current Saty-only replay because the traded levels are derived from Saty levels, so nearly every trade is by construction close to a Saty line. The useful Saty read is zone/field, not raw distance.

Nearest Saty field leaders:

${mdTable(saty.by_nearest_field, [
    { key: 'key', label: 'Nearest field' },
    { key: 'trades', label: 'Trades' },
    { key: 'tp1_rate', label: 'TP1 rate', format: value => pct(value) },
    { key: 'avg_net', label: 'Avg net', format: value => `$${round2(value)}` },
    { key: 'total_net', label: 'Total net', format: value => `$${round2(value)}` },
  ])}

Actionable read:

- Add a **Saty chop warning**, not a hard veto: inside put/call trigger, reduce conviction or require Mancini high-confluence.
- Add a **call-trigger reclaim upgrade**: if Mancini acceptance fires above/through Saty call trigger and not extended beyond ATR+1, it is a cleaner call candidate.
- Add a **deep downside reclaim tag**: below put trigger/ext-minus reclaims had better replay economics than inside chop. Treat this as an oversold-bounce context tag, not a reason to blindly buy every below-put long.
- Add an **extension caution**: when already stretched near outer ATR levels, favor quicker profit-taking rather than larger-swing call holds.

## Actionable Edge Cases To Add With Low Cost

1. **Mancini High-Confluence Call Alert**
   Rule: known Mancini level, 1m flush >= 2 ES points, 3 accepted 1m closes above level, 5+ prior tap groups, after 09:45 ET.
   Why: this is the only tested filter near the requested 80% profile. It is small-sample, but mechanistically matches the failed-breakdown thesis.

2. **Same-Level Super Trigger Upgrade**
   Rule: if the same level fires again inside 60 minutes, collapse into the same setup and upgrade the alert text. Do not count it as a new trade.
   Why: repeated defense/reclaim is accumulation-like behavior, but duplicate entries inflate stats and clutter.

3. **Saty Chop/Call-Trigger Context**
   Rule: tag each alert as inside chop, above call trigger, or stretched near ATR+1.
   Why: this adds useful judgement without needing new paid data. It should change sizing/hold time, not blindly veto.

4. **Deep Saty Reclaim Watch**
   Rule: if a Mancini acceptance trigger also occurs from below Saty put trigger or near ext-minus levels, tag it as an oversold reversal candidate.
   Why: the Saty replay bucket for below-put-trigger longs had stronger net and lower stop rate than the inside-chop bucket. It needs confirmation from Mancini acceptance, not standalone use.

5. **Options Premium Gate For Katbot**
   Rule: only promote naked calls if live option spread and IV/skew are acceptable. Without option marks, underlying edge is only a setup detector.
   Why: the report proves underlying convex windows, not premium mispricing by itself.

## What I Would Not Ship Yet

- A naked-call auto-buy. We do not have option contract bars/marks in this dataset.
- A hard Saty-only trigger. Saty looks useful for context and filtering, not as the source of the edge.
- A Pine rewrite of the flagship. The flagship should stay stable; this belongs in a separate options-purpose indicator or Luke/Katbot signal feed.

## Files

- Report source: ${path.join(OUT_DIR, 'actionable-edge-report.md')}
- HTML report: ${path.join(OUT_DIR, 'actionable-edge-report.html')}
- PDF report: ${path.join(OUT_DIR, 'actionable-edge-report.pdf')}
`;
}

async function renderPdf(htmlPath, pdfPath) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1500 } });
    await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`);
    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.35in', right: '0.35in', bottom: '0.35in', left: '0.35in' },
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  ensureDir(OUT_DIR);
  const highConfluence = readJson(FILES.highConfluence, {});
  const flagship = parseCsv(FILES.flagshipSummary);
  const shipAudit = readJson(FILES.shipAudit, {});
  const saty = analyzeSatyInteractions();
  const detectorSummaries = readDetectorSummaries();

  const markdown = buildMarkdown({ highConfluence, saty, flagship, shipAudit, detectorSummaries });
  const mdPath = path.join(OUT_DIR, 'actionable-edge-report.md');
  const htmlPath = path.join(OUT_DIR, 'actionable-edge-report.html');
  const pdfPath = path.join(OUT_DIR, 'actionable-edge-report.pdf');
  fs.writeFileSync(mdPath, markdown, 'utf8');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Actionable Edge Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.35; margin: 32px; }
    h1 { font-size: 26px; margin: 0 0 14px; }
    h2 { font-size: 18px; margin: 22px 0 8px; border-bottom: 1px solid #D1D5DB; padding-bottom: 4px; }
    h3 { font-size: 15px; margin: 16px 0 6px; }
    p { font-size: 11px; margin: 5px 0; }
    .bullet { padding-left: 10px; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; font-size: 9px; page-break-inside: avoid; }
    th { background: #111827; color: white; text-align: left; }
    th, td { border: 1px solid #D1D5DB; padding: 4px 5px; vertical-align: top; }
    tr:nth-child(even) td { background: #F9FAFB; }
    .spacer { height: 4px; }
  </style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>`;
  fs.writeFileSync(htmlPath, html, 'utf8');
  await renderPdf(htmlPath, pdfPath);

  const summary = {
    generated_at: new Date().toISOString(),
    markdown: mdPath,
    html: htmlPath,
    pdf: pdfPath,
    saty_groups: {
      by_zone: saty.by_zone,
      by_distance: saty.by_distance,
      by_nearest_field: saty.by_nearest_field,
    },
    detector_summaries: detectorSummaries.map(row => ({
      date: row.requested_date,
      triggers: row.detector_summary?.triggers,
      high_confluence: row.detector_summary?.high_confluence,
    })),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'actionable-edge-report-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
