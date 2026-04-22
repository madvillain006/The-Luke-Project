'use strict';
const fs   = require('fs');
const path = require('path');

const PROCESSED = path.join(__dirname, '../data/kat/processed-signals.jsonl');
const WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function katTickerToInstrument(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase();
  if (['SPX','ES','MES'].includes(t))   return 'SPX';
  if (['SPY','QQQ'].includes(t))        return 'SPY_QQQ';
  if (['NQ','MNQ','NDX'].includes(t))   return 'ES_NQ';
  return null;
}

function getRecentKatSignals(instrument, windowMs) {
  windowMs = windowMs || WINDOW_MS;
  if (!fs.existsSync(PROCESSED)) return [];
  const cutoff = Date.now() - windowMs;
  const lines  = fs.readFileSync(PROCESSED, 'utf8')
    .split('\n').filter(l => l.trim());

  const results = [];
  for (const line of lines) {
    try {
      const sig = JSON.parse(line);
      if (!sig.ts) continue;
      if (new Date(sig.ts).getTime() < cutoff) continue;

      const sigInstrument = katTickerToInstrument(sig.ticker);
      if (sigInstrument !== instrument) continue;

      if (!['CHART_ANALYSIS','DIRECTIONAL','LEVEL_WATCH'].includes(sig.signal_type)) continue;

      results.push(sig);
    } catch (e) {}
  }
  return results;
}

function katSignalsToZones(katSignals) {
  const zones = [];
  for (const sig of katSignals) {
    const ageMs   = Date.now() - new Date(sig.ts).getTime();
    const ageMins = ageMs / 60000;

    let freshness = 1.0;
    if (ageMins > 20)  freshness = 0.7;
    if (ageMins > 60)  freshness = 0.4;
    if (ageMins > 240) freshness = 0.2;

    let baseScore = 0;
    if (sig.signal_type === 'CHART_ANALYSIS' && sig.has_image) baseScore = 2;
    else if (sig.signal_type === 'DIRECTIONAL')                 baseScore = 1;
    else if (sig.signal_type === 'LEVEL_WATCH')                 baseScore = 2;

    const score = parseFloat((baseScore * freshness).toFixed(2));

    if (sig.bias && sig.bias !== 'NEUTRAL' && sig.levels && sig.levels.length === 0) {
      zones.push({
        level:       null,
        score,
        instrument:  katTickerToInstrument(sig.ticker),
        source:      'kat',
        analyst:     sig.analyst,
        bias:        sig.bias,
        signal_type: sig.signal_type,
        ts:          sig.ts,
        bias_only:   true
      });
    }

    for (const level of (sig.levels || [])) {
      zones.push({
        level,
        score,
        instrument:  katTickerToInstrument(sig.ticker),
        source:      'kat',
        analyst:     sig.analyst,
        bias:        sig.bias,
        signal_type: sig.signal_type,
        ts:          sig.ts,
        bias_only:   false
      });
    }
  }
  return zones;
}

function getKatContextSummary(instrument) {
  const signals = getRecentKatSignals(instrument, WINDOW_MS);
  if (!signals.length) return null;

  const bullish   = signals.filter(s => s.bias === 'BULLISH').length;
  const bearish   = signals.filter(s => s.bias === 'BEARISH').length;
  const withImage = signals.filter(s => s.has_image).length;

  return {
    count:         signals.length,
    bullish,
    bearish,
    with_image:    withImage,
    analysts:      [...new Set(signals.map(s => s.analyst))],
    dominant_bias: bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'MIXED'
  };
}

module.exports = { getRecentKatSignals, katSignalsToZones, getKatContextSummary, katTickerToInstrument };
