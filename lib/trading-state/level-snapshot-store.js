'use strict';

const fs = require('fs');
const path = require('path');
const { buildLevelClusters, normalizeInstrument } = require('./level-clusters');
const {
  SOURCE_FAMILIES,
  normalizeLevelEvent,
  normalizeSourceFamily,
  normalizeTransport,
  lifecycleForFamily,
  normalizeRole,
} = require('./source-normalization');
const { applyHeatmapLifecycle, heatmapFreshness, ageMinutesAt } = require('./heatmap-gex-lifecycle');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_TIMELINE_PATH = path.join(ROOT, 'artifacts', 'research', 'source-timeline.json');
const DAY_MS = 24 * 60 * 60 * 1000;

let timelineCache = null;

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadSourceTimeline({ timelinePath = DEFAULT_TIMELINE_PATH, cache = true } = {}) {
  if (cache && timelineCache && timelineCache.path === timelinePath) return timelineCache.value;
  const value = readJson(timelinePath, { events: [] }) || { events: [] };
  const normalized = {
    ...value,
    events: Array.isArray(value.events) ? value.events : [],
  };
  if (cache) timelineCache = { path: timelinePath, value: normalized };
  return normalized;
}

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function toMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameDate(a, b) {
  return dateKey(a) && dateKey(a) === dateKey(b);
}

function eventTimestamp(event = {}) {
  return event.available_at_et || event.timestamp_et || null;
}

function eventAvailable(event = {}, timestamp) {
  const eventMs = toMs(eventTimestamp(event));
  const timestampMs = toMs(timestamp);
  return Number.isFinite(eventMs) && Number.isFinite(timestampMs) && eventMs <= timestampMs;
}

function freshnessMinutes(event = {}, timestamp) {
  const ts = eventTimestamp(event);
  return ageMinutesAt(ts, timestamp);
}

function eventDayAge(event = {}, timestamp) {
  const eventMs = toMs(eventTimestamp(event));
  const timestampMs = toMs(timestamp);
  if (!Number.isFinite(eventMs) || !Number.isFinite(timestampMs)) return null;
  return Math.floor(Math.max(0, timestampMs - eventMs) / DAY_MS);
}

function enrichEvent(event = {}) {
  const family = normalizeSourceFamily(event.source, event);
  const transport = normalizeTransport(event.source, event);
  return {
    ...event,
    source_family: family,
    transport,
    lifecycle: lifecycleForFamily(family),
  };
}

function sameDayCallout(event, timestamp) {
  return sameDate(eventTimestamp(event), timestamp) && freshnessMinutes(event, timestamp) <= 390;
}

function structuralAllowed(event, timestamp) {
  if (sameDate(eventTimestamp(event), timestamp)) return true;
  const ageDays = eventDayAge(event, timestamp);
  return Number.isFinite(ageDays) && ageDays <= 5;
}

function eventAllowedByLifecycle(event, timestamp, hasParsedHeatmap) {
  const family = event.source_family || normalizeSourceFamily(event.source, event);
  if (!eventAvailable(event, timestamp)) return false;
  if (event.usable_for_replay === false) return false;
  if (!Array.isArray(event.levels) || !event.levels.some(level => Number.isFinite(Number(level.price)))) return false;

  if (family === SOURCE_FAMILIES.SATY) return sameDate(eventTimestamp(event), timestamp);
  if (family === SOURCE_FAMILIES.MANCINI) return structuralAllowed(event, timestamp);
  if (family === SOURCE_FAMILIES.DUBZ_STRUCTURAL) return structuralAllowed(event, timestamp);
  if (family === SOURCE_FAMILIES.DUBZ_CALLOUT) return sameDayCallout(event, timestamp);
  if (family === SOURCE_FAMILIES.KATBOT_CONTEXT) return !hasParsedHeatmap && sameDayCallout(event, timestamp);
  if (family === SOURCE_FAMILIES.MARKET_DATA) return false;
  if (family === SOURCE_FAMILIES.HEATMAP_GEX) return true;
  return sameDate(eventTimestamp(event), timestamp);
}

function latestEventKey(event = {}) {
  return `${event.source_family || event.source}:${event.instrument || 'unknown'}:${dateKey(eventTimestamp(event))}:${event.source_type || 'unknown'}`;
}

function keepLatestStructuralEvents(events = []) {
  const latest = new Map();
  const passthrough = [];
  for (const event of events) {
    const family = event.source_family || normalizeSourceFamily(event.source, event);
    if ([SOURCE_FAMILIES.SATY, SOURCE_FAMILIES.MANCINI, SOURCE_FAMILIES.DUBZ_STRUCTURAL, SOURCE_FAMILIES.DUBZ_CALLOUT].includes(family)) {
      const key = latestEventKey(event);
      const current = latest.get(key);
      if (!current || toMs(eventTimestamp(event)) >= toMs(eventTimestamp(current))) latest.set(key, event);
    } else {
      passthrough.push(event);
    }
  }
  return [...latest.values(), ...passthrough];
}

function levelToRow(event = {}, level = {}, timestamp) {
  const enriched = normalizeLevelEvent(event, level);
  const family = enriched.source_family;
  const instrument = normalizeInstrument(level.instrument || level.ticker || event.instrument || 'ES');
  const price = Number(level.price);
  if (!Number.isFinite(price)) return null;
  const transport = event.transport || enriched.transport || 'unknown';
  const transports = Array.isArray(event.transports) && event.transports.length
    ? [...new Set(event.transports)].sort()
    : [transport];
  const executable = instrument === 'ES';
  const age = freshnessMinutes(event, timestamp);
  const heatmapStatus = family === SOURCE_FAMILIES.HEATMAP_GEX
    ? heatmapFreshness(eventTimestamp(event), timestamp)
    : null;
  return {
    id: `snapshot:${event.id || 'event'}:${instrument}:${price}:${level.role || level.label || 'level'}`,
    instrument,
    executable_instrument: executable ? 'ES' : null,
    canonical_price_es: executable ? price : null,
    original_price: price,
    original_instrument: instrument,
    source: family,
    source_family: family,
    sources: [family],
    source_families: [family],
    transport,
    transports,
    lifecycle: event.lifecycle || lifecycleForFamily(family),
    roles: [normalizeRole(level.role || level.label || event.source_type)],
    freshness: age,
    freshness_status: heatmapStatus?.status || (Number.isFinite(age) ? (age <= 120 ? 'fresh' : 'aging') : 'unknown'),
    available_at_et: event.available_at_et || null,
    timestamp_et: event.timestamp_et || null,
    basis_method: executable ? 'native_es' : 'reference_only',
    is_executable_es: executable,
    is_reference_only: !executable,
    is_chop_or_veto: normalizeRole(level.role || level.label).includes('chop'),
    confidence: event.confidence === 'low' ? 'D' : 'B',
    original: { event_id: event.id, source_type: event.source_type, level },
    evidence: [{
      source: family,
      transport,
      transports,
      role: normalizeRole(level.role || level.label || event.source_type),
      timestamp: event.available_at_et || event.timestamp_et || null,
      snippet: level.label || event.commentary?.slice?.(0, 180) || null,
    }],
  };
}

function sourceCounts(rows = []) {
  const counts = {};
  for (const row of rows) counts[row.source_family || row.source || 'unknown'] = (counts[row.source_family || row.source || 'unknown'] || 0) + 1;
  return counts;
}

function sourceHealth({ rows = [], staleHeatmaps = [], supersededHeatmaps = [] } = {}) {
  const families = Object.values(SOURCE_FAMILIES);
  const health = {};
  for (const family of families) {
    const familyRows = rows.filter(row => row.source_family === family);
    health[family] = {
      loaded: familyRows.length > 0,
      count: familyRows.length,
      freshness_minutes: familyRows.length ? Math.min(...familyRows.map(row => row.freshness).filter(Number.isFinite), 999999) : null,
      stale_count: family === SOURCE_FAMILIES.HEATMAP_GEX ? staleHeatmaps.length : 0,
      superseded_count: family === SOURCE_FAMILIES.HEATMAP_GEX ? supersededHeatmaps.length : 0,
    };
  }
  return health;
}

function dedupeRows(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.instrument}:${row.original_price}:${row.source_family}:${row.transport}:${row.available_at_et}:${row.roles?.join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function buildLevelSnapshot({
  timestamp,
  instrument = 'ES',
  events = null,
  timelinePath = DEFAULT_TIMELINE_PATH,
  now = null,
} = {}) {
  const normalized = normalizeInstrument(instrument);
  const asOf = timestamp || now?.toISOString?.() || new Date().toISOString();
  if (!Number.isFinite(toMs(asOf))) {
    return {
      ok: false,
      timestamp_et: asOf,
      instrument: normalized,
      active_levels: [],
      active_clusters: [],
      rows: [],
      source_counts: {},
      source_health: {},
      stale_sources: [],
      superseded_sources: [],
      warnings: ['invalid snapshot timestamp'],
    };
  }

  const timeline = events ? { events } : loadSourceTimeline({ timelinePath });
  const enriched = (timeline.events || []).map(enrichEvent);
  const heatmaps = enriched.filter(event => {
    const family = event.source_family || normalizeSourceFamily(event.source, event);
    return family === SOURCE_FAMILIES.HEATMAP_GEX && eventAvailable(event, asOf) && event.usable_for_replay !== false;
  });
  const heatmapLifecycle = applyHeatmapLifecycle(heatmaps, asOf);
  const hasParsedHeatmap = heatmapLifecycle.active.length > 0;

  const allowed = [
    ...keepLatestStructuralEvents(enriched.filter(event => {
      const family = event.source_family || normalizeSourceFamily(event.source, event);
      if (family === SOURCE_FAMILIES.HEATMAP_GEX) return false;
      return eventAllowedByLifecycle(event, asOf, hasParsedHeatmap);
    })),
    ...heatmapLifecycle.active,
  ];

  const rows = dedupeRows(allowed.flatMap(event => (event.levels || []).map(level => levelToRow(event, level, asOf)).filter(Boolean)));
  const activeClusters = buildLevelClusters({ instrument: normalized, rows, now: new Date(asOf) });
  const warnings = [];
  if (!rows.length) warnings.push('active levels unavailable for replay timestamp; no levels fabricated');
  if (rows.some(row => row.is_reference_only)) warnings.push('SPX/reference levels are reference-only without explicit basis');
  if (heatmapLifecycle.stale.length) warnings.push('stale heatmap_gex snapshots excluded');
  if (heatmapLifecycle.superseded.length) warnings.push('superseded heatmap_gex snapshots excluded');

  return {
    ok: true,
    timestamp_et: asOf,
    instrument: normalized,
    active_levels: rows.map(row => ({
      id: row.id,
      instrument: row.original_instrument,
      executable_instrument: row.executable_instrument,
      price: row.original_price,
      canonical_price_es: row.canonical_price_es,
      source_family: row.source_family,
      transport: row.transport,
      transports: row.transports,
      lifecycle: row.lifecycle,
      freshness: row.freshness,
      freshness_status: row.freshness_status,
      role: row.roles?.[0] || 'level',
      is_executable_es: row.is_executable_es,
      is_reference_only: row.is_reference_only,
      available_at_et: row.available_at_et,
      basis_method: row.basis_method,
    })),
    active_clusters: activeClusters,
    rows,
    source_counts: sourceCounts(rows),
    source_health: sourceHealth({
      rows,
      staleHeatmaps: heatmapLifecycle.stale,
      supersededHeatmaps: heatmapLifecycle.superseded,
    }),
    stale_sources: heatmapLifecycle.stale.map(event => ({
      id: event.id,
      source_family: SOURCE_FAMILIES.HEATMAP_GEX,
      transport: event.transport,
      transports: event.transports || [event.transport].filter(Boolean),
      duplicate_ids: event.duplicate_ids || [event.id].filter(Boolean),
      available_at_et: event.available_at_et || event.timestamp_et,
      freshness: event.freshness,
    })),
    superseded_sources: heatmapLifecycle.superseded.map(event => ({
      id: event.id,
      source_family: SOURCE_FAMILIES.HEATMAP_GEX,
      transport: event.transport,
      transports: event.transports || [event.transport].filter(Boolean),
      duplicate_ids: event.duplicate_ids || [event.id].filter(Boolean),
      available_at_et: event.available_at_et || event.timestamp_et,
      superseded_by: event.superseded_by,
    })),
    warnings,
  };
}

module.exports = {
  DEFAULT_TIMELINE_PATH,
  loadSourceTimeline,
  buildLevelSnapshot,
  _internal: {
    dateKey,
    toMs,
    eventAllowedByLifecycle,
    levelToRow,
    dedupeRows,
    keepLatestStructuralEvents,
  },
};
