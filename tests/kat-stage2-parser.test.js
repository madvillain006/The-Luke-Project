'use strict';

const {
  parseGainsPost,
  parseHeatmapRecord,
  parseTradeCall,
  parseTradeUpdate,
} = require('../lib/kat-stage2/parser');

function msg(text, overrides = {}) {
  return {
    message_id: overrides.message_id || 'm1',
    author_id: overrides.author_id || 'u1',
    author_name: overrides.author_name || 'analyst1',
    timestamp_utc: overrides.timestamp_utc || '2026-04-22T14:30:00.000Z',
    channel_name: overrides.channel_name || 'trade-floor',
    raw_text: text,
    attachments: overrides.attachments || [],
  };
}

describe('Kat Stage 2 parser', () => {
  it('parses long and short calls with explicit entries', () => {
    const long = parseTradeCall(msg('Long ES 5320 stop 5314 target 5332'));
    const short = parseTradeCall(msg('NQ short under 18500 stop 18540 target 18420'));

    expect(long.normalized_symbol).toBe('ES');
    expect(long.direction).toBe('long');
    expect(long.entry_price).toBe(5320);
    expect(long.stop_price).toBe(5314);
    expect(long.take_profit_1).toBe(5332);
    expect(short.normalized_symbol).toBe('NQ');
    expect(short.direction).toBe('short');
    expect(short.entry_type).toBe('breakdown');
  });

  it('parses market, zone, reclaim, and lowercase ticker calls', () => {
    expect(parseTradeCall(msg('Short NQ here')).entry_type).toBe('market');

    const zone = parseTradeCall(msg('es long zone 5318-5320 stop 5310 target 5335'));
    expect(zone.normalized_symbol).toBe('ES');
    expect(zone.entry_type).toBe('zone');
    expect(zone.entry_zone_low).toBe(5318);
    expect(zone.entry_zone_high).toBe(5320);

    const reclaim = parseTradeCall(msg('Buying ES reclaim 5320 stop 5312 target 5340'));
    expect(reclaim.entry_type).toBe('breakout');
    expect(reclaim.setup_tags).toContain('reclaim');
  });

  it('parses partial exits, breakeven moves, closed trades, stopped trades, and gains-only posts', () => {
    expect(parseTradeUpdate(msg('TP1 hit take 50%')).update_type).toBe('partial');
    expect(parseTradeUpdate(msg('move stops to BE')).update_type).toBe('moved_to_breakeven');
    expect(parseTradeUpdate(msg('closed 5332')).update_type).toBe('closed');
    expect(parseTradeUpdate(msg('stopped 5314')).update_type).toBe('stop_hit');

    const gains = parseGainsPost(msg('+20 handles nice win from earlier'));
    expect(gains.verification_status).toBe('gains_only_unverified');
    expect(gains.claimed_points).toBe(20);
  });

  it('parses lowercase equity option contracts without treating expiry digits as entry price', () => {
    const option = parseTradeCall(msg('buying mu 4/17 500c @ 2.85 stop 2.20 target 4.00'));

    expect(option.normalized_symbol).toBe('MU');
    expect(option.asset_class).toBe('option');
    expect(option.direction).toBe('long');
    expect(option.entry_type).toBe('limit');
    expect(option.entry_price).toBe(2.85);
    expect(option.option_ticker).toBe('O:MU260417C00500000');
    expect(option.option_contract.expiration_date).toBe('2026-04-17');
  });

  it('parses paid option entries as trade calls, not gains-only captions', () => {
    const option = parseTradeCall(msg('Buying SPX 0DTE 7300c paid 1.25 stop .80 target 2.50'));

    expect(option).not.toBeNull();
    expect(option.normalized_symbol).toBe('SPX');
    expect(option.asset_class).toBe('option');
    expect(option.entry_type).toBe('limit');
    expect(option.entry_price).toBe(1.25);
    expect(option.option_ticker).toBe('O:SPXW260422C07300000');
  });


  it('parses option gains as unverified until linked to a prior call', () => {
    const gains = parseGainsPost(msg('SPX 0DTE 7300c .10 to .90 gains from earlier'));

    expect(gains.symbol).toBe('SPX');
    expect(gains.option_ticker).toBe('O:SPXW260422C07300000');
    expect(gains.option_contract.entry_premium).toBe(0.10);
    expect(gains.option_contract.exit_premium).toBe(0.90);
    expect(gains.verification_status).toBe('gains_only_unverified');
  });

  it('keeps ambiguous and non-trade messages out of verified calls', () => {
    const ambiguous = parseTradeCall(msg('calls over 532'));
    expect(ambiguous.parse_status).toBe('ambiguous');
    expect(parseTradeCall(msg('great chart today'))).toBeNull();
    expect(parseTradeCall(msg('that was a long wait over lunch'))).toBeNull();
  });

  it('catalogs heatmap captions without pretending OCR happened', () => {
    const heatmap = parseHeatmapRecord(msg('$SPX heatmap king node 5320', {
      channel_name: 'heatmap-requests',
      attachments: [{ filename: 'spx.png', url: 'https://cdn.example/spx.png' }],
    }));

    expect(heatmap.symbol).toBe('SPX');
    expect(heatmap.extracted_levels).toContain(5320);
    expect(heatmap.extracted_text).toBeNull();
    expect(heatmap.notes).toContain('OCR not assumed');
  });
});
