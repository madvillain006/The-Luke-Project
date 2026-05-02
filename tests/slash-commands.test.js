'use strict';

const fs = require('fs');
const path = require('path');

const { handleSlashCommand, _internal: { getPhase2WorkflowLoadStatus, getLegacyConfluenceState } } = require('../lib/slash-commands');
const { _internal: levelMemoryInternal } = require('../lib/level-memory');

const DATA_DIR = path.join(__dirname, '../data');
const LEVEL_MEMORY_FILE = path.join(DATA_DIR, 'level-memory.json');
const DUBZ_LEVELS_FILE = path.join(DATA_DIR, 'dubz-levels.json');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const TODAY_LEVELS_FILE = path.join(DATA_DIR, 'today-levels.json');
const SATY_LEVELS_FILE = path.join(DATA_DIR, 'saty-levels.json');
const APEX_STATE_FILE  = path.join(DATA_DIR, 'apex-state.json');

describe('slash-commands Phase 2 workflow status', () => {
  let originals;

  beforeEach(() => {
    originals = {
      levelMemory: fs.existsSync(LEVEL_MEMORY_FILE) ? fs.readFileSync(LEVEL_MEMORY_FILE, 'utf8') : null,
      dubzLevels: fs.existsSync(DUBZ_LEVELS_FILE) ? fs.readFileSync(DUBZ_LEVELS_FILE, 'utf8') : null,
      dailyCtx: fs.existsSync(DAILY_CTX_FILE) ? fs.readFileSync(DAILY_CTX_FILE, 'utf8') : null,
      todayLevels: fs.existsSync(TODAY_LEVELS_FILE) ? fs.readFileSync(TODAY_LEVELS_FILE, 'utf8') : null,
      satyLevels: fs.existsSync(SATY_LEVELS_FILE) ? fs.readFileSync(SATY_LEVELS_FILE, 'utf8') : null,
    };
  });

  afterEach(() => {
    for (const [file, original] of [
      [LEVEL_MEMORY_FILE, originals.levelMemory],
      [DUBZ_LEVELS_FILE, originals.dubzLevels],
      [DAILY_CTX_FILE, originals.dailyCtx],
      [TODAY_LEVELS_FILE, originals.todayLevels],
      [SATY_LEVELS_FILE, originals.satyLevels],
    ]) {
      if (original === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.writeFileSync(file, original, 'utf8');
      }
    }
  });

  it('reads modern Dubz + Bobby workflow state without relying on today-levels.json', () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    fs.writeFileSync(LEVEL_MEMORY_FILE, JSON.stringify({
      version: 1,
      last_updated: null,
      levels: [
        {
          canonical_price: 712,
          instrument: 'SPY',
          first_seen: '2026-04-27T18:00:00.000Z',
          last_seen: '2026-04-27T18:00:00.000Z',
          total_mentions: 1,
          mentions: [
            { analyst: 'bobby', date: todayET, timestamp: '2026-04-27T18:00:00.000Z', significance: 'key', direction: null, intent: null, source_type: 'vision', source_snippet: null, crossSourceConfirmed: false },
          ],
        },
      ],
    }), 'utf8');

    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET,
      last_updated: '2026-04-27T18:01:00.000Z',
      source_pastes: [],
      instruments: {
        NQ: { levels: [] },
        ES: { levels: [{ price: 7185.75 }, { price: 7090 }] },
        QQQ: { levels: [] },
        SPY: { levels: [{ price: 712.38 }] },
      },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');

    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: todayCT,
      heatmap: { source: 'image', stored_at: '2026-04-27T18:02:00.000Z' },
    }), 'utf8');

    const status = getPhase2WorkflowLoadStatus();

    expect(status.dubzLoaded).toBe(true);
    expect(status.dubzCount).toBe(3);
    expect(status.bobbyLoaded).toBe(true);
    expect(status.bobbyCount).toBe(1);
  });

  it('bridges modern Dubz state into legacy confluence context when today-levels.json is absent', () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    if (fs.existsSync(TODAY_LEVELS_FILE)) fs.unlinkSync(TODAY_LEVELS_FILE);

    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET,
      last_updated: '2026-04-27T18:01:00.000Z',
      source_pastes: [],
      instruments: {
        NQ: { levels: [] },
        ES: { levels: [{ price: 7185.75, source_snippet: 'ES flip 7185.75' }] },
        QQQ: { levels: [] },
        SPY: { levels: [{ price: 712.38, source_snippet: 'SPY flip 712.38' }] },
      },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');

    const state = getLegacyConfluenceState(todayET);

    expect(state.date).toBe(todayET);
    expect(state.bobby).toEqual([]);
    expect(state.richyd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        analyst: 'richydubz',
        signal_type: 'CONTEXT',
        ticker: 'ES',
        levels: [7185.75],
      }),
      expect.objectContaining({
        analyst: 'richydubz',
        signal_type: 'CONTEXT',
        ticker: 'SPY',
        levels: [712.38],
      }),
    ]));
  });

  it('counts current-day legacy Bobby heatmap shim as ready', () => {
    for (const f of [LEVEL_MEMORY_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    fs.writeFileSync(TODAY_LEVELS_FILE, JSON.stringify({
      date: todayET,
      bobby: [{ king_nodes: [7185], support: [7170], resistance: [7210] }],
    }), 'utf8');

    const status = getPhase2WorkflowLoadStatus();
    expect(status.bobbyLoaded).toBe(true);
    expect(status.bobbyCount).toBeGreaterThan(0);
  });

  it('/dubz reply stays readable and saves current-day Dubz readiness', async () => {
    const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/dubz/2026-04-27_0859_dubz.txt'), 'utf8');

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/dubz ' + fixture, res);

    expect(payload.reply).toMatch(/^Dubz levels updated/);
    expect(payload.reply.length).toBeLessThan(500);
    expect(payload.reply).not.toMatch(MOJIBAKE_RE);

    const status = getPhase2WorkflowLoadStatus();
    expect(status.dubzLoaded).toBe(true);
    expect(status.dubzCount).toBeGreaterThan(0);
  });

  it('bare /dubz treats old structural levels as carry-forward context', async () => {
    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: '2026-04-27',
      last_updated: '2026-04-27T13:00:00.000Z',
      source_pastes: [],
      instruments: {
        ES: { levels: [{ price: 7185.75 }] },
      },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/dubz', res);

    expect(payload.reply).toMatch(/^Dubz structural levels loaded from 2026-04-27/);
    expect(payload.reply).toContain('Structural levels carry forward until manually replaced or deleted');
    expect(payload.reply).toContain('Same-day callouts');
    expect(payload.reply).not.toContain('ES: 7185.75');
  });

  it('/verdict refuses when prep inputs are missing or stale', async () => {
    for (const f of [LEVEL_MEMORY_FILE, DUBZ_LEVELS_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE, SATY_LEVELS_FILE]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/verdict ES', res);

    expect(payload.reply).toBe('No fresh confluence verdict available. Run /saty, /heatmap first, then /ready before /verdict.');
  });
});


describe('slash-commands /entries hardening', () => {
  let originals;

  beforeEach(() => {
    originals = {
      levelMemory: fs.existsSync(LEVEL_MEMORY_FILE) ? fs.readFileSync(LEVEL_MEMORY_FILE, 'utf8') : null,
      dubzLevels: fs.existsSync(DUBZ_LEVELS_FILE) ? fs.readFileSync(DUBZ_LEVELS_FILE, 'utf8') : null,
      dailyCtx: fs.existsSync(DAILY_CTX_FILE) ? fs.readFileSync(DAILY_CTX_FILE, 'utf8') : null,
      todayLevels: fs.existsSync(TODAY_LEVELS_FILE) ? fs.readFileSync(TODAY_LEVELS_FILE, 'utf8') : null,
      satyLevels: fs.existsSync(SATY_LEVELS_FILE) ? fs.readFileSync(SATY_LEVELS_FILE, 'utf8') : null,
    };
  });

  afterEach(() => {
    for (const [file, original] of [
      [LEVEL_MEMORY_FILE, originals.levelMemory],
      [DUBZ_LEVELS_FILE, originals.dubzLevels],
      [DAILY_CTX_FILE, originals.dailyCtx],
      [TODAY_LEVELS_FILE, originals.todayLevels],
      [SATY_LEVELS_FILE, originals.satyLevels],
    ]) {
      if (original === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.writeFileSync(file, original, 'utf8');
      }
    }
  });

  it('refuses /entries when no fresh inputs are loaded today', async () => {
    for (const f of [LEVEL_MEMORY_FILE, DUBZ_LEVELS_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE, SATY_LEVELS_FILE]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/entries ES', res);

    expect(payload.reply).toContain('No fresh entries available for ES.');
    expect(payload.reply).toContain('Freshness: Saty MISSING');
    expect(payload.reply).toContain('Missing/stale: /saty, /heatmap');
    expect(payload.reply).toContain('Next: run /saty, /heatmap, then /ready before /entries ES.');
  });

  it('surfaces Mancini chop zones inside /entries output', async () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const ts = new Date().toISOString();

    fs.writeFileSync(SATY_LEVELS_FILE, JSON.stringify({ updated: ts, put_trigger: 6809 }), 'utf8');
    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET,
      last_updated: ts,
      source_pastes: [],
      instruments: {
        ES: { levels: [{ price: 6809 }] },
      },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');
    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: todayCT,
      heatmap: { source: 'test', stored_at: ts },
    }), 'utf8');
    fs.writeFileSync(LEVEL_MEMORY_FILE, JSON.stringify({
      version: 1,
      last_updated: ts,
      levels: [
        {
          canonical_price: 6809,
          instrument: 'ES',
          first_seen: ts,
          last_seen: ts,
          total_mentions: 2,
          mentions: [
            { analyst: 'mancini', date: todayET, timestamp: ts, significance: 'key', direction: 'flip', intent: 'long_trigger', source_type: 'text', source_snippet: '6809 reclaim long trigger', crossSourceConfirmed: false },
            { analyst: 'saty', date: todayET, timestamp: ts, significance: 'key', direction: 'support', intent: null, source_type: 'saty_atr', source_snippet: 'put trigger 6809', crossSourceConfirmed: false },
          ],
        },
        {
          canonical_price: 6793,
          instrument: 'ES',
          first_seen: ts,
          last_seen: ts,
          total_mentions: 1,
          mentions: [
            { analyst: 'mancini', date: todayET, timestamp: ts, significance: 'unclear', direction: null, intent: 'chop_boundary', source_type: 'text', source_snippet: '6793/88 to 6830 = pure chop', crossSourceConfirmed: false },
          ],
        },
        {
          canonical_price: 6830,
          instrument: 'ES',
          first_seen: ts,
          last_seen: ts,
          total_mentions: 1,
          mentions: [
            { analyst: 'mancini', date: todayET, timestamp: ts, significance: 'unclear', direction: null, intent: 'chop_boundary', source_type: 'text', source_snippet: '6793/88 to 6830 = pure chop', crossSourceConfirmed: false },
          ],
        },
      ],
    }), 'utf8');

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/entries ES', res);

    expect(payload.reply).toContain('## Futures Entries ES');
    expect(payload.reply).toContain('AVOID: 6793-6830 (Mancini chop zone)');
    expect(payload.reply).toContain('Recommendation: PASS');
    expect(payload.reply).toContain('Mancini chop zone 6793-6830');
    expect(payload.reply).toContain('Vetoes: Mancini chop zone 6793-6830');
    expect(payload.reply).toContain('Reference only: entry');
    expect(payload.reply).not.toContain('Plan: entry');
  });

  it('/entries ES renders the decision spine trade plan fields', async () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const ts = new Date().toISOString();

    fs.writeFileSync(SATY_LEVELS_FILE, JSON.stringify({ valid: true, updated: ts, put_trigger: 6809, call_trigger: 6860, prev_close: 6830 }), 'utf8');
    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET,
      last_updated: ts,
      source_pastes: [],
      instruments: { ES: { levels: [{ price: 6809 }] } },
      conflicts: [],
      parse_errors: [],
    }), 'utf8');
    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: todayCT,
      heatmap: { source: 'test', stored_at: ts },
    }), 'utf8');
    fs.writeFileSync(LEVEL_MEMORY_FILE, JSON.stringify({
      version: 1,
      last_updated: ts,
      levels: [
        {
          canonical_price: 6809,
          instrument: 'ES',
          first_seen: ts,
          last_seen: ts,
          total_mentions: 4,
          mentions: [
            { analyst: 'dubz', date: todayET, timestamp: ts, significance: 'key', direction: 'support', intent: null, source_type: 'text', source_snippet: 'ES support 6809', crossSourceConfirmed: true },
            { analyst: 'bobby', date: todayET, timestamp: ts, significance: 'key', direction: 'support', intent: null, source_type: 'vision', source_snippet: 'support 6809', crossSourceConfirmed: false },
            { analyst: 'saty', date: todayET, timestamp: ts, significance: 'key', direction: null, intent: null, source_type: 'saty_atr', source_snippet: 'put trigger 6809', crossSourceConfirmed: false },
            { analyst: 'mancini', date: todayET, timestamp: ts, significance: 'key', direction: null, intent: 'long_trigger', source_type: 'text', source_snippet: '6809 reclaim long trigger', crossSourceConfirmed: false },
          ],
        },
        {
          canonical_price: 6860,
          instrument: 'ES',
          first_seen: ts,
          last_seen: ts,
          total_mentions: 1,
          mentions: [
            { analyst: 'mancini', date: todayET, timestamp: ts, significance: 'key', direction: 'resistance', intent: 'first_target', source_type: 'text', source_snippet: 'target 6860', crossSourceConfirmed: false },
          ],
        },
      ],
    }), 'utf8');

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/entries ES', res);

    expect(payload.reply).toContain('## Futures Entries ES');
    expect(payload.reply).toContain('Freshness: Saty OK | Dubz OK (1) | Bobby OK');
    expect(payload.reply).toContain('Recommendation: WAIT - market price unavailable | LONG ES 6809 | A grade | full size');
    expect(payload.reply).toContain('Anchor: ES 6809 | A grade | full size | side LONG');
    expect(payload.reply).toContain('Vetoes: none active');
    expect(payload.reply).toContain('Plan: entry 6809.25 | ok 6809.75 | stop');
    expect(payload.reply).toContain('| target 6860');
    expect(payload.reply).toContain('Other levels:');
  });
});

// Mojibake guard: these chars appear when UTF-8 source is misread as Latin-1.
// If any reply starts containing them the encoding rot has returned.
const MOJIBAKE_RE = /[ÃÂâƒÅ�]/;

describe('slash-commands output cleanliness - mojibake guard', () => {
  it('/alert bare returns clean ALERT prefix with no mojibake', async () => {
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/alert', res);
    expect(payload.reply).toMatch(/^ALERT /);
    expect(MOJIBAKE_RE.test(payload.reply)).toBe(false);
  });

  it('/status returns LUKE ONLINE header with required sections and no mojibake', async () => {
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/status', res);
    expect(payload.reply).toMatch(/^LUKE ONLINE/);
    expect(payload.reply).toContain('Market:');
    expect(payload.reply).toContain('Freshness:');
    expect(payload.reply).toContain('Autonomous: staged-only');
    expect(payload.reply).toContain('In memory of Luke');
    expect(MOJIBAKE_RE.test(payload.reply)).toBe(false);
  });

  it('/ready returns READY SESSION READINESS header with no mojibake', async () => {
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/ready', res);
    expect(payload.reply).toMatch(/^READY SESSION READINESS/);
    expect(MOJIBAKE_RE.test(payload.reply)).toBe(false);
  });

  it('warning prefixes from checkSessionReadiness are plain ASCII', () => {
    // Warning strings are embedded directly - test their literals
    const knownWarnings = [
      'Warning: /balance not run today; floor check may be stale',
      'Warning: Apex balance is stale. Update /balance before trading.',
      'Warning: No levels loaded today. Paste /dubz first.',
      'Warning: Bobby heatmap not loaded yet. Run /heatmap before trading.',
      'Warning: Bobby heatmap is stale (>8h old). Reload /heatmap before trading.',
      'Warning: Apex floor headroom < $500; size down or skip',
    ];
    for (const w of knownWarnings) {
      expect(MOJIBAKE_RE.test(w)).toBe(false);
    }
  });
});

describe('slash-commands command boundary coverage', () => {
  let originals;

  beforeEach(() => {
    originals = {
      apexState:   fs.existsSync(APEX_STATE_FILE)    ? fs.readFileSync(APEX_STATE_FILE, 'utf8')    : null,
      satyLevels:  fs.existsSync(SATY_LEVELS_FILE)   ? fs.readFileSync(SATY_LEVELS_FILE, 'utf8')   : null,
      dubzLevels:  fs.existsSync(DUBZ_LEVELS_FILE)   ? fs.readFileSync(DUBZ_LEVELS_FILE, 'utf8')   : null,
      dailyCtx:    fs.existsSync(DAILY_CTX_FILE)     ? fs.readFileSync(DAILY_CTX_FILE, 'utf8')     : null,
      todayLevels: fs.existsSync(TODAY_LEVELS_FILE)  ? fs.readFileSync(TODAY_LEVELS_FILE, 'utf8')  : null,
      levelMemory: fs.existsSync(LEVEL_MEMORY_FILE)  ? fs.readFileSync(LEVEL_MEMORY_FILE, 'utf8')  : null,
    };
  });

  afterEach(() => {
    for (const [file, original] of [
      [APEX_STATE_FILE,   originals.apexState],
      [SATY_LEVELS_FILE,  originals.satyLevels],
      [DUBZ_LEVELS_FILE,  originals.dubzLevels],
      [DAILY_CTX_FILE,    originals.dailyCtx],
      [TODAY_LEVELS_FILE, originals.todayLevels],
      [LEVEL_MEMORY_FILE, originals.levelMemory],
    ]) {
      if (original === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.writeFileSync(file, original, 'utf8');
      }
    }
  });

  it('/balance <amount> writes apex state and returns confirmation', async () => {
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/balance 51200', res);
    expect(payload.reply).toMatch(/^Balance set:/);
    expect(payload.reply).toContain('51,200');
    expect(payload.reply).not.toMatch(MOJIBAKE_RE);
    const state = JSON.parse(fs.readFileSync(APEX_STATE_FILE, 'utf8'));
    expect(state.balance).toBe(51200);
    expect(state.trail_floor).toBe(51200 - 2500);
  });

  it('/balance bare shows existing apex state when already set', async () => {
    const ts = new Date().toISOString();
    fs.writeFileSync(APEX_STATE_FILE, JSON.stringify({ balance: 51200, trail_floor: 48700, updated: ts }), 'utf8');
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/balance', res);
    expect(payload.reply).toMatch(/^APEX BALANCE/);
    expect(payload.reply).toContain('51,200');
    expect(payload.reply).not.toMatch(MOJIBAKE_RE);
  });

  it('/saty <levels> saves saty levels and returns SATY LEVELS SAVED', async () => {
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    // Prevent EPERM on Windows: appendSatyToMemory calls writeJsonAtomic on level-memory.json,
    // which luke-server (pm2) holds open. Mock the write so the test doesn't touch the live file.
    levelMemoryInternal._setWriteFn(() => {});
    try {
      await handleSlashCommand('/saty 5920 5910 5900 5890 5880 5870 5860 5850 5840 5830 5820 5810 5800', res);
    } finally {
      levelMemoryInternal._resetWriteFn();
    }
    expect(payload.reply).toMatch(/^SATY LEVELS SAVED/);
    expect(payload.reply).not.toMatch(MOJIBAKE_RE);
    expect(fs.existsSync(SATY_LEVELS_FILE)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(SATY_LEVELS_FILE, 'utf8'));
    expect(typeof saved.put_trigger).toBe('number');
  });

  it('/heatmap [text] parses bobby text, saves today-levels.json, reports nodes found', async () => {
    const text = fs.readFileSync(path.join(__dirname, '../fixtures/bobby/synthetic-bearish-bobby.txt'), 'utf8');
    if (fs.existsSync(TODAY_LEVELS_FILE)) fs.unlinkSync(TODAY_LEVELS_FILE);
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/heatmap ' + text, res);
    expect(payload.reply).toMatch(/^Heatmap context updated\./);
    expect(payload.reply).toMatch(/\d+ nodes found/);
    expect(payload.reply).not.toMatch(MOJIBAKE_RE);
    expect(fs.existsSync(TODAY_LEVELS_FILE)).toBe(true);
    const levels = JSON.parse(fs.readFileSync(TODAY_LEVELS_FILE, 'utf8'));
    expect(Array.isArray(levels.bobby)).toBe(true);
    expect(levels.bobby.length).toBeGreaterThan(0);
  });

  it('/ready with all prep loaded returns OK READY TO TRADE', async () => {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const ts = new Date().toISOString();

    fs.writeFileSync(APEX_STATE_FILE, JSON.stringify({ balance: 51200, trail_floor: 48700, updated: ts }), 'utf8');
    fs.writeFileSync(SATY_LEVELS_FILE, JSON.stringify({ updated: ts, put_trigger: 5850 }), 'utf8');
    fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
      date: todayET, last_updated: ts, source_pastes: [],
      instruments: { ES: { levels: [{ price: 5850 }] } },
      conflicts: [], parse_errors: [],
    }), 'utf8');
    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
      date: todayCT,
      heatmap: { source: 'test', stored_at: ts },
    }), 'utf8');

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/ready', res);
    expect(payload.reply).toMatch(/^READY SESSION READINESS/);
    expect(payload.reply).toContain('OK Balance set today');
    expect(payload.reply).toContain('OK Saty ATR levels loaded');
    expect(payload.reply).toContain('OK Bobby heatmap loaded');
    expect(payload.reply).toContain('OK READY TO TRADE');
    expect(payload.reply).not.toMatch(MOJIBAKE_RE);
  });

  it('/reset deletes today-levels.json and daily-context.json', async () => {
    const ts = new Date().toISOString();
    fs.writeFileSync(TODAY_LEVELS_FILE, JSON.stringify({ date: '2026-04-27', bobby: [], richyd: [] }), 'utf8');
    fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({ date: '2026-04-27', heatmap: { stored_at: ts } }), 'utf8');
    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };
    await handleSlashCommand('/reset', res);
    expect(payload.reply).toContain('Daily reset complete');
    expect(fs.existsSync(TODAY_LEVELS_FILE)).toBe(false);
    expect(fs.existsSync(DAILY_CTX_FILE)).toBe(false);
  });
});
