'use strict';

const fs = require('fs');
const path = require('path');

const { buildTradeDecision, _internal } = require('../lib/decision-spine');

const LUKE_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(LUKE_ROOT, 'data');
const LEVEL_MEMORY_FILE = path.join(DATA_DIR, 'level-memory.json');
const DUBZ_LEVELS_FILE = path.join(DATA_DIR, 'dubz-levels.json');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const TODAY_LEVELS_FILE = path.join(DATA_DIR, 'today-levels.json');
const SATY_LEVELS_FILE = path.join(DATA_DIR, 'saty-levels.json');

function todayEt(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function todayCt(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function backupFiles(files) {
  const out = new Map();
  for (const file of files) {
    out.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  }
  return out;
}

function restoreFiles(snapshot) {
  for (const [file, original] of snapshot.entries()) {
    if (original === null) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, original, 'utf8');
    }
  }
}

function mention(analyst, timestamp, fields = {}) {
  return {
    analyst,
    date: todayEt(new Date(timestamp)),
    timestamp,
    significance: fields.significance ?? 'unclear',
    direction: fields.direction ?? null,
    intent: fields.intent ?? null,
    source_type: fields.source_type ?? 'text',
    source_snippet: fields.source_snippet ?? null,
    crossSourceConfirmed: fields.crossSourceConfirmed === true,
  };
}

function level(price, instrument, mentions) {
  return {
    canonical_price: price,
    instrument,
    first_seen: mentions[0]?.timestamp || new Date().toISOString(),
    last_seen: mentions[0]?.timestamp || new Date().toISOString(),
    total_mentions: mentions.length,
    mentions,
  };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function writeFreshInputs(now = new Date()) {
  const ts = now.toISOString();
  writeJson(SATY_LEVELS_FILE, {
    valid: true,
    updated: ts,
    put_trigger: 6809,
    call_trigger: 6860,
    prev_close: 6830,
  });
  writeJson(DUBZ_LEVELS_FILE, {
    date: todayEt(now),
    last_updated: ts,
    source_pastes: [],
    instruments: {
      ES: { levels: [{ price: 6809 }] },
      NQ: { levels: [] },
      SPY: { levels: [] },
      QQQ: { levels: [] },
    },
    conflicts: [],
    parse_errors: [],
  });
  writeJson(DAILY_CTX_FILE, {
    date: todayCt(now),
    heatmap: { source: 'test', stored_at: ts },
  });
}

function writeMemory(levels) {
  writeJson(LEVEL_MEMORY_FILE, {
    version: 1,
    last_updated: new Date().toISOString(),
    levels,
  });
}

function actionableLevels(now = new Date()) {
  const ts = now.toISOString();
  return [
    level(6809, 'ES', [
      mention('dubz', ts, { significance: 'key', direction: 'support', crossSourceConfirmed: true }),
      mention('bobby', ts, { significance: 'key', direction: 'support', source_type: 'vision' }),
      mention('saty', ts, { significance: 'key', source_type: 'saty_atr' }),
      mention('mancini', ts, { significance: 'key', intent: 'long_trigger' }),
    ]),
    level(6860, 'ES', [
      mention('mancini', ts, { significance: 'key', direction: 'resistance', intent: 'first_target' }),
    ]),
  ];
}

describe('decision spine buildTradeDecision', () => {
  let originals;

  beforeEach(() => {
    originals = backupFiles([
      LEVEL_MEMORY_FILE,
      DUBZ_LEVELS_FILE,
      DAILY_CTX_FILE,
      TODAY_LEVELS_FILE,
      SATY_LEVELS_FILE,
    ]);
  });

  afterEach(() => {
    restoreFiles(originals);
  });

  it('exists and returns a structured stale-input refusal', () => {
    for (const file of [LEVEL_MEMORY_FILE, DUBZ_LEVELS_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE, SATY_LEVELS_FILE]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    const decision = buildTradeDecision({ instrument: 'ES', currentPrice: 6810 });

    expect(decision).toEqual(expect.objectContaining({
      ok: false,
      action: 'PASS',
      instrument: 'ES',
      entry: null,
      acceptable_entry: null,
      stop: null,
      target: null,
      sizing: 'pass',
      confluence: null,
      freshness: expect.any(Object),
      vetoes: expect.any(Array),
      evidence: expect.any(Array),
    }));
    expect(decision.vetoes.map(v => v.source)).toEqual(['bobby']);
    expect(decision.freshness.saty).toEqual(expect.objectContaining({
      loaded: true,
      generated: true,
      source: 'previous_close_levels',
    }));
  });

  it('recognizes fresh same-day Saty, Bobby, and Dubz context', () => {
    const now = new Date();
    writeFreshInputs(now);
    writeMemory(actionableLevels(now));

    const freshness = _internal.buildFreshness(now);

    expect(freshness.saty.loaded).toBe(true);
    expect(freshness.bobby.loaded).toBe(true);
    expect(freshness.dubz.loaded).toBe(true);
    expect(freshness.dubz.count).toBe(1);
    expect(freshness.dubz.same_day).toBe(true);
  });

  it('carries forward Dubz structural levels across days until manually replaced or deleted', () => {
    const now = new Date('2026-05-02T15:00:00.000Z');
    writeFreshInputs(now);
    const oldTs = '2026-04-29T14:00:00.000Z';
    writeJson(DUBZ_LEVELS_FILE, {
      date: '2026-04-29',
      last_updated: oldTs,
      source_pastes: [],
      instruments: {
        ES: { levels: [{ price: 6809 }] },
        NQ: { levels: [] },
        SPY: { levels: [] },
        QQQ: { levels: [] },
      },
      conflicts: [],
      parse_errors: [],
    });

    const freshness = _internal.buildFreshness(now);

    expect(freshness.dubz.loaded).toBe(true);
    expect(freshness.dubz.count).toBe(1);
    expect(freshness.dubz.same_day).toBe(false);
    expect(freshness.dubz.persistence).toBe('structural_carry_forward_until_deleted');
  });

  it('builds an actionable structured decision from the best confluence anchor', () => {
    const now = new Date();
    writeFreshInputs(now);
    writeMemory(actionableLevels(now));

    const decision = buildTradeDecision({ instrument: 'ES', mode: 'manual', currentPrice: 6810, now });

    expect(decision.ok).toBe(true);
    expect(decision.action).toBe('LONG');
    expect(decision.entry).toBe(6809.25);
    expect(decision.acceptable_entry).toBe(6809.75);
    expect(decision.stop).toBeLessThan(decision.entry);
    expect(decision.target).toBe(6860);
    expect(decision.sizing).toBe('full');
    expect(decision.confluence).toEqual(expect.objectContaining({
      anchor: 6809,
      grade: 'A',
      score: 1,
    }));
    expect(decision.vetoes).toEqual([]);
  });

  it('returns PASS when the best entry sits inside Mancini chop boundaries', () => {
    const now = new Date();
    const ts = now.toISOString();
    writeFreshInputs(now);
    writeMemory([
      ...actionableLevels(now),
      level(6793, 'ES', [
        mention('mancini', ts, { intent: 'chop_boundary', source_snippet: '6793 to 6830 = pure chop' }),
      ]),
      level(6830, 'ES', [
        mention('mancini', ts, { intent: 'chop_boundary', source_snippet: '6793 to 6830 = pure chop' }),
      ]),
    ]);

    const decision = buildTradeDecision({ instrument: 'ES', currentPrice: 6810, now });

    expect(decision.ok).toBe(false);
    expect(decision.action).toBe('PASS');
    expect(decision.reason).toContain('Mancini chop zone 6793-6830');
    expect(decision.vetoes).toEqual([
      expect.objectContaining({ type: 'mancini_chop_zone', zone: { low: 6793, high: 6830 } }),
    ]);
    expect(decision.sizing).toBe('pass');
  });

  it('keeps Apex floor risk as a blocker in the structured decision', () => {
    const now = new Date();
    writeFreshInputs(now);
    writeMemory(actionableLevels(now));

    const decision = buildTradeDecision({
      instrument: 'ES',
      currentPrice: 6810,
      now,
      state: {
        total_eval_pnl: 0,
        apex: {
          enabled: true,
          account_start: 50000,
          eod_threshold: 49990,
        },
      },
    });

    expect(decision.ok).toBe(false);
    expect(decision.action).toBe('PASS');
    expect(decision.reason).toContain('Apex floor blocked');
    expect(decision.vetoes[0].type).toBe('apex_floor');
  });
});
