'use strict';

const fs = require('fs');
const path = require('path');
const { makeEvent } = require('../lib/research/source-timeline');
const { detectSetupsForSession, spxHeatmapComparisonsForSession } = require('../lib/research/prop-fake-breakdown/detector');
const { variantRowsForSetup, targetPrices } = require('../lib/research/prop-fake-breakdown/evaluator');

const ROOT = path.join(__dirname, '..');

describe('prop fake breakdown evaluator', () => {
  it('detects trusted level before event, breakdown, reclaim, and prop variants', () => {
    const session = {
      date: '2026-04-09',
      replayBars: [
        { timestamp: '2026-04-09T09:59:00-04:00', open: 102, high: 103, low: 101, close: 102 },
        { timestamp: '2026-04-09T10:00:00-04:00', open: 102, high: 102, low: 97.5, close: 98 },
        { timestamp: '2026-04-09T10:03:00-04:00', open: 99, high: 101, low: 98, close: 100.5 },
        { timestamp: '2026-04-09T10:04:00-04:00', open: 100.5, high: 101, low: 100.25, close: 100.75 },
        { timestamp: '2026-04-09T10:05:00-04:00', open: 100.75, high: 104, low: 100.5, close: 103 },
      ],
    };
    const events = [
      makeEvent({
        id: 'saty:test',
        source: 'saty',
        source_type: 'saty_generated_levels',
        instrument: 'ES',
        timestamp_et: '2026-04-09T09:25:00-04:00',
        available_at_et: '2026-04-09T09:25:00-04:00',
        levels: [{ price: 100, role: 'put_trigger' }],
        usable_for_replay: true,
      }),
      makeEvent({
        id: 'future:test',
        source: 'mancini',
        source_type: 'mancini_imported_archive',
        instrument: 'ES',
        timestamp_et: '2026-04-09T10:10:00-04:00',
        available_at_et: '2026-04-09T10:10:00-04:00',
        levels: [{ price: 99, role: 'support' }],
        usable_for_replay: true,
      }),
    ];
    const setups = detectSetupsForSession({ session, timelineEvents: events, spxBars: [] });
    expect(setups.length).toBeGreaterThan(0);
    expect(setups.some(setup => setup.executable_level === 99)).toBe(false);
    expect(setups[0].valid_reclaim).toBe(true);
    expect(setups[0].entry_points.map(entry => entry.entry_model)).toContain('level_reclaim_limit');

    const rows = variantRowsForSetup(setups[0], session.replayBars);
    expect(rows.some(row => row.classification === 'TRADEABLE')).toBe(true);
    expect(rows.some(row => row.tp1_hit)).toBe(true);
  });

  it('invalidates reclaim after window and no reclaim', () => {
    const session = {
      date: '2026-04-09',
      replayBars: [
        { timestamp: '2026-04-09T09:59:00-04:00', high: 103, low: 101, close: 102 },
        { timestamp: '2026-04-09T10:00:00-04:00', high: 102, low: 97, close: 98 },
        { timestamp: '2026-04-09T10:16:00-04:00', high: 101, low: 98, close: 100.5 },
      ],
    };
    const events = [makeEvent({
      id: 'saty:test',
      source: 'saty',
      source_type: 'saty_generated_levels',
      instrument: 'ES',
      timestamp_et: '2026-04-09T09:25:00-04:00',
      available_at_et: '2026-04-09T09:25:00-04:00',
      levels: [{ price: 100, role: 'put_trigger' }],
      usable_for_replay: true,
    })];
    const setups = detectSetupsForSession({ session, timelineEvents: events, spxBars: [] });
    expect(setups[0].valid_reclaim).toBe(false);
    expect(setups[0].invalid_reason).toBe('no_reclaim_within_15m');
  });

  it('creates next-level targets only when above entry', () => {
    expect(targetPrices({ next_trusted_level_above: 105 }, 100).map(row => row.target_model)).toContain('next_trusted_level_above');
    expect(targetPrices({ next_trusted_level_above: 100.25 }, 100).map(row => row.target_model)).not.toContain('next_trusted_level_above');
  });

  it('compares timestamped SPX heatmap minutes to ES without making SPX executable', () => {
    const session = {
      date: '2026-04-09',
      replayBars: [
        { timestamp: '2026-04-09T09:59:00-04:00', open: 102, high: 103, low: 101, close: 102 },
        { timestamp: '2026-04-09T10:00:00-04:00', open: 102, high: 102, low: 97.5, close: 98 },
        { timestamp: '2026-04-09T10:03:00-04:00', open: 99, high: 101, low: 98, close: 100.5 },
      ],
    };
    const events = [
      makeEvent({
        id: 'saty:test',
        source: 'saty',
        source_type: 'saty_generated_levels',
        instrument: 'ES',
        timestamp_et: '2026-04-09T09:25:00-04:00',
        available_at_et: '2026-04-09T09:25:00-04:00',
        levels: [{ price: 100, role: 'put_trigger' }],
        usable_for_replay: true,
      }),
      makeEvent({
        id: 'bobby-heatmap:test',
        source: 'bobby',
        source_type: 'bobby_cached_parsed_heatmap',
        instrument: 'SPX',
        timestamp_et: '2026-04-09T10:00:05-04:00',
        available_at_et: '2026-04-09T10:00:05-04:00',
        levels: [{ price: 5000, role: 'king_node', ticker: 'SPX' }],
        tags: ['heatmap', 'cached_parse'],
        usable_for_replay: true,
      }),
    ];
    const spxBars = [
      { timestamp: '2026-04-09T10:00:00-04:00', open: 5001, high: 5002, low: 4999, close: 5001 },
    ];
    const comparisons = spxHeatmapComparisonsForSession({ session, timelineEvents: events, spxBars });
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0].comparison_available).toBe(true);
    expect(comparisons[0].conversion_used).toBe(false);

    const setups = detectSetupsForSession({ session, timelineEvents: events, spxBars });
    expect(setups.some(setup => setup.original_level_instrument === 'SPX')).toBe(false);
    expect(setups.some(setup => setup.source_combo === 'bobby+saty')).toBe(true);
    expect(setups[0].spx_heatmap_minute_comparison.conversion_used).toBe(false);
  });

  it('does not reference live execution, live state writes, or buildTradeDecision', () => {
    const files = [
      'lib/research/prop-fake-breakdown/evaluator.js',
      'lib/research/prop-fake-breakdown/detector.js',
      'scripts/run-prop-fake-breakdown-research.js',
    ].map(file => fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const source = files.join('\n');
    expect(source).not.toContain('execution-live');
    expect(source).not.toContain('broker-tradovate');
    expect(source).not.toContain('buildTradeDecision');
    expect(source).not.toContain('recordLevel(');
  });
});
