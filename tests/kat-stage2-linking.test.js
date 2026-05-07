'use strict';

const {
  linkGainsPosts,
  linkHeatmapsToTrades,
  linkTradeUpdates,
} = require('../lib/kat-stage2/linking');

const trade = {
  trade_id: 't1',
  analyst_id: 'u1',
  analyst_name: 'analyst1',
  timestamp_utc: '2026-04-22T14:30:00.000Z',
  normalized_symbol: 'ES',
  parse_status: 'valid',
};

describe('Kat Stage 2 linking', () => {
  it('links updates to a prior analyst/symbol trade', () => {
    const updates = linkTradeUpdates([trade], [{
      update_id: 'u1',
      analyst_id: 'u1',
      timestamp_utc: '2026-04-22T14:45:00.000Z',
      symbol: 'ES',
    }]);

    expect(updates[0].trade_id).toBe('t1');
    expect(updates[0].link_confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('links gains only when a prior call exists', () => {
    const linked = linkGainsPosts([trade], [{
      gains_id: 'g1',
      analyst_id: 'u1',
      timestamp_utc: '2026-04-22T15:00:00.000Z',
      symbol: 'ES',
    }]);
    const unverified = linkGainsPosts([trade], [{
      gains_id: 'g2',
      analyst_id: 'other',
      timestamp_utc: '2026-04-22T15:00:00.000Z',
      symbol: 'ES',
    }]);

    expect(linked[0].verification_status).toBe('linked_to_prior_call');
    expect(unverified[0].verification_status).toBe('gains_only_unverified');
  });

  it('links nearby same-family heatmaps and rejects unrelated heatmaps', () => {
    const result = linkHeatmapsToTrades([trade], [
      { heatmap_id: 'h1', analyst_id: 'u2', timestamp_utc: '2026-04-22T13:30:00.000Z', symbol: 'SPX', source_message_id: 'm1' },
      { heatmap_id: 'h2', analyst_id: 'u2', timestamp_utc: '2026-04-21T13:30:00.000Z', symbol: 'QQQ', source_message_id: 'm2' },
    ], { maxHeatmapLinkMinutes: 180 });

    expect(result.trade_heatmap_links).toHaveLength(1);
    expect(result.trade_heatmap_links[0].heatmap_id).toBe('h1');
    expect(result.heatmaps.find(row => row.heatmap_id === 'h2').linked_trade_ids).toHaveLength(0);
  });

  it('keeps only the nearest qualifying heatmap for each trade', () => {
    const result = linkHeatmapsToTrades([trade], [
      { heatmap_id: 'h_old', analyst_id: 'u2', timestamp_utc: '2026-04-22T12:30:00.000Z', symbol: 'SPX', source_message_id: 'm_old' },
      { heatmap_id: 'h_near', analyst_id: 'u2', timestamp_utc: '2026-04-22T14:10:00.000Z', symbol: 'SPX', source_message_id: 'm_near' },
    ], { maxHeatmapLinkMinutes: 180 });

    expect(result.trade_heatmap_links).toHaveLength(1);
    expect(result.trade_heatmap_links[0].heatmap_id).toBe('h_near');
    expect(result.trade_heatmap_links[0].link_notes).toContain('nearest_qualifying_heatmap_only');
  });

  it('does not link no-symbol heatmaps from unrelated analysts by proximity alone', () => {
    const result = linkHeatmapsToTrades([trade], [
      { heatmap_id: 'h_loose', analyst_id: 'u2', timestamp_utc: '2026-04-22T14:10:00.000Z', symbol: null, source_message_id: 'm_loose' },
    ], { maxHeatmapLinkMinutes: 180 });

    expect(result.trade_heatmap_links).toHaveLength(0);
  });
});
