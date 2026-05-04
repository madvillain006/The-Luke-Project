'use strict';

const crypto = require('crypto');

function ageMinutesAt(timestamp, asOf) {
  const then = Date.parse(timestamp);
  const now = Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.round((now - then) / 60000));
}

function heatmapFreshness(timestamp, asOf, policy = {}) {
  const freshMinutes = Number.isFinite(policy.freshMinutes) ? policy.freshMinutes : 60;
  const agingMinutes = Number.isFinite(policy.agingMinutes) ? policy.agingMinutes : 120;
  const age = ageMinutesAt(timestamp, asOf);
  if (!Number.isFinite(age)) return { status: 'unknown', age_minutes: null, active: false };
  if (age <= freshMinutes) return { status: 'fresh', age_minutes: age, active: true };
  if (age <= agingMinutes) return { status: 'aging', age_minutes: age, active: true };
  return { status: 'stale', age_minutes: age, active: false };
}

function snapshotHash(event = {}) {
  const levels = (event.levels || [])
    .map(level => `${Number(level.price)}:${String(level.role || level.label || '')}`)
    .sort()
    .join('|');
  return crypto.createHash('sha1')
    .update(`${event.instrument || 'unknown'}|${levels}`)
    .digest('hex')
    .slice(0, 12);
}

function dedupeHeatmapSnapshots(events = []) {
  const seen = new Set();
  const out = [];
  for (const event of events) {
    const key = `${event.transport || 'unknown'}:${snapshotHash(event)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...event, snapshot_hash: snapshotHash(event) });
  }
  return out;
}

function applyHeatmapLifecycle(events = [], asOf, policy = {}) {
  const sorted = dedupeHeatmapSnapshots(events)
    .slice()
    .sort((a, b) => Date.parse(b.available_at_et || b.timestamp_et || 0) - Date.parse(a.available_at_et || a.timestamp_et || 0));
  const latestByTransport = new Map();
  const active = [];
  const stale = [];
  const superseded = [];

  for (const event of sorted) {
    const transport = event.transport || 'unknown';
    const ts = event.available_at_et || event.timestamp_et;
    const freshness = heatmapFreshness(ts, asOf, policy);
    const normalized = { ...event, freshness };
    if (latestByTransport.has(transport)) {
      superseded.push({ ...normalized, superseded_by: latestByTransport.get(transport).id });
      continue;
    }
    latestByTransport.set(transport, normalized);
    if (freshness.active) active.push(normalized);
    else stale.push(normalized);
  }

  return { active, stale, superseded };
}

module.exports = {
  ageMinutesAt,
  heatmapFreshness,
  snapshotHash,
  dedupeHeatmapSnapshots,
  applyHeatmapLifecycle,
};
