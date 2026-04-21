'use strict';

const fs = require('fs');
const path = require('path');
const { detectConfluence, inferInstrument } = require('./confluence');
const { calculateBracket } = require('./bracket-calc');

const JARVIS_ROOT = path.join(__dirname, '..');
const DISCORD_HISTORY = path.join(JARVIS_ROOT, 'discord-history.jsonl');

function loadHistory(startMs, endMs) {
  if (!fs.existsSync(DISCORD_HISTORY)) return [];
  return fs.readFileSync(DISCORD_HISTORY, 'utf8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .filter(entry => {
      const ts = new Date(entry.date).getTime();
      return ts >= startMs && ts <= endMs;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function isActionable(entry) {
  if (entry.signal_type !== 'LIVE_ENTRY' && entry.signal_type !== 'PRE_MARKET_SETUP') return false;
  const strike = entry.strike || entry.entry_price || null;
  if (!strike) return false;
  return true;
}

function resolveDirection(entry) {
  if (entry.direction) return entry.direction;
  if (entry.bias === 'BULLISH') return 'LONG';
  if (entry.bias === 'BEARISH') return 'SHORT';
  return null;
}

function toBobbyContext(entry) {
  if (!entry.king_nodes && !entry.support && !entry.resistance) return null;
  return {
    king_nodes:  entry.king_nodes  || [],
    support:     entry.support     || [],
    resistance:  entry.resistance  || [],
    bias:        entry.bias        || 'NEUTRAL',
    has_image:   !!entry.has_image,
  };
}

function simulateAlert(signal, cumulativeEntries) {
  const strike = signal.strike || signal.entry_price;
  const direction = resolveDirection(signal);
  const ticker = (signal.ticker || '').toUpperCase();

  const ximesSignals = cumulativeEntries.filter(e =>
    e.signal_type === 'LIVE_ENTRY' ||
    e.signal_type === 'PRE_MARKET_SETUP' ||
    e.signal_type === 'CONTEXT' ||
    e.signal_type === 'SIZING_NOTE'
  );

  const bobbyContext = cumulativeEntries
    .map(toBobbyContext)
    .filter(Boolean);

  const zones = detectConfluence(ximesSignals, bobbyContext, null);

  if (!strike || !direction || !ticker) {
    return {
      jarvis_verdict: 'SKIP',
      confluences_available: zones.length,
      confidence: null,
      reason: 'missing strike/direction/ticker',
    };
  }

  const instrument = inferInstrument(strike);
  const matchWindow = instrument === 'ES_NQ' ? 25 : 4;
  const hit = zones.find(z => Math.abs(z.level - strike) <= matchWindow);

  if (!hit) {
    return {
      jarvis_verdict: 'SKIP',
      confluences_available: zones.length,
      confidence: null,
      reason: 'no confluence zone near strike',
    };
  }

  if (hit.confidence !== 'HIGH') {
    return {
      jarvis_verdict: 'WEAK',
      confluences_available: zones.length,
      confidence: hit.confidence,
      reason: `${hit.confidence} confluence at ${hit.level} (score: ${hit.score})`,
    };
  }

  const bracketSignal = { ...signal, ticker, direction, strike };
  const bracket = calculateBracket(bracketSignal, zones, strike);

  if (bracket.error) {
    return { jarvis_verdict: 'SKIP', reason: 'bracket error: ' + bracket.error };
  }
  if (bracket.flag === 'reject') {
    return {
      jarvis_verdict: 'SKIP',
      confluences_available: zones.length,
      confidence: hit.confidence,
      reason: bracket.flag_message,
    };
  }

  return {
    jarvis_verdict: bracket.flag === 'warning' ? 'WEAK' : 'SETUP',
    jarvis_entry:  bracket.entry,
    jarvis_stop:   bracket.stop,
    jarvis_target: bracket.target,
    jarvis_rr:     bracket.rr_ratio,
    confluences_available: zones.length,
    confidence: hit.confidence,
  };
}

function replaySession(startTimestamp, endTimestamp, options = {}) {
  const verbose = options.verbose !== false;

  let entries = loadHistory(startTimestamp, endTimestamp);

  // If no entries in the window, widen to all available data
  if (entries.length === 0) {
    if (verbose) console.log('[replay] no entries in window — widening to all available data');
    entries = loadHistory(0, Date.now() + 86400000);
  }

  if (verbose) console.log(`[replay] loaded ${entries.length} entries`);

  // Detect bulk-export data: if all entries share the same second, use full
  // session as context for every signal (historical snapshot, not live stream).
  const timestamps = entries.map(e => Math.floor(new Date(e.date).getTime() / 1000));
  const uniqueSeconds = new Set(timestamps).size;
  const isBulkExport = uniqueSeconds <= Math.max(1, Math.ceil(entries.length / 50));

  if (verbose && isBulkExport) console.log('[replay] bulk-export detected — using full session context for each signal');

  const results = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!isActionable(entry)) continue;

    // Live-stream: cumulative context. Bulk export: full session context.
    const cumulative = isBulkExport ? entries : entries.slice(0, i + 1);
    const sim = simulateAlert(entry, cumulative);

    const result = {
      timestamp:            entry.date,
      analyst:              entry.analyst || 'unknown',
      signal_type:          entry.signal_type,
      ticker:               (entry.ticker || '').toUpperCase(),
      direction:            resolveDirection(entry),
      strike:               entry.strike || entry.entry_price || null,
      jarvis_verdict:       sim.jarvis_verdict,
      jarvis_entry:         sim.jarvis_entry         ?? null,
      jarvis_stop:          sim.jarvis_stop          ?? null,
      jarvis_target:        sim.jarvis_target        ?? null,
      jarvis_rr:            sim.jarvis_rr            ?? null,
      confluences_available: sim.confluences_available ?? 0,
      confidence:           sim.confidence            ?? null,
      reason:               sim.reason                ?? null,
    };

    results.push(result);
  }

  if (verbose) {
    const setups = results.filter(r => r.jarvis_verdict === 'SETUP').length;
    const weak   = results.filter(r => r.jarvis_verdict === 'WEAK').length;
    const skips  = results.filter(r => r.jarvis_verdict === 'SKIP').length;
    console.log(`[replay] ${results.length} signals processed — SETUP:${setups} WEAK:${weak} SKIP:${skips}`);
  }

  return results;
}

module.exports = { replaySession };
