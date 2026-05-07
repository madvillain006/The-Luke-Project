'use strict';

const { parseKatSignal } = require('../lib/parse-kat');

describe('Kat text parser', () => {
  it('normalizes lower-case ticker mentions from raw analyst text', () => {
    expect(parseKatSignal('analyst1', '$ups breakout over 110', false)).toMatchObject({
      ticker: 'UPS',
      signal_type: 'LEVEL_WATCH',
    });
    expect(parseKatSignal('analyst1', 'ups 1D bull flag', true)).toMatchObject({
      ticker: 'UPS',
      signal_type: 'CHART_ANALYSIS',
    });
  });

  it('does not pull ES out of ordinary words or emoji names', () => {
    expect(parseKatSignal('analyst1', '<:KC_yes:1129057964158898256> $LAC', true)).toMatchObject({
      ticker: 'LAC',
      signal_type: 'CHART_ANALYSIS',
    });
    expect(parseKatSignal('analyst1', 'support continues to hold', true)).toBeNull();
  });
});
