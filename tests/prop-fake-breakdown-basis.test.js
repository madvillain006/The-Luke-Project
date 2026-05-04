'use strict';

const {
  calculateBasis,
  convertSpxLevel,
} = require('../lib/research/prop-fake-breakdown/basis');

describe('prop fake breakdown basis', () => {
  const esBars = [
    { timestamp: '2026-04-08T15:59:00-04:00', open: 4110, close: 4111 },
    { timestamp: '2026-04-09T09:30:00-04:00', open: 4100, close: 4102 },
    { timestamp: '2026-04-09T09:45:00-04:00', open: 4110, close: 4110 },
  ];
  const spxBars = [
    { timestamp: '2026-04-08T15:59:00-04:00', open: 4080, close: 4081 },
    { timestamp: '2026-04-09T09:30:00-04:00', open: 4070, close: 4071 },
    { timestamp: '2026-04-09T09:45:00-04:00', open: 4080, close: 4082 },
  ];

  it('calculates same-minute basis without future bars', () => {
    const basis = calculateBasis({ method: 'same_minute_basis', timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars });
    expect(basis.basis).toBe(28);
    expect(basis.diagnostic_only).toBe(false);
  });

  it('calculates session-open, prior-close, and rolling 15m basis', () => {
    expect(calculateBasis({ method: 'session_open_basis', timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars }).basis).toBe(30);
    expect(calculateBasis({ method: 'prior_close_basis', timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars }).basis).toBe(30);
    expect(calculateBasis({ method: 'rolling_15m_basis', timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars }).basis).toBe(29.5);
  });

  it('marks fixed +30 as diagnostic only and missing basis as reference-only/unavailable', () => {
    expect(calculateBasis({ method: 'fixed_plus_30_proxy', timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars }).diagnostic_only).toBe(true);
    const missing = calculateBasis({ method: 'same_minute_basis', timestamp: '2026-04-09T10:00:00-04:00', esBars, spxBars });
    expect(missing.available).toBe(false);
    const reference = convertSpxLevel({ spxLevel: 4070, timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars, method: 'reference_only' });
    expect(reference.executable).toBe(false);
  });

  it('does not silently substitute SPX as ES', () => {
    const converted = convertSpxLevel({ spxLevel: 4070, timestamp: '2026-04-09T09:45:00-04:00', esBars, spxBars, method: 'same_minute_basis' });
    expect(converted.executable_level).toBe(4098);
    expect(converted.executable_level).not.toBe(4070);
    expect(converted.method).toBe('same_minute_basis');
  });
});
