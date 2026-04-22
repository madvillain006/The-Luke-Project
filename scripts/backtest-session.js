'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const CSV_PATH = getArg('--csv');
const TICKER   = (getArg('--ticker') || 'SPX').toUpperCase();
const SOURCE   = getArg('--source') || 'all';
let   DATE     = getArg('--date');   // optional — derived from CSV if omitted

if (!CSV_PATH) {
  console.error('Usage: node scripts/backtest-session.js --csv <path> --ticker <TICKER> --source <source> [--date <YYYY-MM-DD>]');
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const PROCESSED_SIGNALS = path.join(__dirname, '../data/kat/processed-signals.jsonl');
const RAW_FEED          = path.join(__dirname, '../data/kat/raw-feed.jsonl');
const OUTPUT_DIR        = path.join(__dirname, '../data/backtest');

// ── CSV column name constants ─────────────────────────────────────────────────
const COL_DATETIME = 'Time';
const COL_CLOSE    = 'Close';

// ── DateTime parser ───────────────────────────────────────────────────────────
function parseDateTime(str) {
  // Barchart format: "YYYY-MM-DD HH:MM" (quoted, ISO-like, CT timezone)
  // Convert CT to ET by adding 1 hour for market-hours correlation
  const barchartISO = str.replace(/^"|"$/g, '').trim();
  const isoRe = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/;
  const isoM  = barchartISO.match(isoRe);
  if (isoM) {
    const d = new Date(parseInt(isoM[1]), parseInt(isoM[2])-1, parseInt(isoM[3]),
                       parseInt(isoM[4]) + 1, parseInt(isoM[5]));
    return d.getTime();
  }

  // Original format: MM/DD/YYYY HH:MM
  const parts = barchartISO.split(' ');
  if (parts.length < 2) return NaN;
  const [datePart, timePart] = parts;
  const [mm, dd, yyyy] = datePart.split('/');
  if (!mm || !dd || !yyyy) return NaN;
  const isoTs = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${timePart}:00.000Z`;
  return new Date(isoTs).getTime();
}

// ── CSV price loader (header-aware) ──────────────────────────────────────────
function loadPriceCSV(csvPath) {
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error(`CSV has no data rows: ${csvPath}`);

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

  const colIdx = {
    dt:     headers.findIndex(h => h === COL_DATETIME || h === 'Date' || h === 'DateTime'),
    open:   headers.findIndex(h => h === 'Open'),
    high:   headers.findIndex(h => h === 'High'),
    low:    headers.findIndex(h => h === 'Low'),
    close:  headers.findIndex(h => h === COL_CLOSE || h === 'Latest' || h === 'Last'),
    volume: headers.findIndex(h => h === 'Volume')
  };

  if (colIdx.dt === -1 || colIdx.close === -1) {
    throw new Error(
      `CSV missing required columns.\n` +
      `Expected: ${COL_DATETIME}, ${COL_CLOSE}\n` +
      `Found: ${headers.join(', ')}\n` +
      `Note: Barchart uses 'Latest' instead of 'Close' — this is handled automatically`
    );
  }

  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const ts = parseDateTime(cols[colIdx.dt]);
    if (isNaN(ts)) continue;
    bars.push({
      ts,
      open:   colIdx.open   !== -1 ? parseFloat(cols[colIdx.open])   : NaN,
      high:   colIdx.high   !== -1 ? parseFloat(cols[colIdx.high])   : NaN,
      low:    colIdx.low    !== -1 ? parseFloat(cols[colIdx.low])     : NaN,
      close:  parseFloat(cols[colIdx.close]),
      volume: colIdx.volume !== -1 ? (parseInt(cols[colIdx.volume]) || 0) : 0
    });
  }
  bars.sort((a, b) => a.ts - b.ts);
  return bars;
}

// ── Signal loader ─────────────────────────────────────────────────────────────
function loadSignals(ticker, source, date) {
  if (!fs.existsSync(PROCESSED_SIGNALS)) return [];
  const lines = fs.readFileSync(PROCESSED_SIGNALS, 'utf8').split('\n').filter(l => l.trim());
  return lines.flatMap(l => {
    try {
      const s = JSON.parse(l);
      if (!s.ts) return [];
      if (date && !s.ts.startsWith(date)) return [];
      if (s.ticker && s.ticker.toUpperCase() !== ticker.toUpperCase()) return [];
      if (source && source !== 'all' && s.analyst !== source) return [];
      if (!s.bias || s.bias === 'NEUTRAL') return [];
      if (!s.levels || s.levels.length === 0) return [];
      return [s];
    } catch { return []; }
  });
}

// ── Price lookup ──────────────────────────────────────────────────────────────
function barAtOrAfter(bars, targetTs) {
  for (const b of bars) {
    if (b.ts >= targetTs) return b;
  }
  return null;
}

// ── Outcome evaluator ─────────────────────────────────────────────────────────
const TIMEFRAME_MS = {
  '5m':  5  * 60000,
  '15m': 15 * 60000,
  '30m': 30 * 60000,
  '60m': 60 * 60000
};

function evaluateSignal(signal, bars) {
  const signalTs = new Date(signal.ts).getTime();
  const entryBar = barAtOrAfter(bars, signalTs);
  if (!entryBar) return null;

  const entryPrice = entryBar.close;
  const direction  = signal.bias === 'BULLISH' ? 'LONG' : 'SHORT';
  const outcomes   = {};

  for (const [tf, ms] of Object.entries(TIMEFRAME_MS)) {
    const exitBar = barAtOrAfter(bars, signalTs + ms);
    if (!exitBar) continue;
    const exitPrice = exitBar.close;
    const pnlPts    = direction === 'LONG'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
    const verdict = pnlPts > 0 ? 'WIN' : pnlPts < 0 ? 'LOSS' : 'SCRATCH';
    outcomes[tf] = {
      verdict,
      entry:   entryPrice,
      exit:    exitPrice,
      pnl_pts: +pnlPts.toFixed(2)
    };
  }

  if (Object.keys(outcomes).length === 0) return null;

  return {
    signal_ts:   signal.ts,
    analyst:     signal.analyst,
    ticker:      signal.ticker,
    bias:        signal.bias,
    direction,
    strike:      signal.levels[0],
    levels:      signal.levels,
    signal_type: signal.signal_type,
    entry_price: entryPrice,
    outcomes
  };
}

// ─────────────────────────────────────────────
// ADDITION 1: loadHeatmapContext(date, ticker)
// ─────────────────────────────────────────────
function loadHeatmapContext(date, ticker) {
  if (!fs.existsSync(PROCESSED_SIGNALS)) return null;

  const { parseBobby }     = require('../lib/parse-bobby');
  const { parseKatSignal } = require('../lib/parse-kat');

  if (!fs.existsSync(RAW_FEED)) return null;

  const lines = fs.readFileSync(RAW_FEED, 'utf8')
    .split('\n').filter(l => l.trim());

  const context = {
    king_nodes: [], support: [], resistance: [],
    bias: 'NEUTRAL', sources: [],
    image_posts_skipped: 0,
    text_posts_parsed: 0
  };

  const biasVotes = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (!entry.ts || !entry.ts.startsWith(date)) continue;

      const hasImage   = (entry.attachments || []).length > 0;
      const hasContent = (entry.content || '').trim().length > 0;

      // Skip image-only posts (expired URLs — can't process)
      if (hasImage && !hasContent) {
        context.image_posts_skipped++;
        continue;
      }

      if (!hasContent) continue;

      const contentLower = entry.content.toLowerCase();
      const tickerMatch  = contentLower.includes(ticker.toLowerCase()) ||
        (ticker === 'SPX' && (contentLower.includes('spx') || contentLower.includes('$spx'))) ||
        (ticker === 'ES'  && contentLower.includes('spx'));

      if (!tickerMatch) continue;

      // Try Bobby text parser
      const bobbyResult = parseBobby(entry.content);
      if (bobbyResult && (
        bobbyResult.king_nodes?.length > 0 ||
        bobbyResult.support?.length > 0 ||
        bobbyResult.resistance?.length > 0
      )) {
        context.king_nodes.push(...(bobbyResult.king_nodes || []));
        context.support.push(...(bobbyResult.support || []));
        context.resistance.push(...(bobbyResult.resistance || []));
        if (bobbyResult.bias) biasVotes[bobbyResult.bias] = (biasVotes[bobbyResult.bias] || 0) + 1;
        context.sources.push({ analyst: entry.username, ts: entry.ts, type: 'bobby_text' });
        context.text_posts_parsed++;
      }

      // Try Kat signal parser (for Jefe text descriptions)
      const katResult = parseKatSignal(entry.username, entry.content, hasImage);
      if (katResult && katResult.levels && katResult.levels.length > 0) {
        if (katResult.bias === 'BEARISH') {
          context.resistance.push(...katResult.levels);
        } else if (katResult.bias === 'BULLISH') {
          context.support.push(...katResult.levels);
        } else {
          context.king_nodes.push(...katResult.levels);
        }
        if (katResult.bias) biasVotes[katResult.bias] = (biasVotes[katResult.bias] || 0) + 1;
        context.sources.push({ analyst: entry.username, ts: entry.ts, type: 'kat_text' });
        context.text_posts_parsed++;
      }

    } catch (e) {}
  }

  // Deduplicate levels — bucket to nearest 5
  const dedup = (arr) => [...new Set(arr.map(l => Math.round(l / 5) * 5))].filter(l => l > 0);
  context.king_nodes  = dedup(context.king_nodes);
  context.support     = dedup(context.support);
  context.resistance  = dedup(context.resistance);

  // Dominant bias
  context.bias = biasVotes.BULLISH > biasVotes.BEARISH ? 'BULLISH'
    : biasVotes.BEARISH > biasVotes.BULLISH ? 'BEARISH' : 'NEUTRAL';

  return context;
}

// ─────────────────────────────────────────────
// ADDITION 2: checkHeatmapAlignment(signal, heatmapContext)
// ─────────────────────────────────────────────
function checkHeatmapAlignment(signal, heatmapContext) {
  if (!heatmapContext) return { alignment: 'NO_HEATMAP', score: 0 };

  const strike    = signal.strike || signal.levels?.[0];
  const direction = signal.direction;
  if (!strike || !direction) return { alignment: 'NO_STRIKE', score: 0 };

  const TOLERANCE = 15;
  let score = 0;
  const hits = [];

  // King node near strike — high confluence regardless of direction
  for (const kn of heatmapContext.king_nodes) {
    if (Math.abs(strike - kn) <= TOLERANCE) {
      score += 2;
      hits.push({ level: kn, type: 'king_node' });
    }
  }

  if (direction === 'SHORT') {
    for (const r of heatmapContext.resistance) {
      if (r > strike && r - strike <= TOLERANCE * 2) {
        score += 1;
        hits.push({ level: r, type: 'resistance_above' });
      }
    }
    if (heatmapContext.bias === 'BEARISH') score += 1;
  } else {
    for (const s of heatmapContext.support) {
      if (s < strike && strike - s <= TOLERANCE * 2) {
        score += 1;
        hits.push({ level: s, type: 'support_below' });
      }
    }
    if (heatmapContext.bias === 'BULLISH') score += 1;
  }

  const alignment = score >= 3 ? 'STRONG'
    : score >= 1 ? 'PARTIAL' : 'NONE';

  return { alignment, score, hits };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function runBacktest() {
  const bars = loadPriceCSV(CSV_PATH);
  console.log(`[backtest] Loaded ${bars.length} bars from CSV`);

  // Derive date from first bar if --date not provided
  if (!DATE && bars.length > 0) {
    DATE = new Date(bars[0].ts).toISOString().slice(0, 10);
    console.log(`[backtest] --date not provided, derived from CSV: ${DATE}`);
  }

  const signals = loadSignals(TICKER, SOURCE, DATE);
  console.log(`[backtest] Found ${signals.length} signals for ${DATE} / ${TICKER} / ${SOURCE}`);

  // ADDITION 3: Load heatmap context for each unique date in the signals
  const heatmapsByDate = {};
  for (const sig of signals) {
    const sigDate = sig.ts.slice(0, 10);
    if (!heatmapsByDate[sigDate]) {
      heatmapsByDate[sigDate] = loadHeatmapContext(sigDate, TICKER);
      const ctx = heatmapsByDate[sigDate];
      if (ctx) {
        console.log('[backtest] Heatmap context for', sigDate + ':',
          'king_nodes:', ctx.king_nodes.length,
          '| support:', ctx.support.length,
          '| resistance:', ctx.resistance.length,
          '| text_posts:', ctx.text_posts_parsed,
          '| images_skipped:', ctx.image_posts_skipped,
          '| bias:', ctx.bias);
      }
    }
  }

  const results = [];

  for (const sig of signals) {
    const outcome = evaluateSignal(sig, bars);
    if (!outcome) continue;

    const sigDate   = sig.ts.slice(0, 10);
    const heatmap   = heatmapsByDate[sigDate] || null;
    const alignment = checkHeatmapAlignment(outcome, heatmap);

    results.push({
      ...outcome,
      heatmap_alignment: alignment.alignment,
      heatmap_score:     alignment.score,
      heatmap_hits:      alignment.hits || []
    });
  }

  // ── Win rates ─────────────────────────────────────────────────────────────
  function winRate(tf) {
    const eligible = results.filter(r => r.outcomes?.[tf]);
    if (!eligible.length) return 'N/A';
    const wins = eligible.filter(r => r.outcomes[tf].verdict === 'WIN').length;
    return ((wins / eligible.length) * 100).toFixed(1) + '%';
  }

  // ADDITION 4: heatmap_stats
  const heatmap_stats = {
    strong_alignment_count:  results.filter(r => r.heatmap_alignment === 'STRONG').length,
    partial_alignment_count: results.filter(r => r.heatmap_alignment === 'PARTIAL').length,
    no_alignment_count:      results.filter(r => r.heatmap_alignment === 'NONE').length,
    no_heatmap_count:        results.filter(r => r.heatmap_alignment === 'NO_HEATMAP').length,
    win_rate_strong_alignment: (() => {
      const strong = results.filter(r =>
        r.heatmap_alignment === 'STRONG' && r.outcomes?.['30m']);
      if (!strong.length) return 'N/A';
      const wins = strong.filter(r => r.outcomes['30m'].verdict === 'WIN').length;
      return ((wins / strong.length) * 100).toFixed(1) + '%';
    })(),
    win_rate_no_alignment: (() => {
      const none = results.filter(r =>
        r.heatmap_alignment === 'NONE' && r.outcomes?.['30m']);
      if (!none.length) return 'N/A';
      const wins = none.filter(r => r.outcomes['30m'].verdict === 'WIN').length;
      return ((wins / none.length) * 100).toFixed(1) + '%';
    })()
  };

  const summary = {
    run_ts:        new Date().toISOString(),
    date:          DATE,
    ticker:        TICKER,
    source:        SOURCE,
    csv_path:      CSV_PATH,
    csv_bars:      bars.length,
    signals_found: signals.length,
    evaluated:     results.length,
    win_rate_5m:   winRate('5m'),
    win_rate_15m:  winRate('15m'),
    win_rate_30m:  winRate('30m'),
    win_rate_60m:  winRate('60m'),
    heatmap_stats,
    results
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outFile = path.join(OUTPUT_DIR, `${DATE}_${TICKER}_${SOURCE}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`[backtest] Results written to ${outFile}`);
  console.log(`[backtest] Evaluated: ${results.length}  Win@30m: ${summary.win_rate_30m}`);

  return summary;
}

runBacktest();
