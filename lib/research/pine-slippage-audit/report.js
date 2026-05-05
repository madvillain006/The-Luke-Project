'use strict';

const path = require('path');
const {
  ROOT,
  RESEARCH_ARTIFACT_DIR,
  writeJson,
  writeCsv,
} = require('../common');
const { loadHistoricalAuditInputs } = require('./signal-loader');
const {
  evaluateSlippageModes,
  evaluateSameBarPolicies,
  slippageSensitivity,
  breakEvenSlippage,
} = require('./evaluator');
const { buildFamilyComparison } = require('./family-comparison');
const { ACCOUNT_RULES } = require('./evaluator');

const AUDIT_DIR = path.join(RESEARCH_ARTIFACT_DIR, 'pine-slippage-audit');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function modeRows(modes) {
  return (modes || []).map(mode => ({
    mode: mode.mode,
    same_bar_policy: mode.same_bar_policy,
    total_signals: mode.one_es.total_signals,
    filled_signals: mode.one_es.filled_signals,
    tp1_hit: mode.one_es.tp1_hit,
    stop_hit: mode.one_es.stop_hit,
    stop_first: mode.one_es.stop_first,
    target_first: mode.one_es.target_first,
    ambiguous_same_bar_count: mode.one_es.ambiguous_same_bar_count,
    wins_converted_to_losses: mode.one_es.wins_converted_to_losses,
    one_es_expectancy: mode.one_es.expectancy,
    one_es_total_pnl: mode.one_es.total_pnl,
    one_es_max_drawdown: mode.one_es.max_drawdown,
    one_es_positive_day_rate: mode.one_es.positive_day_rate,
    one_es_account_fail: mode.one_es.account_fail,
    one_es_net_profitable: mode.one_es.net_profitable,
    one_es_account_viable_net_profitable: mode.one_es.account_viable_net_profitable,
    two_es_expectancy: mode.two_es.expectancy,
    two_es_total_pnl: mode.two_es.total_pnl,
    two_es_max_drawdown: mode.two_es.max_drawdown,
    two_es_positive_day_rate: mode.two_es.positive_day_rate,
    two_es_account_fail: mode.two_es.account_fail,
    two_es_net_profitable: mode.two_es.net_profitable,
    two_es_account_viable_net_profitable: mode.two_es.account_viable_net_profitable,
    one_es_50k_total_pnl: mode.one_es_50k.total_pnl,
    one_es_50k_max_drawdown: mode.one_es_50k.max_drawdown,
    one_es_50k_account_fail: mode.one_es_50k.account_fail,
    one_es_50k_net_profitable: mode.one_es_50k.net_profitable,
    one_es_50k_account_viable_net_profitable: mode.one_es_50k.account_viable_net_profitable,
    two_es_50k_total_pnl: mode.two_es_50k.total_pnl,
    two_es_50k_max_drawdown: mode.two_es_50k.max_drawdown,
    two_es_50k_account_fail: mode.two_es_50k.account_fail,
    two_es_50k_net_profitable: mode.two_es_50k.net_profitable,
    two_es_50k_account_viable_net_profitable: mode.two_es_50k.account_viable_net_profitable,
  }));
}

function familyRows(families) {
  return (families || []).map(family => ({
    family: family.family,
    comparison_basis: family.comparison_basis,
    sample_size: family.sample_size,
    no_slippage_expectancy: family.no_slippage_expectancy,
    no_slippage_result: family.no_slippage_result,
    round_trip_0_50_expectancy: family.round_trip_0_50_expectancy,
    round_trip_0_50_result: family.round_trip_0_50_result,
    round_trip_1_00_expectancy: family.round_trip_1_00_expectancy,
    round_trip_1_00_result: family.round_trip_1_00_result,
    same_bar_stop_first_result: family.same_bar_stop_first_result,
    one_es_account_result: family.one_es_account_result,
    two_es_account_result: family.two_es_account_result,
    one_es_50k_account_result: family.one_es_50k_account_result,
    two_es_50k_account_result: family.two_es_50k_account_result,
    max_drawdown: family.max_drawdown,
    positive_day_rate: family.positive_day_rate,
    top_day_dependency: family.top_day_dependency,
    account_fail: family.account_fail,
    account_viable_net_profitable: family.account_viable_net_profitable,
    one_es_50k_account_fail: family.one_es_50k_account_fail,
    two_es_50k_account_fail: family.two_es_50k_account_fail,
    confidence: family.confidence,
  }));
}

function comparePineVsLuke(pineSignals, ladderRows) {
  const lukeRows = (ladderRows || [])
    .filter(row => row.classification === 'TRADEABLE_RESEARCH')
    .filter(row => row.target_model === 'fixed_plus_2')
    .filter(row => Number.isFinite(row.first_reclaimed_level))
    .filter(row => Number.isFinite(row.entry_price));
  const rows = [];
  const counts = {
    MATCH: 0,
    PINE_EARLY: 0,
    PINE_LATE: 0,
    LEVEL_MISMATCH: 0,
    STOP_TARGET_MISMATCH: 0,
    SOURCE_MISMATCH: 0,
    NOT_COMPARABLE: 0,
  };

  for (const signal of pineSignals || []) {
    const sameDay = lukeRows.filter(row => row.date === signal.date);
    const nearest = sameDay
      .map(row => ({
        row,
        levelDelta: Math.abs(Number(row.first_reclaimed_level) - Number(signal.level)),
        timeDeltaMinutes: Math.round(((new Date(signal.entry_timestamp_et).getTime()) - (new Date(row.entry_timestamp_et).getTime())) / 60000),
      }))
      .filter(item => Number.isFinite(item.levelDelta) && Number.isFinite(item.timeDeltaMinutes))
      .sort((a, b) => {
        const level = a.levelDelta - b.levelDelta;
        if (Math.abs(level) > 0.01) return level;
        return Math.abs(a.timeDeltaMinutes) - Math.abs(b.timeDeltaMinutes);
      })[0] || null;

    let classification = 'NOT_COMPARABLE';
    if (!nearest) {
      classification = 'NOT_COMPARABLE';
    } else if (nearest.levelDelta > 1.25) {
      classification = 'LEVEL_MISMATCH';
    } else if (Math.abs((nearest.row.tp1 || 0) - signal.raw_tp1) > 1.0 || Math.abs((nearest.row.stop_price || 0) - signal.raw_stop) > 1.5) {
      classification = 'STOP_TARGET_MISMATCH';
    } else if (nearest.timeDeltaMinutes < -1) {
      classification = 'PINE_EARLY';
    } else if (nearest.timeDeltaMinutes > 1) {
      classification = 'PINE_LATE';
    } else if (
      nearest.row.source_combo
      && signal.source_combo
      && String(nearest.row.source_combo) !== String(signal.source_combo)
    ) {
      classification = 'SOURCE_MISMATCH';
    } else {
      classification = 'MATCH';
    }
    counts[classification] += 1;
    rows.push({
      pine_signal_id: signal.id,
      pine_signal_timestamp: signal.signal_timestamp_et,
      pine_entry_timestamp: signal.entry_timestamp_et,
      pine_level: signal.level,
      pine_source_combo: signal.source_combo,
      pine_entry: signal.raw_entry,
      pine_stop: signal.raw_stop,
      pine_tp1: signal.raw_tp1,
      luke_setup_id: nearest?.row.setup_id || null,
      luke_entry_timestamp: nearest?.row.entry_timestamp_et || null,
      luke_level: nearest?.row.first_reclaimed_level || null,
      luke_source_combo: nearest?.row.source_combo || null,
      luke_entry: nearest?.row.entry_price || null,
      luke_stop: nearest?.row.stop_price || null,
      luke_tp1: nearest?.row.tp1 || null,
      time_delta_minutes: nearest?.timeDeltaMinutes ?? null,
      level_delta: nearest?.levelDelta ?? null,
      classification,
    });
  }

  const matchedOrPartial = counts.MATCH + counts.PINE_EARLY + counts.PINE_LATE + counts.STOP_TARGET_MISMATCH;
  return {
    summary: {
      total_pine_signals: (pineSignals || []).length,
      comparable_signals: matchedOrPartial,
      classification_counts: counts,
      verdict: counts.MATCH > 0 ? 'partial' : (matchedOrPartial > 0 ? 'partial' : 'not available'),
      warning: counts.PINE_EARLY > 0
        ? 'Some reconstructed Pine hard-mode entries occur earlier than the selected Luke ladder rows.'
        : 'No Pine-early cases found in comparable rows.',
    },
    rows: rows.slice(0, 500),
  };
}

function statusFromResults(slippageModes, sameBarModes, familyComparison) {
  const rt050 = slippageModes.find(mode => mode.mode === 'round_trip_0_50');
  const rt100 = slippageModes.find(mode => mode.mode === 'round_trip_1_00');
  const stopFirst = sameBarModes.find(mode => mode.same_bar_policy === 'stop_first_hard');
  const best = familyComparison.best_family;
  if (!rt050 || !rt100 || !stopFirst) return 'BLOCKED_BY_ENVIRONMENT';
  if (rt050.one_es.total_pnl > 0 && rt100.one_es.total_pnl > 0 && stopFirst.one_es.total_pnl > 0) {
    return 'EDGE_SURVIVES_HARD_MODE';
  }
  if (best && best.round_trip_0_50_result > 0 && best.account_fail !== true) {
    return 'EDGE_PARTIALLY_SURVIVES';
  }
  return 'EDGE_FAILS_HARD_MODE';
}

function examplesFromTrades(trades) {
  const sorted = (trades || []).slice().sort((a, b) => a.pnl_dollars - b.pnl_dollars);
  return {
    failed: sorted.slice(0, 25),
    passed: sorted.slice(-25).reverse(),
  };
}

function renderDoc(result) {
  const rt050 = result.slippage_modes.find(mode => mode.mode === 'round_trip_0_50');
  const rt100 = result.slippage_modes.find(mode => mode.mode === 'round_trip_1_00');
  const stopFirst = result.same_bar_modes.find(mode => mode.same_bar_policy === 'stop_first_hard');
  const optimistic = result.same_bar_modes.find(mode => mode.same_bar_policy === 'target_first_optimistic');
  const lines = [
    '# Pine Slippage Historical Audit',
    '',
    `Generated: ${result.generated_at}`,
    '',
    '## Comparison Type',
    '',
    `- ${result.comparison_type}.`,
    `- ${result.comparison_note}`,
    '',
    '## What Was Tested',
    '',
    '- Pine hard-mode LUKE PAPER_CANDIDATE behavior was reconstructed against Luke replay ladder-reclaim data.',
    '- Default hard mode uses confirmed-bar signal timing, next-bar-open entry, stop-first same-bar policy, and explicit adverse slippage.',
    '- Account profit targets and funded payout targets are cumulative milestones, not one-day requirements and not edge filters.',
    '- Net-profitable account survival means cumulative PnL is positive and the relevant drawdown/DLL constraints did not fail.',
    '- No live trading behavior or execution path was changed.',
    '',
    '## Account Rule Interpretation',
    '',
    `- 25K eval: target ${ACCOUNT_RULES['25k_eval'].profitTarget}, max loss ${ACCOUNT_RULES['25k_eval'].maxDrawdown}, DLL none, EOD drawdown.`,
    `- 50K eval: target ${ACCOUNT_RULES['50k_eval'].profitTarget}, max loss ${ACCOUNT_RULES['50k_eval'].maxDrawdown}, DLL ${ACCOUNT_RULES['50k_eval'].dailyLossLimit}, EOD drawdown.`,
    `- 25K funded: payout milestone ${ACCOUNT_RULES['25k_funded'].payoutTarget}, max loss ${ACCOUNT_RULES['25k_funded'].maxDrawdown}, DLL none, consistency ${ACCOUNT_RULES['25k_funded'].consistencyLimit * 100}%.`,
    `- 50K funded: payout milestone ${ACCOUNT_RULES['50k_funded'].payoutTarget}, max loss ${ACCOUNT_RULES['50k_funded'].maxDrawdown}, DLL ${ACCOUNT_RULES['50k_funded'].dailyLossLimit}, consistency ${ACCOUNT_RULES['50k_funded'].consistencyLimit * 100}%.`,
    '',
    '## Slippage Results',
    '',
    `- 0.50 round-trip 1ES: expectancy ${rt050?.one_es.expectancy ?? 'n/a'}, total ${rt050?.one_es.total_pnl ?? 'n/a'}, max DD ${rt050?.one_es.max_drawdown ?? 'n/a'}.`,
    `- 1.00 round-trip 1ES stress: expectancy ${rt100?.one_es.expectancy ?? 'n/a'}, total ${rt100?.one_es.total_pnl ?? 'n/a'}, max DD ${rt100?.one_es.max_drawdown ?? 'n/a'}.`,
    `- Break-even slippage: ${result.break_even_slippage}.`,
    '',
    '## Same-Bar Ambiguity',
    '',
    `- Ambiguous trades under stop-first: ${stopFirst?.one_es.ambiguous_same_bar_count ?? 'n/a'}.`,
    `- Optimistic total: ${optimistic?.one_es.total_pnl ?? 'n/a'}.`,
    `- Stop-first total: ${stopFirst?.one_es.total_pnl ?? 'n/a'}.`,
    `- Wins converted to losses: ${stopFirst?.one_es.wins_converted_to_losses ?? 'n/a'}.`,
    '',
    '## Signal Families',
    '',
    ...result.family_comparison.families.map(family => `- ${family.family}: sample ${family.sample_size}, 25K 1ES ${family.one_es_account_result ?? 'n/a'}, 50K 1ES ${family.one_es_50k_account_result ?? 'n/a'}, 50K 2ES ${family.two_es_50k_account_result ?? 'n/a'}, 0.50 RT expectancy ${family.round_trip_0_50_expectancy}, max DD ${family.max_drawdown}, confidence ${family.confidence}.`),
    '',
    `- Best 25K net-profitable survivor: ${result.family_comparison.best_family?.family ?? 'none'}.`,
    `- Best 50K net-profitable survivor: ${result.family_comparison.best_family_50k?.family ?? 'none'}.`,
    '',
    '## Pine Vs Luke Parity',
    '',
    `- Verdict: ${result.pine_vs_luke.summary.verdict}.`,
    `- Counts: ${JSON.stringify(result.pine_vs_luke.summary.classification_counts)}.`,
    '',
    '## Conclusion',
    '',
    result.conclusion,
    '',
    '## What Remains Unproven',
    '',
    '- TradingView compilation of the hard-mode strategy is still external to this audit.',
    '- 1m OHLC cannot prove intrabar order sequence or queue fill priority.',
    '- Saty display parity still needs human TradingView review.',
    '- Direct Pine signal export was not available, so this is a Luke-equivalent reconstruction.',
    '- Heatmap/GEX and Mancini timestamp quality remain source-data risks.',
    '',
    '## Commands To Rerun',
    '',
    '```powershell',
    'npm run research:pine-slippage-audit',
    'npm test',
    'npm run tradingview:export-levels',
    'npm run research:ladder-reclaim',
    'npm run research:ladder-reclaim-review',
    '```',
    '',
  ];
  return lines.join('\n');
}

async function runPineSlippageAudit(options = {}) {
  const inputs = await loadHistoricalAuditInputs(options);
  const context = { barsByDate: inputs.barsByDate };
  const slippageModes = evaluateSlippageModes(inputs.pine_signals, context, { sameBarPolicy: 'stop_first_hard' });
  const sameBarModes = evaluateSameBarPolicies(inputs.pine_signals, context, { slippageMode: 'round_trip_0_50' });
  const sensitivity = slippageSensitivity(inputs.pine_signals, context);
  const breakEven = breakEvenSlippage(sensitivity);
  const familyComparison = buildFamilyComparison(inputs);
  const pineVsLuke = comparePineVsLuke(inputs.pine_signals, inputs.ladder_rows);
  const rt050 = slippageModes.find(mode => mode.mode === 'round_trip_0_50');
  const examples = examplesFromTrades(rt050?.one_es_trades || []);
  const auditResult = statusFromResults(slippageModes, sameBarModes, familyComparison);
  const conclusion = auditResult === 'EDGE_SURVIVES_HARD_MODE'
    ? 'The reconstructed Pine-style edge survives the tested hard-mode assumptions, but remains research-only because fills and TradingView compilation are not proven here.'
    : auditResult === 'EDGE_PARTIALLY_SURVIVES'
      ? 'The broad Pine-style reconstruction does not cleanly pass every hard-mode stress, but at least one related Luke family remains positive after 0.50 round-trip slippage without account failure. Treat this as WATCHLIST_ONLY, not promotion.'
      : 'The hard-mode assumptions remove the apparent edge in this historical reconstruction. Treat the setup as NOT_READY until the failure modes are isolated.';

  const result = {
    generated_at: new Date().toISOString(),
    audit_result: auditResult,
    readiness: auditResult === 'EDGE_SURVIVES_HARD_MODE' ? 'PAPER_ONLY' : auditResult === 'EDGE_PARTIALLY_SURVIVES' ? 'WATCHLIST_ONLY' : 'NOT_READY',
    comparison_type: inputs.comparison_type,
    comparison_note: inputs.comparison_note,
    pine_config: inputs.pineConfig,
    data: {
      sessions: inputs.sessions.length,
      excluded_sessions: inputs.excluded_sessions,
      es_1m_bars: inputs.es_1m_bars,
      spx_1m_bars: inputs.spx_1m_bars,
      source_timeline_events: inputs.source_timeline_events,
      source_timeline_usable_events: inputs.source_timeline_usable_events,
      pine_style_signals: inputs.pine_signals.length,
      ladder_rows: inputs.ladder_rows.length,
    },
    account_rules: ACCOUNT_RULES,
    slippage_modes: slippageModes,
    same_bar_modes: sameBarModes,
    sensitivity,
    break_even_slippage: breakEven,
    family_comparison: familyComparison,
    pine_vs_luke: pineVsLuke,
    failed_examples: examples.failed,
    passed_examples: examples.passed,
    conclusion,
  };

  if (options.writeArtifacts !== false) {
    writeJson(path.join(AUDIT_DIR, 'slippage-summary.json'), result);
    writeCsv(path.join(AUDIT_DIR, 'slippage-summary.csv'), modeRows(slippageModes), [
      'mode', 'same_bar_policy', 'total_signals', 'filled_signals', 'tp1_hit', 'stop_hit',
      'stop_first', 'target_first', 'ambiguous_same_bar_count', 'wins_converted_to_losses',
      'one_es_expectancy', 'one_es_total_pnl', 'one_es_max_drawdown', 'one_es_positive_day_rate',
      'one_es_account_fail', 'one_es_net_profitable', 'one_es_account_viable_net_profitable',
      'two_es_expectancy', 'two_es_total_pnl', 'two_es_max_drawdown',
      'two_es_positive_day_rate', 'two_es_account_fail', 'two_es_net_profitable',
      'two_es_account_viable_net_profitable', 'one_es_50k_total_pnl', 'one_es_50k_max_drawdown',
      'one_es_50k_account_fail', 'one_es_50k_net_profitable', 'one_es_50k_account_viable_net_profitable',
      'two_es_50k_total_pnl', 'two_es_50k_max_drawdown', 'two_es_50k_account_fail',
      'two_es_50k_net_profitable', 'two_es_50k_account_viable_net_profitable',
    ]);
    writeJson(path.join(AUDIT_DIR, 'same-bar-ambiguity.json'), { modes: sameBarModes });
    writeJson(path.join(AUDIT_DIR, 'slippage-sensitivity.json'), { break_even_slippage: breakEven, rows: sensitivity });
    writeJson(path.join(AUDIT_DIR, 'mode-comparison.json'), { slippage_modes: slippageModes, same_bar_modes: sameBarModes });
    writeJson(path.join(AUDIT_DIR, 'family-comparison.json'), familyComparison);
    writeCsv(path.join(AUDIT_DIR, 'family-comparison.csv'), familyRows(familyComparison.families), [
      'family', 'comparison_basis', 'sample_size', 'no_slippage_expectancy', 'no_slippage_result',
      'round_trip_0_50_expectancy', 'round_trip_0_50_result', 'round_trip_1_00_expectancy',
      'round_trip_1_00_result', 'same_bar_stop_first_result', 'one_es_account_result',
      'two_es_account_result', 'one_es_50k_account_result', 'two_es_50k_account_result',
      'max_drawdown', 'positive_day_rate', 'top_day_dependency', 'account_fail',
      'account_viable_net_profitable', 'one_es_50k_account_fail', 'two_es_50k_account_fail',
      'confidence',
    ]);
    writeJson(path.join(AUDIT_DIR, 'pine-vs-luke-parity.json'), pineVsLuke);
    writeJson(path.join(AUDIT_DIR, 'failed-hardmode-examples.json'), examples.failed);
    writeJson(path.join(AUDIT_DIR, 'passed-hardmode-examples.json'), examples.passed);
    writeJson(path.join(AUDIT_DIR, 'audit-run-summary.json'), {
      audit_result: auditResult,
      readiness: result.readiness,
      comparison_type: result.comparison_type,
      break_even_slippage: breakEven,
      best_family: familyComparison.best_family,
      artifacts_dir: AUDIT_DIR,
    });
    const doc = renderDoc(result);
    const fs = require('fs');
    fs.writeFileSync(path.join(AUDIT_DIR, 'PINE_SLIPPAGE_HISTORICAL_AUDIT.md'), doc, 'utf8');
  }

  return result;
}

module.exports = {
  AUDIT_DIR,
  comparePineVsLuke,
  modeRows,
  familyRows,
  renderDoc,
  runPineSlippageAudit,
};
