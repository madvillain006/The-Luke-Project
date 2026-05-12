'use strict';

const fs = require('fs');
const path = require('path');
const { deriveLevelsByDate } = require('../lib/backtest-data/saty-historical');

const ROOT = path.join(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'data', 'backtest', 'es-long-bracket', 'sessions');
const ORIGINAL_SCORES = path.join(ROOT, 'artifacts', 'research', 'mancini-fbd-hermes-input', 'candidate_rule_scores.json');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-fbd-saty-side-project');

const TICK = 0.25;
const CLOSE_ABOVE = 0.25;
const MIN_FLUSH_DEPTH = 0.25;
const MAX_RECLAIM_WAIT_BARS = 60;
const OUTCOME_BARS = 60;
const COST_POINTS = 0.5;

const LEVEL_KEYS = [
  'atr_minus_1',
  'ext_minus_4',
  'ext_minus_3',
  'ext_minus_2',
  'ext_minus_1',
  'put_trigger',
  'prev_close',
  'call_trigger',
  'ext_plus_1',
  'ext_plus_2',
  'ext_plus_3',
  'ext_plus_4',
  'atr_plus_1',
];

const PROTOCOLS = [
  'non_acceptance_protocol',
  'classic_acceptance_backtest_from_below',
  'classic_acceptance_second_attempt_reclaim',
  'ladder_first_reclaim',
  'simple_reclaim_unclassified',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTimestamp(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function loadSessions() {
  const sessions = [];
  if (!fs.existsSync(SESSIONS_DIR)) return sessions;
  for (const name of fs.readdirSync(SESSIONS_DIR).sort()) {
    if (!name.endsWith('.json') || name === 'example-session.json') continue;
    const filePath = path.join(SESSIONS_DIR, name);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.example || data.usable === false) continue;
    const bars = (data.bars?.es || [])
      .map((bar) => ({
        timestamp: bar.timestamp,
        time: parseTimestamp(bar.timestamp),
        open: asNumber(bar.open),
        high: asNumber(bar.high),
        low: asNumber(bar.low),
        close: asNumber(bar.close),
        volume: asNumber(bar.volume) || 0,
      }))
      .filter((bar) => (
        bar.time !== null
        && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)
      ))
      .sort((a, b) => a.time - b.time);
    if (!bars.length) continue;
    sessions.push({
      date: data.date || name.replace(/\.json$/, ''),
      source_file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      bars,
    });
  }
  return sessions;
}

function satyLevelsForDate(satyByDate, date) {
  const row = satyByDate[date];
  if (!row?.valid) return [];
  return LEVEL_KEYS
    .map((key) => ({ name: key, price: asNumber(row[key]) }))
    .filter((level) => level.price !== null)
    .sort((a, b) => a.price - b.price);
}

function priorTouchGroups(bars, endIndex, level) {
  let groups = 0;
  let touching = false;
  for (let i = 0; i < endIndex; i += 1) {
    const bar = bars[i];
    const isTouch = bar.low <= level + 1.0 && bar.high >= level - 1.0;
    if (isTouch && !touching) groups += 1;
    touching = isTouch;
  }
  return groups;
}

function consecutiveClosesAtOrAbove(bars, startIndex, threshold, maxBars = 16) {
  let count = 0;
  for (let i = startIndex; i < Math.min(bars.length, startIndex + maxBars); i += 1) {
    if (bars[i].close >= threshold) count += 1;
    else break;
  }
  return count;
}

function firstCloseAtOrAbove(bars, startIndex, threshold, maxBars) {
  for (let i = startIndex; i < Math.min(bars.length, startIndex + maxBars); i += 1) {
    if (bars[i].close >= threshold) return i;
  }
  return null;
}

function firstCloseBelow(bars, startIndex, threshold, maxBars) {
  for (let i = startIndex; i < Math.min(bars.length, startIndex + maxBars); i += 1) {
    if (bars[i].close < threshold) return i;
  }
  return null;
}

function firstRetestHold(bars, startIndex, level, maxBars) {
  for (let i = startIndex; i < Math.min(bars.length, startIndex + maxBars); i += 1) {
    if (bars[i].low <= level + 0.5) {
      return bars[i].close >= level ? i : null;
    }
  }
  return null;
}

function levelsBetween(levels, low, high) {
  return levels.filter((level) => level.price > low && level.price < high).length;
}

function nextLevelAbove(levels, entry) {
  return levels.find((level) => level.price > entry + TICK) || null;
}

function evaluateOutcome(bars, entryIndex, entryPrice, sweptLow, levels) {
  const horizon = bars.slice(entryIndex, Math.min(bars.length, entryIndex + OUTCOME_BARS + 1));
  if (!horizon.length) {
    return {
      mfe_60m: null,
      mae_60m: null,
      tp2_hit: false,
      tp3_hit: false,
      next_level_hit: false,
      stop_first: false,
      expectancy_points_slippage_0_5: null,
    };
  }
  const maxHigh = Math.max(...horizon.map((bar) => bar.high));
  const minLow = Math.min(...horizon.map((bar) => bar.low));
  const mfe = round4(maxHigh - entryPrice);
  const mae = round4(entryPrice - minLow);
  const risk = Math.max(entryPrice - (sweptLow - TICK), TICK);
  const stop = entryPrice - risk;
  const next = nextLevelAbove(levels, entryPrice);
  let tp2Hit = false;
  let tp3Hit = false;
  let nextHit = false;
  let stopFirst = false;
  let resolved = false;
  for (const bar of horizon) {
    const hitStop = bar.low <= stop;
    const hitTp2 = bar.high >= entryPrice + 2;
    const hitTp3 = bar.high >= entryPrice + 3;
    const hitNext = next ? bar.high >= next.price : false;
    if (hitTp2) tp2Hit = true;
    if (hitTp3) tp3Hit = true;
    if (hitNext) nextHit = true;
    if (!resolved && hitStop) {
      stopFirst = true;
      resolved = true;
    } else if (!resolved && (hitTp2 || hitTp3 || hitNext)) {
      resolved = true;
    }
  }
  const gross = stopFirst ? -risk : (tp3Hit ? 3 : tp2Hit ? 2 : Math.max(mfe, 0));
  return {
    mfe_60m: mfe,
    mae_60m: mae,
    risk_to_sweep: round4(risk),
    tp2_hit: tp2Hit,
    tp3_hit: tp3Hit,
    next_level_hit: nextHit,
    stop_first: stopFirst,
    expectancy_points_slippage_0_5: round4(gross - COST_POINTS),
  };
}

function classifyProtocols({ bars, flushIndex, reclaimIndex, sweptLow, level, levels }) {
  const protocols = [];
  const acceptanceCloses = consecutiveClosesAtOrAbove(bars, reclaimIndex, level);
  const thresholdIndex = firstCloseAtOrAbove(bars, reclaimIndex, level + 5, 11);
  const thresholdCloses = thresholdIndex === null
    ? 0
    : consecutiveClosesAtOrAbove(bars, thresholdIndex, level + 5, 6);
  const retestAfterThreshold = thresholdIndex === null
    ? null
    : firstRetestHold(bars, thresholdIndex + 1, level, 12);
  const retestAfterReclaim = firstRetestHold(bars, reclaimIndex + 1, level, 10);
  const firstFailureIndex = firstCloseBelow(bars, reclaimIndex + 1, level, 4);
  const secondReclaimIndex = firstFailureIndex === null
    ? null
    : firstCloseAtOrAbove(bars, firstFailureIndex + 1, level + CLOSE_ABOVE, 40);
  const multiLevelFlushCount = levelsBetween(levels, sweptLow, level);

  if (thresholdIndex !== null && thresholdCloses >= 1 && (retestAfterThreshold !== null || thresholdCloses >= 2)) {
    protocols.push({
      protocol: 'non_acceptance_protocol',
      signal_index: retestAfterThreshold ?? thresholdIndex,
      confirmation: 'close_at_or_above_L_plus_5_then_hold_or_retest',
    });
  }
  if ((level - sweptLow) >= 2 && retestAfterReclaim !== null) {
    protocols.push({
      protocol: 'classic_acceptance_backtest_from_below',
      signal_index: retestAfterReclaim,
      confirmation: 'flush_below_L_then_retest_of_L_holds',
    });
  }
  if (firstFailureIndex !== null && secondReclaimIndex !== null) {
    protocols.push({
      protocol: 'classic_acceptance_second_attempt_reclaim',
      signal_index: secondReclaimIndex,
      confirmation: 'first_reclaim_failed_then_second_reclaim_closed_above_L',
    });
  }
  if (multiLevelFlushCount >= 2 && acceptanceCloses >= 1) {
    protocols.push({
      protocol: 'ladder_first_reclaim',
      signal_index: reclaimIndex,
      confirmation: 'multi_saty_level_flush_then_first_reclaim',
    });
  }
  if (!protocols.length && acceptanceCloses >= 1) {
    protocols.push({
      protocol: 'simple_reclaim_unclassified',
      signal_index: reclaimIndex,
      confirmation: 'flush_then_first_reclaim_without_specific_family_match',
    });
  }
  return { protocols, acceptanceCloses, thresholdCloses, multiLevelFlushCount };
}

function findProtocolRows(session, levels) {
  const rows = [];
  const bars = session.bars;
  for (const levelInfo of levels) {
    const level = levelInfo.price;
    let cursor = 1;
    while (cursor < bars.length - OUTCOME_BARS - 1) {
      let flushIndex = null;
      let sweptLow = Infinity;
      for (let i = cursor; i < bars.length - OUTCOME_BARS - 1; i += 1) {
        if (Math.abs(bars[i].close - level) > 80) continue;
        if (bars[i].low <= level - MIN_FLUSH_DEPTH) {
          flushIndex = i;
          sweptLow = bars[i].low;
          break;
        }
      }
      if (flushIndex === null) break;
      let reclaimIndex = null;
      for (let i = flushIndex + 1; i < Math.min(bars.length - OUTCOME_BARS, flushIndex + MAX_RECLAIM_WAIT_BARS); i += 1) {
        sweptLow = Math.min(sweptLow, bars[i].low);
        if (bars[i].close >= level + CLOSE_ABOVE) {
          reclaimIndex = i;
          break;
        }
      }
      if (reclaimIndex === null) {
        cursor = flushIndex + 1;
        continue;
      }
      const context = classifyProtocols({ bars, flushIndex, reclaimIndex, sweptLow, level, levels });
      const priorTaps = priorTouchGroups(bars, flushIndex, level);
      for (const item of context.protocols) {
        const signalIndex = item.signal_index;
        const entryPrice = bars[signalIndex].close;
        const outcome = evaluateOutcome(bars, signalIndex, entryPrice, sweptLow, levels);
        rows.push({
          protocol: item.protocol,
          date: session.date,
          level_name: levelInfo.name,
          level: round2(level),
          flush_timestamp: bars[flushIndex].timestamp,
          reclaim_timestamp: bars[reclaimIndex].timestamp,
          signal_timestamp: bars[signalIndex].timestamp,
          entry_price: round2(entryPrice),
          swept_low: round2(sweptLow),
          flush_depth: round4(level - sweptLow),
          prior_touch_groups: priorTaps,
          acceptance_closes_above_L: context.acceptanceCloses,
          non_acceptance_closes: context.thresholdCloses,
          multi_level_flush_count: context.multiLevelFlushCount,
          confirmation: item.confirmation,
          source_confidence_score: 0,
          source_classification: 'saty_only_no_mancini_source_setup',
          ...outcome,
        });
      }
      cursor = reclaimIndex + 20;
    }
  }
  return rows;
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return round4(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function hitRate(rows, field) {
  if (!rows.length) return null;
  return round4(rows.filter((row) => Boolean(row[field])).length / rows.length);
}

function summarize(rows) {
  return {
    rows: rows.length,
    unique_setups: new Set(rows.map((row) => `${row.date}|${row.protocol}|${row.level_name}|${row.flush_timestamp}`)).size,
    tp_plus_2_hit_rate: hitRate(rows, 'tp2_hit'),
    tp_plus_3_hit_rate: hitRate(rows, 'tp3_hit'),
    next_level_hit_rate: hitRate(rows, 'next_level_hit'),
    stop_first_rate: hitRate(rows, 'stop_first'),
    avg_mfe_60m: average(rows.map((row) => row.mfe_60m)),
    avg_mae_60m: average(rows.map((row) => row.mae_60m)),
    expectancy_points_with_0_5_es_point_slippage: average(rows.map((row) => row.expectancy_points_slippage_0_5)),
  };
}

function groupSummary(rows, field) {
  const out = {};
  for (const row of rows) {
    const key = row[field] || 'missing';
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return Object.fromEntries(Object.entries(out).sort().map(([key, value]) => [key, summarize(value)]));
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const columns = [
    'protocol',
    'date',
    'level_name',
    'level',
    'flush_timestamp',
    'reclaim_timestamp',
    'signal_timestamp',
    'entry_price',
    'swept_low',
    'flush_depth',
    'prior_touch_groups',
    'acceptance_closes_above_L',
    'non_acceptance_closes',
    'multi_level_flush_count',
    'confirmation',
    'source_classification',
    'mfe_60m',
    'mae_60m',
    'risk_to_sweep',
    'tp2_hit',
    'tp3_hit',
    'next_level_hit',
    'stop_first',
    'expectancy_points_slippage_0_5',
  ];
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function markdownReport(summary) {
  const lines = [
    '# Mancini FBD SATY Side-Project Protocol Comparison',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'Scope: research/historical/shadow only. SATY-generated rows are negative/control comparisons unless a separate Mancini source setup exists.',
    '',
    '## Coverage',
    '',
    `- Sessions loaded: ${summary.coverage.sessions_loaded}`,
    `- Valid SATY sessions: ${summary.coverage.valid_saty_sessions}`,
    `- SATY protocol rows: ${summary.coverage.saty_protocol_rows}`,
    '',
    '## SATY By Protocol',
    '',
  ];
  for (const protocol of PROTOCOLS) {
    const item = summary.saty.per_protocol[protocol] || summarize([]);
    lines.push(`- \`${protocol}\`: rows=${item.rows}, unique=${item.unique_setups}, tp2=${item.tp_plus_2_hit_rate}, stop_first=${item.stop_first_rate}, expectancy=${item.expectancy_points_with_0_5_es_point_slippage}`);
  }
  lines.push('', '## Original Package By Protocol', '');
  for (const protocol of PROTOCOLS) {
    const item = summary.original.per_family_results[protocol] || summarize([]);
    lines.push(`- \`${protocol}\`: rows=${item.rows}, unique=${item.unique_setups}, tp2=${item.tp_plus_2_hit_rate}, stop_first=${item.stop_first_rate}, expectancy=${item.expectancy_points_with_0_5_es_point_slippage}`);
  }
  lines.push('', '## Safety', '');
  lines.push('- No Pine, NinjaTrader, broker, account, credential, risk, order, or live-execution path is touched.');
  lines.push('- SATY-only rows are classified as `saty_only_no_mancini_source_setup`.');
  lines.push('- MFE/MAE, hit rates, stop-first, and future target hits are validation labels only.');
  return `${lines.join('\n')}\n`;
}

function main() {
  ensureDir(OUT_DIR);
  const sessions = loadSessions();
  const intradayBars = sessions.flatMap((session) => session.bars.map((bar) => ({
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  })));
  const targetDates = sessions.map((session) => session.date);
  const satyByDate = deriveLevelsByDate(intradayBars, targetDates);
  const rows = sessions.flatMap((session) => findProtocolRows(session, satyLevelsForDate(satyByDate, session.date)));
  const original = JSON.parse(fs.readFileSync(ORIGINAL_SCORES, 'utf8'));
  const summary = {
    generated_at: new Date().toISOString(),
    scope: 'research_historical_replay_shadow_only',
    inputs: {
      sessions_dir: path.relative(ROOT, SESSIONS_DIR).replace(/\\/g, '/'),
      original_scores: path.relative(ROOT, ORIGINAL_SCORES).replace(/\\/g, '/'),
      saty_formula_module: 'lib/backtest-data/saty-historical.js',
    },
    outputs: {
      summary_json: 'artifacts/research/mancini-fbd-saty-side-project/protocol_comparison.json',
      rows_csv: 'artifacts/research/mancini-fbd-saty-side-project/saty_protocol_rows.csv',
      report_md: 'artifacts/research/mancini-fbd-saty-side-project/protocol_comparison.md',
    },
    coverage: {
      sessions_loaded: sessions.length,
      valid_saty_sessions: Object.values(satyByDate).filter((row) => row?.valid).length,
      invalid_saty_sessions: Object.values(satyByDate).filter((row) => !row?.valid).length,
      saty_protocol_rows: rows.length,
    },
    protocol_definitions: {
      non_acceptance_protocol: 'SATY level flush, reclaim, close at/above L+5 within 10 bars, then held threshold or first retest of L held.',
      classic_acceptance_backtest_from_below: 'Flush at least 2 points below L, reclaim L, then first retest/backtest of L closes at/above L.',
      classic_acceptance_second_attempt_reclaim: 'First reclaim closes above L, fails back below L within 3 bars, then second reclaim closes above L within 40 bars.',
      ladder_first_reclaim: 'Flush crosses at least two generated SATY levels, then first reclaim of the tested level closes above L.',
      simple_reclaim_unclassified: 'Flush below L and first reclaim above L when no more specific family matched.',
    },
    original: {
      input_counts: original.input_counts,
      per_family_results: original.per_family_results,
      candidate_rules: original.candidate_rules,
      negative_controls: original.negative_controls,
      safety: original.safety,
    },
    saty: {
      overall: summarize(rows),
      per_protocol: groupSummary(rows, 'protocol'),
      per_level_name: groupSummary(rows, 'level_name'),
      negative_control_classification: 'saty_only_no_mancini_source_setup',
    },
    safety: {
      live_trading_behavior_introduced: false,
      broker_risk_live_pine_credential_execution_touched: false,
      ninja_code_written: false,
      saty_only_rows_promoted_to_positive: false,
      mfe_mae_used_as_candidate_inputs: false,
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'protocol_comparison.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'protocol_comparison.md'), markdownReport(summary), 'utf8');
  writeCsv(path.join(OUT_DIR, 'saty_protocol_rows.csv'), rows);
  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR).replace(/\\/g, '/'),
    saty_protocol_rows: rows.length,
    valid_saty_sessions: summary.coverage.valid_saty_sessions,
    saty_per_protocol: summary.saty.per_protocol,
  }, null, 2));
}

main();
