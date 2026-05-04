const {
  analyzeFalsePositives,
  categorizeFalsePositive,
  repeatedLevelKeys,
  timeBucket,
} = require('../lib/research/multi-source-ladder-reclaim/false-positive-analysis');

function row(overrides = {}) {
  return {
    setup_id: 'setup-1',
    date: '2026-04-24',
    entry_timestamp_et: '2026-04-24T09:35:00-04:00',
    classification: 'TRADEABLE_RESEARCH',
    entry_model: 'reclaim_close_first_cluster',
    first_reclaimed_level: 100,
    stop_points: 1.25,
    time_to_stop: 2,
    stop_first: true,
    tp1_hit: false,
    same_bar_ambiguity: false,
    first_reclaimed_cluster_strength: 2,
    bobby_heatmap_present: false,
    flush_type: 'deep_flush',
    clusters_lost_count: 4,
    ...overrides,
  };
}

describe('ladder reclaim false-positive analysis', () => {
  it('buckets time of day from pre-entry timestamp', () => {
    expect(timeBucket('2026-04-24T09:45:00-04:00')).toBe('opening_30');
    expect(timeBucket('2026-04-24T15:05:00-04:00')).toBe('power_hour');
  });

  it('categorizes a false positive without using future fields as live filters', () => {
    const categories = categorizeFalsePositive(row(), new Set(['2026-04-24|100.00']));
    expect(categories).toContain('stop_too_tight');
    expect(categories).toContain('reclaim_failed');
    expect(categories).toContain('missing_bobby_heatmap_confirmation');
    expect(categories).toContain('deep_flush_too_violent');
    expect(categories).toContain('repeated_same_level');
  });

  it('counts repeated levels and category totals', () => {
    const rows = [
      row({ setup_id: 'a' }),
      row({ setup_id: 'b', stop_points: 3, first_reclaimed_level: 100 }),
      row({ setup_id: 'c', stop_first: false, tp1_hit: true, first_reclaimed_level: 101 }),
    ];
    const repeated = repeatedLevelKeys(rows);
    expect(repeated.has('2026-04-24|100.00')).toBe(true);
    const summary = analyzeFalsePositives(rows);
    expect(summary.false_positive_rows).toBe(2);
    expect(summary.category_counts.repeated_same_level).toBe(2);
  });
});
