'use strict';

const DEFAULT_OPTIONS = {
  tickSize: 0.25,
  acceptanceBars: 3,
  minCloseAboveLevelPoints: 0.25,
  minFlushDepthPoints: 1.0,
  highConfluenceFlushDepthPoints: 2.0,
  minPriorTapGroups: 3,
  highConfluencePriorTapGroups: 5,
  tapTolerancePoints: 0.5,
  maxFlushWindowBars: 45,
  liveLevelWindowPoints: 400,
  superTriggerWindowMinutes: 60,
  actionableFreshMinutes: 5,
  rthStartMinute: 9 * 60 + 30,
  watchStartMinute: 9 * 60 + 45,
  rthEndMinute: 16 * 60,
};

function normalizeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    tickSize: Number(options.tickSize ?? DEFAULT_OPTIONS.tickSize),
  };
}

function roundToTick(value, tickSize = DEFAULT_OPTIONS.tickSize) {
  return Math.round(Number(value) / tickSize) * tickSize;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeLevels(levels, options = {}) {
  const cfg = normalizeOptions(options);
  return [...new Set((levels || [])
    .map(level => {
      if (typeof level === 'number') return level;
      return Number(level?.price);
    })
    .filter(Number.isFinite)
    .map(price => roundToTick(price, cfg.tickSize)))]
    .sort((a, b) => a - b);
}

function sortedCandles(candles) {
  return [...(candles || [])]
    .filter(bar => bar && bar.timestamp && [bar.open, bar.high, bar.low, bar.close].every(isFiniteNumber))
    .map(bar => ({
      ...bar,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
    }))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function etParts(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    const fallback = String(timestamp || '');
    return {
      date: fallback.slice(0, 10),
      hour: Number(fallback.slice(11, 13)),
      minute: Number(fallback.slice(14, 16)),
    };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function minuteOfDay(timestamp) {
  const parts = etParts(timestamp);
  return parts.hour * 60 + parts.minute;
}

function touchedLevel(bar, level, cfg) {
  return Boolean(bar && bar.low <= level + cfg.tapTolerancePoints && bar.high >= level - cfg.tickSize);
}

function priorTouchGroups(bars, index, level, cfg) {
  let groups = 0;
  let wasTouching = false;
  for (let i = 0; i < index; i += 1) {
    const touching = touchedLevel(bars[i], level, cfg);
    if (touching && !wasTouching) groups += 1;
    wasTouching = touching;
  }
  return groups;
}

function heldAbove(bars, index, level, cfg) {
  for (let offset = 0; offset < cfg.acceptanceBars; offset += 1) {
    const bar = bars[index - offset];
    if (!bar || bar.close < level + cfg.minCloseAboveLevelPoints) return false;
  }
  return true;
}

function dumpContext(bars, index, level, cfg) {
  const start = Math.max(1, index - cfg.maxFlushWindowBars);
  let sawAbove = false;
  let highSinceAbove = -Infinity;
  let best = null;

  for (let i = start; i <= index; i += 1) {
    const bar = bars[i];
    if (!bar) continue;
    if (bar.high >= level + cfg.tickSize) {
      sawAbove = true;
      highSinceAbove = Math.max(highSinceAbove, bar.high);
    }
    if (!sawAbove || bar.low > level - cfg.minFlushDepthPoints) continue;
    const flushDepth = round2(level - bar.low);
    const dumpMove = round2(highSinceAbove - bar.low);
    if (!best || flushDepth > best.flush_depth_points) {
      best = {
        flush_index: i,
        flush_timestamp: bar.timestamp,
        bars_since_flush: index - i,
        flush_depth_points: flushDepth,
        dump_move_points: dumpMove,
      };
    }
  }
  return best;
}

function classifyTrigger({ timestamp, priorTapGroups, flushDepthPoints, repeatCount }, cfg) {
  const minute = minuteOfDay(timestamp);
  const reasons = [];
  if (minute >= cfg.watchStartMinute) reasons.push('after_0945_et');
  if (priorTapGroups >= cfg.highConfluencePriorTapGroups) reasons.push(`${cfg.highConfluencePriorTapGroups}+_prior_tap_groups`);
  if (flushDepthPoints >= cfg.highConfluenceFlushDepthPoints) reasons.push(`${cfg.highConfluenceFlushDepthPoints}+_es_point_flush`);
  if (repeatCount >= 2) reasons.push('same_level_repeat_cluster');

  let tier = 'MANCINI_ACCEPTANCE_WATCH';
  if (
    minute >= cfg.watchStartMinute
    && priorTapGroups >= cfg.highConfluencePriorTapGroups
    && flushDepthPoints >= cfg.highConfluenceFlushDepthPoints
  ) {
    tier = 'MANCINI_HIGH_CONFLUENCE_CALL';
  }
  if (repeatCount >= 2 && tier !== 'MANCINI_HIGH_CONFLUENCE_CALL') {
    tier = 'MANCINI_SUPER_TRIGGER_WATCH';
  }

  return { tier, reasons };
}

function buildRawTriggers(candles, levels, options = {}) {
  const cfg = normalizeOptions(options);
  const bars = sortedCandles(candles);
  const prices = normalizeLevels(levels, cfg);
  const triggers = [];

  for (let i = Math.max(1, cfg.acceptanceBars - 1); i < bars.length; i += 1) {
    const bar = bars[i];
    const minute = minuteOfDay(bar.timestamp);
    if (minute < cfg.rthStartMinute || minute > cfg.rthEndMinute) continue;

    let chosen = null;
    for (const level of prices) {
      if (Math.abs(level - bar.close) > cfg.liveLevelWindowPoints) continue;
      if (!heldAbove(bars, i, level, cfg)) continue;
      if (heldAbove(bars, i - 1, level, cfg)) continue;
      const dump = dumpContext(bars, i, level, cfg);
      if (!dump) continue;
      const priorTaps = priorTouchGroups(bars, i, level, cfg);
      if (priorTaps < cfg.minPriorTapGroups) continue;
      if (!chosen || level > chosen.level) {
        chosen = {
          level,
          dump,
          prior_tap_groups: priorTaps,
        };
      }
    }
    if (!chosen) continue;

    const acceptedAt = bar.timestamp;
    const trigger = {
      date: etParts(acceptedAt).date,
      signal_timestamp: acceptedAt,
      signal_index: i,
      level: chosen.level,
      entry_reference: round2(chosen.level + Math.max(cfg.minCloseAboveLevelPoints, cfg.tickSize)),
      close_at_signal: round2(bar.close),
      prior_tap_groups: chosen.prior_tap_groups,
      flush_timestamp: chosen.dump.flush_timestamp,
      bars_since_flush: chosen.dump.bars_since_flush,
      flush_depth_points: chosen.dump.flush_depth_points,
      dump_move_points: chosen.dump.dump_move_points,
      acceptance_bars: cfg.acceptanceBars,
      source: 'mancini_acceptance_detector',
      is_replay_safe: true,
      no_lookahead: true,
    };
    triggers.push({
      ...trigger,
      ...classifyTrigger({
        timestamp: acceptedAt,
        priorTapGroups: trigger.prior_tap_groups,
        flushDepthPoints: trigger.flush_depth_points,
        repeatCount: 1,
      }, cfg),
    });
  }

  return triggers;
}

function sameCluster(previous, current, cfg) {
  if (!previous || !current) return false;
  if (previous.date !== current.date) return false;
  if (Math.abs(previous.level - current.level) > cfg.tickSize / 2) return false;
  return minuteOfDay(current.signal_timestamp) - minuteOfDay(previous.signal_timestamp) <= cfg.superTriggerWindowMinutes;
}

function clusterTriggers(rawTriggers, options = {}) {
  const cfg = normalizeOptions(options);
  const clusters = [];
  const sorted = [...(rawTriggers || [])].sort((a, b) => a.signal_timestamp.localeCompare(b.signal_timestamp));
  let current = [];

  function flushCluster() {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    const maxPriorTaps = Math.max(...current.map(row => row.prior_tap_groups));
    const maxFlushDepth = Math.max(...current.map(row => row.flush_depth_points));
    const classification = classifyTrigger({
      timestamp: last.signal_timestamp,
      priorTapGroups: maxPriorTaps,
      flushDepthPoints: maxFlushDepth,
      repeatCount: current.length,
    }, cfg);
    clusters.push({
      ...last,
      ...classification,
      first_signal_timestamp: first.signal_timestamp,
      last_signal_timestamp: last.signal_timestamp,
      repeat_count: current.length,
      cluster_duration_minutes: minuteOfDay(last.signal_timestamp) - minuteOfDay(first.signal_timestamp),
      max_prior_tap_groups: maxPriorTaps,
      max_flush_depth_points: round2(maxFlushDepth),
      raw_signal_timestamps: current.map(row => row.signal_timestamp),
    });
  }

  for (const trigger of sorted) {
    const anchor = current[0];
    if (!anchor || sameCluster(anchor, trigger, cfg)) {
      current.push(trigger);
    } else {
      flushCluster();
      current = [trigger];
    }
  }
  flushCluster();
  return clusters;
}

function detectManciniTriggers({ candles, levels, options = {} }) {
  const cfg = normalizeOptions(options);
  const rawTriggers = buildRawTriggers(candles, levels, cfg);
  const clusters = clusterTriggers(rawTriggers, cfg);
  const latestCandle = sortedCandles(candles).at(-1) || null;
  const latestMinute = latestCandle ? minuteOfDay(latestCandle.timestamp) : null;
  const latestActionable = [...clusters].reverse().find(trigger => {
    if (!Number.isFinite(latestMinute)) return false;
    return minuteOfDay(trigger.last_signal_timestamp) >= latestMinute - cfg.actionableFreshMinutes;
  }) || null;

  return {
    generated_at: new Date().toISOString(),
    options: cfg,
    raw_triggers: rawTriggers,
    triggers: clusters,
    latest_actionable: latestActionable,
    summary: summarizeTriggers(clusters),
  };
}

function summarizeTriggers(triggers) {
  const rows = triggers || [];
  const byTier = {};
  for (const row of rows) {
    byTier[row.tier] = (byTier[row.tier] || 0) + 1;
  }
  return {
    triggers: rows.length,
    high_confluence: byTier.MANCINI_HIGH_CONFLUENCE_CALL || 0,
    super_trigger_watch: byTier.MANCINI_SUPER_TRIGGER_WATCH || 0,
    acceptance_watch: byTier.MANCINI_ACCEPTANCE_WATCH || 0,
    by_tier: byTier,
  };
}

function formatDiscordSignal(signal) {
  if (!signal) return 'No fresh Mancini trigger.';
  const line1 = `${signal.tier}: ES reclaimed ${signal.level.toFixed(2)} after ${signal.flush_depth_points.toFixed(2)}pt flush`;
  const line2 = `accepted ${signal.acceptance_bars}m | taps ${signal.max_prior_tap_groups || signal.prior_tap_groups} | repeats ${signal.repeat_count || 1}`;
  const line3 = `signal ${signal.last_signal_timestamp || signal.signal_timestamp} | entry ref ${signal.entry_reference.toFixed(2)}`;
  return `${line1}\n${line2}\n${line3}`;
}

module.exports = {
  DEFAULT_OPTIONS,
  detectManciniTriggers,
  buildRawTriggers,
  clusterTriggers,
  formatDiscordSignal,
  normalizeLevels,
  _internal: {
    etParts,
    minuteOfDay,
    priorTouchGroups,
    dumpContext,
    heldAbove,
    classifyTrigger,
    roundToTick,
  },
};
