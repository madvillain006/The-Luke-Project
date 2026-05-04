'use strict';

const {
  clusterLevelsForPineExport,
  _internal,
} = require('../lib/tradingview/level-export');

function level(price, sourceFamily = 'mancini', instrument = 'ES') {
  return {
    price,
    instrument,
    source_family: sourceFamily,
    source_transport: 'manual',
    role: 'level',
    label: `${sourceFamily} ${price}`,
    active: true,
  };
}

describe('Pine level clustering export', () => {
  it('clusters nearby levels within the default ES tolerance', () => {
    const clusters = clusterLevelsForPineExport([
      level(7248.5, 'saty', 'SPX'),
      level(7249, 'mancini', 'ES'),
    ], { tolerance: 1.25 });

    expect(clusters).toHaveLength(1);
    expect(clusters[0].source_families).toEqual(['mancini', 'saty']);
    expect(clusters[0].price).toBe(7249);
  });

  it('does not merge far ladder rungs', () => {
    const clusters = clusterLevelsForPineExport([
      level(7248, 'mancini'),
      level(7258, 'saty'),
    ], { tolerance: 1.25 });

    expect(clusters).toHaveLength(2);
  });

  it('keeps separate levels when the cluster width would exceed tolerance', () => {
    const clusters = clusterLevelsForPineExport([
      level(7242, 'saty'),
      level(7244.8, 'mancini'),
    ], { tolerance: 1.25 });

    expect(clusters).toHaveLength(2);
  });

  it('caps unsafe tolerance values at 3 points', () => {
    expect(_internal.capTolerance(10, 3)).toBe(3);
  });
});
