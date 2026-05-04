'use strict';

const {
  easternDate,
  levelContextForKatInstrument,
  formatLevelContextLine,
} = require('../lib/kat-level-context');

describe('kat level context gate', () => {
  it('requires same-day Mancini and daily levels before Kat confluence can fire', () => {
    const now = new Date('2026-05-04T14:00:00.000Z');
    const today = easternDate(now);
    const queryFn = ({ instrument }) => {
      if (instrument !== 'SPX') return [];
      return [{
        canonical_price: 6809,
        instrument: 'SPX',
        mentions: [
          { analyst: 'mancini', date: today, source_type: 'text', source_snippet: '6809 reclaim' },
          { analyst: 'saty', date: today, source_type: 'saty_atr', source_snippet: 'put trigger 6809' },
        ],
      }];
    };

    const context = levelContextForKatInstrument('SPX', { now, queryFn });

    expect(context.ready).toBe(true);
    expect(context.source_flags).toEqual({ mancini: true, daily_levels: true });
    expect(formatLevelContextLine(context)).toBe('- Levels: current levels loaded for 2026-05-04');
  });

  it('blocks confluence when levels are stale or incomplete', () => {
    const now = new Date('2026-05-04T14:00:00.000Z');
    const queryFn = () => [{
      canonical_price: 6809,
      instrument: 'SPX',
      mentions: [
        { analyst: 'mancini', date: '2026-05-01', source_type: 'text', source_snippet: 'old level' },
        { analyst: 'saty', date: '2026-05-01', source_type: 'saty_atr', source_snippet: 'old daily level' },
      ],
    }];

    const context = levelContextForKatInstrument('SPX', { now, queryFn });

    expect(context.ready).toBe(false);
    expect(context.blocker).toBe('current levels not fully loaded');
    expect(formatLevelContextLine(context)).toBe('- Levels: current levels incomplete');
  });
});
