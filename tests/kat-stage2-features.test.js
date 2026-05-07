'use strict';

const { computeMarketFeatures } = require('../lib/kat-stage2/features');

describe('Kat Stage 2 feature extraction', () => {
  it('uses only closed candles before the call time', () => {
    const feature = computeMarketFeatures({
      trade_id: 't1',
      normalized_symbol: 'ES',
      timestamp_utc: '2026-04-22T14:00:30.000Z',
    }, {
      bySymbol: {
        ES: [
          { timestamp_utc: '2026-04-22T13:59:00.000Z', open: 5299, high: 5302, low: 5298, close: 5301, volume: 100 },
          { timestamp_utc: '2026-04-22T14:00:00.000Z', open: 5301, high: 9999, low: 1, close: 8888, volume: 100 },
        ],
      },
    }, []);

    expect(feature.price_at_call).toBe(5301);
    expect(feature.recent_high).toBe(5302);
    expect(feature.recent_low).toBe(5298);
    expect(feature.feature_quality).toBe('computed_from_closed_local_replay_candles');
  });
});
