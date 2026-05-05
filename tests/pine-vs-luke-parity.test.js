const { comparePineVsLuke } = require('../lib/research/pine-slippage-audit/report');

describe('pine vs luke parity', () => {
  it('classifies matched and Pine-early reconstructed signals', () => {
    const pineSignals = [
      {
        id: 'pine-1',
        date: '2026-04-24',
        signal_timestamp_et: '2026-04-24T09:30:00-04:00',
        entry_timestamp_et: '2026-04-24T09:31:00-04:00',
        level: 100,
        source_combo: 'saty',
        raw_entry: 100.25,
        raw_stop: 97,
        raw_tp1: 102.25,
      },
      {
        id: 'pine-2',
        date: '2026-04-24',
        signal_timestamp_et: '2026-04-24T09:35:00-04:00',
        entry_timestamp_et: '2026-04-24T09:36:00-04:00',
        level: 105,
        source_combo: 'mancini',
        raw_entry: 105.25,
        raw_stop: 102,
        raw_tp1: 107.25,
      },
    ];
    const lukeRows = [
      {
        setup_id: 'luke-1',
        date: '2026-04-24',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        entry_timestamp_et: '2026-04-24T09:31:00-04:00',
        first_reclaimed_level: 100,
        source_combo: 'saty',
        entry_price: 100.25,
        stop_price: 97,
        tp1: 102.25,
      },
      {
        setup_id: 'luke-2',
        date: '2026-04-24',
        classification: 'TRADEABLE_RESEARCH',
        target_model: 'fixed_plus_2',
        entry_timestamp_et: '2026-04-24T09:40:00-04:00',
        first_reclaimed_level: 105,
        source_combo: 'mancini',
        entry_price: 105.25,
        stop_price: 102,
        tp1: 107.25,
      },
    ];
    const parity = comparePineVsLuke(pineSignals, lukeRows);
    expect(parity.summary.classification_counts.MATCH).toBe(1);
    expect(parity.summary.classification_counts.PINE_EARLY).toBe(1);
    expect(parity.summary.warning).toContain('earlier');
  });
});
