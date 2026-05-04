'use strict';

const fs = require('fs');
const path = require('path');

const { computeOutcomeMetrics } = require('../lib/research/outcome-metrics');
const { buildActiveSourceContext } = require('../lib/research/no-lookahead-context');
const { makeEvent } = require('../lib/research/source-timeline');
const {
  collectCheckpointTimes,
  recordsFromContext,
  barAtOrBefore,
  _internal: replayInternal,
} = require('../lib/research/replay-engine');

const ROOT = path.join(__dirname, '..');

describe('research existing-data replay', () => {
  it('builds active research level records from only available-at-or-before events', () => {
    const events = [
      makeEvent({
        id: 'saty-1',
        source: 'saty',
        source_type: 'saty_generated_levels',
        instrument: 'ES',
        timestamp_et: '2026-04-09T09:25:00-04:00',
        available_at_et: '2026-04-09T09:25:00-04:00',
        levels: [{ price: 6800, role: 'put_trigger' }],
      }),
      makeEvent({
        id: 'bobby-1',
        source: 'bobby',
        source_type: 'bobby_cached_parsed_heatmap',
        instrument: 'SPX',
        timestamp_et: '2026-04-09T10:05:00-04:00',
        available_at_et: '2026-04-09T10:05:00-04:00',
        levels: [{ price: 6770, role: 'king_node', ticker: 'SPXW' }],
      }),
    ];
    const early = recordsFromContext(buildActiveSourceContext(events, '2026-04-09T10:00:00-04:00'));
    const late = recordsFromContext(buildActiveSourceContext(events, '2026-04-09T10:06:00-04:00'));

    expect(early.map(record => record.instrument)).toEqual(['ES']);
    expect(late.map(record => record.instrument).sort()).toEqual(['ES', 'SPX']);
  });

  it('calculates forward MFE/MAE and target-first outcomes', () => {
    const bars = [
      { timestamp: '2026-04-09T10:01:00-04:00', high: 100.5, low: 99.5, close: 100 },
      { timestamp: '2026-04-09T10:05:00-04:00', high: 106, low: 100, close: 105 },
      { timestamp: '2026-04-09T10:10:00-04:00', high: 107, low: 98, close: 101 },
    ];
    const outcome = computeOutcomeMetrics({
      bars,
      timestamp: '2026-04-09T10:00:00-04:00',
      price: 100,
      decision: { action: 'LONG', target: 105, stop: 96, confluence: { anchor: 100 } },
    });

    expect(outcome.mfe_5m).toBe(6);
    expect(outcome.mae_5m).toBe(0.5);
    expect(outcome.target_stop_first).toBe('TARGET_FIRST');
    expect(outcome.time_to_first_plus_5_es).toBe(5);
  });

  it('handles missing SPX or missing ES without substituting prices', () => {
    const bars = [{ timestamp: '2026-04-09T10:00:00-04:00', close: 6800 }];
    expect(barAtOrBefore(bars, '2026-04-09T10:00:30-04:00').close).toBe(6800);
    expect(barAtOrBefore([], '2026-04-09T10:00:30-04:00')).toBeNull();

    const source = fs.readFileSync(path.join(ROOT, 'lib/research/replay-engine.js'), 'utf8');
    expect(source).toContain('SPX CSV inventory available but not silently substituted');
    expect(source).not.toContain('execution-live');
    expect(source).not.toContain('placeOrder');
  });

  it('selects level-touch, source-update, and cadence checkpoints from tiny fixture data', () => {
    const session = {
      date: '2026-04-09',
      levels: [{ price: 100, source: 'saty', label: 'put_trigger' }],
      replayBars: [
        { timestamp: '2026-04-09T09:30:00-04:00', high: 101, low: 99, close: 100 },
        { timestamp: '2026-04-09T09:31:00-04:00', high: 102, low: 101, close: 101 },
      ],
    };
    const events = [makeEvent({
      id: 'bobby-update',
      source: 'bobby',
      source_type: 'bobby_text',
      timestamp_et: '2026-04-09T09:31:00-04:00',
      available_at_et: '2026-04-09T09:31:00-04:00',
    })];
    const checkpoints = collectCheckpointTimes(session, events, { maxTouchesPerDay: 5, maxCheckpointsPerDay: 20 });
    expect(checkpoints.some(row => row.reasons.includes('near_level_or_touch'))).toBe(true);
    expect(checkpoints.some(row => row.reasons.includes('source_update:bobby'))).toBe(true);
    expect(checkpoints.some(row => row.reasons.includes('15m_cadence_or_opening_range'))).toBe(true);
  });

  it('keeps replay temp memory under ignored artifacts instead of live state', () => {
    expect(replayInternal.TEMP_MEMORY_FILE).toContain(path.join('artifacts', 'research'));
    expect(replayInternal.classifyPassMiss({ adapter_action: 'PASS', outcome: { mfe_15m: 12 } })).toBe(true);
    expect(replayInternal.classifyVetoSave({ vetoes: [{ type: 'mancini_chop_zone' }], outcome: { mae_15m: 6 } })).toBe(true);
  });
});
