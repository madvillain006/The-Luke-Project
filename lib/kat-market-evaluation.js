'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadIntraday,
  _internal: historicalInternal,
} = require('./historical-data');

const HORIZONS = [
  { key: '5m', minutes: 5 },
  { key: '15m', minutes: 15 },
  { key: '30m', minutes: 30 },
  { key: '60m', minutes: 60 },
];

function etDate(isoTs) {
  const date = new Date(isoTs);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function marketInstrumentForRecord(record) {
  if (!record || !record.spx_options_direct) return null;
  if (record.ticker === 'SPX') return 'SPX';
  if (record.ticker === 'SPY') return 'SPY';
  return null;
}

function withHistoricalRoot(root, fn) {
  historicalInternal._setHistoricalRoot(root);
  try {
    return fn();
  } finally {
    historicalInternal._resetHistoricalRoot();
  }
}

function loadBarsFromRoots(instrument, date, roots) {
  const byTs = new Map();
  const rootsUsed = [];
  for (const root of roots) {
    const bars = withHistoricalRoot(root, () => loadIntraday(instrument, date));
    if (!Array.isArray(bars) || bars.length === 0) continue;
    rootsUsed.push(root);
    for (const bar of bars) {
      const existing = byTs.get(bar.timestamp);
      if (!existing || Number(bar.volume || 0) > Number(existing.volume || 0)) {
        byTs.set(bar.timestamp, bar);
      }
    }
  }
  return {
    bars: [...byTs.values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))),
    roots_used: rootsUsed,
  };
}

function firstBarAtOrAfter(bars, targetMs) {
  for (const bar of bars) {
    const ms = new Date(bar.timestamp).getTime();
    if (Number.isFinite(ms) && ms >= targetMs) return bar;
  }
  return null;
}

function barsBetween(bars, startMs, endMs) {
  return bars.filter(bar => {
    const ms = new Date(bar.timestamp).getTime();
    return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
  });
}

function summarizeMove(direction, entryPrice, bars) {
  if (!bars.length || !Number.isFinite(entryPrice)) return null;
  const high = Math.max(...bars.map(bar => bar.high));
  const low = Math.min(...bars.map(bar => bar.low));
  const last = bars[bars.length - 1].close;
  const pnl = direction === 'LONG' ? last - entryPrice : entryPrice - last;
  const mfe = direction === 'LONG' ? high - entryPrice : entryPrice - low;
  const mae = direction === 'LONG' ? entryPrice - low : high - entryPrice;
  return {
    exit_price: round2(last),
    pnl_pts: round2(pnl),
    verdict: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'SCRATCH',
    max_favorable_pts: round2(mfe),
    max_adverse_pts: round2(mae),
    high: round2(high),
    low: round2(low),
  };
}

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function buildRecommendation(record, direction, evaluationStatus) {
  if (evaluationStatus !== 'evaluated') {
    return {
      recommendation: 'no_trade',
      reason: evaluationStatus,
      human_gate_required: true,
    };
  }
  return {
    recommendation: direction === 'LONG' ? 'long' : 'short',
    reason: 'shadow_replay_of_direct_spx_spy_signal',
    evidence: [
      {
        type: 'kat_signal',
        analyst: record.analyst,
        message_id: record.message_id,
        ticker: record.ticker,
        bias: record.bias,
        levels: record.levels,
      },
    ],
    conflicts: [],
    human_gate_required: true,
  };
}

function evaluateRecord(record, bars, rootsUsed) {
  if (!record.spx_options_direct) return null;
  if (!['BULLISH', 'BEARISH'].includes(record.bias)) {
    return {
      replay_id: record.replay_id,
      message_id: record.message_id,
      ts: record.ts,
      analyst: record.analyst,
      ticker: record.ticker,
      status: 'skipped_neutral_bias',
      recommendation: buildRecommendation(record, null, 'skipped_neutral_bias'),
    };
  }

  const signalMs = new Date(record.ts).getTime();
  if (!Number.isFinite(signalMs)) return null;
  const entryBar = firstBarAtOrAfter(bars, signalMs);
  if (!entryBar) {
    return {
      replay_id: record.replay_id,
      message_id: record.message_id,
      ts: record.ts,
      analyst: record.analyst,
      ticker: record.ticker,
      status: 'missing_entry_bar',
      recommendation: buildRecommendation(record, null, 'missing_entry_bar'),
    };
  }

  const direction = record.bias === 'BULLISH' ? 'LONG' : 'SHORT';
  const entryMs = new Date(entryBar.timestamp).getTime();
  const outcomes = {};
  for (const horizon of HORIZONS) {
    const windowBars = barsBetween(bars, entryMs, entryMs + horizon.minutes * 60 * 1000);
    const move = summarizeMove(direction, entryBar.close, windowBars);
    if (move) outcomes[horizon.key] = move;
  }

  const eodBars = bars.filter(bar => new Date(bar.timestamp).getTime() >= entryMs);
  const eod = summarizeMove(direction, entryBar.close, eodBars);
  if (eod) outcomes.eod = eod;

  return {
    replay_id: record.replay_id,
    message_id: record.message_id,
    ts: record.ts,
    analyst: record.analyst,
    channel: record.channel,
    ticker: record.ticker,
    market_instrument: marketInstrumentForRecord(record),
    direction,
    bias: record.bias,
    levels: record.levels,
    signal_type: record.signal_type,
    has_image_evidence: !!(record.image_evidence && record.image_evidence.has_image),
    heatmap_candidate: !!(record.image_evidence && record.image_evidence.heatmap_candidate),
    status: Object.keys(outcomes).length ? 'evaluated' : 'missing_horizon_bars',
    market_data_roots_used: rootsUsed,
    entry: {
      timestamp: entryBar.timestamp,
      price: round2(entryBar.close),
    },
    outcomes,
    recommendation: buildRecommendation(record, direction, Object.keys(outcomes).length ? 'evaluated' : 'missing_horizon_bars'),
  };
}

function summarizeEvaluations(evaluations) {
  const summary = {
    generated_at: new Date().toISOString(),
    total: evaluations.length,
    evaluated: evaluations.filter(e => e.status === 'evaluated').length,
    skipped_or_missing: evaluations.filter(e => e.status !== 'evaluated').length,
    by_ticker: {},
    by_analyst: {},
    win_rate_5m: winRate(evaluations, '5m'),
    win_rate_15m: winRate(evaluations, '15m'),
    win_rate_30m: winRate(evaluations, '30m'),
    win_rate_60m: winRate(evaluations, '60m'),
    win_rate_eod: winRate(evaluations, 'eod'),
  };
  for (const evalRecord of evaluations) {
    const ticker = evalRecord.ticker || 'unknown';
    if (!summary.by_ticker[ticker]) summary.by_ticker[ticker] = { total: 0, evaluated: 0 };
    summary.by_ticker[ticker].total++;
    if (evalRecord.status === 'evaluated') summary.by_ticker[ticker].evaluated++;

    const analyst = evalRecord.analyst || 'unknown';
    if (!summary.by_analyst[analyst]) summary.by_analyst[analyst] = { total: 0, evaluated: 0, wins_30m: 0, losses_30m: 0 };
    summary.by_analyst[analyst].total++;
    if (evalRecord.status === 'evaluated') summary.by_analyst[analyst].evaluated++;
    if (evalRecord.outcomes && evalRecord.outcomes['30m']) {
      if (evalRecord.outcomes['30m'].verdict === 'WIN') summary.by_analyst[analyst].wins_30m++;
      if (evalRecord.outcomes['30m'].verdict === 'LOSS') summary.by_analyst[analyst].losses_30m++;
    }
  }
  return summary;
}

function winRate(evaluations, horizon) {
  const eligible = evaluations.filter(e => e.outcomes && e.outcomes[horizon]);
  if (!eligible.length) return { eligible: 0, wins: 0, losses: 0, scratches: 0, pct: null };
  const wins = eligible.filter(e => e.outcomes[horizon].verdict === 'WIN').length;
  const losses = eligible.filter(e => e.outcomes[horizon].verdict === 'LOSS').length;
  const scratches = eligible.filter(e => e.outcomes[horizon].verdict === 'SCRATCH').length;
  return {
    eligible: eligible.length,
    wins,
    losses,
    scratches,
    pct: round2((wins / eligible.length) * 100),
  };
}

function evaluateKatReplay(records, options) {
  const opts = options || {};
  const rootDir = opts.rootDir || path.join(__dirname, '..');
  const marketRoots = (opts.marketRoots || [
    path.join(rootDir, 'data', 'historical'),
    path.join(rootDir, 'data', 'backtest'),
  ]).filter(root => fs.existsSync(root));

  const barsCache = new Map();
  const evaluations = [];
  for (const record of records) {
    const instrument = marketInstrumentForRecord(record);
    if (!instrument) continue;
    const date = etDate(record.ts);
    if (!date) continue;
    const cacheKey = instrument + ':' + date;
    if (!barsCache.has(cacheKey)) {
      barsCache.set(cacheKey, loadBarsFromRoots(instrument, date, marketRoots));
    }
    const loaded = barsCache.get(cacheKey);
    if (!loaded.bars.length) {
      evaluations.push({
        replay_id: record.replay_id,
        message_id: record.message_id,
        ts: record.ts,
        analyst: record.analyst,
        ticker: record.ticker,
        market_instrument: instrument,
        status: 'missing_market_data',
        recommendation: buildRecommendation(record, null, 'missing_market_data'),
      });
      continue;
    }
    evaluations.push(evaluateRecord(record, loaded.bars, loaded.roots_used));
  }

  const filtered = evaluations.filter(Boolean);
  return {
    evaluations: filtered,
    summary: summarizeEvaluations(filtered),
  };
}

function writeKatEvaluation(result, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const evaluationsPath = path.join(outDir, 'kat-spx-spy-evaluations.jsonl');
  const summaryPath = path.join(outDir, 'kat-evaluation-summary.json');
  fs.writeFileSync(
    evaluationsPath,
    result.evaluations.map(record => JSON.stringify(record)).join('\n') + (result.evaluations.length ? '\n' : ''),
    'utf8'
  );
  fs.writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2), 'utf8');
  return { evaluationsPath, summaryPath };
}

module.exports = {
  evaluateKatReplay,
  writeKatEvaluation,
  _internal: {
    etDate,
    marketInstrumentForRecord,
    loadBarsFromRoots,
    evaluateRecord,
    summarizeEvaluations,
    firstBarAtOrAfter,
  },
};
