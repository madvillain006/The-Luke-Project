const {
  activeNativeLevel,
  historicalSatyLevels,
  uniqueSortedPrices,
} = require('../scripts/export-ninja-native-levels');
const { loadIntraday } = require('../lib/historical-data');
const { deriveLevelsByDate } = require('../lib/backtest-data/saty-historical');

describe('Ninja-native level export', () => {
  it('keeps the native level file to external Mancini levels only', () => {
    expect(activeNativeLevel({ source_family: 'saty', active: true, price: 7415.25 })).toBe(false);
    expect(activeNativeLevel({ source_family: 'saty', active: false, price: 7415.25 })).toBe(false);
    expect(activeNativeLevel({ source_family: 'mancini', active: true, price: 7418.5 })).toBe(true);
    expect(activeNativeLevel({ source_family: 'mancini', price: 7418.5 })).toBe(true);
    expect(activeNativeLevel({ source_family: 'dubz_structural', active: true })).toBe(false);
    expect(activeNativeLevel({ source_family: 'heatmap_gex', active: true })).toBe(false);
    expect(activeNativeLevel({ source_family: 'mancini', active: false, price: 7418.5 })).toBe(false);
  });

  it('writes stable sorted unique price values', () => {
    expect(uniqueSortedPrices([
      { price: 7413.249 },
      { price: '7418.5' },
      { price: 7413.25 },
      { price: 'not-a-price' },
    ])).toEqual([7413.25, 7418.5]);
  });

  it('derives historical Ninja Saty levels from the same previous-close Barchart formula as the Pine parity replay', () => {
    const date = '2026-04-29';
    const levels = historicalSatyLevels(date);
    const direct = deriveLevelsByDate(loadIntraday('ES'), [date], { referenceField: 'close' })[date];
    const levelPrices = levels.map(level => level.price).sort((a, b) => a - b);
    const directPrices = [
      direct.atr_minus_1,
      direct.ext_minus_4,
      direct.ext_minus_3,
      direct.ext_minus_2,
      direct.ext_minus_1,
      direct.put_trigger,
      direct.prev_close,
      direct.call_trigger,
      direct.ext_plus_1,
      direct.ext_plus_2,
      direct.ext_plus_3,
      direct.ext_plus_4,
      direct.atr_plus_1,
    ].sort((a, b) => a - b);

    expect(direct.valid).toBe(true);
    expect(direct.reference_field).toBe('close');
    expect(direct.formula_provenance).toBe('Saty_Pine_D_session_extended_close1_atr14_1');
    expect(levelPrices).toEqual(directPrices);
  });
});
