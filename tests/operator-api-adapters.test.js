'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildDecisionResponse } = require('../lib/operator/decision-adapter');
const { buildOperatorStatus } = require('../lib/operator/operator-status-adapter');
const { buildConfluenceResponse } = require('../lib/operator/confluence-adapter');
const { handleEntriesCommand } = require('../lib/commands/entries-command');
const { handleStatusCommand } = require('../lib/commands/status-command');
const { handleVerdictCommand } = require('../lib/commands/verdict-command');
const { _internal: slashInternal } = require('../lib/slash-commands');
const { loadSatyLevels } = require('../lib/saty-levels');
const { isMarketOpen, isGoodTradingTime, minsUntilOpen } = require('../lib/market-hours');
const { buildTradeDecision } = require('../lib/decision-spine');
const { loadMemory, _internal: levelMemoryInternal } = require('../lib/level-memory');

const LUKE_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(LUKE_ROOT, 'data');
const STATE_DIR = path.join(LUKE_ROOT, 'state');
const LEVEL_MEMORY_FILE = path.join(DATA_DIR, 'level-memory.json');
const DUBZ_LEVELS_FILE = path.join(DATA_DIR, 'dubz-levels.json');
const DAILY_CTX_FILE = path.join(DATA_DIR, 'daily-context.json');
const TODAY_LEVELS_FILE = path.join(DATA_DIR, 'today-levels.json');
const SATY_LEVELS_FILE = path.join(DATA_DIR, 'saty-levels.json');
const TRADING_STATE_FILE = path.join(STATE_DIR, 'snapshots', 'trading-state.json');
const TRADING_EVENTS_FILE = path.join(STATE_DIR, 'events', 'trading-events.jsonl');
const AUTONOMOUS_STATE_FILE = path.join(STATE_DIR, 'snapshots', 'autonomous-state.json');
const TRADES_JSONL = path.join(STATE_DIR, 'events', 'trades.jsonl');
const LAST_SIGNAL_FILE = path.join(DATA_DIR, 'last-signal.json');

function todayEt() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function todayCt() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function backupFiles(files) {
  return new Map(files.map(file => [file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null]));
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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function mention(analyst, ts, fields = {}) {
  return {
    analyst,
    date: todayEt(),
    timestamp: ts,
    significance: fields.significance ?? 'key',
    direction: fields.direction ?? null,
    intent: fields.intent ?? null,
    source_type: fields.source_type ?? 'text',
    source_snippet: fields.source_snippet ?? null,
    source_id: fields.source_id ?? null,
    crossSourceConfirmed: fields.crossSourceConfirmed === true,
  };
}

function level(price, instrument, mentions) {
  return {
    canonical_price: price,
    instrument,
    first_seen: mentions[0]?.timestamp,
    last_seen: mentions[mentions.length - 1]?.timestamp,
    total_mentions: mentions.length,
    mentions,
  };
}

function writeFreshFixture(ts = new Date().toISOString()) {
  writeJson(SATY_LEVELS_FILE, {
    valid: true,
    updated: ts,
    put_trigger: 6809,
    call_trigger: 6860,
    prev_close: 6830,
  });
  writeJson(DUBZ_LEVELS_FILE, {
    date: todayEt(),
    last_updated: ts,
    source_pastes: [],
    instruments: { ES: { levels: [{ price: 6809 }] }, NQ: { levels: [] }, SPY: { levels: [] }, QQQ: { levels: [] } },
    conflicts: [],
    parse_errors: [],
  });
  writeJson(DAILY_CTX_FILE, {
    date: todayCt(),
    heatmap: { source: 'test', stored_at: ts },
  });
  writeJson(TRADING_STATE_FILE, {
    mode: 'paper',
    running: true,
    kill_day: false,
    kill_week: false,
    daily_pnl: 0,
    weekly_pnl: 0,
    total_eval_pnl: 0,
    paper_trades: 0,
    open_position: null,
    pending_signal: null,
    apex: { enabled: false, consistency_limit: 0.5 },
    tradovate: {},
  });
  writeJson(LEVEL_MEMORY_FILE, {
    version: 1,
    last_updated: ts,
    levels: [
      level(6809, 'ES', [
        mention('dubz', ts, { direction: 'support', source_type: 'text', crossSourceConfirmed: true }),
        mention('bobby', ts, { direction: 'support', source_type: 'vision' }),
        mention('saty', ts, { source_type: 'saty_atr' }),
      ]),
      level(6860, 'ES', [
        mention('mancini', ts, { direction: 'resistance', intent: 'first_target' }),
      ]),
    ],
  });
}

function captureRes() {
  return {
    payload: null,
    json(obj) {
      this.payload = obj;
      return obj;
    },
  };
}

describe('operator API adapters', () => {
  let originals;
  let tempMemoryFile;

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
      TRADES_JSONL,
      LAST_SIGNAL_FILE,
    ]);
    tempMemoryFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operator-adapters-')), 'level-memory.json');
    levelMemoryInternal._setMemoryFile(tempMemoryFile);
  });

  afterEach(() => {
    levelMemoryInternal._setMemoryFile(LEVEL_MEMORY_FILE);
    levelMemoryInternal._resetWriteFn();
    restoreFiles(originals);
    vi.restoreAllMocks();
  });

  it('/api/decision agrees with /entries ES core decision facts', async () => {
    const ts = new Date().toISOString();
    writeFreshFixture(ts);
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);
    const getLivePrice = async () => ({ instruments: { es: { price: 6809.5 } } });
    const state = JSON.parse(fs.readFileSync(TRADING_STATE_FILE, 'utf8'));

    const api = await buildDecisionResponse({
      instrument: 'ES',
      mode: 'manual',
      state,
      getLivePriceFn: getLivePrice,
      now: new Date(ts),
    });

    const res = captureRes();
    await handleEntriesCommand('/entries ES', res, {
      getKatContextSummary: () => null,
      formatKatSummaryLine: () => null,
      getLivePrice,
      loadState: () => state,
      buildTradeDecision,
    });

    expect(res.payload.reply).toContain(`Anchor: ES ${api.summary.anchor}`);
    expect(res.payload.reply).toContain(`side ${api.summary.side}`);
    expect(res.payload.reply).toContain(`stop ${api.summary.stop}`);
    expect(api.decision.action).toBe('LONG');
    expect(api.actionable).toBe(true);
  });

  it('/api/operator/status agrees with /status freshness and recommendation-only facts', async () => {
    const ts = new Date().toISOString();
    writeFreshFixture(ts);
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);

    const api = await buildOperatorStatus({
      instrument: 'ES',
      mode: 'manual',
      currentPrice: 6810,
      now: new Date(ts),
      getLivePriceFn: false,
    });

    const res = captureRes();
    await handleStatusCommand('/status', res, {
      fs,
      TRADES_JSONL,
      LAST_SIGNAL_FILE,
      isMarketOpen,
      isGoodTradingTime,
      minsUntilOpen,
      getPhase2WorkflowLoadStatus: slashInternal.getPhase2WorkflowLoadStatus,
      loadSatyLevels,
      loadApexState: () => null,
      getMorningPrepLine: () => null,
      loadTodayContext: () => ({}),
      checkEmotionalState: () => [],
      getKatbotRegime: () => ({ regime: 'NEUTRAL', reason: 'test' }),
      formatKatSummaryLine: () => null,
      getKatContextSummary: () => null,
    });

    expect(api.freshness.saty.loaded).toBe(true);
    expect(api.freshness.dubz.count).toBe(1);
    expect(api.freshness.bobby.count).toBe(1);
    expect(api.autonomous.staged_only).toBe(true);
    expect(api.autonomous.recommendation_only).toBe(true);
    expect(api.autonomous.wording).toContain('recommendations to Luke chat');
    expect(res.payload.reply).toContain('Freshness: Dubz OK (1) | Bobby OK (1) | Saty OK');
    expect(res.payload.reply).toContain('Autonomous: recommendation-only');
    expect(res.payload.reply).toContain('Luke chat: active for trading ops');
    expect(res.payload.reply).not.toContain('personal logging is retired');
  });

  it('/api/confluence agrees with /verdict rows and remains confluence-only', async () => {
    const ts = new Date().toISOString();
    writeFreshFixture(ts);
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);
    const getLivePrice = async () => ({ instruments: { es: { price: 6810 } } });

    const api = await buildConfluenceResponse({
      instrument: 'ES',
      getLivePriceFn: getLivePrice,
    });

    const res = captureRes();
    await handleVerdictCommand('/verdict ES', res, {
      getPhase2WorkflowLoadStatus: slashInternal.getPhase2WorkflowLoadStatus,
      loadSatyLevels,
      getLivePrice,
    });

    for (const row of api.rows) {
      expect(res.payload.reply).toContain(row.markdown);
    }
    expect(api.mode).toBe('confluence_only');
    expect(api.actionable).toBe(false);
    expect(api.trade_action).toBeNull();
    expect(api.disclaimer).toContain('/api/decision');
  });

  it('PASS decisions never appear actionable', async () => {
    writeJson(LEVEL_MEMORY_FILE, { version: 1, last_updated: null, levels: [] });
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);
    for (const file of [SATY_LEVELS_FILE, DUBZ_LEVELS_FILE, DAILY_CTX_FILE, TODAY_LEVELS_FILE]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    const api = await buildDecisionResponse({
      instrument: 'ES',
      mode: 'manual',
      currentPrice: 6810,
      getLivePriceFn: false,
      now: new Date(),
    });

    expect(api.decision.action).toBe('PASS');
    expect(api.actionable).toBe(false);
    expect(api.trade_instruction).toBeNull();
  });

  it('/api/decision mirrors /entries WAIT when live price is unavailable', async () => {
    const ts = new Date().toISOString();
    writeFreshFixture(ts);
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);

    const api = await buildDecisionResponse({
      instrument: 'ES',
      mode: 'manual',
      getLivePriceFn: async () => {
        throw new Error('price feed down');
      },
      now: new Date(ts),
    });

    expect(api.spine_decision.action).toBe('LONG');
    expect(api.decision.action).toBe('PASS');
    expect(api.decision.side).toBe('LONG');
    expect(api.decision.reason).toContain('WAIT - market price unavailable');
    expect(api.actionable).toBe(false);
    expect(api.trade_instruction).toBeNull();
  });

  it('/api/decision mirrors /entries SKIP CHASE as non-actionable adapter state', async () => {
    const ts = new Date().toISOString();
    writeFreshFixture(ts);
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);

    const api = await buildDecisionResponse({
      instrument: 'ES',
      mode: 'manual',
      currentPrice: 7000,
      now: new Date(ts),
      getLivePriceFn: false,
    });

    expect(api.spine_decision.action).toBe('LONG');
    expect(api.decision.action).toBe('PASS');
    expect(api.decision.side).toBe('LONG');
    expect(api.decision.reason).toContain('SKIP CHASE');
    expect(api.actionable).toBe(false);
    expect(api.trade_instruction).toBeNull();
  });

  it('missing or corrupt state files return explicit operator blockers', async () => {
    const ts = new Date().toISOString();
    writeFreshFixture(ts);
    fs.copyFileSync(LEVEL_MEMORY_FILE, tempMemoryFile);
    fs.writeFileSync(TRADING_STATE_FILE, '{bad json', 'utf8');
    if (fs.existsSync(AUTONOMOUS_STATE_FILE)) fs.unlinkSync(AUTONOMOUS_STATE_FILE);

    const api = await buildOperatorStatus({
      instrument: 'ES',
      mode: 'manual',
      currentPrice: 6810,
      now: new Date(ts),
      getLivePriceFn: false,
    });

    expect(api.ok).toBe(false);
    expect(api.blockers.some(blocker => blocker.includes('trading state unavailable'))).toBe(true);
    expect(api.risk_status.staged_only).toBe(true);
  });
});
