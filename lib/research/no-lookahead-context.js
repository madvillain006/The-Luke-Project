'use strict';

const { tsMs } = require('./common');

function activeEventsAt(timelineEvents, checkpointTimestamp) {
  const checkpointMs = tsMs(checkpointTimestamp);
  if (!Number.isFinite(checkpointMs)) return [];
  return (timelineEvents || [])
    .filter(event => event.usable_for_replay)
    .filter(event => {
      const available = tsMs(event.available_at_et);
      return Number.isFinite(available) && available <= checkpointMs;
    });
}

function eventDate(event) {
  return String(event.available_at_et || event.timestamp_et || '').slice(0, 10);
}

function buildActiveSourceContext(timelineEvents, checkpointTimestamp, options = {}) {
  const checkpointDate = String(checkpointTimestamp).slice(0, 10);
  const maxAgeDays = options.maxAgeDays ?? 3;
  const checkpointMs = tsMs(checkpointTimestamp);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const active = activeEventsAt(timelineEvents, checkpointTimestamp)
    .filter(event => {
      if (event.source === 'bobby') return eventDate(event) === checkpointDate;
      if (event.tags?.includes('date_only_context')) return eventDate(event) === checkpointDate;
      const eventMs = tsMs(event.available_at_et);
      return Number.isFinite(eventMs) && checkpointMs - eventMs <= maxAgeMs;
    });

  const sourceCounts = {};
  const sourceFreshness = {};
  for (const event of active) {
    sourceCounts[event.source] = (sourceCounts[event.source] || 0) + 1;
    const prev = sourceFreshness[event.source];
    if (!prev || event.available_at_et > prev) sourceFreshness[event.source] = event.available_at_et;
  }
  return {
    checkpoint: checkpointTimestamp,
    events: active,
    source_counts: sourceCounts,
    source_freshness: sourceFreshness,
  };
}

module.exports = {
  activeEventsAt,
  buildActiveSourceContext,
};
