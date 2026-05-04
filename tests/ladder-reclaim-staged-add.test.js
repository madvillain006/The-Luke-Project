const {
  analyzeStagedAdds,
  findTrigger,
  starterPnl,
  variantOutcome,
} = require('../lib/research/multi-source-ladder-reclaim/staged-add-analysis');

function bar(minute, open, high, low, close) {
  return { timestamp: `2026-04-24T09:${minute}:00-04:00`, open, high, low, close };
}

function row(overrides = {}) {
  return {
    setup_id: 'setup-1',
    date: '2026-04-24',
    entry_timestamp_et: '2026-04-24T09:30:00-04:00',
    classification: 'TRADEABLE_RESEARCH',
    target_model: 'fixed_plus_2',
    entry_price: 100,
    stop_price: 98,
    stop_points: 2,
    tp1_hit: true,
    stop_first: false,
    same_bar_ambiguity: false,
    pnl_1es_slip_0_5_round_trip: 75,
    pnl_2es_slip_0_5_round_trip: 150,
    next_cluster_target: 102,
    second_cluster_target: 104,
    ...overrides,
  };
}

describe('ladder reclaim staged add analysis', () => {
  it('keeps 1ES starter pnl separate from add logic', () => {
    expect(starterPnl(row())).toBe(75);
    expect(starterPnl(row({ stop_first: true, tp1_hit: false }))).toBe(-125);
  });

  it('detects add-after-plus-one trigger before stop', () => {
    const bars = [
      bar('30', 100, 100.5, 99.5, 100.25),
      bar('31', 100.25, 101.25, 100.5, 101),
    ];
    const trigger = findTrigger(row(), bars, '1ES_ADD_AFTER_PLUS_1');
    expect(trigger.price).toBe(101);
  });

  it('adds a second contract only after the configured confirmation', () => {
    const bars = [
      bar('30', 100, 100.5, 99.5, 100.25),
      bar('31', 100.25, 101.25, 100.5, 101),
      bar('32', 101, 103.25, 100.75, 103),
    ];
    const outcome = variantOutcome(row(), bars, '1ES_ADD_AFTER_PLUS_1');
    expect(outcome.add_triggered).toBe(true);
    expect(outcome.pnl).toBeGreaterThan(75);
  });

  it('simulates 25k staged variants without requiring a single-trade target hit', () => {
    const barsByDate = new Map([['2026-04-24', [
      bar('30', 100, 100.5, 99.5, 100.25),
      bar('31', 100.25, 101.25, 100.5, 101),
      bar('32', 101, 103.25, 100.75, 103),
    ]]]);
    const result = analyzeStagedAdds([row()], barsByDate);
    expect(result.variants.some(item => item.variant === '1ES_ONLY')).toBe(true);
    expect(result.best_variant.target_hit).toBe(false);
    expect(result.best_variant.failed).toBe(false);
  });
});
