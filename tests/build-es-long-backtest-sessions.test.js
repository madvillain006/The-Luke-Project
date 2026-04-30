'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  dateAdd,
  isRthBar,
  isOvernightBarForSession,
  splitEsBarsForSession,
  normalizeSatyLevels,
  buildSession,
  buildSessionsFromInputs,
} = require('../scripts/build-es-long-backtest-sessions');

function bar(timestamp, open = 100, high = 101, low = 99, close = 100.5) {
  return { timestamp, open, high, low, close, volume: 10 };
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

describe('build-es-long-backtest-sessions helpers', () => {
  it('adds and subtracts calendar dates in UTC-safe format', () => {
    expect(dateAdd('2026-04-29', -1)).toBe('2026-04-28');
    expect(dateAdd('2026-04-29', 1)).toBe('2026-04-30');
  });

  it('identifies RTH bars as 09:30 through 16:00 ET', () => {
    expect(isRthBar(bar('2026-04-29T09:29:00-04:00'))).toBe(false);
    expect(isRthBar(bar('2026-04-29T09:30:00-04:00'))).toBe(true);
    expect(isRthBar(bar('2026-04-29T16:00:00-04:00'))).toBe(true);
    expect(isRthBar(bar('2026-04-29T16:01:00-04:00'))).toBe(false);
  });

  it('assigns prior evening and current premarket bars to session overnight', () => {
    expect(isOvernightBarForSession(bar('2026-04-28T18:00:00-04:00'), '2026-04-29')).toBe(true);
    expect(isOvernightBarForSession(bar('2026-04-29T09:29:00-04:00'), '2026-04-29')).toBe(true);
    expect(isOvernightBarForSession(bar('2026-04-29T09:30:00-04:00'), '2026-04-29')).toBe(false);
  });

  it('splits session ES bars into overnight and RTH buckets', () => {
    const bars = [
      bar('2026-04-28T17:59:00-04:00'),
      bar('2026-04-28T18:00:00-04:00'),
      bar('2026-04-29T09:29:00-04:00'),
      bar('2026-04-29T09:30:00-04:00'),
      bar('2026-04-29T16:00:00-04:00'),
      bar('2026-04-29T16:01:00-04:00'),
    ];
    const split = splitEsBarsForSession(bars, '2026-04-29');
    expect(split.overnightBars.map(b => b.timestamp)).toEqual([
      '2026-04-28T18:00:00-04:00',
      '2026-04-29T09:29:00-04:00',
    ]);
    expect(split.rthBars.map(b => b.timestamp)).toEqual([
      '2026-04-29T09:30:00-04:00',
      '2026-04-29T16:00:00-04:00',
    ]);
  });

  it('normalizes only valid Saty outputs into levels', () => {
    expect(normalizeSatyLevels({ valid: false })).toBeNull();
    const saty = normalizeSatyLevels({
      valid: true,
      call_trigger: 7200,
      put_trigger: 7100,
      call_levels: [{ price: 7210, label: '0.236' }],
    });
    expect(saty.normalizedLevels.map(l => l.price)).toEqual([7100, 7200, 7210]);
  });

  it('builds a usable long-only session with context and deduped levels', () => {
    const session = buildSession({
      date: '2026-04-29',
      esBars: [
        bar('2026-04-28T18:00:00-04:00'),
        bar('2026-04-29T09:30:00-04:00'),
      ],
      bobbyMessages: [{ id: 'b1', levelCandidates: [7200, 7210] }],
      bobbyImages: [{ messageId: 'b1', status: 'local_matched' }],
      manciniPosts: [
        { postIndex: 1, timestampConfidence: 'high', levels: [{ price: 7200, role: 'target' }] },
        { postIndex: 2, timestampConfidence: 'low', levels: [{ price: 7190, role: 'support' }] },
      ],
      satyByDate: { '2026-04-29': { valid: true, call_trigger: 7220, put_trigger: 7180 } },
    });

    expect(session.usable).toBe(true);
    expect(session.excludedReason).toBeNull();
    expect(session.bars.counts.overnight).toBe(1);
    expect(session.bars.counts.rth).toBe(1);
    expect(session.mancini.counts.entryReady).toBe(1);
    expect(session.mancini.counts.lowConfidence).toBe(1);
    expect(session.levels.map(l => l.price)).toEqual([7180, 7200, 7210, 7220]);
  });

  it('marks sessions without RTH data as excluded', () => {
    const session = buildSession({
      date: '2026-04-29',
      esBars: [bar('2026-04-28T18:00:00-04:00')],
    });
    expect(session.usable).toBe(false);
    expect(session.excludedReason).toContain('missing_es_rth_bars');
  });
});

describe('buildSessionsFromInputs', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-sessions-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes one session file per target date plus reports', () => {
    const derived = path.join(tmp, 'derived');
    const sessions = path.join(tmp, 'sessions');
    fs.mkdirSync(derived, { recursive: true });

    writeJsonl(path.join(derived, 'bobby-messages.jsonl'), [
      { id: 'b1', tradingDateET: '2026-04-29', levelCandidates: [7200] },
    ]);
    writeJsonl(path.join(derived, 'bobby-image-cache.jsonl'), [
      { messageId: 'b1', tradingDateET: '2026-04-29', status: 'local_matched' },
    ]);
    writeJsonl(path.join(derived, 'mancini-posts.jsonl'), [
      { postIndex: 1, estimatedDate: '2026-04-29', timestampConfidence: 'high', levels: [{ price: 7210 }] },
      { postIndex: 2, estimatedDate: null, timestampConfidence: 'low', levels: [{ price: 7000 }] },
    ]);
    fs.writeFileSync(path.join(derived, 'saty-levels-by-date.json'), JSON.stringify({
      '2026-04-29': { valid: true, call_trigger: 7220, put_trigger: 7180 },
    }), 'utf8');

    const esBars = [
      bar('2026-04-28T18:00:00-04:00'),
      bar('2026-04-29T09:30:00-04:00'),
    ];

    const { report } = buildSessionsFromInputs({ derivedDir: derived, sessionsDir: sessions, esBars });

    expect(report.summary.totalSessions).toBe(1);
    expect(report.summary.eligibleSessions).toBe(1);
    expect(fs.existsSync(path.join(sessions, '2026-04-29.json'))).toBe(true);
    expect(fs.existsSync(path.join(derived, 'session-build-report.json'))).toBe(true);
    expect(fs.existsSync(path.join(derived, 'session-build-report.md'))).toBe(true);
  });
});
