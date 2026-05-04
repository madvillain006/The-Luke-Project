'use strict';

const {
  executableRowsForFact,
  buildLevelLadder,
  rankTargetCandidates,
} = require('../lib/research/fake-breakdown-v2/level-ladder');

const esBars = [
  { timestamp: '2026-04-08T15:59:00-04:00', open: 5018, high: 5020, low: 5017, close: 5019 },
  { timestamp: '2026-04-09T09:30:00-04:00', open: 5030, high: 5032, low: 5029, close: 5031 },
  { timestamp: '2026-04-09T09:45:00-04:00', open: 5032, high: 5034, low: 5031, close: 5033 },
  { timestamp: '2026-04-09T10:00:00-04:00', open: 5040, high: 5042, low: 5038, close: 5041 },
];

const spxBars = [
  { timestamp: '2026-04-08T15:59:00-04:00', open: 4998, high: 5000, low: 4997, close: 4999 },
  { timestamp: '2026-04-09T09:30:00-04:00', open: 5000, high: 5002, low: 4999, close: 5001 },
  { timestamp: '2026-04-09T09:45:00-04:00', open: 5002, high: 5004, low: 5001, close: 5003 },
  { timestamp: '2026-04-09T10:00:00-04:00', open: 5010, high: 5012, low: 5008, close: 5011 },
];

function fact(fields) {
  return {
    id: fields.id,
    source: fields.source,
    role: fields.role || 'level',
    level_type: fields.level_type || `${fields.source}_level`,
    original_level: fields.price,
    original_level_instrument: fields.instrument || 'ES',
    available_at_et: fields.available_at_et || '2026-04-09T09:25:00-04:00',
    raw_path: 'fixture',
  };
}

describe('fake breakdown v2 level ladder', () => {
  it('keeps SPX reference-only when basis conversion is not requested', () => {
    const rows = executableRowsForFact({
      fact: fact({ id: 'spx', source: 'bobby', instrument: 'SPX', price: 5005 }),
      timestamp: '2026-04-09T10:00:00-04:00',
      esBars,
      spxBars,
      allowSpxBasis: false,
      basisMethods: ['reference_only'],
    });
    expect(rows[0]).toEqual(expect.objectContaining({ basis_method: 'reference_only', executable: false, executable_level: null }));
  });

  it('supports explicit same-minute, session-open, rolling, and diagnostic fixed +30 basis', () => {
    const spxFact = fact({ id: 'spx', source: 'bobby', instrument: 'SPX', price: 5005 });
    const rows = executableRowsForFact({
      fact: spxFact,
      timestamp: '2026-04-09T10:00:00-04:00',
      esBars,
      spxBars,
      allowSpxBasis: true,
      basisMethods: ['same_minute_basis', 'session_open_basis', 'rolling_15m_basis', 'fixed_plus_30_proxy'],
    });
    expect(rows.find(row => row.basis_method === 'same_minute_basis')).toEqual(expect.objectContaining({ executable_level: 5035, executable: true }));
    expect(rows.find(row => row.basis_method === 'session_open_basis')).toEqual(expect.objectContaining({ executable_level: 5035, executable: true }));
    expect(rows.find(row => row.basis_method === 'rolling_15m_basis').executable_level).toBeGreaterThan(5034);
    expect(rows.find(row => row.basis_method === 'fixed_plus_30_proxy')).toEqual(expect.objectContaining({
      basis_diagnostic_only: true,
      executable: false,
      executable_level: null,
      diagnostic_level: 5035,
    }));
  });

  it('builds below/current/above ladder and ranks Saty, Mancini, Bobby, and GEX targets above entry', () => {
    const setup = {
      date: '2026-04-09',
      timestamp_et: '2026-04-09T10:00:00-04:00',
      executable_level: 100,
      source_combo: 'saty',
      level_type: 'put_trigger',
      inside_chop: false,
    };
    const facts = [
      fact({ id: 'below', source: 'saty', price: 98, level_type: 'put_trigger' }),
      fact({ id: 'saty', source: 'saty', price: 104, level_type: 'ext_plus_1' }),
      fact({ id: 'mancini', source: 'mancini', price: 106, level_type: 'mancini_target' }),
      fact({ id: 'bobby', source: 'bobby', price: 108, level_type: 'bobby_king_node' }),
      fact({ id: 'gex', source: 'gex', price: 110, level_type: 'gex_magnet' }),
    ];
    const ladder = buildLevelLadder({ setup, facts, timestamp: setup.timestamp_et, esBars, spxBars });
    expect(ladder.below[0].executable_level).toBe(98);
    expect(ladder.above.map(row => row.source)).toEqual(['saty', 'mancini', 'bobby', 'gex']);
    expect(rankTargetCandidates({ ladder, entryPrice: 100, minDistance: 3 })[0]).toEqual(expect.objectContaining({ source: 'saty', target_price: 104 }));
  });
});
