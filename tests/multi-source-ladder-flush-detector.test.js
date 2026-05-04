const {
  detectFlushAt,
  detectFlushesForSession,
} = require('../lib/research/multi-source-ladder-reclaim/flush-detector');

function bar(minute, open, high, low, close) {
  return { timestamp: `2026-04-24T09:${minute}:00-04:00`, open, high, low, close };
}

function cluster(price, sources = ['saty']) {
  return {
    cluster_id: `es:${price}`,
    canonical_price_es: price,
    source_combo: sources.sort().join('+'),
    sources,
    basis_method: 'native_es',
    basis_methods: ['native_es'],
    is_executable_es: true,
    is_veto_or_chop: false,
    cluster_strength: sources.length,
  };
}

function fact(id, price, available = '2026-04-24T09:25:00-04:00') {
  return {
    id,
    source: id.split('-')[0],
    source_type: 'fixture',
    level_type: 'support',
    role: 'support',
    original_level: price,
    original_level_instrument: 'ES',
    available_at_et: available,
  };
}

describe('multi-source ladder flush detector', () => {
  it('detects a flush through one trusted level and first reclaim', () => {
    const bars = [
      bar('30', 101, 101, 100.75, 101),
      bar('31', 101, 101, 98.5, 99),
      bar('32', 99, 100.5, 98.75, 100.25),
    ];
    const event = detectFlushAt({
      bars,
      index: 1,
      ladder: { executable_clusters: [cluster(100)] },
    });
    expect(event.flush_type).toBe('single_level');
    expect(event.first_reclaimed_price).toBe(100);
    expect(event.sweep_low).toBe(98.5);
  });

  it('detects a multi-level flush and does not wait for upper reclaim', () => {
    const bars = [
      bar('30', 104, 104, 103.75, 104),
      bar('31', 104, 104, 98.5, 99),
      bar('32', 99, 99.5, 98.75, 99.25),
      bar('33', 99.25, 101.5, 99, 101.25),
    ];
    const event = detectFlushAt({
      bars,
      index: 1,
      ladder: { executable_clusters: [cluster(103), cluster(101), cluster(99)] },
    });
    expect(event.flush_type).toBe('multi_level');
    expect(event.clusters_lost_count).toBe(3);
    expect(event.first_reclaimed_price).toBe(99);
    expect(event.upper_lost_clusters.map(row => row.canonical_price_es)).toEqual([101, 103]);
  });

  it('tracks deep flushes separately', () => {
    const bars = [
      bar('30', 106, 106, 105.75, 106),
      bar('31', 106, 106, 97.5, 98),
      bar('32', 98, 99.5, 97.75, 99.25),
    ];
    const event = detectFlushAt({
      bars,
      index: 1,
      ladder: { executable_clusters: [cluster(105), cluster(103), cluster(101), cluster(99)] },
    });
    expect(event.flush_type).toBe('deep_flush');
    expect(event.clusters_lost_count).toBe(4);
  });

  it('excludes source levels that are available after the event', () => {
    const session = {
      date: '2026-04-24',
      replayBars: [
        bar('30', 104, 104, 103.75, 104),
        bar('31', 104, 104, 98.5, 99),
        bar('32', 99, 100.5, 98.75, 100.25),
      ],
    };
    const flushes = detectFlushesForSession({
      session,
      facts: [fact('saty-a', 100, '2026-04-24T09:35:00-04:00')],
      spxBars: [],
    });
    expect(flushes).toHaveLength(0);
  });
});
