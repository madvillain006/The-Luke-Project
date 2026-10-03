const fs = require('fs');
const path = require('path');
const {
  activeNativeLevel,
  exportNativeLevels,
  loadCentralManciniEventLevels,
  loadDailyPlanLevels,
  renderNativeLevelFile,
  historicalSatyLevels,
  uniqueSortedPrices,
} = require('../scripts/export-ninja-native-levels');
const { loadIntraday, _internal: historicalInternal } = require('../lib/historical-data');
const { deriveLevelsByDate } = require('../lib/backtest-data/saty-historical');
const { createChartLevelFixtures } = require('./helpers/ci-chart-level-fixtures');

describe('Ninja-native level export', () => {
  let fixture;

  beforeEach(() => {
    fixture = createChartLevelFixtures();
    historicalInternal._setHistoricalRoot(fixture.historicalDir);
    // This exporter has an absolute default for the central CSV. Redirect only
    // that read to a synthetic input; all other filesystem behavior is real.
    const defaultCsv = path.resolve(__dirname, '../artifacts/research/mancini-context-protocol/events.csv');
    const existsSync = fs.existsSync.bind(fs);
    const readFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, 'existsSync').mockImplementation(file => existsSync(String(file) === defaultCsv ? fixture.centralCsv : file));
    vi.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => readFileSync(String(file) === defaultCsv ? fixture.centralCsv : file, ...args));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    historicalInternal._resetHistoricalRoot();
    fixture.cleanup();
  });

  function tempLevelFile() {
    return path.join(fixture.root, 'output', 'levels.txt');
  }

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
    const daily = loadDailyPlanLevels({ rootDir: fixture.root });
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
    expect(text).toContain('last matching tag wins');
    expect(text.indexOf('read_reaction: ')).toBeLessThan(text.indexOf('trade: '));
    expect(text.indexOf('trigger: ')).toBeLessThan(text.indexOf('major: '));
  });

  it('selects Mancini trade levels by explicit target session for replay dates', () => {
    const daily = loadDailyPlanLevels({ rootDir: fixture.root, targetSession: '2026-05-11' });

    expect(daily.date).toBe('2026-05-08');
    expect(daily.target_session).toBe('2026-05-11');
    expect(daily.levels.trade).toContain(7391);
    expect(daily.levels.trade).toContain(7402);
  });

  it('loads current Mancini levels from the centralized event ledger', () => {
    const central = loadCentralManciniEventLevels({ rootDir: fixture.root, csvPath: fixture.centralCsv, targetSession: '2026-05-14' });

    expect(central.target_session).toBe('2026-05-14');
    expect(central.file_path).toContain('mancini-context-protocol');
    expect(central.levels.trade).toContain(7467);
    expect(central.levels.trade).toContain(7455);
    expect(central.levels.trade).toContain(7111);
    expect(central.levels.trade.length).toBe(48);
    expect(central.levels.trade).toEqual([...fixture.centralPrices].sort((a, b) => a - b));
    expect(central.levels.trade).not.toContain(7991);
    expect(central.levels.trade).not.toContain(7992);
    expect(central.levels.trade).not.toContain(7993);
  });

  it('prefers the centralized event ledger for native level exports', () => {
    const result = exportNativeLevels({ rootDir: fixture.root, targetSession: '2026-05-14', includeContext: true, outFile: tempLevelFile() });

    expect(result.source).toBe('mancini_event_csv');
    expect(result.target_session).toBe('2026-05-14');
    expect(result.daily_plan.trade).toBe(48);
    expect(result.prices).toBe(48);
  });

  it('fails closed instead of reusing stale levels for an unknown target session', () => {
    expect(() => loadDailyPlanLevels({ rootDir: fixture.root, targetSession: '2026-05-12' }))
      .toThrow('No Mancini daily plan found for target session 2026-05-12');
  });

  it('uses --historical-date as the Mancini target session instead of emitting Saty-only levels', () => {
    const result = exportNativeLevels({ rootDir: fixture.root, historicalDate: '2026-05-11', includeContext: true, outFile: tempLevelFile() });

    expect(['mancini_event_csv', 'mancini_daily_plan']).toContain(result.source);
    expect(result.target_session).toBe('2026-05-11');
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
    expect(direct.reference_date).toBe('2026-04-28');
    expect(direct.prev_close).toBe(7009.75);
    expect(direct.atr_value).toBe(20);
    expect(levelPrices[0]).toBe(6989.75);
    expect(levelPrices.at(-1)).toBe(7029.75);
    expect(levelPrices).toEqual(directPrices);
  });
});
