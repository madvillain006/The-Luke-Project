const {
  activeNativeLevel,
  exportNativeLevels,
  loadDailyPlanLevels,
  renderNativeLevelFile,
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

  it('loads corrected daily-plan Mancini levels and renders context without making every context line executable', () => {
    const daily = loadDailyPlanLevels();
    expect(daily.date).toBe('2026-05-08');
    expect(daily.target_session).toBe('2026-05-11');
    expect(daily.levels.trade).toContain(7391);
    expect(daily.levels.trade).toContain(7402);
    expect(daily.levels.target_only).toContain(7434);
    expect(daily.levels.target_only).toContain(7462);

    const text = renderNativeLevelFile({ dailyPlan: daily, generatedAt: '2026-05-08T00:00:00.000Z', includeContext: true });
    expect(text).toContain('trade: ');
    expect(text).toContain('target_only: ');
    expect(text).toContain('read_reaction: ');
    expect(text).toContain('target_session: 2026-05-11 ES');
    expect(text).toContain('Strategy parser trades only the trade/mancini section');
  });

  it('selects Mancini trade levels by explicit target session for replay dates', () => {
    const daily = loadDailyPlanLevels({ targetSession: '2026-05-11' });

    expect(daily.date).toBe('2026-05-08');
    expect(daily.target_session).toBe('2026-05-11');
    expect(daily.levels.trade).toContain(7391);
    expect(daily.levels.trade).toContain(7402);
  });

  it('fails closed instead of reusing stale levels for an unknown target session', () => {
    expect(() => loadDailyPlanLevels({ targetSession: '2026-05-12' }))
      .toThrow('No Mancini daily plan found for target session 2026-05-12');
  });

  it('uses --historical-date as the Mancini target session instead of emitting Saty-only levels', () => {
    const result = exportNativeLevels({ historicalDate: '2026-05-11', includeContext: true });

    expect(result.source).toBe('mancini_daily_plan');
    expect(result.target_session).toBe('2026-05-11');
    expect(result.daily_plan.date).toBe('2026-05-08');
    expect(result.by_family.saty || 0).toBe(0);
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
