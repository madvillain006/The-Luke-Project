'use strict';

const fs   = require('fs');
const path = require('path');

const { parseXimes, resetSessionContext } = require('../lib/parse-ximes');
const { parseBobby }                      = require('../lib/parse-bobby');

// ── CLI ───────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const DATA_DIR = (() => {
  const i = args.indexOf('--dir');
  return i !== -1 ? args[i + 1] : 'data/backtest';
})();

const ROOT        = path.resolve(__dirname, '..');
const BACKTEST_DIR = path.resolve(ROOT, DATA_DIR);
const KAT_SIGNALS  = path.resolve(ROOT, 'data/kat/processed-signals.jsonl');

// ── toUtcMs ───────────────────────────────────────────────────────────────────
// dateStr: 'M/D/YYYY' | 'YYYY-MM-DD' | 'YYYY-MM-DD HH:MM'
// timeStr: 'H:MM AM/PM' | 'HH:MM' | null
// tz:      'ET' | 'CT'
function toUtcMs(dateStr, timeStr, tz) {
  const zone = tz === 'ET' ? 'America/New_York' : 'America/Chicago';
  let y, m, d, H, M;

  const isoFull = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(dateStr);
  if (isoFull) {
    [, y, m, d, H, M] = isoFull.map(Number);
  } else {
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
    const dash  = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (slash) {
      const [, mm, dd, yy] = slash.map(Number);
      m = mm; d = dd; y = yy;
    } else if (dash) {
      const [, yy, mm, dd] = dash.map(Number);
      y = yy; m = mm; d = dd;
    } else {
      throw new Error(`toUtcMs: unrecognized dateStr: ${dateStr}`);
    }

    if (timeStr) {
      const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeStr.trim());
      const hhmm = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
      if (ampm) {
        H = parseInt(ampm[1]);
        M = parseInt(ampm[2]);
        const p = ampm[3].toUpperCase();
        if (p === 'AM' && H === 12) H = 0;
        if (p === 'PM' && H !== 12) H += 12;
      } else if (hhmm) {
        H = parseInt(hhmm[1]);
        M = parseInt(hhmm[2]);
      } else {
        throw new Error(`toUtcMs: unrecognized timeStr: ${timeStr}`);
      }
    } else {
      H = 0; M = 0;
    }
  }

  const asIfUtc  = Date.UTC(y, m - 1, d, H, M);
  const tzStr    = new Date(asIfUtc).toLocaleString('en-US', { timeZone: zone });
  const parsedBack = new Date(tzStr + ' UTC');
  const offset   = asIfUtc - parsedBack.getTime();
  return asIfUtc + offset;
}

// ── Sanity check ──────────────────────────────────────────────────────────────
function runSanityCheck() {
  const t1 = toUtcMs('3/15/2026', '10:00 AM', 'ET');
  console.log('3/15/2026 10:00 AM ET →', new Date(t1).toISOString());

  const t2 = toUtcMs('2/26/2026', '10:41 AM', 'ET');
  console.log('2/26/2026 10:41 AM ET →', new Date(t2).toISOString());

  const t3 = toUtcMs('2026-03-15 09:30', null, 'CT');
  console.log('2026-03-15 09:30 CT   →', new Date(t3).toISOString());
}

// ── Rollover gap (computed after toUtcMs is defined) ─────────────────────────
// ES/NQ futures: 3/20 close → 4/1 open. Fall back to SPX during gap.
const ROLLOVER_START_UTC = toUtcMs('3/20/2026', '4:00 PM', 'ET');
const ROLLOVER_END_UTC   = toUtcMs('4/1/2026',  '9:30 AM', 'ET');

function inRolloverGap(utcMs) {
  return utcMs >= ROLLOVER_START_UTC && utcMs < ROLLOVER_END_UTC;
}

// ── parseDiscordFile ──────────────────────────────────────────────────────────
const TS_RE    = /^\[(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)\]\s+(\S+)\s*$/i;
const BLOCK_RE = /^\{(?:Reactions|Attachments|Embed)\}/i;

function parseDiscordFile(filePath, channelHint) {
  const lines   = fs.readFileSync(filePath, 'utf8').split('\n');
  const signals = [];

  let curDate = null, curTime = null, curUser = null, curLines = [];

  function flush() {
    if (!curDate || !curUser) return;
    const content = curLines.join('\n').trim();
    if (!content) return;

    const utcMs = toUtcMs(curDate, curTime, 'ET');
    let sig = null;

    if (channelHint === 'ximes-dubz') {
      const raw = parseXimes(curUser, content);
      if (raw && (raw.signal_type === 'LIVE_ENTRY' || raw.signal_type === 'PRE_MARKET_SETUP')) {
        sig = raw;
      }
    } else if (channelHint === 'bobby-spx-coms') {
      if (curUser.toLowerCase() === 'bobbyaxl') {
        const r = parseBobby(content);
        if (r && (r.king_nodes.length > 0 || r.support.length > 0 || r.resistance.length > 0)) {
          sig = { signal_type: 'BOBBY_CONTEXT', ...r };
        }
      }
    }

    if (sig) {
      signals.push({
        ...sig,
        utcMs,
        ts:       new Date(utcMs).toISOString(),
        username: curUser,
        channel:  channelHint,
        source:   channelHint === 'bobby-spx-coms' ? 'bobby' : 'ximes',
      });
    }
  }

  for (const line of lines) {
    if (BLOCK_RE.test(line)) {
      flush();
      curLines = [];
      continue;
    }
    const tsMatch = TS_RE.exec(line);
    if (tsMatch) {
      flush();
      curDate = tsMatch[1];
      curTime = tsMatch[2];
      curUser = tsMatch[3];
      curLines = [];
    } else {
      curLines.push(line);
    }
  }
  flush();

  return signals;
}

// ── loadKatSignals ────────────────────────────────────────────────────────────
const KAT_TICKERS = new Set(['SPX','SPY','QQQ','ES','NQ','MES','MNQ','NDX']);

function normalizeKatAnalyst(analyst) {
  if (!analyst) return analyst;
  const a = analyst.toLowerCase();
  if (a === 'mathemeatloaf7') return 'jefe';
  if (a.startsWith('barry'))  return 'barry';
  if (a.startsWith('kapri'))  return 'kapri';
  if (a.includes('dollar'))   return 'gendollars';
  return analyst;
}

function katInstrument(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase();
  if (['SPX','ES','MES'].includes(t)) return 'ES';
  if (['SPY','QQQ'].includes(t))      return 'SPY_QQQ';
  if (['NQ','MNQ','NDX'].includes(t)) return 'NQ';
  return null;
}

function katRole(sig) {
  const { signal_type, levels, has_image } = sig;
  const hasLevels = levels && levels.length > 0;
  if (signal_type === 'LEVEL_WATCH' && hasLevels)               return 'level_call';
  if (signal_type === 'CHART_ANALYSIS' && hasLevels)            return 'chart_level';
  if (signal_type === 'CHART_ANALYSIS' && has_image && !hasLevels) return 'chart_bias_only';
  if (signal_type === 'DIRECTIONAL')                            return 'directional_bias';
  if (signal_type === 'CONTEXT' && hasLevels)                   return 'context';
  return null;
}

function loadKatSignals(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
  const out = [];
  for (const line of lines) {
    let s;
    try { s = JSON.parse(line); } catch { continue; }
    if (!s.ts) continue;
    if (['MANAGEMENT','NOISE'].includes(s.signal_type)) continue;
    if (s.signal_type === 'CONTEXT' && (!s.levels || s.levels.length === 0)) continue;
    if (!s.ticker || !KAT_TICKERS.has(s.ticker.toUpperCase())) continue;
    const instrument = katInstrument(s.ticker);
    if (!instrument) continue;
    const role = katRole(s);
    if (!role) continue;
    out.push({
      ...s,
      utcMs:        new Date(s.ts).getTime(),
      instrument,
      role,
      analyst_norm: normalizeKatAnalyst(s.analyst),
    });
  }
  return out;
}

// ── buildPriceIndex ───────────────────────────────────────────────────────────
const CONTRACT_PRIORITY = {
  esz25: 1, esh26: 2, esm26: 3,
  nqh26: 2, nqm26: 3,
  spx: 1, spy: 1, qqq: 1,
};

function detectInstrumentFromFilename(fname) {
  const f = fname.toLowerCase();
  if (f.startsWith('esz25')) return { inst: 'ES',  contract: 'esz25' };
  if (f.startsWith('esh26')) return { inst: 'ES',  contract: 'esh26' };
  if (f.startsWith('esm26')) return { inst: 'ES',  contract: 'esm26' };
  if (f.startsWith('nqh26')) return { inst: 'NQ',  contract: 'nqh26' };
  if (f.startsWith('nqm26')) return { inst: 'NQ',  contract: 'nqm26' };
  if (f.startsWith('spx_'))  return { inst: 'SPX', contract: 'spx'   };
  if (f.startsWith('spy_'))  return { inst: 'SPY', contract: 'spy'   };
  if (f.startsWith('qqq_'))  return { inst: 'QQQ', contract: 'qqq'   };
  return null;
}

function parseCsvBars(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  if (lines.length < 2) return [];

  const headers  = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const dtIdx    = headers.findIndex(h => ['Time','Date','DateTime'].includes(h));
  const openIdx  = headers.findIndex(h => h === 'Open');
  const highIdx  = headers.findIndex(h => h === 'High');
  const lowIdx   = headers.findIndex(h => h === 'Low');
  const closeIdx = headers.findIndex(h => ['Latest','Close','Last'].includes(h));

  if (dtIdx === -1 || closeIdx === -1) return [];

  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('"')) continue; // skip footer / blank
    const cols = line.split(',');
    if (cols.length < 2) continue;
    const rawDt = cols[dtIdx].replace(/^"|"$/g, '').trim();
    if (!rawDt) continue;
    let utcMs;
    try { utcMs = toUtcMs(rawDt, null, 'CT'); } catch { continue; }
    if (isNaN(utcMs)) continue;
    const close = parseFloat(cols[closeIdx]);
    if (isNaN(close)) continue;
    bars.push({
      utcMs,
      open:  openIdx  !== -1 ? parseFloat(cols[openIdx])  : close,
      high:  highIdx  !== -1 ? parseFloat(cols[highIdx])  : close,
      low:   lowIdx   !== -1 ? parseFloat(cols[lowIdx])   : close,
      close,
    });
  }
  bars.sort((a, b) => a.utcMs - b.utcMs);
  return bars;
}

function buildPriceIndex(dir) {
  const index = { ES: new Map(), NQ: new Map(), SPX: new Map(), SPY: new Map(), QQQ: new Map() };

  const tagged = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.csv'))
    .map(f => ({ f, ...detectInstrumentFromFilename(f) }))
    .filter(x => x.inst)
    .sort((a, b) => (CONTRACT_PRIORITY[a.contract] || 0) - (CONTRACT_PRIORITY[b.contract] || 0));

  for (const { f, inst, contract } of tagged) {
    const bars = parseCsvBars(path.join(dir, f));
    const map  = index[inst];
    if (!map) continue;
    for (const bar of bars) {
      map.set(Math.floor(bar.utcMs / 60000) * 60000, bar);
    }
    if (VERBOSE) console.log(`[price] ${contract}: ${bars.length} bars → ${inst}`);
  }

  return index;
}

// ── Price helpers ─────────────────────────────────────────────────────────────
function barNear(map, targetMs, toleranceMs) {
  const steps = Math.ceil(toleranceMs / 60000);
  for (let delta = 0; delta <= steps; delta++) {
    const k1 = Math.floor((targetMs + delta * 60000) / 60000) * 60000;
    const k2 = Math.floor((targetMs - delta * 60000) / 60000) * 60000;
    if (map.has(k1)) return map.get(k1);
    if (delta > 0 && map.has(k2)) return map.get(k2);
  }
  return null;
}

// For SPY_QQQ instrument, pick the right price map from original ticker
function resolveMapKey(instrument, ticker) {
  if (instrument !== 'SPY_QQQ') return instrument;
  return (ticker || '').toUpperCase() === 'QQQ' ? 'QQQ' : 'SPY';
}

// ── ET time helpers ───────────────────────────────────────────────────────────
function getEtHM(utcMs) {
  const s = new Date(utcMs).toLocaleString('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [H, M] = s.split(':').map(Number);
  return { H: isNaN(H) ? 0 : H, M: isNaN(M) ? 0 : M };
}

function getTimeWindow(utcMs) {
  const { H, M } = getEtHM(utcMs);
  const tot = H * 60 + M;
  if (tot >= 9*60+30 && tot < 11*60)    return 'morning';
  if (tot >= 11*60   && tot < 14*60)    return 'midday';
  if (tot >= 14*60   && tot < 15*60+50) return 'afternoon';
  return 'offhours';
}

// ── evaluateSignal ────────────────────────────────────────────────────────────
const PNL_MARKS_MIN = [5, 15, 30, 60, 90, 120];
const TOLERANCES    = { ES: 10, NQ: 10, SPX: 5, SPY: 2, QQQ: 2, SPY_QQQ: 2 };

function resolveInstrumentFromSig(sig) {
  if (sig.instrument) return sig.instrument;
  const t = (sig.ticker || '').toUpperCase();
  if (['SPX','ES','MES'].includes(t))  return 'ES';
  if (t === 'SPY')                     return 'SPY';
  if (t === 'QQQ')                     return 'QQQ';
  if (['NQ','MNQ','NDX'].includes(t))  return 'NQ';
  return null;
}

function evaluateSignal(sig, priceIndex, bobbyContexts, katSignals) {
  const instrument = resolveInstrumentFromSig(sig);
  if (!instrument) return null;

  const sigMs   = sig.utcMs;
  const usedSPX = (instrument === 'ES' || instrument === 'NQ') && inRolloverGap(sigMs);
  const mapKey  = usedSPX ? 'SPX' : resolveMapKey(instrument, sig.ticker);
  const map     = priceIndex[mapKey];
  if (!map) return { ...sig, instrument, skip: true, reason: 'no_price_map', used_spx_gap: usedSPX };

  const entryBar = barNear(map, sigMs, 5 * 60000);
  if (!entryBar) return { ...sig, instrument, skip: true, reason: 'no_price_data', used_spx_gap: usedSPX };

  const strike    = sig.strike || (sig.levels && sig.levels[0]) || null;
  const direction = sig.direction ||
    (sig.bias === 'BULLISH' ? 'LONG' : sig.bias === 'BEARISH' ? 'SHORT' : null);
  const tol       = TOLERANCES[instrument] || 5;
  const { H: etHour } = getEtHM(sigMs);

  // PnL at marks
  const pnl = {};
  for (const mins of PNL_MARKS_MIN) {
    const bar = barNear(map, sigMs + mins * 60000, 2 * 60000);
    if (!bar) continue;
    const raw = direction === 'LONG'  ? bar.close - entryBar.close
              : direction === 'SHORT' ? entryBar.close - bar.close
              : bar.close - entryBar.close;
    pnl[`m${mins}`] = +raw.toFixed(2);
  }

  // 120m window: touch, runner, max fav/adv
  let touched = false, firstTouchMs = null;
  let maxFav = 0, maxAdv = 0, runnerExtension = 0;

  const endMs = sigMs + 120 * 60000;
  let t = Math.floor(sigMs / 60000) * 60000;
  while (t <= endMs) {
    if (map.has(t)) {
      const bar = map.get(t);
      if (direction === 'LONG') {
        maxFav = Math.max(maxFav, bar.high - entryBar.close);
        maxAdv = Math.max(maxAdv, entryBar.close - bar.low);
        if (!touched && strike !== null && bar.low <= strike + tol && bar.high >= strike - tol) {
          touched = true; firstTouchMs = bar.utcMs;
        }
      } else if (direction === 'SHORT') {
        maxFav = Math.max(maxFav, entryBar.close - bar.low);
        maxAdv = Math.max(maxAdv, bar.high - entryBar.close);
        if (!touched && strike !== null && bar.high >= strike - tol && bar.low <= strike + tol) {
          touched = true; firstTouchMs = bar.utcMs;
        }
      }
      if (touched && firstTouchMs !== null && bar.utcMs >= firstTouchMs && strike !== null) {
        if (direction === 'LONG')  runnerExtension = Math.max(runnerExtension, bar.high - strike);
        if (direction === 'SHORT') runnerExtension = Math.max(runnerExtension, strike - bar.low);
      }
    }
    t += 60000;
  }

  const runnerThreshold = (['ES','NQ'].includes(instrument)) ? 4 : 2;
  const runnerViable    = runnerExtension >= runnerThreshold;

  // Bobby confluence (Ximes signals only)
  let bobbyConfluence = null;
  if (sig.source === 'ximes' && strike !== null && bobbyContexts) {
    const sigDay = new Date(sigMs).toISOString().slice(0, 10);
    const win4h  = 4 * 60 * 60 * 1000;
    for (const b of bobbyContexts) {
      if (new Date(b.utcMs).toISOString().slice(0, 10) !== sigDay) continue;
      if (b.utcMs > sigMs || sigMs - b.utcMs > win4h) continue;
      const allLevels = [...(b.king_nodes||[]), ...(b.support||[]), ...(b.resistance||[])];
      const hit = allLevels.find(l => Math.abs(l - strike) <= tol);
      if (hit) {
        const biasDir = b.bias === 'BULLISH' ? 'LONG' : b.bias === 'BEARISH' ? 'SHORT' : null;
        bobbyConfluence = { level: hit, aligned: biasDir === direction, bias: b.bias };
        break;
      }
    }
  }

  // Kat confluence (all signals): level_call or chart_level within 2h before
  let katConfluence = null;
  if (strike !== null && katSignals) {
    const win2h  = 2 * 60 * 60 * 1000;
    const katInst = (instrument === 'SPY' || instrument === 'QQQ') ? 'SPY_QQQ' : instrument;
    for (const k of katSignals) {
      if (k.instrument !== katInst) continue;
      if (k.utcMs > sigMs || sigMs - k.utcMs > win2h) continue;
      if (!['level_call','chart_level'].includes(k.role)) continue;
      if (!k.levels || k.levels.length === 0) continue;
      const hit = k.levels.find(l => Math.abs(l - strike) <= tol);
      if (hit) { katConfluence = { analyst: k.analyst_norm, level: hit, ts: k.ts }; break; }
    }
  }

  // Lead-lag: Kat called same level ≤60min before (Ximes only)
  const ledBy = [];
  if (sig.source === 'ximes' && strike !== null && katSignals) {
    const win1h  = 60 * 60 * 1000;
    const katInst = (instrument === 'SPY' || instrument === 'QQQ') ? 'SPY_QQQ' : instrument;
    for (const k of katSignals) {
      if (k.instrument !== katInst) continue;
      if (k.utcMs > sigMs || sigMs - k.utcMs > win1h) continue;
      if (!k.levels || !k.levels.some(l => Math.abs(l - strike) <= tol)) continue;
      if (!ledBy.includes(k.analyst_norm)) ledBy.push(k.analyst_norm);
    }
  }

  return {
    id:               `${sig.source || 'kat'}_${sigMs}`,
    source:           sig.source || 'kat',
    signal_type:      sig.signal_type,
    instrument,
    used_spx_gap:     usedSPX,
    ts:               sig.ts,
    utcMs:            sigMs,
    time_window:      getTimeWindow(sigMs),
    et_hour:          etHour,
    analyst:          sig.analyst || sig.analyst_norm || sig.username,
    direction,
    strike,
    entry_close:      entryBar.close,
    pnl,
    touched,
    runner_extension: +runnerExtension.toFixed(2),
    runner_viable:    runnerViable,
    max_fav:          +maxFav.toFixed(2),
    max_adv:          +maxAdv.toFixed(2),
    bobby_confluence: bobbyConfluence,
    kat_confluence:   katConfluence,
    led_by:           ledBy,
    skip:             false,
  };
}

// ── Aggregates ────────────────────────────────────────────────────────────────
function winRateFor(subset, field) {
  const el = subset.filter(o => !o.skip && o.pnl && o.pnl[field] !== undefined);
  if (!el.length) return null;
  const wins = el.filter(o => o.pnl[field] > 0).length;
  return { n: el.length, wins, rate: +(wins / el.length * 100).toFixed(1) };
}

function groupBy(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = fn(x);
    if (!out[k]) out[k] = [];
    out[k].push(x);
  }
  return out;
}

function buildAggregates(outcomes, katSignals) {
  const ximes   = outcomes.filter(o => o.source === 'ximes' && !o.skip);
  const allEval = outcomes.filter(o => !o.skip);

  const withBobby    = ximes.filter(o => o.bobby_confluence);
  const withoutBobby = ximes.filter(o => !o.bobby_confluence);
  const withKat      = allEval.filter(o => o.kat_confluence);
  const withoutKat   = allEval.filter(o => !o.kat_confluence);
  const both         = ximes.filter(o => o.bobby_confluence && o.kat_confluence);
  const neither      = ximes.filter(o => !o.bobby_confluence && !o.kat_confluence);

  const levelHits = {};
  for (const o of allEval.filter(o => o.touched && o.strike)) {
    const k = String(Math.round(o.strike));
    levelHits[k] = (levelHits[k] || 0) + 1;
  }
  const topLevels = Object.entries(levelHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([level, count]) => ({ level: Number(level), count }));

  const byHour   = {};
  for (const o of ximes) { byHour[String(o.et_hour)] = (byHour[String(o.et_hour)] || 0) + 1; }

  const byWindow = groupBy(ximes, o => o.time_window);
  const byInst   = groupBy(ximes, o => o.instrument);
  const byType   = groupBy(ximes, o => o.signal_type);

  // Kat analysts scoreboard
  const katBoard = {};
  for (const k of katSignals) {
    const a = k.analyst_norm;
    if (!katBoard[a]) katBoard[a] = { analyst: a, signals: 0, by_role: {} };
    katBoard[a].signals++;
    katBoard[a].by_role[k.role] = (katBoard[a].by_role[k.role] || 0) + 1;
  }

  // Lead-lag
  const leadLag = {};
  for (const o of ximes.filter(o => o.led_by && o.led_by.length > 0)) {
    for (const analyst of o.led_by) {
      if (!leadLag[analyst]) leadLag[analyst] = { count: 0, signals: [] };
      leadLag[analyst].count++;
      leadLag[analyst].signals.push({ ts: o.ts, strike: o.strike, instrument: o.instrument });
    }
  }

  return {
    meta: {
      run_ts:             new Date().toISOString(),
      total_outcomes:     outcomes.length,
      skipped_no_price:   outcomes.filter(o => o.skip).length,
      ximes_evaluated:    ximes.length,
      rollover_gap_count: outcomes.filter(o => o.used_spx_gap).length,
    },
    ximes: {
      overall: {
        n:            ximes.length,
        win_rate_m15: winRateFor(ximes, 'm15'),
        win_rate_m30: winRateFor(ximes, 'm30'),
        win_rate_m60: winRateFor(ximes, 'm60'),
        touch_rate:   +(ximes.filter(o => o.touched).length / (ximes.length || 1) * 100).toFixed(1),
        runner_rate:  +(ximes.filter(o => o.runner_viable).length / (ximes.length || 1) * 100).toFixed(1),
      },
      by_time_window: Object.fromEntries(
        Object.entries(byWindow).map(([w, s]) => [w, { n: s.length, win_rate_m30: winRateFor(s, 'm30') }])
      ),
      by_instrument: Object.fromEntries(
        Object.entries(byInst).map(([i, s]) => [i, { n: s.length, win_rate_m30: winRateFor(s, 'm30') }])
      ),
      by_signal_type: Object.fromEntries(
        Object.entries(byType).map(([tp, s]) => [tp, { n: s.length, win_rate_m30: winRateFor(s, 'm30') }])
      ),
      confluence_lift_bobby: {
        with:    { n: withBobby.length,    win_rate_m30: winRateFor(withBobby,    'm30') },
        without: { n: withoutBobby.length, win_rate_m30: winRateFor(withoutBobby, 'm30') },
      },
      kat_confluence_lift: {
        with:    { n: withKat.length,    win_rate_m30: winRateFor(withKat,    'm30') },
        without: { n: withoutKat.length, win_rate_m30: winRateFor(withoutKat, 'm30') },
      },
      top_levels: topLevels,
      signals_by_hour_et: byHour,
    },
    kat_analysts:      Object.values(katBoard),
    lead_lag_analysis: leadLag,
    combined_edge: {
      both:    { n: both.length,    win_rate_m30: winRateFor(both,    'm30') },
      neither: { n: neither.length, win_rate_m30: winRateFor(neither, 'm30') },
    },
  };
}

// ── Console summary ───────────────────────────────────────────────────────────
function printSummary(agg) {
  const x  = agg.ximes;
  const wr = r => r ? `${r.rate}% (${r.wins}/${r.n})` : 'N/A';
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  BACKTEST SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Outcomes total:  ${agg.meta.total_outcomes}  skipped: ${agg.meta.skipped_no_price}`);
  console.log(`  Rollover-gap (SPX fallback): ${agg.meta.rollover_gap_count}`);
  console.log('');
  console.log(`  Ximes (n=${x.overall.n})`);
  console.log(`    touch: ${x.overall.touch_rate}%  runner: ${x.overall.runner_rate}%`);
  console.log(`    WR@15m ${wr(x.overall.win_rate_m15)}  @30m ${wr(x.overall.win_rate_m30)}  @60m ${wr(x.overall.win_rate_m60)}`);
  console.log('');
  console.log('  By time window:');
  for (const [w, v] of Object.entries(x.by_time_window)) {
    console.log(`    ${w.padEnd(12)} n=${v.n}  WR@30m ${wr(v.win_rate_m30)}`);
  }
  console.log('');
  console.log('  By instrument:');
  for (const [i, v] of Object.entries(x.by_instrument)) {
    console.log(`    ${i.padEnd(8)} n=${v.n}  WR@30m ${wr(v.win_rate_m30)}`);
  }
  console.log('');
  console.log('  Bobby confluence lift @30m:');
  console.log(`    with   : ${wr(x.confluence_lift_bobby.with.win_rate_m30)}  (n=${x.confluence_lift_bobby.with.n})`);
  console.log(`    without: ${wr(x.confluence_lift_bobby.without.win_rate_m30)}  (n=${x.confluence_lift_bobby.without.n})`);
  console.log('');
  console.log('  Kat confluence lift @30m:');
  console.log(`    with   : ${wr(x.kat_confluence_lift.with.win_rate_m30)}  (n=${x.kat_confluence_lift.with.n})`);
  console.log(`    without: ${wr(x.kat_confluence_lift.without.win_rate_m30)}  (n=${x.kat_confluence_lift.without.n})`);
  console.log('');
  console.log('  Combined edge (both confluences vs neither) @30m:');
  console.log(`    both   : ${wr(agg.combined_edge.both.win_rate_m30)}  (n=${agg.combined_edge.both.n})`);
  console.log(`    neither: ${wr(agg.combined_edge.neither.win_rate_m30)}  (n=${agg.combined_edge.neither.n})`);
  if (x.top_levels.length > 0) {
    console.log('');
    console.log('  Top touched levels:');
    x.top_levels.slice(0, 5).forEach(({ level, count }) =>
      console.log(`    ${level}: ${count}x`)
    );
  }
  if (Object.keys(agg.lead_lag_analysis).length > 0) {
    console.log('');
    console.log('  Lead-lag (Kat analysts who led Ximes ≤60m):');
    for (const [a, v] of Object.entries(agg.lead_lag_analysis)) {
      console.log(`    ${a}: ${v.count} signals`);
    }
  }
  console.log('══════════════════════════════════════════════════════\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n── toUtcMs sanity check ──────────────────────────────');
  runSanityCheck();
  console.log('──────────────────────────────────────────────────────\n');

  const dirFiles  = fs.readdirSync(BACKTEST_DIR);
  const ximesFile = dirFiles.find(f => f.includes('ximes-dubz'));
  const bobbyFile = dirFiles.find(f => f.includes('bobby-spx-coms'));

  if (!ximesFile) { console.error('No ximes-dubz file in', BACKTEST_DIR); process.exit(1); }
  if (!bobbyFile) { console.error('No bobby-spx-coms file in', BACKTEST_DIR); process.exit(1); }

  resetSessionContext();
  const ximesSigs = parseDiscordFile(path.join(BACKTEST_DIR, ximesFile), 'ximes-dubz');
  const bobbySigs = parseDiscordFile(path.join(BACKTEST_DIR, bobbyFile), 'bobby-spx-coms');

  const ximesLE  = ximesSigs.filter(s => s.signal_type === 'LIVE_ENTRY');
  const ximesPM  = ximesSigs.filter(s => s.signal_type === 'PRE_MARKET_SETUP');
  const allXimes = [...ximesLE, ...ximesPM];

  console.log(`Ximes LIVE_ENTRY:       ${ximesLE.length}`);
  console.log(`Ximes PRE_MARKET_SETUP: ${ximesPM.length}`);
  console.log(`Bobby contexts:         ${bobbySigs.length}`);

  const katSignals = loadKatSignals(KAT_SIGNALS);
  const katByRole  = {};
  for (const k of katSignals) { katByRole[k.role] = (katByRole[k.role] || 0) + 1; }
  console.log('Kat signals loaded:', JSON.stringify(katByRole));

  const priceIndex = buildPriceIndex(BACKTEST_DIR);
  for (const [inst, map] of Object.entries(priceIndex)) {
    if (map.size === 0) continue;
    const keys = [...map.keys()].sort();
    console.log(`Price ${inst.padEnd(5)}: ${map.size} bars  ${new Date(keys[0]).toISOString().slice(0,10)} → ${new Date(keys[keys.length-1]).toISOString().slice(0,10)}`);
  }

  // Date overlap
  const allMs = [...allXimes, ...bobbySigs].map(s => s.utcMs).filter(Boolean);
  if (allMs.length) {
    console.log(`Discord range: ${new Date(Math.min(...allMs)).toISOString().slice(0,10)} → ${new Date(Math.max(...allMs)).toISOString().slice(0,10)}`);
  }
  console.log(`Signals in rollover gap: ${allXimes.filter(s => inRolloverGap(s.utcMs)).length}`);

  const withPrice = allXimes.filter(s => {
    const inst = resolveInstrumentFromSig(s);
    if (!inst) return false;
    const usedSPX = (inst === 'ES' || inst === 'NQ') && inRolloverGap(s.utcMs);
    const mk = usedSPX ? 'SPX' : resolveMapKey(inst, s.ticker);
    const map = priceIndex[mk];
    return map && barNear(map, s.utcMs, 5 * 60000) !== null;
  });
  console.log(`Ximes with price data:   ${withPrice.length}/${allXimes.length}`);

  console.log('\nFirst 5 Ximes LIVE_ENTRY:');
  ximesLE.slice(0, 5).forEach(s =>
    console.log(`  ${s.ts}  ${s.analyst}  ${s.ticker}  strike=${s.strike}  ${s.direction}`)
  );
  console.log('\nFirst 5 Bobby contexts:');
  bobbySigs.slice(0, 5).forEach(s =>
    console.log(`  ${s.ts}  king_nodes=[${s.king_nodes?.join(',')}]  bias=${s.bias}`)
  );
  console.log('\nFirst 5 Kat signals:');
  katSignals.slice(0, 5).forEach(s =>
    console.log(`  ${s.ts}  ${s.analyst_norm}  ${s.role}  ${s.ticker}  levels=[${s.levels?.join(',')}]`)
  );

  if (DRY_RUN) {
    console.log('\n[dry-run] Stopping before evaluation.\n');
    return;
  }

  // Full evaluation
  const outcomes = [];
  for (const sig of allXimes) {
    const out = evaluateSignal(sig, priceIndex, bobbySigs, katSignals);
    if (out) outcomes.push(out);
  }

  if (!fs.existsSync(BACKTEST_DIR)) fs.mkdirSync(BACKTEST_DIR, { recursive: true });
  const jsonlPath = path.join(BACKTEST_DIR, 'signals-parsed.jsonl');
  fs.writeFileSync(jsonlPath, outcomes.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.log(`\nWrote ${outcomes.length} outcomes → ${jsonlPath}`);

  const agg = buildAggregates(outcomes, katSignals);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const resultPath = path.join(BACKTEST_DIR, `results-${stamp}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(agg, null, 2));
  console.log(`Wrote aggregates → ${resultPath}`);

  printSummary(agg);
}

main();
