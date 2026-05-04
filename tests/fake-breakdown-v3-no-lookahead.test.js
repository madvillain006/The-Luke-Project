'use strict';

const { buildBobbyDistanceMap, bobbyDistanceForRow } = require('../lib/research/fake-breakdown-v3/feature-extractor');
const { searchCombos } = require('../lib/research/fake-breakdown-v3/combo-search');
const { V3_ENTRY_GROUPS, observationSourceRows } = require('../lib/research/fake-breakdown-v3/evaluator');

describe('fake breakdown v3 no-lookahead controls', () => {
  it('excludes Bobby targets posted after entry from distance buckets', () => {
    const rows = [
      {
        setup_id: 's1',
        entry_model: 'micro_pivot_break',
        entry_timestamp_et: '2026-04-09T10:00:00-04:00',
        tp2_source: 'bobby',
        target_distance: 4,
        tp2: 104,
        target_available_at_et: '2026-04-09T10:05:00-04:00',
      },
      {
        setup_id: 's2',
        entry_model: 'micro_pivot_break',
        entry_timestamp_et: '2026-04-09T10:00:00-04:00',
        tp2_source: 'bobby',
        target_distance: 4,
        tp2: 104,
        target_available_at_et: '2026-04-09T09:55:00-04:00',
      },
    ];
    const map = buildBobbyDistanceMap(rows);
    expect(bobbyDistanceForRow(rows[0], map)).toBeNull();
    expect(bobbyDistanceForRow(rows[1], map)).toEqual(expect.objectContaining({ target_distance: 4 }));
  });

  it('does not let heat, MFE, MAE, TP, stop, or V2 classification drive combo filters', () => {
    const combos = searchCombos([
      {
        setup_id: 's1',
        valid_reclaim: true,
        stop_within_hard: true,
        stop_within_preferred: true,
        bobby_heatmap_target_present: true,
        entry_model_group: 'micro_pivot_break',
        outcome: { tp2_hit: true, tp3_hit: true, stop_first: false, mae_before_tp1: 0.5, time_to_tp1: 1 },
        prop: { pnl_2es_slip_0_5_round_trip: 150, pnl_1es_slip_0_5_round_trip: 75 },
      },
    ], { minRows: 1, maxSize: 1 });
    for (const combo of combos) {
      expect(combo.filter_uses).not.toContain('max_heat_before_tp1');
      expect(combo.filter_uses).not.toContain('mfe_5m');
      expect(combo.filter_uses).not.toContain('mae_5m');
      expect(combo.filter_uses).not.toContain('tp1_hit');
      expect(combo.filter_uses).not.toContain('stop_first');
      expect(combo.filter_uses).not.toContain('classification');
    }
  });

  it('keeps V3 source rows to requested entry models and executable ES basis', () => {
    const rows = [
      { archetype: 'REACTION_SCALP', target_model: 'fixed_plus_2', entry_model: 'micro_pivot_break', basis_method: 'native_es' },
      { archetype: 'REACTION_SCALP', target_model: 'fixed_plus_2', entry_model: 'reclaim_close', basis_method: 'native_es' },
      { archetype: 'REACTION_SCALP', target_model: 'fixed_plus_2', entry_model: 'micro_pivot_break', basis_method: 'reference_only' },
      { archetype: 'LEVEL_TO_LEVEL_LONG', target_model: 'fixed_plus_2', entry_model: 'micro_pivot_break', basis_method: 'native_es' },
    ];
    expect(V3_ENTRY_GROUPS.has('micro_pivot_break')).toBe(true);
    expect(observationSourceRows(rows)).toHaveLength(1);
  });
});
