'use strict';

const { tsMs } = require('../common');

const STATES = Object.freeze({
  LEVEL_WATCH: 'LEVEL_WATCH',
  ZONE_WATCH: 'ZONE_WATCH',
  BREAKDOWN_DETECTED: 'BREAKDOWN_DETECTED',
  RECLAIM_WATCH: 'RECLAIM_WATCH',
  ARMED: 'ARMED',
  TRADEABLE: 'TRADEABLE',
  INVALIDATED: 'INVALIDATED',
  EXPIRED: 'EXPIRED',
});

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function minutesBetween(from, to) {
  const a = tsMs(from);
  const b = tsMs(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function stateEvent(state, timestamp_et, details = {}) {
  return { state, timestamp_et: timestamp_et || null, ...details };
}

function findZoneWatchTimestamp({ setup, bars = [], zoneDistance = 5 }) {
  const level = setup?.executable_level;
  const end = tsMs(setup?.breakdown_timestamp_et || setup?.timestamp_et);
  if (!Number.isFinite(level) || !Number.isFinite(end)) return null;
  const candidates = bars.filter(bar => {
    const t = tsMs(bar.timestamp);
    if (!Number.isFinite(t) || t > end) return false;
    return bar.low <= level + zoneDistance && bar.high >= level - zoneDistance;
  });
  return candidates[0]?.timestamp || null;
}

function firstCloseBelowAfterReclaim({ setup, bars = [], untilTimestamp }) {
  const level = setup?.executable_level;
  const start = tsMs(setup?.reclaim_timestamp);
  const end = tsMs(untilTimestamp);
  if (!Number.isFinite(level) || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  return (bars || []).find(bar => {
    const t = tsMs(bar.timestamp);
    return Number.isFinite(t) && t > start && t < end && bar.close < level;
  }) || null;
}

function transitionOrderValid(events) {
  let prior = -Infinity;
  for (const event of events || []) {
    if (!event.timestamp_et) continue;
    const t = tsMs(event.timestamp_et);
    if (!Number.isFinite(t)) return false;
    if (t < prior) return false;
    prior = t;
  }
  return true;
}

function buildStateTimeline({ setup, observation, bars = [], rule, tradePlan, zoneDistance = 5 }) {
  const levelWatchAt = setup?.source_freshness?.available_at_et || setup?.timestamp_et;
  const zoneWatchAt = findZoneWatchTimestamp({ setup, bars, zoneDistance });
  const invalidationBar = firstCloseBelowAfterReclaim({
    setup,
    bars,
    untilTimestamp: observation?.entry_timestamp_et,
  });
  const invalidBeforeArmed = Boolean(invalidationBar);
  const hardInvalid = tradePlan?.classification === 'PASS' || invalidBeforeArmed;
  const tradeable = ['2ES_FULL', '1ES_STARTER', '1ES_ADD_LATER'].includes(tradePlan?.classification);
  const events = [
    stateEvent(STATES.LEVEL_WATCH, levelWatchAt, {
      source_combo: setup?.source_combo,
      next_target_above: setup?.next_trusted_level_above ?? observation?.next_trusted_target_distance ?? null,
    }),
    stateEvent(STATES.ZONE_WATCH, zoneWatchAt, {
      zone_distance_points: zoneDistance,
      no_overhead_within_2: observation?.no_trusted_level_within_2_above === true,
    }),
    stateEvent(STATES.BREAKDOWN_DETECTED, setup?.breakdown_timestamp_et || setup?.timestamp_et, {
      breakdown_depth: setup?.breakdown_depth_actual ?? observation?.breakdown_depth,
      sweep_bucket: observation?.sweep_depth_bucket,
    }),
    stateEvent(STATES.RECLAIM_WATCH, setup?.reclaim_timestamp, {
      minutes_below_level: setup?.minutes_below_level ?? observation?.minutes_below_level,
      reclaim_range_not_excessive: observation?.reclaim_range_not_excessive === true,
    }),
  ];

  if (invalidBeforeArmed) {
    events.push(stateEvent(STATES.INVALIDATED, invalidationBar.timestamp, {
      reason: 'close_back_below_reclaimed_level_before_armed',
      classification: 'PASS',
    }));
    return {
      events,
      order_valid: transitionOrderValid(events),
      level_watch_lead_minutes: null,
      zone_watch_lead_minutes: null,
      watch_to_tradeable_minutes: null,
      breakdown_to_reclaim_minutes: minutesBetween(setup?.breakdown_timestamp_et || setup?.timestamp_et, setup?.reclaim_timestamp),
      reclaim_to_armed_minutes: null,
      invalid_before_armed: true,
    };
  }

  events.push(stateEvent(STATES.ARMED, observation?.entry_timestamp_et, {
    rule_id: rule?.id,
    entry_model: observation?.entry_model,
    pre_entry_uses: rule?.uses || [],
  }));

  if (tradeable) {
    events.push(stateEvent(STATES.TRADEABLE, observation.entry_timestamp_et, {
      classification: tradePlan.classification,
      entry_price: observation.entry_price,
      stop_price: observation.stop_price,
      stop_points: observation.stop_points,
      tp1: observation.tp1,
      tp3: observation.tp3,
    }));
  } else if (hardInvalid) {
    events.push(stateEvent(STATES.INVALIDATED, invalidationBar?.timestamp || observation?.entry_timestamp_et, {
      reason: tradePlan?.reason,
      classification: tradePlan?.classification || 'PASS',
    }));
  } else {
    events.push(stateEvent(STATES.EXPIRED, observation?.entry_timestamp_et, {
      reason: tradePlan?.reason || 'armed_but_not_tradeable',
      classification: tradePlan?.classification || 'WATCH_ONLY',
    }));
  }

  return {
    events,
    order_valid: transitionOrderValid(events),
    level_watch_lead_minutes: tradeable ? minutesBetween(levelWatchAt, observation.entry_timestamp_et) : null,
    zone_watch_lead_minutes: tradeable ? minutesBetween(zoneWatchAt, observation.entry_timestamp_et) : null,
    watch_to_tradeable_minutes: tradeable ? minutesBetween(levelWatchAt, observation.entry_timestamp_et) : null,
    breakdown_to_reclaim_minutes: minutesBetween(setup?.breakdown_timestamp_et || setup?.timestamp_et, setup?.reclaim_timestamp),
    reclaim_to_armed_minutes: minutesBetween(setup?.reclaim_timestamp, observation?.entry_timestamp_et),
    invalid_before_armed: invalidBeforeArmed,
  };
}

module.exports = {
  STATES,
  rounded,
  minutesBetween,
  stateEvent,
  findZoneWatchTimestamp,
  firstCloseBelowAfterReclaim,
  transitionOrderValid,
  buildStateTimeline,
};
