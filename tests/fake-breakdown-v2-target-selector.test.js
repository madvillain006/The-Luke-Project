'use strict';

const {
  fixedTarget,
  nextApplicableTarget,
  reactionScalpTargets,
  levelToLevelTargets,
  rejectReason,
  selectTargets,
} = require('../lib/research/fake-breakdown-v2/target-selector');

describe('fake breakdown v2 target selector', () => {
  const ladder = {
    above: [
      { source: 'saty', level_type: 'ext_plus_1', executable_level: 104, basis_method: 'native_es', source_strength: 5, age_minutes: 20 },
      { source: 'mancini', level_type: 'mancini_target', executable_level: 108, basis_method: 'native_es', source_strength: 5, age_minutes: 10 },
      { source: 'bobby', level_type: 'bobby_king_node', executable_level: 110, basis_method: 'native_es', source_strength: 4, age_minutes: 5 },
      { source: 'gex', level_type: 'gex_magnet', executable_level: 112, basis_method: 'native_es', source_strength: 4, age_minutes: 5 },
      { source: 'mancini', level_type: 'mancini_chop_zone', executable_level: 106, basis_method: 'native_es', source_strength: 5, age_minutes: 1 },
    ],
  };

  it('builds fixed +2/+3/+4 reaction scalp targets', () => {
    expect(fixedTarget(100, 2)).toEqual(expect.objectContaining({ tp1: 102, target_model: 'fixed_plus_2' }));
    expect(reactionScalpTargets(100).map(row => row.tp1)).toEqual([102, 103, 104]);
    expect(selectTargets({ archetype: 'REACTION_SCALP', ladder, entryPrice: 100 })).toHaveLength(3);
  });

  it('selects next trusted level above by proximity while exposing source details', () => {
    const selected = nextApplicableTarget({ ladder, entryPrice: 100, minDistance: 3 });
    expect(selected).toEqual(expect.objectContaining({
      tp2: 104,
      tp2_source: 'saty',
      target_basis_method: 'native_es',
    }));
    const l2l = levelToLevelTargets({ ladder, entryPrice: 100, trimPoints: 3 });
    expect(l2l[0]).toEqual(expect.objectContaining({ tp1: 103, tp2: 104 }));
  });

  it('rejects targets below entry, too close, diagnostic, reference-only, and chop unless explicitly allowed', () => {
    expect(rejectReason({ target_price: 99 }, 100)).toBe('target_below_or_at_entry');
    expect(rejectReason({ target_price: 101 }, 100)).toBe('target_too_close');
    expect(rejectReason({ target_price: 105, basis_diagnostic_only: true }, 100)).toBe('diagnostic_basis_not_strategy_truth');
    expect(rejectReason({ target_price: 105, basis_method: 'reference_only' }, 100)).toBe('reference_only_not_executable');
    expect(rejectReason({ target_price: 105, level_type: 'mancini_chop_zone' }, 100)).toBe('target_inside_chop_veto');
    expect(rejectReason({ target_price: 105, level_type: 'mancini_chop_zone' }, 100, { allowChop: true })).toBe(null);
  });
});
