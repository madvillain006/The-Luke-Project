'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const router = require('../trading/router');
const { getApexConsistencyReason, getApexPreTradeFloorBlock, validateStagedTrade } = require('../trading/risk');
const { queryLevels, _internal: levelMemoryInternal } = require('../lib/level-memory');
const { parseDubzText, mergeDubzInputs, appendDubzToMemory } = require('../lib/parse-dubz');
const { parseBobby } = require('../lib/parse-bobby');
const { parseManciniBatch } = require('../lib/parse-mancini');
const { handleSlashCommand } = require('../lib/slash-commands');

const LUKE_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(LUKE_ROOT, 'data');
const LEVEL_MEMORY_FILE = path.join(DATA_DIR, 'level-memory.json');
const DUBZ_LEVELS_FILE = path.join(DATA_DIR, 'dubz-levels.json');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const TODAY_LEVELS_FILE = path.join(DATA_DIR, 'today-levels.json');
const SATY_LEVELS_FILE = path.join(DATA_DIR, 'saty-levels.json');
const TRADING_STATE_FILE = path.join(LUKE_ROOT, 'state', 'snapshots', 'trading-state.json');
const TRADING_EVENTS_FILE = path.join(LUKE_ROOT, 'state', 'events', 'trading-events.jsonl');
const AUTONOMOUS_STATE_FILE = path.join(LUKE_ROOT, 'state', 'snapshots', 'autonomous-state.json');
const JARVIS_LOG_FILE = path.join(LUKE_ROOT, 'state', 'events', 'jarvis-log.jsonl');

const DEFAULT_MEMORY_FILE = LEVEL_MEMORY_FILE;

function todayEt() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function todayCt() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
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

function tempMemoryFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-spine-'));
  const file = path.join(dir, 'level-memory.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, last_updated: null, levels: [] }), 'utf8');
  return file;
}

function mention(analyst, timestamp, fields = {}) {
  return {
    analyst,
    date: todayEt(),
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

function writeMemory(levels, file = LEVEL_MEMORY_FILE) {
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    last_updated: new Date().toISOString(),
    levels,
  }, null, 2), 'utf8');
}

function writeFreshDecisionInputs(ts = new Date().toISOString()) {
  fs.writeFileSync(SATY_LEVELS_FILE, JSON.stringify({
    valid: true,
    updated: ts,
    put_trigger: 6809,
    call_trigger: 6860,
    prev_close: 6830,
  }), 'utf8');
  fs.writeFileSync(DAILY_CTX_FILE, JSON.stringify({
    date: todayCt(),
    heatmap: { source: 'test', stored_at: ts },
  }), 'utf8');
  fs.writeFileSync(DUBZ_LEVELS_FILE, JSON.stringify({
    date: todayEt(),
    last_updated: ts,
    source_pastes: [],
    instruments: { ES: { levels: [{ price: 6809 }] }, NQ: { levels: [] }, SPY: { levels: [] }, QQQ: { levels: [] } },
    conflicts: [],
    parse_errors: [],
  }), 'utf8');
}

function actionableLongMemory(ts) {
  return [
    level(6809, 'ES', [
      mention('dubz', ts, { significance: 'key', direction: 'support', source_type: 'text', crossSourceConfirmed: true }),
      mention('bobby', ts, { significance: 'key', direction: 'support', source_type: 'vision' }),
      mention('saty', ts, { significance: 'key', source_type: 'saty_atr' }),
      mention('mancini', ts, { significance: 'key', intent: 'long_trigger' }),
    ]),
    level(6793, 'ES', [
      mention('mancini', ts, { intent: 'chop_boundary', source_snippet: '6793 to 6830 = pure chop' }),
    ]),
    level(6830, 'ES', [
      mention('mancini', ts, { intent: 'chop_boundary', source_snippet: '6793 to 6830 = pure chop' }),
    ]),
    level(6860, 'ES', [
      mention('mancini', ts, { significance: 'key', direction: 'resistance', intent: 'first_target' }),
    ]),
  ];
}

function actionableLongMemoryNoChop(ts) {
  return actionableLongMemory(ts).filter(record =>
    !(record.mentions || []).some(m => m.intent === 'chop_boundary')
  );
}

function freshDubz(ts) {
  return [{ ticker: 'ES', ts, signal_type: 'CONTEXT', analyst: 'richydubz', levels: [6809], bias: 'BULLISH' }];
}

function freshBobby(ts) {
  return [{ ts, king_nodes: [], support: [6809], resistance: [6860], bias: 'BULLISH' }];
}

describe('decision spine regression harness', () => {
  let originals;

  beforeEach(() => {
    originals = backupFiles([
      LEVEL_MEMORY_FILE,
      DUBZ_LEVELS_FILE,
      DAILY_CTX_FILE,
      TODAY_LEVELS_FILE,
      SATY_LEVELS_FILE,
      TRADING_STATE_FILE,
      TRADING_EVENTS_FILE,
      AUTONOMOUS_STATE_FILE,
      JARVIS_LOG_FILE,
    ]);
  });

  afterEach(() => {
    restoreFiles(originals);
    levelMemoryInternal._setMemoryFile(DEFAULT_MEMORY_FILE);
    levelMemoryInternal._resetWriteFn();
    vi.restoreAllMocks();
  });

  it('/entries-style command refuses stale or missing Bobby/Dubz context', async () => {
    for (const file of [LEVEL_MEMORY_FILE, DUBZ_LEVELS_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE, SATY_LEVELS_FILE]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    let payload = null;
    const res = { json(obj) { payload = obj; return obj; } };

    await handleSlashCommand('/entries ES', res);

    expect(payload.reply).toContain('No fresh entries available for ES.');
    expect(payload.reply).toContain('Freshness: Saty MISSING');
    expect(payload.reply).toContain('Missing/stale: /saty, /heatmap');
    expect(payload.reply).toContain('Next: run /saty, /heatmap, then /ready before /entries ES.');
  });

  it('fresh same-day Bobby, Dubz, Saty, and Mancini context is recognized as fresh', () => {
    const ts = new Date().toISOString();
    writeMemory(actionableLongMemory(ts));

    const freshness = router._internal.summarizePhase2Freshness(
      require('../lib/confluence-engine').queryLevelsAcrossEquivalents('ES'),
      freshDubz(ts),
      freshBobby(ts)
    );

    expect(freshness).toEqual(expect.objectContaining({
      today_et: todayEt(),
      dubz_today: true,
      bobby_today: true,
      saty_today: true,
      mancini_today: true,
    }));
  });

  it('Mancini chop-zone boundaries create autonomous avoid/pass behavior', () => {
    const ts = new Date().toISOString();
    writeMemory(actionableLongMemory(ts));

    const result = router._internal.buildEntriesAlignment(
      { ticker: 'ES', direction: 'LONG', entry: 6810 },
      freshDubz(ts),
      freshBobby(ts)
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('inside Mancini chop zone 6793-6830');
    expect(result.avoid_zone).toEqual({ low: 6793, high: 6830 });
  });

  it('best confluence anchor produces side, entry zone, stop, and sizing', () => {
    const ts = new Date().toISOString();
    writeFreshDecisionInputs(ts);
    writeMemory(actionableLongMemoryNoChop(ts));

    const result = router._internal.buildEntriesAlignment(
      { ticker: 'ES', direction: 'LONG', entry: 6809 },
      freshDubz(ts),
      freshBobby(ts)
    );

    expect(result.ok).toBe(true);
    expect(result.best).toEqual(expect.objectContaining({
      canonical_price: 6809,
      side: 'LONG',
      sizing: 'full',
    }));
    expect(result.best.optimal_entry).toBe(6809.25);
    expect(result.best.acceptable_entry).toBe(6809.75);
    expect(result.best.stop).toBeLessThan(result.best.optimal_entry);
  });

  it('autonomous alignment refuses when candidate side disagrees with /entries-style side', () => {
    const ts = new Date().toISOString();
    writeFreshDecisionInputs(ts);
    writeMemory(actionableLongMemoryNoChop(ts));

    const result = router._internal.buildEntriesAlignment(
      { ticker: 'ES', direction: 'SHORT', entry: 6809 },
      freshDubz(ts),
      freshBobby(ts)
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('disagrees with /entries LONG ES 6809');
  });

  it('autonomous alignment refuses when candidate entry is too far from the /entries anchor', () => {
    const ts = new Date().toISOString();
    writeFreshDecisionInputs(ts);
    writeMemory(actionableLongMemoryNoChop(ts));

    const result = router._internal.buildEntriesAlignment(
      { ticker: 'ES', direction: 'LONG', entry: 6900 },
      freshDubz(ts),
      freshBobby(ts)
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('pts from /entries anchor 6809');
    expect(result.reason).toContain('91.00 pts');
  });

  it('autonomous alignment refuses when the decision spine returns PASS', () => {
    const ts = new Date().toISOString();
    writeFreshDecisionInputs(ts);
    writeMemory([
      level(6809, 'ES', [
        mention('dubz', ts, { significance: 'unclear', direction: 'support', source_type: 'text' }),
      ]),
    ]);

    const result = router._internal.buildEntriesAlignment(
      { ticker: 'ES', direction: 'LONG', entry: 6809 },
      freshDubz(ts),
      freshBobby(ts)
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Decision spine PASS');
    expect(result.spine_decision.action).toBe('PASS');
  });

  it('autonomous preflight reports blockers when fresh same-day context is missing', async () => {
    writeMemory([]);
    for (const file of [DUBZ_LEVELS_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE, SATY_LEVELS_FILE]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    const result = await router._internal.buildAutonomousPreflight({
      running: true,
      kill_day: false,
      kill_week: false,
      open_position: null,
      pending_signal: null,
      mode: 'paper',
      total_eval_pnl: 0,
      apex: { enabled: true, consistency_limit: 0.50 },
      tradovate: {},
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('fresh same-day Bobby/Dubz context missing');
    expect(result.blockers).toContain('fresh Saty context missing');
    expect(result.blockers.some(blocker => blocker.startsWith('decision spine not actionable:'))).toBe(true);
    expect(result.risk_status.staged_only).toBe(true);
    expect(result.staged_only).toBe(true);
    expect(result.readiness).toEqual(expect.objectContaining({
      status: 'BLOCKED',
      staged_only: true,
    }));
    expect(result.readiness.next_action).toContain('Fix first blocker:');
    expect(result.decision).toEqual(expect.objectContaining({
      action: 'PASS',
      freshness: expect.any(Object),
      evidence: expect.any(Array),
    }));
    expect(result.state_counts).toEqual(expect.objectContaining({
      es_records: 0,
      dubz_context: 0,
      bobby_context: 0,
    }));
  });

  it('autonomous preflight reports state and Apex blockers without executing', async () => {
    const ts = new Date().toISOString();
    writeFreshDecisionInputs(ts);
    writeMemory(actionableLongMemoryNoChop(ts));

    const result = await router._internal.buildAutonomousPreflight({
      running: true,
      kill_day: true,
      kill_week: true,
      open_position: { ticker: 'ES' },
      pending_signal: { expires_at: new Date(Date.now() + 60000).toISOString() },
      mode: 'paper',
      daily_pnl: 925,
      total_eval_pnl: 2000,
      apex: {
        enabled: true,
        consistency_limit: 0.50,
        account_start: 50000,
        eod_threshold: 48000,
      },
      tradovate: {},
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'daily kill active',
      'weekly kill active',
      'position already open',
      'pending signal awaiting confirmation',
    ]));
    expect(result.blockers.some(blocker => blocker.includes('Apex consistency cap'))).toBe(true);
    expect(result.risk_status).toEqual(expect.objectContaining({
      daily_kill: true,
      weekly_kill: true,
      open_position: true,
      pending_signal: true,
      staged_only: true,
    }));
    expect(result.risk_status.apex_consistency.ok).toBe(false);
    expect(result.decision.action).toBe('LONG');
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.anchor).toBe(6809);
    expect(result.state_counts).toEqual(expect.objectContaining({
      has_open_position: true,
      has_pending_signal: true,
    }));
  });

  it('autonomous preflight surfaces actionable spine decision and Mancini warning state', async () => {
    const ts = new Date().toISOString();
    writeFreshDecisionInputs(ts);
    writeMemory(actionableLongMemoryNoChop(ts)
      .map(record => ({ ...record, mentions: (record.mentions || []).filter(m => m.analyst !== 'mancini') }))
      .filter(record => record.mentions.length > 0));

    const result = await router._internal.buildAutonomousPreflight({
      running: true,
      kill_day: false,
      kill_week: false,
      open_position: null,
      pending_signal: null,
      mode: 'paper',
      total_eval_pnl: 0,
      apex: { enabled: true, consistency_limit: 0.50, account_start: 50000, eod_threshold: 48000 },
      tradovate: {},
    });

    expect(result.decision).toEqual(expect.objectContaining({
      ok: true,
      action: 'LONG',
      entry: 6809.25,
      sizing: 'full',
    }));
    expect(result.freshness.dubz_today).toBe(true);
    expect(result.freshness.bobby_today).toBe(true);
    expect(result.freshness.decision.saty.loaded).toBe(true);
    expect(result.warnings).toContain('Mancini context missing - chop-zone veto coverage may be incomplete');
    expect(result.readiness).toEqual(expect.objectContaining({
      staged_only: true,
      anchor: 6809,
      side: 'LONG',
      sizing: 'full',
      active_vetoes: [],
    }));
    expect(['READY_TO_STAGE_IF_CANDIDATE_ALIGNS', 'BLOCKED']).toContain(result.readiness.status);
    expect(result.readiness.next_action).toMatch(/Wait for aligned candidate|Fix first blocker/);
    expect(result.market_context).toBeNull();
  });

  it('autonomous remains staged-only and does not execute without explicit staged execution', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    const state = {
      mode: 'paper',
      running: true,
      kill_day: false,
      kill_week: false,
      open_position: null,
      pending_signal: null,
      daily_pnl: 0,
      weekly_pnl: 0,
      total_eval_pnl: 0,
      daily_loss_limit: -100,
      weekly_loss_limit: -300,
      apex: { enabled: true, account_start: 50000, eod_threshold: 48000, max_drawdown: 2000, consistency_limit: 0.50 },
      paper_trades: 0,
      tradovate: {},
    };

    await router._internal.stageTrade(state, {
      ticker: 'ES',
      direction: 'LONG',
      entry: 6809.25,
      stop: 6807.25,
      target: 6815,
      reason: 'test staged signal',
    });

    expect(state.pending_signal).toEqual(expect.objectContaining({
      ticker: 'ES',
      direction: 'LONG',
      entry: 6809.25,
    }));
    expect(state.open_position).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/notify', expect.any(Object));
    const persisted = JSON.parse(fs.readFileSync(TRADING_STATE_FILE, 'utf8'));
    expect(persisted.pending_signal).toEqual(expect.objectContaining({ ticker: 'ES' }));
    expect(persisted.open_position).toBeNull();
  });

  it('existing Apex and risk blockers remain active', () => {
    const consistency = getApexConsistencyReason({
      total_eval_pnl: 2000,
      daily_pnl: 925,
      apex: { enabled: true, consistency_limit: 0.50 },
    });
    expect(consistency).toContain('Apex consistency cap');

    const floorBlock = getApexPreTradeFloorBlock({
      total_eval_pnl: 0,
      apex: { enabled: true, account_start: 50000, eod_threshold: 49950 },
    }, {
      ticker: 'ES',
      direction: 'LONG',
      entry: 6809,
      stop: 6700,
    });
    expect(floorBlock).toEqual(expect.objectContaining({ floor: 49950, buffer: 200 }));

    const stagedValidation = validateStagedTrade(
      { ticker: 'ES', direction: 'LONG', entry: 6809, stop: 6807, target: 6810 },
      { stale: false, price: 6815, spread_ticks: 1 },
      { drift_reject_ticks: 8, min_rr: 1.5 }
    );
    expect(stagedValidation.ok).toBe(false);
    expect(stagedValidation.reasons.some(reason => reason.startsWith('price_drift:'))).toBe(true);
  });

  it('parser fixtures still load and append to Level Memory without breaking schema', async () => {
    const memoryFile = tempMemoryFile();
    levelMemoryInternal._setMemoryFile(memoryFile);

    const dubzFixture = fs.readFileSync(path.join(__dirname, '../fixtures/dubz/2026-04-27_0859_dubz.txt'), 'utf8');
    const dubzParsed = parseDubzText(dubzFixture);
    const dubzState = mergeDubzInputs(dubzParsed, [], null, todayEt(), {
      timestamp: new Date().toISOString(),
      input_type: 'text',
      raw_text: dubzFixture,
      image_count: 0,
    });
    await appendDubzToMemory(dubzState);

    const bobbyFixture = fs.readFileSync(path.join(__dirname, '../fixtures/bobby/synthetic-bearish-bobby.txt'), 'utf8');
    const bobbyParsed = parseBobby(bobbyFixture);
    expect(bobbyParsed.king_nodes.length + bobbyParsed.support.length + bobbyParsed.resistance.length).toBeGreaterThan(0);

    const manciniFixture = fs.readFileSync(path.join(__dirname, '../fixtures/mancini/reddit-archive-2026-04-10-to-2026-04-22.md'), 'utf8');
    const manciniParsed = parseManciniBatch(manciniFixture);
    expect(manciniParsed.deduped_levels.length).toBeGreaterThan(0);

    const esLevels = queryLevels({ instrument: 'ES' });
    expect(esLevels.length).toBeGreaterThan(0);
    expect(esLevels[0]).toEqual(expect.objectContaining({
      canonical_price: expect.any(Number),
      mentions: expect.any(Array),
    }));
  });
});
