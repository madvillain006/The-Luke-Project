'use strict';

const { NAMED_RULES } = require('./rules');
const {
  sweepDepthBucket,
  timeBelowBucket,
  timeOfDayBucket,
} = require('../fake-breakdown-v3/feature-extractor');

const WATCHLIST_STATES = Object.freeze({
  NO_SETUP: 'NO_SETUP',
  LEVEL_WATCH: 'LEVEL_WATCH',
  ZONE_WATCH: 'ZONE_WATCH',
  BREAKDOWN_DETECTED: 'BREAKDOWN_DETECTED',
  RECLAIM_WATCH: 'RECLAIM_WATCH',
  ARMED_RULE_A: 'ARMED_RULE_A',
  ARMED_RULE_B: 'ARMED_RULE_B',
  ARMED_RULE_C: 'ARMED_RULE_C',
  WATCH_ONLY: 'WATCH_ONLY',
  INVALIDATED: 'INVALIDATED',
  EXPIRED: 'EXPIRED',
});

const RULE_STATUS = Object.freeze({
  A: 'WATCHLIST_ONLY',
  B: 'WATCHLIST_ONLY',
  C: 'WATCHLIST_ONLY',
});

const SOURCE_ORDER = ['saty', 'mancini', 'bobby', 'dubz', 'gex', 'katbot', 'jefe', 'unknown'];
const EXECUTABLE_BASIS_METHODS = new Set(['same_minute_basis', 'session_open_basis', 'prior_close_basis', 'rolling_15m_basis']);

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tsMs(value) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function todayEt(now = new Date()) {
  return new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function normalizeInstrument(value) {
  return String(value || 'ES').toUpperCase();
}

function ruleMeta(id) {
  const rule = NAMED_RULES.find(item => item.id === id);
  return {
    id,
    label: rule?.label || `Rule ${id}`,
    status: RULE_STATUS[id] || 'WATCHLIST_ONLY',
  };
}

function sourceFromMention(mention = {}) {
  const text = [
    mention.analyst,
    mention.source_type,
    mention.source_id,
    mention.source_snippet,
    mention.intent,
    mention.significance,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/saty|atr/.test(text)) return 'saty';
  if (/mancini/.test(text)) return 'mancini';
  if (/bobby|heatmap|node|king/.test(text)) return 'bobby';
  if (/dubz|richy/.test(text)) return 'dubz';
  if (/gex|heatseeker|gamma/.test(text)) return 'gex';
  if (/katbot|kat/.test(text)) return 'katbot';
  if (/jefe/.test(text)) return 'jefe';
  return 'unknown';
}

function sourceComboFromMentions(mentions = []) {
  const sources = new Set((mentions || []).map(sourceFromMention));
  return [...sources].sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b)).join('+') || 'unknown';
}

function canCreateTrustedLevel(sources) {
  const set = new Set(String(sources || '').split('+'));
  if (set.has('saty') || set.has('mancini') || set.has('bobby') || set.has('dubz') || set.has('gex')) return true;
  return false;
}

function normalizeLevelRecord(level, executableInstrument) {
  const originalInstrument = normalizeInstrument(level.instrument);
  const price = toNumber(level.canonical_price ?? level.price ?? level.level ?? level.executable_level);
  const sources = sourceComboFromMentions(level.mentions || []);
  const trusted = canCreateTrustedLevel(sources);
  const explicitBasis = level.basis_method || level.basisMethod || null;
  const explicitEquivalent = toNumber(level.es_equivalent ?? level.executable_level);
  const native = originalInstrument === executableInstrument;
  const basisExecutable = originalInstrument === 'SPX'
    && executableInstrument === 'ES'
    && EXECUTABLE_BASIS_METHODS.has(explicitBasis)
    && Number.isFinite(explicitEquivalent);
  const executable = trusted && (native || basisExecutable);
  return {
    raw: level,
    instrument: executable ? executableInstrument : originalInstrument,
    original_instrument: originalInstrument,
    price: basisExecutable ? explicitEquivalent : price,
    original_price: price,
    basis_method: native ? 'native_es' : (basisExecutable ? explicitBasis : 'reference_only'),
    executable,
    trusted,
    source_combo: sources,
    level_type: inferLevelType(level),
    first_seen: level.first_seen || null,
    last_seen: level.last_seen || null,
    total_mentions: level.total_mentions ?? (level.mentions || []).length,
  };
}

function inferLevelType(level = {}) {
  const text = (level.mentions || []).map(mention => [
    mention.intent,
    mention.direction,
    mention.significance,
    mention.source_type,
  ].filter(Boolean).join(' ')).join(' ').toLowerCase();
  if (/target|resistance|magnet|wall/.test(text)) return 'target_or_resistance';
  if (/support|floor|trigger/.test(text)) return 'support_or_trigger';
  if (/chop/.test(text)) return 'chop_boundary';
  if (/atr|saty/.test(text)) return 'saty_atr';
  return 'trusted_level';
}

function normalizeLevels(levels = [], instrument = 'ES') {
  const normalizedInstrument = normalizeInstrument(instrument);
  const normalized = (levels || [])
    .map(level => normalizeLevelRecord(level, normalizedInstrument))
    .filter(level => Number.isFinite(level.price));
  return {
    executable: normalized.filter(level => level.executable && level.instrument === normalizedInstrument),
    references: normalized.filter(level => !level.executable),
  };
}

function nearestLevel(levels, price) {
  if (!Number.isFinite(price)) return null;
  return (levels || []).slice().sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))[0] || null;
}

function nearestAbove(levels, basePrice) {
  if (!Number.isFinite(basePrice)) return null;
  return (levels || [])
    .filter(level => level.price > basePrice)
    .sort((a, b) => a.price - b.price)[0] || null;
}

function nearestBobbyAbove(levels, basePrice) {
  if (!Number.isFinite(basePrice)) return null;
  return (levels || [])
    .filter(level => level.price > basePrice && String(level.source_combo).includes('bobby'))
    .sort((a, b) => a.price - b.price)[0] || null;
}

function freshUsablePrice(marketData) {
  return Number.isFinite(marketData?.price)
    && marketData.stale !== true
    && marketData.delayed !== true
    && (marketData.confidence ?? 0) >= 0.6;
}

function summarizeMarketData(marketData, instrument) {
  const price = toNumber(marketData?.price);
  return {
    instrument: normalizeInstrument(marketData?.instrument || instrument),
    symbol: marketData?.symbol || normalizeInstrument(instrument),
    price,
    timestamp: marketData?.timestamp || null,
    source: marketData?.source || (price === null ? 'UNKNOWN' : 'unknown'),
    stale: marketData?.stale !== undefined ? Boolean(marketData.stale) : true,
    delayed: marketData?.delayed !== undefined ? Boolean(marketData.delayed) : true,
    confidence: Number.isFinite(marketData?.confidence) ? marketData.confidence : 0,
    status: freshUsablePrice({ ...marketData, price }) ? 'fresh' : 'UNKNOWN_OR_STALE',
    error: marketData?.error || null,
  };
}

function sortBars(bars = [], now) {
  const end = tsMs(now);
  return (bars || [])
    .filter(bar => Number.isFinite(toNumber(bar.high)) && Number.isFinite(toNumber(bar.low)) && Number.isFinite(toNumber(bar.close)))
    .filter(bar => {
      const t = tsMs(bar.timestamp);
      return Number.isFinite(t) && (!Number.isFinite(end) || t <= end);
    })
    .map(bar => ({
      timestamp: bar.timestamp,
      open: toNumber(bar.open),
      high: toNumber(bar.high),
      low: toNumber(bar.low),
      close: toNumber(bar.close),
    }))
    .sort((a, b) => tsMs(a.timestamp) - tsMs(b.timestamp));
}

function consecutiveClosesAbove(bars, levelPrice, count) {
  if (!Number.isFinite(levelPrice) || bars.length < count) return false;
  return bars.slice(-count).every(bar => bar.close >= levelPrice);
}

function analyzeRecentBars({ bars = [], levelPrice, now, config = {} }) {
  const sorted = sortBars(bars, now);
  const breakdownMinPoints = config.breakdownMinPoints ?? 1;
  const reclaimWindowMinutes = config.reclaimWindowMinutes ?? 15;
  const maxReclaimRange = config.maxReclaimRange ?? 6;
  if (!sorted.length || !Number.isFinite(levelPrice)) {
    return {
      has_bars: false,
      phase: 'no_bars',
      state: null,
      required_next_condition: 'Need recent ES one-minute bars to detect breakdown/reclaim state.',
      transitions: [],
    };
  }

  const breakdownIndex = sorted.map((bar, index) => ({ bar, index }))
    .filter(item => item.bar.low <= levelPrice - breakdownMinPoints && item.bar.close < levelPrice)
    .at(-1);
  if (!breakdownIndex) {
    return {
      has_bars: true,
      phase: 'pre_breakdown',
      state: null,
      required_next_condition: 'Need trade below level by 1-3 ES points.',
      transitions: [],
    };
  }

  const afterBreakdown = sorted.slice(breakdownIndex.index);
  const reclaimIndexRelative = afterBreakdown.findIndex((bar, index) => {
    if (index === 0) return false;
    const mins = minutesBetween(breakdownIndex.bar.timestamp, bar.timestamp);
    return Number.isFinite(mins) && mins <= reclaimWindowMinutes && bar.close >= levelPrice;
  });
  const sweepLow = Math.min(...afterBreakdown.map(bar => bar.low));
  const breakdownDepth = rounded(levelPrice - sweepLow);

  if (reclaimIndexRelative < 0) {
    const elapsed = minutesBetween(breakdownIndex.bar.timestamp, sorted.at(-1)?.timestamp);
    const expired = Number.isFinite(elapsed) && elapsed > reclaimWindowMinutes;
    return {
      has_bars: true,
      phase: expired ? 'expired_no_reclaim' : 'breakdown',
      state: expired ? WATCHLIST_STATES.EXPIRED : WATCHLIST_STATES.BREAKDOWN_DETECTED,
      required_next_condition: expired ? 'Reclaim window expired.' : 'Need close back above level within 15 minutes.',
      breakdown_timestamp_et: breakdownIndex.bar.timestamp,
      breakdown_depth_points: breakdownDepth,
      sweep_depth_bucket: sweepDepthBucket(breakdownDepth),
      sweep_low: rounded(sweepLow),
      transitions: [{ state: WATCHLIST_STATES.BREAKDOWN_DETECTED, timestamp_et: breakdownIndex.bar.timestamp }],
    };
  }

  const reclaimIndex = breakdownIndex.index + reclaimIndexRelative;
  const reclaimBar = sorted[reclaimIndex];
  const afterReclaim = sorted.slice(reclaimIndex);
  const invalidation = afterReclaim.slice(1).find(bar => bar.close < levelPrice);
  const reclaimRange = reclaimBar.high - reclaimBar.low;
  const timeBelow = minutesBetween(breakdownIndex.bar.timestamp, reclaimBar.timestamp);
  const transitions = [
    { state: WATCHLIST_STATES.BREAKDOWN_DETECTED, timestamp_et: breakdownIndex.bar.timestamp },
    { state: WATCHLIST_STATES.RECLAIM_WATCH, timestamp_et: reclaimBar.timestamp },
  ];

  if (invalidation) {
    transitions.push({ state: WATCHLIST_STATES.INVALIDATED, timestamp_et: invalidation.timestamp, reason: 'close_back_below_reclaimed_level' });
    return {
      has_bars: true,
      phase: 'invalidated',
      state: WATCHLIST_STATES.INVALIDATED,
      required_next_condition: 'Reclaimed level was lost.',
      breakdown_timestamp_et: breakdownIndex.bar.timestamp,
      reclaim_timestamp_et: reclaimBar.timestamp,
      breakdown_depth_points: breakdownDepth,
      sweep_depth_bucket: sweepDepthBucket(breakdownDepth),
      sweep_low: rounded(sweepLow),
      minutes_below_level: timeBelow,
      time_below_bucket: timeBelowBucket(timeBelow),
      reclaim_range: rounded(reclaimRange),
      reclaim_range_not_excessive: reclaimRange <= maxReclaimRange,
      transitions,
    };
  }

  return {
    has_bars: true,
    phase: 'reclaimed',
    state: WATCHLIST_STATES.RECLAIM_WATCH,
    required_next_condition: 'Need pre-entry hold/target condition for Rule A, B, or C.',
    breakdown_timestamp_et: breakdownIndex.bar.timestamp,
    reclaim_timestamp_et: reclaimBar.timestamp,
    breakdown_depth_points: breakdownDepth,
    sweep_depth_bucket: sweepDepthBucket(breakdownDepth),
    sweep_low: rounded(sweepLow),
    minutes_below_level: timeBelow,
    time_below_bucket: timeBelowBucket(timeBelow),
    reclaim_range: rounded(reclaimRange),
    reclaim_range_not_excessive: reclaimRange <= maxReclaimRange,
    two_closes_above_level: consecutiveClosesAbove(afterReclaim, levelPrice, 2),
    three_closes_above_level: consecutiveClosesAbove(afterReclaim, levelPrice, 3),
    no_close_below_before_entry: true,
    transitions,
  };
}

function minutesBetween(from, to) {
  const a = tsMs(from);
  const b = tsMs(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function sameLevel(a, b, tolerance = 0.25) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

function hasPriorLossAtLevel({ todayLosses = [], levelPrice, now = new Date() }) {
  const today = todayEt(now);
  return (todayLosses || []).some(loss => {
    const lossDate = loss.date || String(loss.timestamp_et || loss.timestamp || '').slice(0, 10);
    const lossLevel = toNumber(loss.level ?? loss.executable_level ?? loss.price);
    const pnl = toNumber(loss.pnl);
    return lossDate === today && pnl !== null && pnl < 0 && sameLevel(lossLevel, levelPrice);
  });
}

function buildRuleCandidates(features, priorLossSameLevelToday) {
  const candidates = [];
  if (features.time_of_day_bucket_v3 === 'power_hour' && features.three_closes_above_level && features.next_trusted_target_at_least_4) {
    candidates.push({ ...ruleMeta('A'), state: WATCHLIST_STATES.ARMED_RULE_A, blocked: false });
  }
  if (features.time_of_day_bucket_v3 === 'power_hour' && features.reclaim_range_not_excessive && features.next_trusted_target_at_least_3) {
    const blocked = priorLossSameLevelToday === true;
    candidates.push({
      ...ruleMeta('B'),
      state: blocked ? WATCHLIST_STATES.WATCH_ONLY : WATCHLIST_STATES.ARMED_RULE_B,
      blocked,
      blocker: blocked ? 'BLOCKED_REPEAT_LEVEL_AFTER_LOSS' : null,
    });
  }
  if (features.bobby_heatmap_target_present && features.two_closes_above_level) {
    candidates.push({ ...ruleMeta('C'), state: WATCHLIST_STATES.ARMED_RULE_C, blocked: false });
  }
  return candidates;
}

function chooseCandidate(candidates) {
  const order = ['A', 'B', 'C'];
  return (candidates || []).slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0] || null;
}

function buildResearchPlan({ level, currentPrice, barState, nearestOverhead }) {
  const levelPrice = level?.price;
  const entryLow = Number.isFinite(levelPrice) ? rounded(levelPrice) : null;
  const entryHigh = Number.isFinite(levelPrice) ? rounded(levelPrice + 0.25) : null;
  return {
    label: 'research_reference_only',
    entry_zone: Number.isFinite(entryLow) ? `${entryLow}-${entryHigh}` : 'unavailable',
    invalidation: Number.isFinite(barState?.sweep_low)
      ? `reclaimed level lost or sweep low ${barState.sweep_low} fails`
      : (Number.isFinite(levelPrice) ? `reclaimed level ${rounded(levelPrice)} lost` : 'unavailable'),
    tp1_reference: Number.isFinite(levelPrice) ? rounded(levelPrice + 2) : null,
    next_target_reference: nearestOverhead ? rounded(nearestOverhead.price) : null,
    warning: 'WATCHLIST ONLY - not a trade recommendation.',
  };
}

function buildFakeBreakdownLiveWatchlist({
  instrument = 'ES',
  levels = [],
  marketData = null,
  recentBars = [],
  todayLosses = [],
  now = new Date(),
  config = {},
} = {}) {
  const normalizedInstrument = normalizeInstrument(instrument);
  const market = summarizeMarketData(marketData, normalizedInstrument);
  const normalized = normalizeLevels(levels, normalizedInstrument);
  const warnings = [];
  const currentPrice = market.price;

  if (normalizedInstrument !== 'ES') {
    warnings.push('fake breakdown watchlist is ES-only research');
  }
  if (currentPrice === null) warnings.push('ES market price UNKNOWN; watchlist cannot arm');
  if (currentPrice !== null && !freshUsablePrice(marketData)) warnings.push('ES market price stale/delayed/low confidence; watchlist cannot arm');
  if (normalized.references.some(level => level.original_instrument === 'SPX')) {
    warnings.push('SPX levels are reference_only unless an explicit basis exists');
  }

  const basePayload = {
    ok: true,
    endpoint_type: 'fake_breakdown_watchlist',
    read_only: true,
    strategy: 'fake_breakdown_v3_live_filters_watchlist',
    instrument: normalizedInstrument,
    generated_at: new Date(now).toISOString(),
    warning: 'WATCHLIST ONLY - not a trade recommendation.',
    rule_status: RULE_STATUS,
    state: WATCHLIST_STATES.NO_SETUP,
    rule_candidate: 'none',
    rule_candidates: [],
    current_price: currentPrice,
    market_data: market,
    active_level: null,
    source_combo: null,
    distance_to_level: null,
    target_space_above: null,
    nearest_overhead_level: null,
    prior_loss_same_level_today: false,
    no_repeat_after_loss_throttle: {
      rule: 'B',
      status: 'not_applicable',
      blocked: false,
    },
    required_next_condition: currentPrice === null ? 'Need fresh ES market price.' : 'Need trusted ES level near current price.',
    suggested_research_plan: buildResearchPlan({ level: null, currentPrice, barState: null, nearestOverhead: null }),
    state_transitions: [],
    warnings,
    references: normalized.references,
  };

  if (normalizedInstrument !== 'ES' || currentPrice === null) return basePayload;
  const active = nearestLevel(normalized.executable, currentPrice);
  if (!active) {
    return {
      ...basePayload,
      required_next_condition: normalized.references.length
        ? 'Only reference levels are available; no executable ES level without basis.'
        : 'Need trusted executable ES level.',
    };
  }

  const distance = rounded(currentPrice - active.price);
  const zoneDistance = config.zoneDistancePoints ?? 5;
  const entryReference = Math.max(active.price + 0.25, currentPrice);
  const overhead = nearestAbove(normalized.executable, entryReference);
  const bobbyOverhead = nearestBobbyAbove(normalized.executable, entryReference);
  const targetSpace = overhead ? rounded(overhead.price - entryReference) : null;
  const bobbyTargetDistance = bobbyOverhead ? rounded(bobbyOverhead.price - entryReference) : null;
  const priorLoss = hasPriorLossAtLevel({ todayLosses, levelPrice: active.price, now });

  const withLevel = {
    ...basePayload,
    active_level: {
      price: rounded(active.price),
      original_price: rounded(active.original_price),
      original_instrument: active.original_instrument,
      basis_method: active.basis_method,
      level_type: active.level_type,
      source_combo: active.source_combo,
      last_seen: active.last_seen,
      total_mentions: active.total_mentions,
    },
    source_combo: active.source_combo,
    distance_to_level: distance,
    target_space_above: targetSpace,
    nearest_overhead_level: overhead ? {
      price: rounded(overhead.price),
      source_combo: overhead.source_combo,
      level_type: overhead.level_type,
      basis_method: overhead.basis_method,
    } : null,
    prior_loss_same_level_today: priorLoss,
    no_repeat_after_loss_throttle: {
      rule: 'B',
      status: priorLoss ? 'BLOCKED_REPEAT_LEVEL_AFTER_LOSS' : 'clear',
      blocked: priorLoss,
    },
  };

  if (!freshUsablePrice(marketData)) {
    return {
      ...withLevel,
      state: Math.abs(distance) <= zoneDistance ? WATCHLIST_STATES.ZONE_WATCH : WATCHLIST_STATES.LEVEL_WATCH,
      required_next_condition: 'Need fresh ES market data before arming any watchlist rule.',
      suggested_research_plan: buildResearchPlan({ level: active, currentPrice, barState: null, nearestOverhead: overhead }),
    };
  }

  const stateTransitions = [
    { state: WATCHLIST_STATES.LEVEL_WATCH, timestamp_et: active.last_seen || null },
  ];
  if (Math.abs(distance) <= zoneDistance) {
    stateTransitions.push({ state: WATCHLIST_STATES.ZONE_WATCH, timestamp_et: market.timestamp || new Date(now).toISOString() });
  }

  let state = Math.abs(distance) <= zoneDistance ? WATCHLIST_STATES.ZONE_WATCH : WATCHLIST_STATES.LEVEL_WATCH;
  let required = state === WATCHLIST_STATES.ZONE_WATCH
    ? 'Need trade below level by 1-3 ES points.'
    : 'Need price within 5 ES points of a trusted level.';

  const barState = analyzeRecentBars({ bars: recentBars, levelPrice: active.price, now, config });
  const mergedTransitions = stateTransitions.concat(barState.transitions || []);
  if (barState.state) {
    state = barState.state;
    required = barState.required_next_condition;
  }

  const features = {
    time_of_day_bucket_v3: timeOfDayBucket(market.timestamp || new Date(now).toISOString()),
    two_closes_above_level: barState.two_closes_above_level === true,
    three_closes_above_level: barState.three_closes_above_level === true,
    reclaim_range_not_excessive: barState.reclaim_range_not_excessive === true,
    next_trusted_target_distance: targetSpace,
    next_trusted_target_at_least_3: Number.isFinite(targetSpace) && targetSpace >= 3,
    next_trusted_target_at_least_4: Number.isFinite(targetSpace) && targetSpace >= 4,
    no_trusted_level_within_2_above: Number.isFinite(targetSpace) ? targetSpace >= 2 : false,
    bobby_heatmap_target_present: Number.isFinite(bobbyTargetDistance) && bobbyTargetDistance > 0,
    bobby_target_distance: bobbyTargetDistance,
    sweep_depth_bucket: barState.sweep_depth_bucket || 'unknown',
    time_below_bucket: barState.time_below_bucket || 'unknown',
  };

  let ruleCandidates = [];
  let selected = null;
  if (barState.phase === 'reclaimed') {
    ruleCandidates = buildRuleCandidates(features, priorLoss);
    selected = chooseCandidate(ruleCandidates);
    if (selected) {
      state = selected.state;
      required = selected.blocked
        ? 'Rule B no-repeat-after-loss throttle blocks this level today.'
        : 'Manual visual review only; rules remain WATCHLIST_ONLY.';
      mergedTransitions.push({ state, timestamp_et: market.timestamp || new Date(now).toISOString(), rule_id: selected.id, status: selected.status });
    } else if (!Number.isFinite(targetSpace) || targetSpace < 3) {
      state = WATCHLIST_STATES.WATCH_ONLY;
      required = 'Need at least 3 ES points of target space above.';
    }
  }

  return {
    ...withLevel,
    state,
    rule_candidate: selected?.id || 'none',
    rule_candidates: ruleCandidates,
    required_next_condition: required,
    target_features: features,
    breakdown: {
      timestamp_et: barState.breakdown_timestamp_et || null,
      reclaim_timestamp_et: barState.reclaim_timestamp_et || null,
      breakdown_depth_points: barState.breakdown_depth_points ?? null,
      sweep_depth_bucket: barState.sweep_depth_bucket || 'unknown',
      sweep_low: barState.sweep_low ?? null,
      minutes_below_level: barState.minutes_below_level ?? null,
      time_below_bucket: barState.time_below_bucket || 'unknown',
      reclaim_range: barState.reclaim_range ?? null,
      reclaim_range_not_excessive: barState.reclaim_range_not_excessive === true,
    },
    suggested_research_plan: buildResearchPlan({ level: active, currentPrice, barState, nearestOverhead: overhead }),
    state_transitions: mergedTransitions,
  };
}

module.exports = {
  WATCHLIST_STATES,
  RULE_STATUS,
  buildFakeBreakdownLiveWatchlist,
  normalizeLevels,
  analyzeRecentBars,
  buildRuleCandidates,
  hasPriorLossAtLevel,
  summarizeMarketData,
  freshUsablePrice,
  todayEt,
  _internal: {
    rounded,
    sourceFromMention,
    sourceComboFromMentions,
    sameLevel,
    nearestLevel,
    nearestAbove,
  },
};
