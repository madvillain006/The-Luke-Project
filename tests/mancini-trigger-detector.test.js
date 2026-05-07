'use strict';

const {
  detectManciniTriggers,
  formatDiscordSignal,
} = require('../lib/mancini-trigger-detector');

function bar(minute, open, high, low, close) {
  const hh = String(9 + Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return {
    timestamp: `2026-04-07T${hh}:${mm}:00-04:00`,
    open,
    high,
    low,
    close,
    volume: 1,
  };
}

describe('mancini trigger detector', () => {
  it('fires a high-confluence trigger only after a flush and 3 accepted closes', () => {
    const candles = [
      bar(40, 100, 101, 99.75, 100.5),
      bar(41, 100.5, 101, 99.75, 100.5),
      bar(42, 100.5, 101, 99.75, 100.5),
      bar(43, 100.5, 101, 99.75, 100.5),
      bar(44, 100.5, 101, 99.75, 100.5),
      bar(45, 100.5, 102, 97.5, 99),
      bar(46, 99, 101.5, 99, 100.25),
      bar(47, 100.25, 101, 100, 100.5),
      bar(48, 100.5, 101.25, 100.25, 100.75),
    ];

    const result = detectManciniTriggers({
      candles,
      levels: [100],
      options: {
        rthStartMinute: 0,
        watchStartMinute: 0,
        minPriorTapGroups: 1,
        highConfluencePriorTapGroups: 1,
      },
    });

    expect(result.summary.high_confluence).toBe(1);
    expect(result.triggers[0].tier).toBe('MANCINI_HIGH_CONFLUENCE_CALL');
    expect(result.triggers[0].flush_depth_points).toBe(2.5);
    expect(result.triggers[0].max_prior_tap_groups).toBeGreaterThanOrEqual(1);
    expect(formatDiscordSignal(result.triggers[0])).toContain('MANCINI_HIGH_CONFLUENCE_CALL');
  });

  it('clusters repeated same-level signals into one super trigger', () => {
    const candles = [
      bar(40, 100, 101, 99.75, 100.5),
      bar(41, 100.5, 101, 99.75, 100.5),
      bar(42, 100.5, 101, 99.75, 100.5),
      bar(43, 100.5, 102, 98.75, 99),
      bar(44, 99, 101.5, 99, 100.5),
      bar(45, 100.5, 101, 100, 100.5),
      bar(46, 100.5, 101, 100, 100.75),
      bar(47, 100.75, 101, 98.5, 99),
      bar(48, 99, 101.5, 100, 100.25),
      bar(49, 100.25, 101, 100, 100.5),
      bar(50, 100.5, 101, 100, 100.75),
    ];

    const result = detectManciniTriggers({
      candles,
      levels: [100],
      options: {
        rthStartMinute: 0,
        watchStartMinute: 0,
        minPriorTapGroups: 1,
        highConfluencePriorTapGroups: 50,
        highConfluenceFlushDepthPoints: 9,
        superTriggerWindowMinutes: 10,
      },
    });

    expect(result.triggers).toHaveLength(1);
    expect(result.triggers[0].repeat_count).toBeGreaterThanOrEqual(2);
    expect(result.triggers[0].tier).toBe('MANCINI_SUPER_TRIGGER_WATCH');
  });
});
