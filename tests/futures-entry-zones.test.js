'use strict';

const { computeFuturesEntryZone } = require('../lib/futures-entry-zones');

function record(price, mentions) {
  return { canonical_price: price, mentions };
}

describe('futures-entry-zones', () => {
  it('builds grade A long zone', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support', intent: 'long_trigger' }]), {
      instrument: 'ES',
      confluenceGrade: 'A',
      confluenceScore: 0.9,
    });
    expect(zone.sizing_guidance).toBe('full');
    expect(zone.entry_window.optimal_entry).toBe(5000.25);
    expect(zone.entry_window.abort_below).not.toBeNull();
  });

  it('builds grade B long zone', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support' }]), {
      instrument: 'ES',
      confluenceGrade: 'B',
      confluenceScore: 0.6,
    });
    expect(zone.sizing_guidance).toBe('half');
    expect(zone.entry_window.optimal_entry).toBe(5000.5);
  });

  it('builds grade C long zone', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support' }]), {
      instrument: 'ES',
      confluenceGrade: 'C',
      confluenceScore: 0.4,
    });
    expect(zone.sizing_guidance).toBe('quarter');
    expect(zone.entry_window.acceptable_entry).toBe(5002);
  });

  it('passes on grade D', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support' }]), {
      instrument: 'ES',
      confluenceGrade: 'D',
      confluenceScore: 0.2,
    });
    expect(zone.sizing_guidance).toBe('pass');
  });

  it('passes on grade F', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support' }]), {
      instrument: 'ES',
      confluenceGrade: 'F',
      confluenceScore: 0.1,
    });
    expect(zone.sizing_guidance).toBe('pass');
  });

  it('builds short zone with abort above', () => {
    const zone = computeFuturesEntryZone(record(15000, [{ direction: 'resistance', intent: 'short_trigger' }]), {
      instrument: 'NQ',
      confluenceGrade: 'B',
      confluenceScore: 0.6,
    });
    expect(zone.entry_window.optimal_entry).toBe(14999.5);
    expect(zone.entry_window.abort_above).not.toBeNull();
    expect(zone.entry_window.abort_below).toBeNull();
  });

  it('uses historical worst drawdown override when larger', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support' }]), {
      instrument: 'ES',
      confluenceGrade: 'A',
      confluenceScore: 0.9,
      historicalReplay: {
        summary: {
          worst_drawdown_seen: 4.5,
          avg_drawdown_on_hold: 1.25,
        },
      },
    });
    expect(zone.futures_specific.worst_drawdown_to_respect_pts).toBe(4.5);
    expect(zone.futures_specific.avg_drawdown_pts).toBe(1.25);
  });

  it('falls back to score-derived grade when grade missing', () => {
    const zone = computeFuturesEntryZone(record(5000, [{ direction: 'support' }]), {
      instrument: 'ES',
      confluenceScore: 0.56,
    });
    expect(zone.sizing_guidance).toBe('half');
  });
});
