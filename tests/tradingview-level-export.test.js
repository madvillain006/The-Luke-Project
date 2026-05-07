'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildTradingViewLevelExport,
  buildPineInputText,
  renderGeneratedPine,
  writeTradingViewArtifacts,
} = require('../lib/tradingview/level-export');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function makeExportRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-export-'));
  fs.mkdirSync(path.join(root, 'data', 'research', 'mancini'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'research', 'mancini', 'The Mancini Logs 3-15-2026 - 5-3-2026.txt'), [
    'The Mancini Logs 3-15-2026 - 5-4-2026',
    'Adam Mancini',
    '@AdamMancini4',
    'Â·',
    '2h',
    'Plan: 7248 reclaim sees 53, 64, 85. 7237 fails, dip 7212. 7213, 7199 below.',
  ].join('\n'), 'utf8');

  writeJson(path.join(root, 'data', 'saty-levels.json'), {
    valid: true,
    instrument: 'SPX',
    updated: '2026-05-04T13:47:23.783Z',
    prev_close: 7227.73,
    call_trigger: 7245.01,
    put_trigger: 7210.45,
    ext_plus_1: 7255.7,
    ext_plus_2: 7264.35,
    ext_plus_3: 7272.99,
    ext_plus_4: 7285.29,
    atr_plus_1: 7300.96,
    ext_minus_1: 7199.76,
    ext_minus_2: 7191.11,
    ext_minus_3: 7182.47,
    ext_minus_4: 7170.17,
    atr_minus_1: 7154.5,
  });

  writeJson(path.join(root, 'data', 'dubz-levels.json'), {
    date: '2026-05-03',
    last_updated: '2026-05-04T13:00:00.000Z',
    instruments: {
      ES: { levels: [{ price: 7245, direction: 'support', significance: 'key', source: 'text' }] },
      NQ: { levels: [] },
      SPY: { levels: [] },
      QQQ: { levels: [] },
    },
  });

  fs.mkdirSync(path.join(root, 'state', 'events'), { recursive: true });
  fs.writeFileSync(path.join(root, 'state', 'events', 'bobby-context.jsonl'), JSON.stringify({
    source: 'bobby-text',
    source_id: 'fresh-bobby',
    date: '2026-05-04T14:30:00.000Z',
    king_nodes: [7125],
  }), 'utf8');

  return root;
}

describe('TradingView level export workflow', () => {
  it('builds normalized export data and writes TradingView artifacts', () => {
    const root = makeExportRoot();
    const exportData = buildTradingViewLevelExport({
      rootDir: root,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    const artifactDir = path.join(root, 'artifacts', 'tradingview');
    const summary = writeTradingViewArtifacts({
      exportData,
      rootDir: root,
      artifactDir,
      basePinePath: path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch.pine'),
    });

    expect(exportData.source_files.mancini_misnamed).toBe(true);
    expect(exportData.source_summary.mancini).toBeGreaterThanOrEqual(7);
    expect(exportData.pine_inputs.mancini).toContain('7248');
    expect(fs.existsSync(summary.artifacts.json)).toBe(true);
    expect(fs.existsSync(summary.artifacts.csv)).toBe(true);
    expect(fs.existsSync(summary.artifacts.pine_input)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_pine)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_realistic_indicator)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_production_test_indicator)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_readable_ledger_v5_indicator)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_simulation_strategy)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_hardmode_strategy)).toBe(true);
    expect(fs.existsSync(summary.artifacts.pine_files_summary)).toBe(true);
    expect(fs.existsSync(summary.artifacts.slippage_modes_summary)).toBe(true);
    expect(fs.existsSync(summary.artifacts.pine_hardmode_audit)).toBe(true);

    const generated = fs.readFileSync(summary.artifacts.generated_pine, 'utf8');
    expect(generated).toContain('indicator("Luke Level Reclaim Watch"');
    expect(generated).toContain('alertcondition(');
    expect(generated).not.toContain('alert(');
    expect(generated).not.toContain('strategy(');
    expect(generated).not.toMatch(/strategy\.|submitOrder|placeOrder|broker/i);
    expect(generated).not.toMatch(/\bBUY\b|\bSELL\b/);

    const generatedRealistic = fs.readFileSync(summary.artifacts.generated_realistic_indicator, 'utf8');
    expect(generatedRealistic).toContain('indicator("Luke Level Reclaim Watch - Realistic Accounting"');
    expect(generatedRealistic).toContain('realistic_accounting_mode = input.string("entry_only_0_25"');
    expect(generatedRealistic).toContain('commission_only');
    expect(generatedRealistic).toContain('both_sides_0_25_each');
    expect(generatedRealistic).toContain('7248');
    expect(generatedRealistic).not.toContain('strategy(');
    expect(generatedRealistic).not.toMatch(/strategy\.|submitOrder|placeOrder|broker/i);
    expect(generatedRealistic).not.toMatch(/\bBUY\b|\bSELL\b/);

    const generatedProductionTest = fs.readFileSync(summary.artifacts.generated_production_test_indicator, 'utf8');
    expect(generatedProductionTest).toContain('indicator("Luke Watch Production Test - Realistic Accounting"');
    expect(generatedProductionTest).toContain('realistic_accounting_mode = input.string("entry_only_0_25"');
    expect(generatedProductionTest).toContain('LONG #');
    expect(generatedProductionTest).toContain('Result: TP1');
    expect(generatedProductionTest).not.toContain('strategy(');
    expect(generatedProductionTest).not.toMatch(/submitOrder|placeOrder|webhook|LIVE_READY|EXECUTE/i);

    const generatedReadableV5 = fs.readFileSync(summary.artifacts.generated_readable_ledger_v5_indicator, 'utf8');
    expect(generatedReadableV5).toContain('indicator("Luke Watch Production Test - Readable Ledger v4 Trade Math"');
    expect(generatedReadableV5).toContain('7248');
    expect(generatedReadableV5).toContain('Pivot Ribbon fast conviction EMA');
    expect(generatedReadableV5).toContain('f_event_net_dollars');
    expect(generatedReadableV5).not.toContain('strategy(');
    expect(generatedReadableV5).not.toMatch(/submitOrder|placeOrder|webhook|LIVE_READY|EXECUTE/i);

    const generatedSimulation = fs.readFileSync(summary.artifacts.generated_simulation_strategy, 'utf8');
    expect(generatedSimulation).toContain('strategy("Luke Watch Production Test Strategy - Simulation Only"');
    expect(generatedSimulation).toContain('strategy.entry("LUKE_SIM_LONG"');
    expect(generatedSimulation).toContain('strategy.exit("LUKE_SIM_TP1"');
    expect(generatedSimulation).toContain('SIMULATION ONLY');
    expect(generatedSimulation).toContain('non-executable alert');
    expect(generatedSimulation).not.toMatch(/submitOrder|placeOrder|LIVE_READY/i);

    const generatedHardmode = fs.readFileSync(summary.artifacts.generated_hardmode_strategy, 'utf8');
    expect(generatedHardmode).toContain('strategy("Luke Level Reclaim Watch Hard Mode Strategy"');
    expect(generatedHardmode).toContain('mancini_levels_input = input.string("');
    expect(generatedHardmode).toContain('7248');
    expect(generatedHardmode).toContain('slippage_mode = input.string');
    expect(generatedHardmode).toContain('same_bar_policy = input.string("stop_first_hard_mode"');
    expect(generatedHardmode).not.toMatch(/webhook|submitOrder|placeOrder|LIVE_READY|EXECUTE/);
    expect(generatedHardmode).not.toMatch(/\bBUY\b|\bSELL\b/);

    const slippageSummary = JSON.parse(fs.readFileSync(summary.artifacts.slippage_modes_summary, 'utf8'));
    expect(slippageSummary.modes).toContain('both_sides_0_25_each');
    expect(slippageSummary.same_bar_default).toBe('stop_first_hard_mode');
    const hardmodeAudit = JSON.parse(fs.readFileSync(summary.artifacts.pine_hardmode_audit, 'utf8'));
    expect(hardmodeAudit.safety.strategy_safe_saty_uses_lookahead_off).toBe(true);
    expect(hardmodeAudit.hard_mode_features.ambiguous_count_surfaced).toBe(true);
  });

  it('handles empty Pine inputs without fabricating levels or alerts', () => {
    const inputText = buildPineInputText({
      mancini: [],
      dubz: [],
      heatmap: [],
      heatmapSnapshotTime: '',
    });
    const base = fs.readFileSync(path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch.pine'), 'utf8');
    const generated = renderGeneratedPine(base, {
      mancini: '',
      dubz: '',
      heatmap: '',
      heatmapSnapshotTime: '',
    });

    expect(inputText).toContain('Mancini levels:\n\n');
    expect(inputText).toContain('Dubz levels:\n\n');
    expect(inputText).toContain('Heatmap/GEX levels:\n\n');
    expect(inputText).toContain('Heatmap/GEX snapshot time:\nnone');
    expect(generated).toContain('input.string("", "Mancini levels"');
    expect(generated).toContain('input.string("", "Dubz levels"');
    expect(generated).toContain('input.string("", "Heatmap/GEX levels"');
    expect(generated).toContain('alertcondition(');
    expect(generated).not.toContain('alert(');
    expect(generated).not.toContain('strategy(');

    const hardmode = renderGeneratedPine(fs.readFileSync(path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch-hardmode.strategy.pine'), 'utf8'), {
      mancini: '',
      dubz: '',
      heatmap: '',
      heatmapSnapshotTime: '',
    });
    expect(hardmode).toContain('input.string("", "Mancini levels"');
    expect(hardmode).toContain('input.string("", "Dubz levels"');
    expect(hardmode).toContain('input.string("", "Heatmap/GEX levels"');
    expect(hardmode).toContain('strategy(');
  });

  it('replaces non-empty Pine level defaults when regenerating current files', () => {
    const generated = renderGeneratedPine([
      'mancini_levels_input = input.string("1111,2222", "Mancini levels")',
      'dubz_levels_input = input.string("3333", "Dubz levels")',
      'heatmap_gex_levels_input = input.string("4444", "Heatmap/GEX levels")',
      'heatmap_gex_snapshot_time = input.string("old", "Heatmap/GEX snapshot time")',
    ].join('\n'), {
      mancini: '7248,7268',
      dubz: '7198',
      heatmap: '7100',
      heatmapSnapshotTime: '2026-05-06T10:09:22.450Z',
    });

    expect(generated).toContain('input.string("7248,7268", "Mancini levels"');
    expect(generated).toContain('input.string("7198", "Dubz levels"');
    expect(generated).toContain('input.string("7100", "Heatmap/GEX levels"');
    expect(generated).toContain('input.string("2026-05-06T10:09:22.450Z", "Heatmap/GEX snapshot time"');
    expect(generated).not.toContain('1111,2222');
  });

  it('keeps the local Saty ATR reference available for parity review', () => {
    const sourcePath = path.join(__dirname, '..', 'tradingview', 'saty-atr-levels-source.pine');
    const satySource = fs.readFileSync(sourcePath, 'utf8');

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(satySource).toContain('indicator(');
    expect(satySource).toContain('request.security');
    expect(satySource).toContain('barmerge.lookahead_on');
    expect(satySource).toContain('ta.atr');
    expect(satySource).not.toContain('strategy(');
    expect(satySource).not.toMatch(/strategy\.|submitOrder|placeOrder|broker/i);
  });

  it('keeps the base Pine indicator safe and Saty-backed', () => {
    const pine = fs.readFileSync(path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch.pine'), 'utf8');

    expect(pine).toContain('request.security');
    expect(pine).toContain('atr_value');
    expect(pine).not.toContain('ta.barssince');
    expect(pine).not.toContain('ta.crossunder');
    expect(pine).not.toContain('ta.crossover');
    expect(pine).toContain('bars_since_flush = -1');
    expect(pine).not.toContain('f_hold_above');
    expect(pine).toContain('flush_lookback_bars');
    expect(pine).toContain('LUKE RAW FLUSH');
    expect(pine).toContain('LUKE BLOCKED');
    expect(pine).toContain('Pivot Ribbon long filter');
    expect(pine).toContain('soft_reclaim');
    expect(pine).toContain('pivot_ribbon_long_ok');
    expect(pine).toContain('allow_tp1_room_candidate');
    expect(pine).toContain('paper_level');
    expect(pine).toContain('active_block_reason');
    expect(pine).toContain('show_long_signal_marker');
    expect(pine).toContain('LUKE PAPER_CANDIDATE');
    expect(pine).toContain('text="PAPER"');
    expect(pine).toContain('label.new(bar_index, candidate_label_y');
    expect(pine).toContain('entry_price_mode');
    expect(pine).toContain('cluster_plus_tick');
    expect(pine).toContain('enable_impulse_reclaim_long');
    expect(pine).toContain('impulse_reclaim_here');
    expect(pine).toContain('pivot_cloud_break_now');
    expect(pine).toContain('show_session_scorecard');
    expect(pine).toContain('show_event_ledger');
    expect(pine).toContain('event_ledger_rows');
    expect(pine).toContain('event_ledger_table');
    expect(pine).toContain('f_add_event_ledger');
    expect(pine).toContain('Luke event ledger');
    expect(pine).toContain('show_session_pnl');
    expect(pine).toContain('pnl_contract_plan');
    expect(pine).toContain('split_tp1_tp2');
    expect(pine).toContain('2ES split');
    expect(pine).toContain('session_realized_points');
    expect(pine).toContain('session_realized_dollars');
    expect(pine).toContain('event_points');
    expect(pine).toContain('slippage_points_per_side');
    expect(pine).toContain('commission_per_contract_round_trip');
    expect(pine).toContain('eval_loss_limit_dollars');
    expect(pine).toContain('session_cost_dollars');
    expect(pine).toContain('session_net_dollars');
    expect(pine).toContain('f_event_net_dollars');
    expect(pine).toContain('session_after_all_costs');
    expect(pine).toContain('minus comm');
    expect(pine).toContain('minus comm+slip');
    expect(pine).toContain('Total ');
    expect(pine).not.toContain('entry_slippage_points');
    expect(pine).not.toContain('round_trip_fee_per_contract');
    expect(pine).toContain('session_watches');
    expect(pine).toContain('session_tp1_hits');
    expect(pine).toContain('session_tp2_hits');
    expect(pine).toContain('session_breakevens');
    expect(pine).toContain('session_mixed');
    expect(pine).toContain('session_successes');
    expect(pine).toContain('session_attempts');
    expect(pine).toContain('new_futures_session');
    expect(pine).toContain('candidate_label_y');
    expect(pine).toContain('enable_alertconditions');
    expect(pine).toContain('alert_watch_events');
    expect(pine).toContain('alert_armed_events');
    expect(pine).toContain('alert_paper_candidate_events');
    expect(pine).toContain('alert_invalidated_events');
    expect(pine).toContain('alert_blocked_events');
    expect(pine).toContain('alertcondition(');
    expect(pine).not.toContain('alert(');
    expect(pine).not.toContain('f_json_event');
    expect(pine).not.toContain('luke_watch_v1');
    expect(pine).toContain('fresh_level_retest');
    expect(pine).toContain('failed_chase_block');
    expect(pine).toContain('failed_reentry_cooldown_bars');
    expect(pine).toContain('failed cooldown');
    expect(pine).toContain('paper_retest_reentry');
    expect(pine).toContain('PAPER_CANDIDATE');
    expect(pine).toContain('TP1 HIT - STOP TO BE');
    expect(pine).toContain('SUCCEEDED TP1 / STOPPED');
    expect(pine).toContain('FAILED STOPPED');
    expect(pine).toContain('WATCH #');
    expect(pine).not.toContain('LUKE LONG SIGNAL');
    expect(pine).not.toContain('text="LONG"');
    expect(pine).not.toContain('LONG CANDIDATE');
    expect(pine).not.toContain('string text =');
    expect(pine).toContain('indicator("Luke Level Reclaim Watch"');
    expect(pine).toContain('WATCHLIST ONLY - not an order');
    expect(pine).not.toContain('strategy(');
    expect(pine).not.toMatch(/\bBUY\b|\bSELL\b/);
  });
});
