'use strict';

function inferInstrument(level, tickerHint) {
  if (tickerHint) {
    const t = tickerHint.toUpperCase();
    if (['ES','MES','NQ','MNQ'].includes(t)) return 'ES_NQ';
    if (t === 'SPX')                          return 'SPX';
    if (['SPY','QQQ'].includes(t))            return 'SPY_QQQ';
  }
  const n = parseFloat(level);
  if (isNaN(n) || n <= 0)   return null;
  if (n >= 1000)            return 'ES_NQ';
  if (n >= 50 && n < 1000)  return 'SPY_QQQ';
  return null;
}

function getToleranceByInstrument(instrument) {
  if (instrument === 'ES_NQ')    return 10.0;
  if (instrument === 'SPX')      return 10.0;
  if (instrument === 'SPY_QQQ')  return 2.0;
  return 2.0;
}

function extractNumbers(text) {
  return [...String(text).matchAll(/\$?([\d,]+(?:\.\d+)?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 50);
}

function sigTimestampMs(sig) {
  const raw = sig.date || sig.timestamp || sig.ts || null;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const ms = new Date(raw).getTime();
  return isNaN(ms) ? 0 : ms;
}

function freshnessScore(ts_ms) {
  if (!ts_ms || ts_ms <= 0) return 1.0;
  const ageHours = (Date.now() - ts_ms) / 3600000;
  if (ageHours < 0.5)  return 1.0;
  if (ageHours < 2)    return 0.7;
  if (ageHours < 4)    return 0.4;
  return 0.2;
}

function extractXiLevels(sig) {
  const results = [];
  const analyst  = sig.analyst   || null;
  const ticker   = sig.ticker    || null;
  const sigType  = sig.signal_type || null;
  const source   = sig.source    || null;
  const bias     = sig.bias      || 'NEUTRAL';
  const ts_ms    = sigTimestampMs(sig);

  const push = (level, st) => {
    if (level > 0) results.push({ level, ticker, signalType: st, analyst, source, bias, ts_ms });
  };

  if (sigType === 'LIVE_ENTRY' || sigType === 'PRE_MARKET_SETUP') {
    if (sig.strike) push(sig.strike, sigType);
  } else if (sigType === 'CONTEXT') {
    for (const l of (sig.levels || [])) push(l, sigType);
  } else if (sigType === 'SIZING_NOTE') {
    for (const l of extractNumbers(sig.note || sig.raw || '')) push(l, sigType);
  } else {
    if (sig.strike) push(sig.strike, 'UNKNOWN');
    else if (analyst === 'richydubz') {
      for (const l of extractNumbers(sig.raw || '')) push(l, 'CONTEXT');
    }
  }
  return results;
}

function extractBobbyLevels(bob) {
  const bias     = bob.bias      || 'NEUTRAL';
  const hasImage = !!bob.has_image || bob.source === 'bobby-vision' || !!bob.vision_parsed;
  const ts_ms    = sigTimestampMs(bob);
  const results  = [];
  // Bobby exclusively covers SPX. Levels in the 4000-9000 range are SPX, not ES.
  function inferBobbyInstrument(level) {
    if (level >= 4000 && level <= 9000) return 'SPX';
    return inferInstrument(level);
  }
  for (const l of (bob.king_nodes || [])) if (l > 0) results.push({ level: l, type: 'king_node', bias, hasImage, ts_ms, _instrument: inferBobbyInstrument(l) });
  for (const l of (bob.support   || [])) if (l > 0) results.push({ level: l, type: 'support',   bias, hasImage, ts_ms, _instrument: inferBobbyInstrument(l) });
  for (const l of (bob.resistance|| [])) if (l > 0) results.push({ level: l, type: 'resistance', bias, hasImage, ts_ms, _instrument: inferBobbyInstrument(l) });
  return results;
}

function inZone(level, zoneRange) {
  return level >= zoneRange[0] && level <= zoneRange[1];
}

function dominantBias(biases) {
  const bull = biases.filter(b => b === 'BULLISH').length;
  const bear = biases.filter(b => b === 'BEARISH').length;
  return bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL';
}

function detectConfluence(ximesSignals, bobbyContext, currentPrice) {
  const xiLevels = (ximesSignals || []).flatMap(extractXiLevels)
    .map(x => ({ ...x, instrument: inferInstrument(x.level, x.ticker) }))
    .filter(x => x.instrument !== null);
  const bobLevels = (bobbyContext || []).flatMap(extractBobbyLevels)
    .map(b => ({ ...b, instrument: b._instrument || inferInstrument(b.level) }))
    .filter(b => b.instrument !== null);

  const instruments = [...new Set([
    ...xiLevels.map(x => x.instrument),
    ...bobLevels.map(b => b.instrument)
  ])];

  const zones = [];

  for (const instrument of instruments) {
    const tol      = getToleranceByInstrument(instrument);
    const xiGroup  = xiLevels.filter(x => x.instrument === instrument);
    const bobGroup = bobLevels.filter(b => b.instrument === instrument);

    const allValues = [...new Set([
      ...xiGroup.map(x => x.level),
      ...bobGroup.map(b => b.level)
    ])].filter(l => l > 0).sort((a, b) => a - b);

    if (allValues.length === 0) continue;

    const clusters = [];
    let current = [allValues[0]];
    for (let i = 1; i < allValues.length; i++) {
      if (allValues[i] - current[current.length - 1] <= tol * 2) {
        current.push(allValues[i]);
      } else {
        clusters.push(current);
        current = [allValues[i]];
      }
    }
    clusters.push(current);

    for (const cluster of clusters) {
      const center    = cluster.reduce((a, b) => a + b, 0) / cluster.length;
      const zoneRange = [
        Math.round((center - tol) * 100) / 100,
        Math.round((center + tol) * 100) / 100
      ];

      let score = 0;
      const sources    = [];
      const biases     = [];
      const timestamps = [];

      const seenXi = new Set();
      for (const xi of xiGroup) {
        if (!inZone(xi.level, zoneRange)) continue;
        const key = `${xi.analyst}:${xi.signalType}:${xi.level}`;
        if (seenXi.has(key)) continue;
        seenXi.add(key);

        const isXimes = xi.analyst === 'ximes';
        const isRichy = xi.analyst === 'richydubz' || xi.source === 'richydubz-context';
        const st      = xi.signalType;

        if (isXimes && (st === 'LIVE_ENTRY' || st === 'PRE_MARKET_SETUP')) {
          score += 2; sources.push(`ximes:${st}`);
        } else if (isRichy && st === 'CONTEXT') {
          score += 1; sources.push('richydubz:CONTEXT');
        } else if (isXimes && st === 'CONTEXT') {
          score += 1; sources.push('ximes:CONTEXT');
        } else if (isXimes && st === 'SIZING_NOTE') {
          score += 1; sources.push('ximes:SIZING_NOTE');
        }

        if (xi.bias && xi.bias !== 'NEUTRAL') biases.push(xi.bias);
        if (xi.ts_ms > 0) timestamps.push(xi.ts_ms);
      }

      const bobHits = bobGroup.filter(b => inZone(b.level, zoneRange));
      const imageEntryIds = new Set();

      for (const bob of bobHits) {
        score += 2;
        sources.push(`bobby:${bob.type}`);
        if (bob.bias && bob.bias !== 'NEUTRAL') biases.push(bob.bias);
        if (bob.ts_ms > 0) timestamps.push(bob.ts_ms);

        const imgKey = `${bob.level}:${bob.hasImage}`;
        if (bob.hasImage && !imageEntryIds.has(imgKey)) {
          imageEntryIds.add(imgKey);
          score += 2;
          sources.push('bobby:has_image');
        }
      }

      if (score === 0) continue;

      // PHASE 2 — time decay: freshness based on newest contributing source
      const newestTs = timestamps.length > 0 ? Math.max(...timestamps) : 0;
      const freshness = freshnessScore(newestTs);
      const raw_score = score;
      const effective_score = Math.round(score * freshness * 10) / 10;
      const aging = freshness < 0.5;

      // confidence uses effective score; if all sources > 4hr, demote HIGH→MEDIUM
      let confidence = effective_score >= 5 ? 'HIGH' : effective_score >= 3 ? 'MEDIUM' : 'LOW';
      if (aging && confidence === 'HIGH') confidence = 'MEDIUM';

      zones.push({
        level:      Math.round(center * 100) / 100,
        zone:       zoneRange,
        score:      effective_score,
        raw_score,
        freshness,
        aging,
        confidence,
        instrument,
        sources:    [...new Set(sources)],
        bias:       dominantBias(biases)
      });
    }
  }

  return zones.sort((a, b) => b.score - a.score);
}

module.exports = { detectConfluence, inferInstrument };
